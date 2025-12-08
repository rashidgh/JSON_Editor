<script setup>
import { ref, onMounted, nextTick, watch } from "vue";

// Use a simple textarea approach instead of Monaco (Monaco has Vite config issues)
const inputText = ref('{\n  "example": "Paste JSON here"\n}');
const outputText = ref("");
const searchTerm = ref("");
const searchResults = ref("");
const kvKey = ref("");
const kvValue = ref("");
const kvExpr = ref("");
const keysList = ref([]);
const fuzzyEnabled = ref(false);
const fuzzyThreshold = ref(2);

// Levenshtein distance (classic implementation)
const levenshteinDistance = (a, b) => {
  const as = String(a || "").split("");
  const bs = String(b || "").split("");
  const m = as.length;
  const n = bs.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = as[i - 1] === bs[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const matchedPaths = ref([]); // array of Sets per result indicating which key paths matched
const highlightedHtml = ref("");
const showHighlighted = ref(true);

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Render an object/array as HTML with matched paths highlighted
const renderValueHtml = (val, path) => {
  if (val === null) return '<span class="json-null">null</span>';
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      const items = val
        .map((it, idx) => `${renderValueHtml(it, path ? `${path}[${idx}]` : `[${idx}]`)}`)
        .join(',\n');
      return `[\n${items}\n]`;
    }
    const parts = Object.keys(val).map((k) => {
      const p = path ? `${path}.${k}` : k;
      return (`<div class="json-line"><span class="json-key">\"${escapeHtml(k)}\"</span>: ${renderValueHtml(val[k], p)}</div>`);
    });
    return `{\n${parts.join('\n')}\n}`;
  }
  // primitive
  const text = escapeHtml(String(val));
  // if this path was matched in any result, highlight
  // We'll highlight based on currently selected matchedPaths (for single-object results we use index 0)
  // But to keep it simple, highlight when the global matchedPaths contains this path anywhere
  for (const s of matchedPaths.value) {
    if (s && s.has(path)) {
      return `<span class="json-match">\"${text}\"</span>`;
    }
  }
  // default rendering for string/number/boolean
  if (typeof val === "string") return `\"${text}\"`;
  if (typeof val === "number") return `<span class="json-num">${text}</span>`;
  if (typeof val === "boolean") return `<span class="json-bool">${text}</span>`;
  return text;
};

const renderResultsHtml = (results) => {
  if (!results) return "";
  try {
    if (Array.isArray(results)) {
      const html = results
        .map((r, i) => `<div class="json-obj">${renderValueHtml(r, "")}</div>`) // matchedPaths indices correspond to results
        .join('<hr class="json-sep"/>');
      return `<pre class="json-pre">${html}</pre>`;
    }
    return `<pre class="json-pre">${renderValueHtml(results, "")}</pre>`;
  } catch (err) {
    return `<pre class="json-pre">${escapeHtml(String(results))}</pre>`;
  }
};

// Recursively collect keys (dot notation) from objects/arrays
const flattenKeys = (obj, prefix, set, maxDepth = 10) => {
  if (obj == null || maxDepth <= 0) return;

  // Check if it's a plain object (not array, not null, not primitives)
  if (typeof obj !== "object" || Array.isArray(obj)) {
    return;
  }

  // Process object properties
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    set.add(path);

    // Recurse into the value
    const val = obj[k];
    if (Array.isArray(val)) {
      // For arrays, recurse into each element
      for (const el of val) {
        flattenKeys(el, path, set, maxDepth - 1);
      }
    } else if (val != null && typeof val === "object") {
      // For nested objects, recurse with the new prefix
      flattenKeys(val, path, set, maxDepth - 1);
    }
  }
};

const updateKeysList = () => {
  try {
    const data = JSON.parse(inputText.value);
    const s = new Set();
    if (Array.isArray(data)) {
      for (const it of data) flattenKeys(it, "", s);
    } else {
      flattenKeys(data, "", s);
    }
    keysList.value = Array.from(s).sort();
    console.log("Keys found:", keysList.value);
  } catch (err) {
    keysList.value = [];
  }
};

// Load JSON file
const loadJson = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      inputText.value = JSON.stringify(parsed, null, 2);
      formatJson();
    } catch (err) {
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
};

// Format and beautify JSON
const formatJson = () => {
  try {
    const parsed = JSON.parse(inputText.value);
    outputText.value = JSON.stringify(parsed, null, 2);
    updateKeysList();
  } catch (err) {
    outputText.value = "// Invalid JSON\n" + err.message;
  }
};

// Search by dynamic key:value (e.g. city:hongkong or address.city:london)
const searchByKeyValue = () => {
  // If an expression is provided (e.g. "age>24"), use dynamic search
  if (kvExpr.value && kvExpr.value.trim()) {
    return performDynamicSearch();
  }
  if (!kvKey.value.trim()) {
    searchResults.value = "// Enter a key to search";
    return;
  }

  try {
    const data = JSON.parse(inputText.value);
    const key = kvKey.value;
    const val = String(kvValue.value || "").toLowerCase();

    const arr = Array.isArray(data) ? data : [data];
    const matched = [];
    const results = arr.filter((item) => {
      if (!item || typeof item !== "object") return false;
      // Use getValueByPath to support nested keys like address.city
      const fieldRaw = getValueByPath(item, key);
      if (fieldRaw === undefined) return false;
      if (!val) return true; // key exists
      const field = String(fieldRaw ?? "").toLowerCase();
      // Fuzzy matching option
      if (fuzzyEnabled.value) {
        const distance = levenshteinDistance(field, val);
        const ok = distance <= Number(fuzzyThreshold.value || 2);
        if (ok) matched.push(key);
        return ok;
      }
      const ok = field.includes(val);
      if (ok) matched.push(key);
      return ok;
    });
    if (results.length === 0) {
      searchResults.value =
        "// No matches found for " + key + ":" + kvValue.value;
      outputText.value = "[]";
      matchedPaths.value = [];
      highlightedHtml.value = "";
    } else {
      searchResults.value = `// ${results.length} matches`;
      outputText.value = JSON.stringify(results, null, 2);
      // populate matchedPaths: mark the selected key for each result
      matchedPaths.value = results.map(() => new Set([key]));
      highlightedHtml.value = renderResultsHtml(results);
    }
  } catch (err) {
    searchResults.value = "// Error: Invalid JSON or search failed";
  }
};

// Helper: get nested value by dot-path (e.g. "address.city")
const getValueByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

// Parse simple expressions like "age>24", "salary>=80000", "name:john"
const parseExpression = (expr) => {
  const operators = [">=", "<=", "==", "!=", ">", "<", ":", "="];
  for (const op of operators) {
    const idx = expr.indexOf(op);
    if (idx > -1) {
      const key = expr.slice(0, idx).trim();
      const val = expr.slice(idx + op.length).trim();
      return { key, op, val };
    }
  }
  return null;
};

const performDynamicSearch = () => {
  const raw = kvExpr.value.trim();
  if (!raw) {
    searchResults.value = "// Enter an expression, e.g. age>24";
    return;
  }

  const parsedExpr = parseExpression(raw);
  if (!parsedExpr || !parsedExpr.key) {
    searchResults.value = "// Invalid expression";
    return;
  }

  try {
    const data = JSON.parse(inputText.value);
    const arr = Array.isArray(data) ? data : [data];
    const { key, op, val } = parsedExpr;

    const results = arr.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const fieldRaw = getValueByPath(item, key);
      if (fieldRaw === undefined) return false;

      const fieldStr = String(fieldRaw).trim();
      const targetStr = String(val).trim();

      // remove surrounding quotes from target if provided, then normalize for string comparisons
      const unquotedTarget = targetStr.replace(/^\s*["']|["']\s*$/g, "").trim();
      const lhs = fieldStr.toLowerCase();
      const rhs = unquotedTarget.toLowerCase();

      // Numeric comparisons when both sides are numeric
      const a = Number(fieldStr);
      const b = Number(targetStr);
      const bothNumeric = !Number.isNaN(a) && !Number.isNaN(b);

      switch (op) {
        case ">":
          return bothNumeric ? a > b : fieldStr > targetStr;
        case "<":
          return bothNumeric ? a < b : fieldStr < targetStr;
        case ">=":
          return bothNumeric ? a >= b : fieldStr >= targetStr;
        case "<=":
          return bothNumeric ? a <= b : fieldStr <= targetStr;
        case "==":
        case "=":
          if (bothNumeric) return a === b;
          if (fuzzyEnabled.value) {
            return (
              levenshteinDistance(lhs, rhs) <= Number(fuzzyThreshold.value || 2)
            );
          }
          return lhs === rhs;
        case "!=":
          if (bothNumeric) return a !== b;
          if (fuzzyEnabled.value) {
            return (
              levenshteinDistance(lhs, rhs) > Number(fuzzyThreshold.value || 2)
            );
          }
          return lhs !== rhs;
        case ":":
          if (fuzzyEnabled.value) {
            return (
              levenshteinDistance(lhs, unquotedTarget.toLowerCase()) <=
              Number(fuzzyThreshold.value || 2)
            );
          }
          return fieldStr.toLowerCase().includes(unquotedTarget.toLowerCase());
        default:
          return false;
      }
    });

    if (results.length === 0) {
      searchResults.value = `// No matches for ${raw}`;
      outputText.value = "[]";
      matchedPaths.value = [];
      highlightedHtml.value = "";
    } else {
      searchResults.value = `// ${results.length} matches for ${raw}`;
      outputText.value = JSON.stringify(results, null, 2);
      // mark the parsedExpr.key as matched path for each result
      matchedPaths.value = results.map(() => new Set([key]));
      highlightedHtml.value = renderResultsHtml(results);
    }
  } catch (err) {
    searchResults.value = "// Error: Invalid JSON or search failed";
  }
};

onMounted(() => {
  // build initial keys list from default inputText
  updateKeysList();
});

// Clear search fields and restore full formatted JSON
const clearSearch = () => {
  kvExpr.value = "";
  kvKey.value = "";
  kvValue.value = "";
  searchResults.value = "";
  // restore output from inputText
  try {
    const parsed = JSON.parse(inputText.value);
    outputText.value = JSON.stringify(parsed, null, 2);
  } catch (err) {
    outputText.value = "// Invalid JSON\n" + err.message;
  }
  updateKeysList();
  matchedPaths.value = [];
  highlightedHtml.value = "";
};

// If user manually clears the expression/key/value, automatically restore full data
watch([kvExpr, kvKey, kvValue], ([e, k, v]) => {
  if (
    (!e || e.trim() === "") &&
    (!k || k.trim() === "") &&
    (!v || v.trim() === "")
  ) {
    // small debounce to avoid rapid calls
    setTimeout(() => {
      try {
        const parsed = JSON.parse(inputText.value);
        outputText.value = JSON.stringify(parsed, null, 2);
        searchResults.value = "";
      } catch (err) {
        // leave output as-is if input invalid
      }
    }, 120);
  }
});
</script>
<template>
  <div class="container">
    <!-- LEFT: INPUT JSON -->
    <div class="editor-panel">
      <h2>Input JSON</h2>
      <input type="file" accept="application/json" @change="loadJson" />
      <textarea
        v-model="inputText"
        @input="formatJson"
        class="editor-area"
        placeholder="Upload JSON or paste here..."
      ></textarea>
    </div>

    <!-- MIDDLE: Key:Value / Expression Search -->
    <div class="kv-panel">
      <h2>Search (expressions or key:value)</h2>
      <!-- Expression input -->
      <input
        v-model="kvExpr"
        class="kv-input kv-expr"
        placeholder="Expression e.g. age>24   (operators: >, <, >=, <=, =, !=, :)"
      />

      <div class="kv-form">
        <select v-model="kvKey" class="kv-input kv-select">
          <option value="">-- select key --</option>
          <option v-for="k in keysList" :key="k" :value="k">{{ k }}</option>
        </select>
        <span class="kv-sep">:</span>
        <input
          v-model="kvValue"
          class="kv-input"
          placeholder="value (e.g. hongkong)"
        />
      </div>
      <div class="input-help input-help-margin">
        Keys available: {{ keysList.length }}
      </div>

      <div class="kv-options">
        <label class="fuzzy-label">
          <input type="checkbox" v-model="fuzzyEnabled" />
          <span class="fuzzy-text">Fuzzy</span>
        </label>
        <label class="distance-label">
          <input
            type="number"
            v-model.number="fuzzyThreshold"
            min="0"
            class="distance-input"
          />
          <span class="distance-text">max distance</span>
        </label>
        <div class="kv-buttons">
          <button @click="searchByKeyValue" class="kv-btn">Search</button>
          <button @click.prevent="clearSearch" class="btn-secondary">
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT: OUTPUT JSON -->
    <div class="editor-panel">
      <h2>Output JSON (Formatted)</h2>
      <textarea
        v-model="outputText"
        class="editor-area"
        placeholder="Formatted output will appear here..."
      ></textarea>
    </div>
  </div>
</template>


<style scoped>
/* Main layout */
.container {
  display: flex;
  gap: 20px;
  padding: 20px;
  height: 90vh;
  background: #121212;
  box-sizing: border-box;
  overflow-x: hidden; /* prevent horizontal scroll */
}

/* Make component responsive and avoid overflow from fixed min-widths */
.top-search {
  flex-wrap: wrap;
}
.search-input-top {
  min-width: 0;
}
.distance-input {
  min-width: 0;
}
.place-checkbox {
  min-width: 0;
}
.top-result {
  max-width: 30vw;
}

/* Each side panel */
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  padding: 15px;
  border-radius: 8px;
  min-height: 0;
  overflow: hidden;
  height: 80%;
}

/* Textarea editor styling */
.editor-area {
  flex: 1;
  width: 100%;
  background: #252526;
  color: #d4d4d4;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  font-family: "Monaco", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  overflow: auto;
  margin-top: 10px;
}

.editor-area:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
}

.editor-area::placeholder {
  color: #888;
}

/* General form controls */
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  color: #dcdcdc;
  font-size: 13px;
  margin-bottom: 6px;
}

.form-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

input[type="text"],
input[type="number"],
textarea,
select {
  background: #0f0f10;
  color: #e6e6e6;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  transition: box-shadow 120ms ease, border-color 120ms ease;
}

select {
  appearance: none;
  -webkit-appearance: none;
}

input[type="text"]:focus,
input[type="number"]:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: rgba(13, 110, 253, 0.9);
  box-shadow: 0 6px 20px rgba(13, 110, 253, 0.06);
}

/* Buttons */
.btn-primary {
  background: linear-gradient(180deg, #2b81ff, #0d6efd);
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.btn-secondary {
  background: #695e5e;
  color: #e6e6e6;
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  width: 84%;
}

.input-help {
  color: #9aa4b2;
  font-size: 12px;
}

/* KV panel (between editors) */
.kv-panel {
  flex: 0.8;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #151515, #1a1a1a);
  padding: 18px;
  border-radius: 10px;
  min-width: 220px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.03);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.02);
  height: 85%;
}

.kv-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.kv-input {
  padding: 10px 12px;
  background: #0f0f10;
  color: #e6e6e6;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  min-width: 0;
  transition: box-shadow 120ms ease, transform 120ms ease,
    border-color 120ms ease;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02);
  width: 32%;
}

.kv-expr {
  width: 90%;
}

.kv-input:focus {
  outline: none;
  border-color: rgba(13, 110, 253, 0.9);
  box-shadow: 0 6px 20px rgba(13, 110, 253, 0.08);
  transform: translateY(-1px);
}

.kv-sep {
  color: #d4d4d4;
  font-weight: 700;
}

/* File input styling */
input[type="file"] {
  margin-bottom: 10px;
  padding: 8px 12px;
  background: #232323;
  color: #e6e6e6;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

input[type="file"]:hover {
  background: #444;
}

/* Headings */
h2 {
  margin: 0 0 10px 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

/* Converted inline styles */
.input-help-margin {
  margin-top: 8px;
}

.kv-options {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.fuzzy-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d4d4d4;
}

.fuzzy-text {
  font-size: 13px;
}

.distance-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9aa4b2;
}

.distance-input {
  width: 72px;
  padding: 6px;
  border-radius: 6px;
  background: #0f0f10;
  color: #e6e6e6;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.distance-text {
  font-size: 13px;
  color: #9aa4b2;
}

.kv-buttons {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-direction: column;
}

.kv-btn {
  padding: 9px 14px;
  background: linear-gradient(180deg, #2b81ff, #0d6efd);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(13, 110, 253, 0.18);
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  width: 84%;
}

.kv-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(13, 110, 253, 0.22);
}

.kv-btn:active {
  transform: translateY(0);
  opacity: 0.95;
}

/* Responsive: stack panels on small screens */
@media (max-width: 920px) {
  .container {
    flex-direction: column;
    height: auto;
    padding: 14px;
  }
  .kv-panel {
    order: 2;
    width: 100%;
    min-width: 0;
  }
  .editor-panel {
    order: 1;
    width: 100%;
  }
  .kv-form {
    flex-wrap: wrap;
    gap: 8px;
  }
  .kv-input {
    flex: 1 1 140px;
    width: auto;
  }
  .kv-btn {
    width: 100%;
    padding: 10px;
  }
}

/* Select styling tweak for kv select */
.kv-select {
  width: auto;
}
</style>

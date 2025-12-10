<script setup>
import { ref, onMounted, watch } from "vue";

// -------------------------------------------------------------
// STATE
// -------------------------------------------------------------
const inputText = ref('{\n  "example": "Paste JSON here"\n}');
const outputText = ref("");
const searchResults = ref("");
const kvKey = ref("");
const kvValue = ref("");
const kvExpr = ref("");
const keysList = ref([]);
const fuzzyEnabled = ref(false);
const fuzzyThreshold = ref(2);

// Grouping
const groupEnabled = ref(false);
const groupByKey = ref("");

// NEW: Rename Key
const renameOldKey = ref("");
const renameNewKey = ref("");

// Highlighting
const matchedPaths = ref([]);
const highlightedHtml = ref("");
const showHighlighted = ref(true);

// -------------------------------------------------------------
// UTILITY FUNCTIONS
// -------------------------------------------------------------
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

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// -------------------------------------------------------------
// RENDER JSON WITH HIGHLIGHT
// -------------------------------------------------------------
const renderValueHtml = (val, path) => {
  if (val === null) return '<span class="json-null">null</span>';

  if (typeof val === "object") {
    if (Array.isArray(val)) {
      const items = val
        .map((it, idx) =>
          renderValueHtml(it, path ? `${path}[${idx}]` : `[${idx}]`)
        )
        .join(",\n");
      return `[\n${items}\n]`;
    }
    const parts = Object.keys(val).map((k) => {
      const p = path ? `${path}.${k}` : k;
      return `<div class="json-line"><span class="json-key">"${escapeHtml(
        k
      )}"</span>: ${renderValueHtml(val[k], p)}</div>`;
    });
    return `{\n${parts.join("\n")}\n}`;
  }

  const text = escapeHtml(String(val));

  for (const set of matchedPaths.value) {
    if (set && set.has(path)) {
      return `<span class="json-match">"${text}"</span>`;
    }
  }

  if (typeof val === "string") return `"${text}"`;
  if (typeof val === "number") return `<span class="json-num">${text}</span>`;
  if (typeof val === "boolean") return `<span class="json-bool">${text}</span>`;
  return text;
};

const renderResultsHtml = (results) => {
  if (!results) return "";
  if (Array.isArray(results)) {
    const html = results
      .map((r) => `<div class="json-obj">${renderValueHtml(r, "")}</div>`)
      .join('<hr class="json-sep"/>');
    return `<pre class="json-pre">${html}</pre>`;
  }
  return `<pre class="json-pre">${renderValueHtml(results, "")}</pre>`;
};

// -------------------------------------------------------------
// KEY FLATTENING
// -------------------------------------------------------------
const flattenKeys = (obj, prefix, set, maxDepth = 10) => {
  if (obj == null || maxDepth <= 0) return;
  if (typeof obj !== "object" || Array.isArray(obj)) return;

  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    set.add(path);
    const val = obj[k];
    if (Array.isArray(val)) {
      val.forEach((el) => flattenKeys(el, path, set, maxDepth - 1));
    } else if (val && typeof val === "object") {
      flattenKeys(val, path, set, maxDepth - 1);
    }
  }
};

const updateKeysList = () => {
  try {
    const data = JSON.parse(inputText.value);
    const s = new Set();
    if (Array.isArray(data)) {
      data.forEach((it) => flattenKeys(it, "", s));
    } else {
      flattenKeys(data, "", s);
    }
    keysList.value = [...s].sort();
  } catch {
    keysList.value = [];
  }
};

// -------------------------------------------------------------
// LOAD JSON
// -------------------------------------------------------------
const loadJson = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const j = JSON.parse(ev.target.result);
      inputText.value = JSON.stringify(j, null, 2);
      formatJson();
    } catch {
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
};

// -------------------------------------------------------------
// FORMAT JSON
// -------------------------------------------------------------
const formatJson = () => {
  try {
    const parsed = JSON.parse(inputText.value);
    outputText.value = JSON.stringify(parsed, null, 2);
    updateKeysList();
    if (groupEnabled.value) applyGrouping();
  } catch (err) {
    outputText.value = "// Invalid JSON\n" + err.message;
    keysList.value = [];
  }
};

// -------------------------------------------------------------
// GET VALUE BY KEY PATH
// -------------------------------------------------------------
const getValueByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
};

// -------------------------------------------------------------
// GROUPING
// -------------------------------------------------------------
const applyGrouping = () => {
  try {
    const data = JSON.parse(inputText.value);
    if (!groupEnabled.value) {
      outputText.value = JSON.stringify(data, null, 2);
      return;
    }
    if (!Array.isArray(data)) {
      searchResults.value = "// Grouping requires a root array";
      return;
    }
    const groups = {};
    data.forEach((it) => {
      const val = getValueByPath(it, groupByKey.value);
      const key =
        val === undefined
          ? "__undefined__"
          : val === null
          ? "__null__"
          : String(val);
      (groups[key] ??= []).push(it);
    });
    outputText.value = JSON.stringify(groups, null, 2);
    searchResults.value = `// Grouped by "${groupByKey.value}"`;
    matchedPaths.value = [];
    highlightedHtml.value = "";
  } catch (err) {
    searchResults.value = "// Error: " + err.message;
  }
};

// -------------------------------------------------------------
// SEARCH (key:value)
// -------------------------------------------------------------
const searchByKeyValue = () => {
  if (kvExpr.value.trim()) return performDynamicSearch();
  if (!kvKey.value.trim()) {
    searchResults.value = "// Enter key";
    return;
  }

  try {
    const data = JSON.parse(inputText.value);
    const arr = Array.isArray(data) ? data : [data];
    const key = kvKey.value;
    const val = String(kvValue.value || "").toLowerCase();

    const results = arr.filter((item) => {
      const raw = getValueByPath(item, key);
      if (raw === undefined) return false;

      if (!val) return true;

      const field = String(raw ?? "").toLowerCase();

      if (fuzzyEnabled.value)
        return levenshteinDistance(field, val) <= fuzzyThreshold.value;

      return field.includes(val);
    });

    if (!results.length) {
      searchResults.value = "// No matches";
      outputText.value = "[]";
      return;
    }

    searchResults.value = `// ${results.length} matches`;
    outputText.value = JSON.stringify(results, null, 2);

    matchedPaths.value = results.map(() => new Set([key]));
    highlightedHtml.value = renderResultsHtml(results);
  } catch {
    searchResults.value = "// Error during search";
  }
};

// -------------------------------------------------------------
// PARSE EXPRESSIONS (age > 30, name:john, etc.)
// -------------------------------------------------------------
const parseExpression = (expr) => {
  const ops = [">=", "<=", "==", "!=", ">", "<", ":", "="];
  for (const op of ops) {
    const idx = expr.indexOf(op);
    if (idx > -1)
      return {
        key: expr.slice(0, idx).trim(),
        op,
        val: expr.slice(idx + op.length).trim(),
      };
  }
  return null;
};

// -------------------------------------------------------------
// DYNAMIC SEARCH
// -------------------------------------------------------------
const performDynamicSearch = () => {
  const raw = kvExpr.value.trim();
  const parsed = parseExpression(raw);
  if (!parsed) {
    searchResults.value = "// Invalid expression";
    return;
  }

  try {
    const data = JSON.parse(inputText.value);
    const arr = Array.isArray(data) ? data : [data];
    const { key, op, val } = parsed;

    const results = arr.filter((item) => {
      const raw = getValueByPath(item, key);
      if (raw === undefined) return false;

      const a = Number(raw);
      const b = Number(val);
      const numeric = !Number.isNaN(a) && !Number.isNaN(b);

      const lhs = String(raw).toLowerCase();
      const rhs = val.toLowerCase();

      switch (op) {
        case ">":
          return numeric ? a > b : lhs > rhs;
        case "<":
          return numeric ? a < b : lhs < rhs;
        case ">=":
          return numeric ? a >= b : lhs >= rhs;
        case "<=":
          return numeric ? a <= b : lhs <= rhs;
        case "==":
        case "=":
          return numeric ? a === b : lhs === rhs;
        case "!=":
          return numeric ? a !== b : lhs !== rhs;
        case ":":
          return lhs.includes(rhs);
      }
      return false;
    });

    if (!results.length) {
      searchResults.value = "// No matches";
      outputText.value = "[]";
      return;
    }

    searchResults.value = `// ${results.length} matches`;
    outputText.value = JSON.stringify(results, null, 2);

    matchedPaths.value = results.map(() => new Set([parsed.key]));
    highlightedHtml.value = renderResultsHtml(results);
  } catch {
    searchResults.value = "// Error evaluating expression";
  }
};
const downloadJson = () => {
  try {
    const blob = new Blob([outputText.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "edited.json";
    a.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Unable to download JSON");
  }
};

// -------------------------------------------------------------
// CLEAR SEARCH
// -------------------------------------------------------------
const clearSearch = () => {
  kvExpr.value = "";
  kvKey.value = "";
  kvValue.value = "";
  groupEnabled.value = false;
  groupByKey.value = "";
  matchedPaths.value = [];
  searchResults.value = "";
  renameOldKey.value = "";
  renameNewKey.value = "";

  try {
    const parsed = JSON.parse(inputText.value);
    outputText.value = JSON.stringify(parsed, null, 2);
  } catch {}
};

// -------------------------------------------------------------
// NEW: RENAME KEY (supports nested)
// -------------------------------------------------------------
const renameKeyInObject = (obj, oldPath, newPath) => {
  const oldParts = oldPath.split(".");
  const newParts = newPath.split(".");

  // Helper: navigate to parent object
  const getParent = (o, parts) => {
    for (let i = 0; i < parts.length - 1; i++) {
      if (o == null || typeof o !== "object") return null;
      o = o[parts[i]];
    }
    return o;
  };

  const oldParent = getParent(obj, oldParts);
  if (!oldParent || !(oldParts.at(-1) in oldParent)) return;

  const oldKey = oldParts.at(-1);
  const newKey = newParts.at(-1);

  const keys = Object.keys(oldParent);
  const idx = keys.indexOf(oldKey);
  if (idx === -1) return;

  const value = oldParent[oldKey];
  delete oldParent[oldKey];

  // Insert new key at the SAME position
  const newObj = {};
  keys.forEach((k, i) => {
    if (i === idx) {
      newObj[newKey] = value;
    }
    if (k !== oldKey) newObj[k] = oldParent[k];
  });

  // Copy back to original object
  Object.keys(oldParent).forEach((k) => delete oldParent[k]);
  Object.assign(oldParent, newObj);
};

// Wrapper for array/object
const renameKey = () => {
  if (!renameOldKey.value.trim() || !renameNewKey.value.trim()) {
    alert("Enter both old and new key.");
    return;
  }

  try {
    let data = JSON.parse(inputText.value);

    if (Array.isArray(data)) {
      data.forEach((obj) =>
        renameKeyInObject(obj, renameOldKey.value, renameNewKey.value)
      );
    } else {
      renameKeyInObject(data, renameOldKey.value, renameNewKey.value);
    }

    inputText.value = JSON.stringify(data, null, 2);
    formatJson();
    alert("Key renamed successfully!");
  } catch (err) {
    alert("Invalid JSON");
  }
};

// -------------------------------------------------------------
// WATCHERS
// -------------------------------------------------------------
watch(inputText, formatJson);
watch([groupEnabled, groupByKey], applyGrouping);

onMounted(formatJson);
</script>

<template>
  <div
    class="container"
    style="display: flex; gap: 16px; align-items: flex-start"
  >
    <!-- LEFT PANEL -->
    <div class="editor-panel" style="flex: 1; min-width: 300px">
      <h2>Input JSON</h2>
      <input type="file" accept="application/json" @change="loadJson" />

      <textarea
        v-model="inputText"
        @input="formatJson"
        class="editor-area"
        style="width: 100%; height: 360px; font-family: monospace; padding: 8px"
      ></textarea>
    </div>

    <!-- MIDDLE PANEL -->
    <div class="kv-panel" style="width: 360px">
      <h2>Search / Filter</h2>

      <!-- Expression -->
      <input
        v-model="kvExpr"
        placeholder="Expression e.g. age>24"
        style="
          width: 100%;
          padding: 10px;
          margin-bottom: 8px;
          border-radius: 6px;
          border: none;
          width: 95%;
        "
      />

      <!-- Key:value -->
      <div
        style="
          display: flex;
          flex-direction: column;
          width: 100%;
          gap: 8px;
          align-items: center;
        "
      >
        <select v-model="kvKey" style="flex: 1; padding: 10px; width: 100%">
          <option value="">-- select key --</option>
          <option v-for="k in keysList" :key="k" :value="k">{{ k }}</option>
        </select>
        <input
          v-model="kvValue"
          style="
            flex: 1;
            padding: 10px;
            border-radius: 6px;
            border: none;
            width: 94%;
          "
          placeholder="value"
        />
      </div>

      <div style="margin-top: 6px">
        Keys available: <b>{{ keysList.length }}</b>
      </div>

      <div
        style="margin-top: 10px; display: flex; gap: 8px; align-items: center"
      >
        <label><input type="checkbox" v-model="fuzzyEnabled" /> Fuzzy</label>

        <label style="display: flex; gap: 6px">
          <input
            type="number"
            v-model.number="fuzzyThreshold"
            min="0"
            style="width: 60px"
          />
          distance
        </label>
      </div>

      <!-- Group -->
      <p style="margin-bottom: 4px; margin-top: -6px">Group By</p>
      <div style="display: flex; gap: 8px; align-items: center">
        <select v-model="groupByKey" style="flex: 1; padding: 6px">
          <option value="">-- select key --</option>
          <option v-for="k in keysList" :key="k" :value="k">{{ k }}</option>
        </select>
        <label><input type="checkbox" v-model="groupEnabled" /> Enable</label>
      </div>

      <!-- NEW: Rename Key -->
      <h5>Rename Key</h5>
      <div style="display: flex; gap: 8px">
        <input
          v-model="renameOldKey"
          placeholder="old key"
          style="flex: 1; padding: 8px; border-radius: 6px; border: none"
        />
        <input
          v-model="renameNewKey"
          placeholder="new key"
          style="flex: 1; padding: 8px; border-radius: 6px; border: none"
        />
      </div>
      <div
        style="
          display: flex;
          gap: 4px;
          font-size: 14px;
          justify-content: space-between;
        "
      >
        <button
          @click="renameKey"
          style="
            margin-top: 10px;
            font-weight: 400;
            padding: 6px;
            background-color: #444;
            display: flex;
            align-items: center;
            gap: 2px;
          "
        >
          <span>Rename</span> <span>🖊️</span>
        </button>

        
        <button
        @click="clearSearch"
        style="
            margin-top: 10px;
            font-weight: 400;
            padding: 6px;
            background-color: brown;
            display: flex;
            align-items: center;
            gap: 2px;
          "
        >
        <span>Clear</span> <span>❌</span>
      </button>
      <button
        @click="searchByKeyValue"
        style="
          margin-top: 10px;
          font-weight: 400;
          padding: 6px;
          background-color: green;
          display: flex;
          align-items: center;
          gap: 2px;
        "
      >
        <span>Search</span> <span>🔍</span>
      </button>

        <button
          @click="downloadJson"
          style="
            margin-top: 10px;
            font-weight: 400;
            padding: 6px;
            background-color: #007bff;
            display: flex;
            align-items: center;
            gap: 2px;
          "
        >
          <span>Download</span> <span>⬇️</span>
        </button>
      </div>

      <div style="margin-top: 12px; font-style: italic; color: #444">
        {{ searchResults }}
      </div>
    </div>

    <!-- RIGHT PANEL -->
    <div class="editor-panel" style="flex: 1; min-width: 300px">
      <h2>Output JSON</h2>
      <textarea
        v-model="outputText"
        class="editor-area"
        style="width: 100%; height: 360px; font-family: monospace; padding: 8px"
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
/* .kv-panel {
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
  height: auto;
} */

/* .kv-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
} */

/* .kv-input {
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
} */

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

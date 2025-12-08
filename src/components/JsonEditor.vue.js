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
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = as[i - 1] === bs[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
};
const matchedPaths = ref([]); // array of Sets per result indicating which key paths matched
const highlightedHtml = ref("");
const showHighlighted = ref(true);
const escapeHtml = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// Render an object/array as HTML with matched paths highlighted
const renderValueHtml = (val, path) => {
    if (val === null)
        return '<span class="json-null">null</span>';
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
    if (typeof val === "string")
        return `\"${text}\"`;
    if (typeof val === "number")
        return `<span class="json-num">${text}</span>`;
    if (typeof val === "boolean")
        return `<span class="json-bool">${text}</span>`;
    return text;
};
const renderResultsHtml = (results) => {
    if (!results)
        return "";
    try {
        if (Array.isArray(results)) {
            const html = results
                .map((r, i) => `<div class="json-obj">${renderValueHtml(r, "")}</div>`) // matchedPaths indices correspond to results
                .join('<hr class="json-sep"/>');
            return `<pre class="json-pre">${html}</pre>`;
        }
        return `<pre class="json-pre">${renderValueHtml(results, "")}</pre>`;
    }
    catch (err) {
        return `<pre class="json-pre">${escapeHtml(String(results))}</pre>`;
    }
};
// Recursively collect keys (dot notation) from objects/arrays
const flattenKeys = (obj, prefix, set, maxDepth = 10) => {
    if (obj == null || maxDepth <= 0)
        return;
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
        }
        else if (val != null && typeof val === "object") {
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
            for (const it of data)
                flattenKeys(it, "", s);
        }
        else {
            flattenKeys(data, "", s);
        }
        keysList.value = Array.from(s).sort();
        console.log("Keys found:", keysList.value);
    }
    catch (err) {
        keysList.value = [];
    }
};
// Load JSON file
const loadJson = (e) => {
    const file = e.target.files[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parsed = JSON.parse(ev.target.result);
            inputText.value = JSON.stringify(parsed, null, 2);
            formatJson();
        }
        catch (err) {
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
    }
    catch (err) {
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
            if (!item || typeof item !== "object")
                return false;
            // Use getValueByPath to support nested keys like address.city
            const fieldRaw = getValueByPath(item, key);
            if (fieldRaw === undefined)
                return false;
            if (!val)
                return true; // key exists
            const field = String(fieldRaw ?? "").toLowerCase();
            // Fuzzy matching option
            if (fuzzyEnabled.value) {
                const distance = levenshteinDistance(field, val);
                const ok = distance <= Number(fuzzyThreshold.value || 2);
                if (ok)
                    matched.push(key);
                return ok;
            }
            const ok = field.includes(val);
            if (ok)
                matched.push(key);
            return ok;
        });
        if (results.length === 0) {
            searchResults.value =
                "// No matches found for " + key + ":" + kvValue.value;
            outputText.value = "[]";
            matchedPaths.value = [];
            highlightedHtml.value = "";
        }
        else {
            searchResults.value = `// ${results.length} matches`;
            outputText.value = JSON.stringify(results, null, 2);
            // populate matchedPaths: mark the selected key for each result
            matchedPaths.value = results.map(() => new Set([key]));
            highlightedHtml.value = renderResultsHtml(results);
        }
    }
    catch (err) {
        searchResults.value = "// Error: Invalid JSON or search failed";
    }
};
// Helper: get nested value by dot-path (e.g. "address.city")
const getValueByPath = (obj, path) => {
    if (!obj || !path)
        return undefined;
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
        if (cur == null)
            return undefined;
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
            if (!item || typeof item !== "object")
                return false;
            const fieldRaw = getValueByPath(item, key);
            if (fieldRaw === undefined)
                return false;
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
                    if (bothNumeric)
                        return a === b;
                    if (fuzzyEnabled.value) {
                        return (levenshteinDistance(lhs, rhs) <= Number(fuzzyThreshold.value || 2));
                    }
                    return lhs === rhs;
                case "!=":
                    if (bothNumeric)
                        return a !== b;
                    if (fuzzyEnabled.value) {
                        return (levenshteinDistance(lhs, rhs) > Number(fuzzyThreshold.value || 2));
                    }
                    return lhs !== rhs;
                case ":":
                    if (fuzzyEnabled.value) {
                        return (levenshteinDistance(lhs, unquotedTarget.toLowerCase()) <=
                            Number(fuzzyThreshold.value || 2));
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
        }
        else {
            searchResults.value = `// ${results.length} matches for ${raw}`;
            outputText.value = JSON.stringify(results, null, 2);
            // mark the parsedExpr.key as matched path for each result
            matchedPaths.value = results.map(() => new Set([key]));
            highlightedHtml.value = renderResultsHtml(results);
        }
    }
    catch (err) {
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
    }
    catch (err) {
        outputText.value = "// Invalid JSON\n" + err.message;
    }
    updateKeysList();
    matchedPaths.value = [];
    highlightedHtml.value = "";
};
// If user manually clears the expression/key/value, automatically restore full data
watch([kvExpr, kvKey, kvValue], ([e, k, v]) => {
    if ((!e || e.trim() === "") &&
        (!k || k.trim() === "") &&
        (!v || v.trim() === "")) {
        // small debounce to avoid rapid calls
        setTimeout(() => {
            try {
                const parsed = JSON.parse(inputText.value);
                outputText.value = JSON.stringify(parsed, null, 2);
                searchResults.value = "";
            }
            catch (err) {
                // leave output as-is if input invalid
            }
        }, 120);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
/** @type {__VLS_StyleScopedClasses['distance-input']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-form']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-btn']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "container" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.loadJson) },
    type: "file",
    accept: "application/json",
});
// @ts-ignore
[loadJson,];
__VLS_asFunctionalElement(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    ...{ onInput: (__VLS_ctx.formatJson) },
    value: (__VLS_ctx.inputText),
    ...{ class: "editor-area" },
    placeholder: "Upload JSON or paste here...",
});
// @ts-ignore
[formatJson, inputText,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ class: "kv-input kv-expr" },
    placeholder: "Expression e.g. age>24   (operators: >, <, >=, <=, =, !=, :)",
});
(__VLS_ctx.kvExpr);
// @ts-ignore
[kvExpr,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.kvKey),
    ...{ class: "kv-input kv-select" },
});
// @ts-ignore
[kvKey,];
__VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
for (const [k] of __VLS_getVForSourceType((__VLS_ctx.keysList))) {
    // @ts-ignore
    [keysList,];
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (k);
}
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "kv-sep" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ class: "kv-input" },
    placeholder: "value (e.g. hongkong)",
});
(__VLS_ctx.kvValue);
// @ts-ignore
[kvValue,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "input-help input-help-margin" },
});
(__VLS_ctx.keysList.length);
// @ts-ignore
[keysList,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-options" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "fuzzy-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.fuzzyEnabled);
// @ts-ignore
[fuzzyEnabled,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "fuzzy-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "distance-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    ...{ class: "distance-input" },
});
(__VLS_ctx.fuzzyThreshold);
// @ts-ignore
[fuzzyThreshold,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "distance-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-buttons" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.searchByKeyValue) },
    ...{ class: "kv-btn" },
});
// @ts-ignore
[searchByKeyValue,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearSearch) },
    ...{ class: "btn-secondary" },
});
// @ts-ignore
[clearSearch,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    value: (__VLS_ctx.outputText),
    ...{ class: "editor-area" },
    placeholder: "Formatted output will appear here...",
});
// @ts-ignore
[outputText,];
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-expr']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-form']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-select']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-sep']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-help']} */ ;
/** @type {__VLS_StyleScopedClasses['input-help-margin']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-options']} */ ;
/** @type {__VLS_StyleScopedClasses['fuzzy-label']} */ ;
/** @type {__VLS_StyleScopedClasses['fuzzy-text']} */ ;
/** @type {__VLS_StyleScopedClasses['distance-label']} */ ;
/** @type {__VLS_StyleScopedClasses['distance-input']} */ ;
/** @type {__VLS_StyleScopedClasses['distance-text']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
const __VLS_export = (await import('vue')).defineComponent({});
export default {};

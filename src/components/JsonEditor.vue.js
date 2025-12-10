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
const escapeHtml = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// -------------------------------------------------------------
// RENDER JSON WITH HIGHLIGHT
// -------------------------------------------------------------
const renderValueHtml = (val, path) => {
    if (val === null)
        return '<span class="json-null">null</span>';
    if (typeof val === "object") {
        if (Array.isArray(val)) {
            const items = val
                .map((it, idx) => renderValueHtml(it, path ? `${path}[${idx}]` : `[${idx}]`))
                .join(",\n");
            return `[\n${items}\n]`;
        }
        const parts = Object.keys(val).map((k) => {
            const p = path ? `${path}.${k}` : k;
            return `<div class="json-line"><span class="json-key">"${escapeHtml(k)}"</span>: ${renderValueHtml(val[k], p)}</div>`;
        });
        return `{\n${parts.join("\n")}\n}`;
    }
    const text = escapeHtml(String(val));
    for (const set of matchedPaths.value) {
        if (set && set.has(path)) {
            return `<span class="json-match">"${text}"</span>`;
        }
    }
    if (typeof val === "string")
        return `"${text}"`;
    if (typeof val === "number")
        return `<span class="json-num">${text}</span>`;
    if (typeof val === "boolean")
        return `<span class="json-bool">${text}</span>`;
    return text;
};
const renderResultsHtml = (results) => {
    if (!results)
        return "";
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
    if (obj == null || maxDepth <= 0)
        return;
    if (typeof obj !== "object" || Array.isArray(obj))
        return;
    for (const k of Object.keys(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        set.add(path);
        const val = obj[k];
        if (Array.isArray(val)) {
            val.forEach((el) => flattenKeys(el, path, set, maxDepth - 1));
        }
        else if (val && typeof val === "object") {
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
        }
        else {
            flattenKeys(data, "", s);
        }
        keysList.value = [...s].sort();
    }
    catch {
        keysList.value = [];
    }
};
// -------------------------------------------------------------
// LOAD JSON
// -------------------------------------------------------------
const loadJson = (e) => {
    const file = e.target.files[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const j = JSON.parse(ev.target.result);
            inputText.value = JSON.stringify(j, null, 2);
            formatJson();
        }
        catch {
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
        if (groupEnabled.value)
            applyGrouping();
    }
    catch (err) {
        outputText.value = "// Invalid JSON\n" + err.message;
        keysList.value = [];
    }
};
// -------------------------------------------------------------
// GET VALUE BY KEY PATH
// -------------------------------------------------------------
const getValueByPath = (obj, path) => {
    if (!obj || !path)
        return undefined;
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
            const key = val === undefined
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
    }
    catch (err) {
        searchResults.value = "// Error: " + err.message;
    }
};
// -------------------------------------------------------------
// SEARCH (key:value)
// -------------------------------------------------------------
const searchByKeyValue = () => {
    if (kvExpr.value.trim())
        return performDynamicSearch();
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
            if (raw === undefined)
                return false;
            if (!val)
                return true;
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
    }
    catch {
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
            if (raw === undefined)
                return false;
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
    }
    catch {
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
    }
    catch (err) {
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
    }
    catch { }
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
            if (o == null || typeof o !== "object")
                return null;
            o = o[parts[i]];
        }
        return o;
    };
    const oldParent = getParent(obj, oldParts);
    if (!oldParent || !(oldParts.at(-1) in oldParent))
        return;
    const oldKey = oldParts.at(-1);
    const newKey = newParts.at(-1);
    const keys = Object.keys(oldParent);
    const idx = keys.indexOf(oldKey);
    if (idx === -1)
        return;
    const value = oldParent[oldKey];
    delete oldParent[oldKey];
    // Insert new key at the SAME position
    const newObj = {};
    keys.forEach((k, i) => {
        if (i === idx) {
            newObj[newKey] = value;
        }
        if (k !== oldKey)
            newObj[k] = oldParent[k];
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
            data.forEach((obj) => renameKeyInObject(obj, renameOldKey.value, renameNewKey.value));
        }
        else {
            renameKeyInObject(data, renameOldKey.value, renameNewKey.value);
        }
        inputText.value = JSON.stringify(data, null, 2);
        formatJson();
        alert("Key renamed successfully!");
    }
    catch (err) {
        alert("Invalid JSON");
    }
};
// -------------------------------------------------------------
// WATCHERS
// -------------------------------------------------------------
watch(inputText, formatJson);
watch([groupEnabled, groupByKey], applyGrouping);
onMounted(formatJson);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['distance-input']} */ ;
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-input']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "container" },
    ...{ style: "display: flex; gap: 16px; align-items: flex-start" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor-panel" },
    ...{ style: "flex: 1; min-width: 300px" },
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
    ...{ style: "width: 100%; height: 360px; font-family: monospace; padding: 8px" },
});
// @ts-ignore
[formatJson, inputText,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-panel" },
    ...{ style: "width: 360px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    placeholder: "Expression e.g. age>24",
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0077\u0069\u0064\u0074\u0068\u003a\u0020\u0031\u0030\u0030\u0025\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0061\u0072\u0067\u0069\u006e\u002d\u0062\u006f\u0074\u0074\u006f\u006d\u003a\u0020\u0038\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u006f\u0072\u0064\u0065\u0072\u002d\u0072\u0061\u0064\u0069\u0075\u0073\u003a\u0020\u0036\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u006f\u0072\u0064\u0065\u0072\u003a\u0020\u006e\u006f\u006e\u0065\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0077\u0069\u0064\u0074\u0068\u003a\u0020\u0039\u0035\u0025\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
(__VLS_ctx.kvExpr);
// @ts-ignore
[kvExpr,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; gap: 8px; align-items: center" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.kvKey),
    ...{ style: "flex: 1; padding: 10px" },
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
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ style: "flex: 1; padding: 10px; border-radius: 6px; border: none" },
    placeholder: "value",
});
(__VLS_ctx.kvValue);
// @ts-ignore
[kvValue,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "margin-top: 6px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.keysList.length);
// @ts-ignore
[keysList,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "margin-top: 10px; display: flex; gap: 8px; align-items: center" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.fuzzyEnabled);
// @ts-ignore
[fuzzyEnabled,];
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ style: "display: flex; gap: 6px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    ...{ style: "width: 60px" },
});
(__VLS_ctx.fuzzyThreshold);
// @ts-ignore
[fuzzyThreshold,];
__VLS_asFunctionalElement(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; gap: 8px; align-items: center" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.groupByKey),
    ...{ style: "flex: 1; padding: 6px" },
});
// @ts-ignore
[groupByKey,];
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
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.groupEnabled);
// @ts-ignore
[groupEnabled,];
__VLS_asFunctionalElement(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; gap: 8px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    placeholder: "old key",
    ...{ style: "flex: 1; padding: 8px; border-radius: 6px; border: none" },
});
(__VLS_ctx.renameOldKey);
// @ts-ignore
[renameOldKey,];
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    placeholder: "new key",
    ...{ style: "flex: 1; padding: 8px; border-radius: 6px; border: none" },
});
(__VLS_ctx.renameNewKey);
// @ts-ignore
[renameNewKey,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; gap: 4px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.renameKey) },
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0061\u0072\u0067\u0069\u006e\u002d\u0074\u006f\u0070\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0066\u006f\u006e\u0074\u002d\u0077\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0034\u0030\u0030\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0036\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u002d\u0063\u006f\u006c\u006f\u0072\u003a\u0020\u0023\u0034\u0034\u0034\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0064\u0069\u0073\u0070\u006c\u0061\u0079\u003a\u0020\u0066\u006c\u0065\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0061\u006c\u0069\u0067\u006e\u002d\u0069\u0074\u0065\u006d\u0073\u003a\u0020\u0063\u0065\u006e\u0074\u0065\u0072\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0067\u0061\u0070\u003a\u0020\u0032\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
// @ts-ignore
[renameKey,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.searchByKeyValue) },
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0061\u0072\u0067\u0069\u006e\u002d\u0074\u006f\u0070\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0066\u006f\u006e\u0074\u002d\u0077\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0034\u0030\u0030\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0036\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u002d\u0063\u006f\u006c\u006f\u0072\u003a\u0020\u0067\u0072\u0065\u0065\u006e\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0064\u0069\u0073\u0070\u006c\u0061\u0079\u003a\u0020\u0066\u006c\u0065\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0061\u006c\u0069\u0067\u006e\u002d\u0069\u0074\u0065\u006d\u0073\u003a\u0020\u0063\u0065\u006e\u0074\u0065\u0072\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0067\u0061\u0070\u003a\u0020\u0032\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
// @ts-ignore
[searchByKeyValue,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearSearch) },
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0061\u0072\u0067\u0069\u006e\u002d\u0074\u006f\u0070\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0066\u006f\u006e\u0074\u002d\u0077\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0034\u0030\u0030\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0036\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u002d\u0063\u006f\u006c\u006f\u0072\u003a\u0020\u0062\u0072\u006f\u0077\u006e\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0064\u0069\u0073\u0070\u006c\u0061\u0079\u003a\u0020\u0066\u006c\u0065\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0061\u006c\u0069\u0067\u006e\u002d\u0069\u0074\u0065\u006d\u0073\u003a\u0020\u0063\u0065\u006e\u0074\u0065\u0072\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0067\u0061\u0070\u003a\u0020\u0032\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
// @ts-ignore
[clearSearch,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.downloadJson) },
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0061\u0072\u0067\u0069\u006e\u002d\u0074\u006f\u0070\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0066\u006f\u006e\u0074\u002d\u0077\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0034\u0030\u0030\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0036\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u002d\u0063\u006f\u006c\u006f\u0072\u003a\u0020\u0023\u0030\u0030\u0037\u0062\u0066\u0066\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0064\u0069\u0073\u0070\u006c\u0061\u0079\u003a\u0020\u0066\u006c\u0065\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0061\u006c\u0069\u0067\u006e\u002d\u0069\u0074\u0065\u006d\u0073\u003a\u0020\u0063\u0065\u006e\u0074\u0065\u0072\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0067\u0061\u0070\u003a\u0020\u0032\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
// @ts-ignore
[downloadJson,];
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "margin-top: 12px; font-style: italic; color: #444" },
});
(__VLS_ctx.searchResults);
// @ts-ignore
[searchResults,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor-panel" },
    ...{ style: "flex: 1; min-width: 300px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    value: (__VLS_ctx.outputText),
    ...{ class: "editor-area" },
    ...{ style: "width: 100%; height: 360px; font-family: monospace; padding: 8px" },
});
// @ts-ignore
[outputText,];
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
/** @type {__VLS_StyleScopedClasses['kv-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-area']} */ ;
const __VLS_export = (await import('vue')).defineComponent({});
export default {};

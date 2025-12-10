debugger; /* PartiallyEnd: #3632/script.vue */
const __VLS_export = (await import('vue')).defineComponent({
    name: "JsonEditor",
    data() {
        return {
            inputText: "",
            lastError: "",
            parsing: false,
            parsed: false,
            objState: null,
            originalState: null,
            transformedJson: null,
            mode: "collect",
            removeFromOriginal: true,
            aggregatedMap: new Map(),
        };
    },
    computed: {
        aggregatedKeys() {
            return Array.from(this.aggregatedMap.keys()).filter((k) => this.aggregatedMap.get(k).length > 1);
        },
    },
    methods: {
        onFileChange(e) {
            const file = e.target.files[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = () => (this.inputText = reader.result);
            reader.readAsText(file);
        },
        parseInput() {
            this.lastError = "";
            this.parsing = true;
            try {
                const obj = JSON.parse(this.inputText.trim());
                this.objState = JSON.parse(JSON.stringify(obj));
                this.originalState = JSON.parse(JSON.stringify(obj));
                this.parsed = true;
            }
            catch (e) {
                this.lastError = "Invalid JSON: " + e.message;
                this.parsed = false;
            }
            this.parsing = false;
            this.transformedJson = null;
            this.aggregatedMap.clear();
        },
        clearAll() {
            this.inputText = "";
            this.parsed = false;
            this.objState = null;
            this.transformedJson = null;
            this.aggregatedMap.clear();
        },
        resetToOriginal() {
            if (this.originalState) {
                this.objState = JSON.parse(JSON.stringify(this.originalState));
                this.transformedJson = null;
                this.aggregatedMap.clear();
            }
        },
        transform() {
            if (!this.objState)
                return;
            // Step 1: collect duplicate keys
            this.aggregatedMap.clear();
            this.collect(this.objState, []);
            // Step 2: build aggregated block
            const aggregated = {};
            for (const [key, list] of this.aggregatedMap.entries()) {
                if (list.length <= 1)
                    continue;
                if (this.mode === "merge" &&
                    list.every((x) => typeof x.value === "object")) {
                    const merged = {};
                    list.forEach((item) => Object.assign(merged, JSON.parse(JSON.stringify(item.value))));
                    aggregated[key] = merged;
                }
                else {
                    aggregated[key] = list.map((i) => ({ path: i.path, value: i.value }));
                }
            }
            // Step 3: clone & remove duplicates
            let result = JSON.parse(JSON.stringify(this.objState));
            if (this.removeFromOriginal) {
                this.removeKeys(result, this.aggregatedKeys);
            }
            if (Object.keys(aggregated).length > 0) {
                result["__aggregated"] = aggregated;
            }
            this.transformedJson = result;
        },
        collect(node, path) {
            if (Array.isArray(node)) {
                node.forEach((v, i) => this.collect(v, path.concat(`[${i}]`)));
            }
            else if (node && typeof node === "object") {
                for (const key of Object.keys(node)) {
                    const fullPath = [...path, key].join(".");
                    if (!this.aggregatedMap.has(key)) {
                        this.aggregatedMap.set(key, []);
                    }
                    this.aggregatedMap
                        .get(key)
                        .push({ path: fullPath, value: node[key] });
                    this.collect(node[key], path.concat(key));
                }
            }
        },
        removeKeys(node, keys) {
            if (Array.isArray(node)) {
                node.forEach((n) => this.removeKeys(n, keys));
            }
            else if (node && typeof node === "object") {
                for (const k of Object.keys(node)) {
                    if (keys.includes(k)) {
                        delete node[k];
                    }
                    else {
                        this.removeKeys(node[k], keys);
                    }
                }
            }
        },
        format(obj) {
            return JSON.stringify(obj, null, 2);
        },
        copyTransformed() {
            if (!this.transformedJson)
                return;
            navigator.clipboard.writeText(JSON.stringify(this.transformedJson, null, 2));
            this.lastError = "Copied!";
            setTimeout(() => (this.lastError = ""), 1200);
        },
        downloadTransformed() {
            const blob = new Blob([JSON.stringify(this.transformedJson, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "output.json";
            a.click();
            URL.revokeObjectURL(url);
        },
    },
});
const __VLS_self = (await import('vue')).defineComponent({
    name: "JsonEditor",
    data() {
        return {
            inputText: "",
            lastError: "",
            parsing: false,
            parsed: false,
            objState: null,
            originalState: null,
            transformedJson: null,
            mode: "collect",
            removeFromOriginal: true,
            aggregatedMap: new Map(),
        };
    },
    computed: {
        aggregatedKeys() {
            return Array.from(this.aggregatedMap.keys()).filter((k) => this.aggregatedMap.get(k).length > 1);
        },
    },
    methods: {
        onFileChange(e) {
            const file = e.target.files[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = () => (this.inputText = reader.result);
            reader.readAsText(file);
        },
        parseInput() {
            this.lastError = "";
            this.parsing = true;
            try {
                const obj = JSON.parse(this.inputText.trim());
                this.objState = JSON.parse(JSON.stringify(obj));
                this.originalState = JSON.parse(JSON.stringify(obj));
                this.parsed = true;
            }
            catch (e) {
                this.lastError = "Invalid JSON: " + e.message;
                this.parsed = false;
            }
            this.parsing = false;
            this.transformedJson = null;
            this.aggregatedMap.clear();
        },
        clearAll() {
            this.inputText = "";
            this.parsed = false;
            this.objState = null;
            this.transformedJson = null;
            this.aggregatedMap.clear();
        },
        resetToOriginal() {
            if (this.originalState) {
                this.objState = JSON.parse(JSON.stringify(this.originalState));
                this.transformedJson = null;
                this.aggregatedMap.clear();
            }
        },
        transform() {
            if (!this.objState)
                return;
            // Step 1: collect duplicate keys
            this.aggregatedMap.clear();
            this.collect(this.objState, []);
            // Step 2: build aggregated block
            const aggregated = {};
            for (const [key, list] of this.aggregatedMap.entries()) {
                if (list.length <= 1)
                    continue;
                if (this.mode === "merge" &&
                    list.every((x) => typeof x.value === "object")) {
                    const merged = {};
                    list.forEach((item) => Object.assign(merged, JSON.parse(JSON.stringify(item.value))));
                    aggregated[key] = merged;
                }
                else {
                    aggregated[key] = list.map((i) => ({ path: i.path, value: i.value }));
                }
            }
            // Step 3: clone & remove duplicates
            let result = JSON.parse(JSON.stringify(this.objState));
            if (this.removeFromOriginal) {
                this.removeKeys(result, this.aggregatedKeys);
            }
            if (Object.keys(aggregated).length > 0) {
                result["__aggregated"] = aggregated;
            }
            this.transformedJson = result;
        },
        collect(node, path) {
            if (Array.isArray(node)) {
                node.forEach((v, i) => this.collect(v, path.concat(`[${i}]`)));
            }
            else if (node && typeof node === "object") {
                for (const key of Object.keys(node)) {
                    const fullPath = [...path, key].join(".");
                    if (!this.aggregatedMap.has(key)) {
                        this.aggregatedMap.set(key, []);
                    }
                    this.aggregatedMap
                        .get(key)
                        .push({ path: fullPath, value: node[key] });
                    this.collect(node[key], path.concat(key));
                }
            }
        },
        removeKeys(node, keys) {
            if (Array.isArray(node)) {
                node.forEach((n) => this.removeKeys(n, keys));
            }
            else if (node && typeof node === "object") {
                for (const k of Object.keys(node)) {
                    if (keys.includes(k)) {
                        delete node[k];
                    }
                    else {
                        this.removeKeys(node[k], keys);
                    }
                }
            }
        },
        format(obj) {
            return JSON.stringify(obj, null, 2);
        },
        copyTransformed() {
            if (!this.transformedJson)
                return;
            navigator.clipboard.writeText(JSON.stringify(this.transformedJson, null, 2));
            this.lastError = "Copied!";
            setTimeout(() => (this.lastError = ""), 1200);
        },
        downloadTransformed() {
            const blob = new Blob([JSON.stringify(this.transformedJson, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "output.json";
            a.click();
            URL.revokeObjectURL(url);
        },
    },
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "json-editor p-4" },
    ...{ style: "font-family: system-ui, -apple-system, 'Segoe UI', Roboto" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ style: "margin-bottom: 12px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; flex-wrap: wrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "flex: 1; min-width: 300px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    value: (__VLS_ctx.inputText),
    rows: "20",
    placeholder: "Paste JSON here or upload file...",
    ...{ style: "width: 90%; padding: 10px; font-family: monospace" },
});
// @ts-ignore
[inputText,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onFileChange) },
    type: "file",
    accept: ".json",
});
// @ts-ignore
[onFileChange,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.parseInput) },
    disabled: (__VLS_ctx.parsing),
    ...{ style: "padding: 6px 10px" },
});
// @ts-ignore
[parseInput, parsing,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearAll) },
    ...{ style: "padding: 6px 10px" },
});
// @ts-ignore
[clearAll,];
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ style: "display: inline-flex; align-items: center; gap: 5px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.removeFromOriginal);
// @ts-ignore
[removeFromOriginal,];
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ style: "display: inline-flex; align-items: center; gap: 5px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.mode),
    ...{ style: "padding: 4px" },
});
// @ts-ignore
[mode,];
__VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "collect",
});
__VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "merge",
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "margin-top: 5px" },
});
if (__VLS_ctx.lastError) {
    // @ts-ignore
    [lastError,];
    __VLS_asFunctionalElement(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ style: "color: red" },
    });
    (__VLS_ctx.lastError);
    // @ts-ignore
    [lastError,];
}
else if (__VLS_ctx.parsed) {
    // @ts-ignore
    [parsed,];
    __VLS_asFunctionalElement(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ style: "color: green" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "width: 300px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; flex-direction: column; gap: 10px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.transform) },
    disabled: (!__VLS_ctx.parsed),
    ...{ style: "padding: 8px" },
});
// @ts-ignore
[parsed, transform,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.copyTransformed) },
    disabled: (!__VLS_ctx.transformedJson),
});
// @ts-ignore
[copyTransformed, transformedJson,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.downloadTransformed) },
    disabled: (!__VLS_ctx.transformedJson),
});
// @ts-ignore
[transformedJson, downloadTransformed,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetToOriginal) },
    disabled: (!__VLS_ctx.parsed),
});
// @ts-ignore
[parsed, resetToOriginal,];
__VLS_asFunctionalElement(__VLS_intrinsics.hr)({
    ...{ style: "margin: 14px 0" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "display: flex; gap: 12px; flex-wrap: wrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "flex: 1; min-width: 320px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u003a\u0020\u0023\u0066\u0033\u0066\u0033\u0066\u0037\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0069\u006e\u002d\u0068\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0032\u0030\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006f\u0076\u0065\u0072\u0066\u006c\u006f\u0077\u003a\u0020\u0061\u0075\u0074\u006f\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
(__VLS_ctx.format(__VLS_ctx.objState));
// @ts-ignore
[format, objState,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: "flex: 1; min-width: 320px" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
    ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u003a\u0020\u0023\u0066\u0033\u0066\u0033\u0066\u0037\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0031\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006d\u0069\u006e\u002d\u0068\u0065\u0069\u0067\u0068\u0074\u003a\u0020\u0032\u0030\u0030\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u006f\u0076\u0065\u0072\u0066\u006c\u006f\u0077\u003a\u0020\u0061\u0075\u0074\u006f\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
});
(__VLS_ctx.transformedJson ? __VLS_ctx.format(__VLS_ctx.transformedJson) : "Click Transform");
// @ts-ignore
[transformedJson, transformedJson, format,];
if (__VLS_ctx.aggregatedKeys.length) {
    // @ts-ignore
    [aggregatedKeys,];
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: "margin-top: 20px" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: "display: flex; gap: 8px; flex-wrap: wrap" },
    });
    for (const [k] of __VLS_getVForSourceType((__VLS_ctx.aggregatedKeys))) {
        // @ts-ignore
        [aggregatedKeys,];
        __VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (k),
            ...{ style: "\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0070\u0061\u0064\u0064\u0069\u006e\u0067\u003a\u0020\u0036\u0070\u0078\u0020\u0031\u0032\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u0061\u0063\u006b\u0067\u0072\u006f\u0075\u006e\u0064\u003a\u0020\u0023\u0065\u0065\u0066\u0032\u0066\u0066\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0062\u006f\u0072\u0064\u0065\u0072\u002d\u0072\u0061\u0064\u0069\u0075\u0073\u003a\u0020\u0035\u0070\u0078\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0063\u006f\u006c\u006f\u0072\u003a\u0020\u0062\u006c\u0061\u0063\u006b\u003b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020" },
        });
        (k);
    }
}
/** @type {__VLS_StyleScopedClasses['json-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
export default {};

import { ref } from "vue";
const data = ref([]);
const selectedFilter = ref("");
const searchTerm = ref("");
const results = ref(null);
const loadJson = (e) => {
    const file = e.target.files[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            data.value = JSON.parse(ev.target.result);
        }
        catch {
            alert("Invalid JSON file");
        }
    };
    reader.readAsText(file);
};
// Levenshtein distance function
function levenshtein(a, b) {
    const matrix = [];
    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}
// Main filter function
const runFilter = () => {
    let filtered = data.value;
    // Apply static filter
    switch (selectedFilter.value) {
        case "age24":
            filtered = filtered.filter((item) => item.age > 24);
            break;
        case "age30":
            filtered = filtered.filter((item) => item.age > 30);
            break;
        case "salary50":
            filtered = filtered.filter((item) => item.salary > 50000);
            break;
        case "salary80":
            filtered = filtered.filter((item) => item.salary > 80000);
            break;
        case "cityNY":
            filtered = filtered.filter((item) => item.city === "New York");
            break;
        case "cityChicago":
            filtered = filtered.filter((item) => item.city === "Chicago");
            break;
        case "deptIT":
            filtered = filtered.filter((item) => item.department === "IT");
            break;
        case "deptHR":
            filtered = filtered.filter((item) => item.department === "HR");
            break;
    }
    // Apply fuzzy search if searchTerm exists
    if (searchTerm.value.trim() !== "") {
        const threshold = 3; // max distance allowed
        filtered = filtered.filter((item) => {
            const name = item.name || "";
            return (levenshtein(name.toLowerCase(), searchTerm.value.toLowerCase()) <=
                threshold);
        });
    }
    results.value = JSON.stringify(filtered, null, 2);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "container" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "left-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.loadJson) },
    type: "file",
    accept: "application/json",
});
// @ts-ignore
[loadJson,];
if (__VLS_ctx.data.length) {
    // @ts-ignore
    [data,];
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filter-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.selectedFilter),
    });
    // @ts-ignore
    [selectedFilter,];
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        disabled: true,
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "age24",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "age30",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "salary50",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "salary80",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "cityNY",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "cityChicago",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "deptIT",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "deptHR",
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsics.input)({
        placeholder: "Search by name (fuzzy)",
    });
    (__VLS_ctx.searchTerm);
    // @ts-ignore
    [searchTerm,];
    __VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.runFilter) },
        ...{ style: "margin-top: 20px" },
    });
    // @ts-ignore
    [runFilter,];
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "right-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
if (__VLS_ctx.results) {
    // @ts-ignore
    [results,];
    __VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "results-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
    (__VLS_ctx.results);
    // @ts-ignore
    [results,];
}
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['left-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-box']} */ ;
/** @type {__VLS_StyleScopedClasses['right-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['results-box']} */ ;
const __VLS_export = (await import('vue')).defineComponent({});
export default {};

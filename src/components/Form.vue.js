import { ref } from "vue";
debugger; /* PartiallyEnd: #3632/script.vue */
const __VLS_export = (await import('vue')).defineComponent({
    name: "Form",
    setup() {
        const input = ref("");
        const data = ref([]);
        const handleSubmit = (e) => {
            e.preventDefault();
            data.value.push(input.value);
            input.value = "";
        };
        return {
            input,
            data,
            handleSubmit,
        };
    },
});
const __VLS_self = (await import('vue')).defineComponent({
    name: "Form",
    setup() {
        const input = ref("");
        const data = ref([]);
        const handleSubmit = (e) => {
            e.preventDefault();
            data.value.push(input.value);
            input.value = "";
        };
        return {
            input,
            data,
            handleSubmit,
        };
    },
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
});
// @ts-ignore
[handleSubmit,];
__VLS_asFunctionalElement(__VLS_intrinsics.input)({});
(__VLS_ctx.input);
// @ts-ignore
[input,];
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({});
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
for (const [value, index] of __VLS_getVForSourceType((__VLS_ctx.data))) {
    // @ts-ignore
    [data,];
    __VLS_asFunctionalElement(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (index),
    });
    (value);
}
export default {};

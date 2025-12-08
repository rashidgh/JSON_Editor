import { defineComponent, ref } from "vue";
debugger; /* PartiallyEnd: #3632/script.vue */
const __VLS_export = defineComponent({
    name: "Counter",
    setup() {
        const num = ref(0);
        return {
            num,
        };
    },
});
const __VLS_self = (await import('vue')).defineComponent({
    name: "Counter",
    setup() {
        const num = ref(0);
        return {
            num,
        };
    },
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "counter" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
(__VLS_ctx.num);
// @ts-ignore
[num,];
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "btn_container" },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.num++;
            // @ts-ignore
            [num,];
        } },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.num--;
            // @ts-ignore
            [num,];
        } },
});
__VLS_asFunctionalElement(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.num = 0;
            // @ts-ignore
            [num,];
        } },
});
/** @type {__VLS_StyleScopedClasses['counter']} */ ;
/** @type {__VLS_StyleScopedClasses['btn_container']} */ ;
export default {};

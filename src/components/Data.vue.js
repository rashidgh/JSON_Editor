import { onMounted, ref } from "vue";
debugger; /* PartiallyEnd: #3632/script.vue */
const __VLS_export = (await import('vue')).defineComponent({
    name: "Data",
    setup() {
        const data = ref([]);
        const fetchData = async () => {
            try {
                const response = await fetch("https://api.escuelajs.co/api/v1/products");
                const json = await response.json();
                data.value = json;
            }
            catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        onMounted(() => {
            fetchData();
        });
        return {
            data,
        };
    },
});
const __VLS_self = (await import('vue')).defineComponent({
    name: "Data",
    setup() {
        const data = ref([]);
        const fetchData = async () => {
            try {
                const response = await fetch("https://api.escuelajs.co/api/v1/products");
                const json = await response.json();
                data.value = json;
            }
            catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        onMounted(() => {
            fetchData();
        });
        return {
            data,
        };
    },
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.data))) {
    // @ts-ignore
    [data,];
    __VLS_asFunctionalElement(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (item.id),
    });
    (item.title);
}
export default {};

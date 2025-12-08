import { computed } from "vue";
import { Pie } from "vue-chartjs";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useGetProducts } from "../api/useGetProducts.js";
ChartJS.register(ArcElement, Tooltip, Legend);
const { products } = useGetProducts();
// Chart options (required to avoid size issues)
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
};
// Prevent error before products are loaded
const chartData = computed(() => ({
    labels: products.value?.slice(0, 6).map((p) => p.title.slice(0, 8)) || [],
    datasets: [
        {
            data: products.value.slice(0, 6)?.map((p) => p.price) || [],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
        },
    ],
}));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
const __VLS_0 = {}.Pie;
/** @type {[typeof __VLS_components.Pie, ]} */ ;
// @ts-ignore
Pie;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    data: (__VLS_ctx.chartData),
    options: (__VLS_ctx.chartOptions),
}));
const __VLS_2 = __VLS_1({
    data: (__VLS_ctx.chartData),
    options: (__VLS_ctx.chartOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[chartData, chartOptions,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};

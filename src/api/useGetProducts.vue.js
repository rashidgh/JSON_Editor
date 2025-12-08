debugger; /* PartiallyEnd: #3632/script.vue */
const __VLS_export = (await import('vue')).defineComponent({
    name: 'useGetProducts',
    getProductsUrl: import.meta.env.VITE_API_PRODUCTS_URL,
    setup() {
        const products = ref([]);
        const getProducts = async () => {
            try {
                const response = await fetch(this.getProductsUrl);
                const data = await response.json();
                products.value = data;
            }
            catch (error) {
                console.error('Error fetching products:', error);
            }
        };
        onMounted(() => {
            getProducts();
        });
        return {
            products
        };
    }
});
const __VLS_self = (await import('vue')).defineComponent({
    name: 'useGetProducts',
    getProductsUrl: import.meta.env.VITE_API_PRODUCTS_URL,
    setup() {
        const products = ref([]);
        const getProducts = async () => {
            try {
                const response = await fetch(this.getProductsUrl);
                const data = await response.json();
                products.value = data;
            }
            catch (error) {
                console.error('Error fetching products:', error);
            }
        };
        onMounted(() => {
            getProducts();
        });
        return {
            products
        };
    }
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
export default {};

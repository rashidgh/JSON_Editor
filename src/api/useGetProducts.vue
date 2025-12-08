<script>
export default{
    name: 'useGetProducts',
    getProductsUrl: import.meta.env.VITE_API_PRODUCTS_URL,
    setup(){
        const products=ref([]);
        const getProducts=async()=>{
            try{
                const response=await fetch(this.getProductsUrl);
                const data=await response.json();
                products.value=data;
            }catch(error){
                console.error('Error fetching products:', error);
            }
        }
        onMounted(()=>{
            getProducts();
        });
        return{
            products
        }
    }
}
</script>

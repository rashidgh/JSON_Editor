import { ref, onMounted } from 'vue';

export function useGetProducts() {
  const products = ref([]);
  const getProductsUrl = import.meta.env.VITE_API_PRODUCTS_URL;

  const getProducts = async () => {
    try {
      const response = await fetch(getProductsUrl);
      const data = await response.json();
      products.value = data;
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  onMounted(() => {
    getProducts();
  });

  return { products, getProducts };
}

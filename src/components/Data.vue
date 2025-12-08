<template>
  <ul>
    <li v-for="item in data" :key="item.id">
      {{ item.title }}
    </li>
  </ul>
</template>

<script>
import { onMounted, ref } from "vue";

export default {
  name: "Data",
  setup() {
    const data = ref([]);
    const fetchData = async () => {
      try {
        const response = await fetch(
          "https://api.escuelajs.co/api/v1/products"
        );
        const json = await response.json();
        data.value = json;
      } catch (error) {
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
};
</script>

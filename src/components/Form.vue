<template>
  <form @submit="handleSubmit">
    <input v-model="input" />
    <button>add</button>
  </form>
  <div>
    <ul>
      <li v-for="(value, index) in data" :key="index">{{ value }}</li>
    </ul>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
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
};
</script>

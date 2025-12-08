<style>
.counter{
  text-align: center;
  margin: 20px;
  width: 96vw;
}
.btn_container{
  display: flex;
  height: fit-content;
  gap: 14px;
  justify-content: center;
  width: 96vw;
}
</style>
<template>
  <div class="counter">
    <h2>Counter</h2>
    <h2>{{ num }}</h2>
    <div class="btn_container">
      <button @click="num++">Increment</button>
    <button @click="num--">Decrement</button>
    <button @click="num = 0">Reset</button>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";

export default defineComponent({
  name: "Counter",
  setup() {
    const num = ref(0);
    return {
      num,
    };
  },
});
</script>

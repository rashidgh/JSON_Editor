<template>
  <div>
    <h2>PieChart</h2>
    <!-- Chart must be rendered here -->
    <Pie :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from "vue"
import { Pie } from "vue-chartjs"
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js"
import { useGetProducts } from "../api/useGetProducts.js"

ChartJS.register(ArcElement, Tooltip, Legend)

const { products } = useGetProducts();

// Chart options (required to avoid size issues)
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}

// Prevent error before products are loaded
const chartData = computed(() => ({
  labels: products.value?.slice(0,6).map((p) => p.title.slice(0,8)) || [],
  datasets: [
    {
      data: products.value.slice(0,6)?.map((p) => p.price) || [],
      backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
    },
  ],
}))
</script>

<style>
/* Set chart height manually or it won't show */
div {
  width: 400px;
  height: 400px;
}
</style>

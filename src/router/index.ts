// src/router/index.js

import { createRouter, createWebHistory } from "vue-router";
// import Counter from "../components/Counter.vue";
// import Data from "../components/Data.vue";
// import Form from "../components/Form.vue";
// import PieChart from "../components/PieChart.vue";
// import levenshtein from "../components/Levenshtein.vue";
import JsonEditor from "../components/JsonEditor.vue";

const routes = [
  { path: "/", name: "JsonEditor", component: JsonEditor },
  // { path: "/data", name: "Data", component: Data },
  // { path: "/form", name: "Form", component: Form },
  // { path: "/pie", name: "PieChart", component: PieChart },
  // { path: "/levenshtein", name: "Levenshtein", component: levenshtein },
  // { path: "/jsoneditor", name: "JsonEditor", component: JsonEditor },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

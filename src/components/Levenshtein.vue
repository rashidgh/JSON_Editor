<template>
  <div class="container">
    <!-- LEFT SIDE (FORM) -->
    <div class="left-panel">
      <h2>JSON Filter & Fuzzy Search</h2>

      <!-- Upload JSON -->
      <input type="file" accept="application/json" @change="loadJson" />

      <div v-if="data.length" class="filter-box">
        <h3>Static Filters</h3>
        <select v-model="selectedFilter">
          <option disabled value="">Choose filter</option>
          <option value="age24">Age > 24</option>
          <option value="age30">Age > 30</option>
          <option value="salary50">Salary > 50000</option>
          <option value="salary80">Salary > 80000</option>
          <option value="cityNY">City = New York</option>
          <option value="cityChicago">City = Chicago</option>
          <option value="deptIT">Department = IT</option>
          <option value="deptHR">Department = HR</option>
        </select>

        <h3>Fuzzy Search</h3>
        <input v-model="searchTerm" placeholder="Search by name (fuzzy)" />

        <button @click="runFilter" style="margin-top: 20px">Run Filter</button>
      </div>
    </div>

    <!-- RIGHT SIDE (RESULTS) -->
    <div class="right-panel">
      <h3>Results</h3>
      <div class="results-box" v-if="results">
        <pre>{{ results }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const data = ref([]);
const selectedFilter = ref("");
const searchTerm = ref("");
const results = ref(null);

const loadJson = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      data.value = JSON.parse(ev.target.result);
    } catch {
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
};

// Levenshtein distance function
function levenshtein(a, b) {
  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Main filter function
const runFilter = () => {
  let filtered = data.value;

  // Apply static filter
  switch (selectedFilter.value) {
    case "age24":
      filtered = filtered.filter((item) => item.age > 24);
      break;
    case "age30":
      filtered = filtered.filter((item) => item.age > 30);
      break;
    case "salary50":
      filtered = filtered.filter((item) => item.salary > 50000);
      break;
    case "salary80":
      filtered = filtered.filter((item) => item.salary > 80000);
      break;
    case "cityNY":
      filtered = filtered.filter((item) => item.city === "New York");
      break;
    case "cityChicago":
      filtered = filtered.filter((item) => item.city === "Chicago");
      break;
    case "deptIT":
      filtered = filtered.filter((item) => item.department === "IT");
      break;
    case "deptHR":
      filtered = filtered.filter((item) => item.department === "HR");
      break;
  }

  // Apply fuzzy search if searchTerm exists
  if (searchTerm.value.trim() !== "") {
    const threshold = 3; // max distance allowed
    filtered = filtered.filter((item) => {
      const name = item.name || "";
      return (
        levenshtein(name.toLowerCase(), searchTerm.value.toLowerCase()) <=
        threshold
      );
    });
  }

  results.value = JSON.stringify(filtered, null, 2);
};
</script>

<style>
/* Layout container */
.container {
  display: flex;
  gap: 50px; /* more gap */
  padding: 20px;
  box-sizing: border-box;
  min-height: 90vh;
  background: #121212; /* matching your dark background */
  color: white;
  font-family: Arial, sans-serif;
  width: 100vw;
}

/* LEFT SIDE */
.left-panel {
  width: 35vw;
  background: #222;
  padding: 20px;
  border-radius: 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 540px;
}

.left-panel select,
.left-panel input,
.left-panel button {
  display: block;
  padding: 10px;
  width: 100%;
  box-sizing: border-box;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid #555;
  background: #333;
  color: white;
}

.left-panel select:focus,
.left-panel input:focus {
  outline: 2px solid #0d6efd;
  border-color: #0d6efd;
}

/* RIGHT SIDE */
.right-panel {
  width: 58%;
  height: 540px;
  overflow: auto;
  background: #1e1e1e;
  padding: 20px;
  border-radius: 10px;
  box-sizing: border-box;
  color: #ddd;
}

.results-box {
  background: #000;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #444;
  /* min-height: 400px; */
  overflow: auto;
  font-family: monospace;
  font-size: 14px;
  color: #ddd;
  white-space: pre-wrap;
  word-break: break-word;
  width: 90%;
}

/* Button hover */
.left-panel button:hover {
  background: #0d6efd;
  border-color: #0d6efd;
  cursor: pointer;
  color: white;
}
</style>

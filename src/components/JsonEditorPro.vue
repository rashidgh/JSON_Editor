<template>
  <div
    class="json-editor p-4"
    style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto"
  >
    <h2 style="margin-bottom: 12px">JSON Editor — Duplicate-key Aggregator</h2>

    <div style="display: flex; flex-wrap: wrap">
      <div style="flex: 1; min-width: 300px">
        <label><strong>Input JSON</strong></label>
        <textarea
          v-model="inputText"
          rows="20"
          placeholder="Paste JSON here or upload file..."
          style="width: 90%; padding: 10px; font-family: monospace"
        ></textarea>

        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px">
          <input type="file" @change="onFileChange" accept=".json" />

          <button
            @click="parseInput"
            :disabled="parsing"
            style="padding: 6px 10px"
          >
            Parse
          </button>
          <button @click="clearAll" style="padding: 6px 10px">Clear</button>

          <label style="display: inline-flex; align-items: center; gap: 5px">
            <input type="checkbox" v-model="removeFromOriginal" />
            Remove duplicates
          </label>

          <label style="display: inline-flex; align-items: center; gap: 5px">
            Mode:
            <select v-model="mode" style="padding: 4px">
              <option value="collect">Collect</option>
              <option value="merge">Merge Objects</option>
            </select>
          </label>
        </div>

        <div style="margin-top: 5px">
          <small v-if="lastError" style="color: red">{{ lastError }}</small>
          <small v-else-if="parsed" style="color: green"
            >JSON parsed successfully.</small
          >
        </div>
      </div>

      <div style="width: 300px">
        <h4>Actions</h4>
        <div style="display: flex; flex-direction: column; gap: 10px">
          <button @click="transform" :disabled="!parsed" style="padding: 8px">
            Transform
          </button>
          <button @click="copyTransformed" :disabled="!transformedJson">
            Copy JSON
          </button>
          <button @click="downloadTransformed" :disabled="!transformedJson">
            Download JSON
          </button>
          <button @click="resetToOriginal" :disabled="!parsed">Reset</button>
        </div>
      </div>
    </div>

    <hr style="margin: 14px 0" />

    <div style="display: flex; gap: 12px; flex-wrap: wrap">
      <div style="flex: 1; min-width: 320px">
        <label><strong>Original JSON</strong></label>
        <pre
          style="
            background: #f3f3f7;
            padding: 10px;
            min-height: 200px;
            overflow: auto;
          "
          >{{ format(objState) }}
        </pre>
      </div>

      <div style="flex: 1; min-width: 320px">
        <label><strong>Transformed JSON</strong></label>
        <pre
          style="
            background: #f3f3f7;
            padding: 10px;
            min-height: 200px;
            overflow: auto;
          "
          >{{ transformedJson ? format(transformedJson) : "Click Transform" }}
        </pre>
      </div>
    </div>

    <div v-if="aggregatedKeys.length" style="margin-top: 20px">
      <h4>Aggregated Keys:</h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <span
          v-for="k in aggregatedKeys"
          :key="k"
          style="
            padding: 6px 12px;
            background: #eef2ff;
            border-radius: 5px;
            color: black;
          "
          >{{ k }}</span
        >
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "JsonEditor",

  data() {
    return {
      inputText: "",
      lastError: "",
      parsing: false,
      parsed: false,

      objState: null,
      originalState: null,
      transformedJson: null,

      mode: "collect",
      removeFromOriginal: true,

      aggregatedMap: new Map(),
    };
  },

  computed: {
    aggregatedKeys() {
      return Array.from(this.aggregatedMap.keys()).filter(
        (k) => this.aggregatedMap.get(k).length > 1
      );
    },
  },

  methods: {
    onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => (this.inputText = reader.result);
      reader.readAsText(file);
    },

    parseInput() {
      this.lastError = "";
      this.parsing = true;

      try {
        const obj = JSON.parse(this.inputText.trim());
        this.objState = JSON.parse(JSON.stringify(obj));
        this.originalState = JSON.parse(JSON.stringify(obj));
        this.parsed = true;
      } catch (e) {
        this.lastError = "Invalid JSON: " + e.message;
        this.parsed = false;
      }

      this.parsing = false;
      this.transformedJson = null;
      this.aggregatedMap.clear();
    },

    clearAll() {
      this.inputText = "";
      this.parsed = false;
      this.objState = null;
      this.transformedJson = null;
      this.aggregatedMap.clear();
    },

    resetToOriginal() {
      if (this.originalState) {
        this.objState = JSON.parse(JSON.stringify(this.originalState));
        this.transformedJson = null;
        this.aggregatedMap.clear();
      }
    },

    transform() {
      if (!this.objState) return;

      // Step 1: collect duplicate keys
      this.aggregatedMap.clear();
      this.collect(this.objState, []);

      // Step 2: build aggregated block
      const aggregated = {};

      for (const [key, list] of this.aggregatedMap.entries()) {
        if (list.length <= 1) continue;

        if (
          this.mode === "merge" &&
          list.every((x) => typeof x.value === "object")
        ) {
          const merged = {};
          list.forEach((item) =>
            Object.assign(merged, JSON.parse(JSON.stringify(item.value)))
          );
          aggregated[key] = merged;
        } else {
          aggregated[key] = list.map((i) => ({ path: i.path, value: i.value }));
        }
      }

      // Step 3: clone & remove duplicates
      let result = JSON.parse(JSON.stringify(this.objState));

      if (this.removeFromOriginal) {
        this.removeKeys(result, this.aggregatedKeys);
      }

      if (Object.keys(aggregated).length > 0) {
        result["__aggregated"] = aggregated;
      }

      this.transformedJson = result;
    },

    collect(node, path) {
      if (Array.isArray(node)) {
        node.forEach((v, i) => this.collect(v, path.concat(`[${i}]`)));
      } else if (node && typeof node === "object") {
        for (const key of Object.keys(node)) {
          const fullPath = [...path, key].join(".");

          if (!this.aggregatedMap.has(key)) {
            this.aggregatedMap.set(key, []);
          }
          this.aggregatedMap
            .get(key)
            .push({ path: fullPath, value: node[key] });

          this.collect(node[key], path.concat(key));
        }
      }
    },

    removeKeys(node, keys) {
      if (Array.isArray(node)) {
        node.forEach((n) => this.removeKeys(n, keys));
      } else if (node && typeof node === "object") {
        for (const k of Object.keys(node)) {
          if (keys.includes(k)) {
            delete node[k];
          } else {
            this.removeKeys(node[k], keys);
          }
        }
      }
    },

    format(obj) {
      return JSON.stringify(obj, null, 2);
    },

    copyTransformed() {
      if (!this.transformedJson) return;

      navigator.clipboard.writeText(
        JSON.stringify(this.transformedJson, null, 2)
      );
      this.lastError = "Copied!";
      setTimeout(() => (this.lastError = ""), 1200);
    },

    downloadTransformed() {
      const blob = new Blob([JSON.stringify(this.transformedJson, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "output.json";
      a.click();
      URL.revokeObjectURL(url);
    },
  },
};
</script>

<style scoped>
button {
  background: #2563eb;
  color: rgb(77, 73, 73);
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}
button:disabled {
  background: #9bb8ee;
  cursor: not-allowed;
}
pre {
  background: #ffffff !important; /* or dark: #1e1e1e */
  color: #111111 !important; /* or light: #e5e5e5 */
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

  // ========== CONFIG ==========
  const PRESETS_URL = "./presets.json";
  const EDITOR_URL = "./editor.html";
  const DEFAULT_THUMBNAIL = "./thumbnails/default.webp"; // عکس پیش‌فرض

  // ========== GALLERY ==========
  const Gallery = {
    presets: [],
    currentCategory: "all",

    async init() {
      await this.loadPresets();
      this.renderFilters();
      this.render();
    },

    async loadPresets() {
      const grid = document.getElementById("presetsGrid");

      try {
        const response = await fetch(PRESETS_URL);
        if (!response.ok) throw new Error("Failed to load");

        const data = await response.json();
        this.presets = data.presets || [];
        console.log(`✅ Loaded ${this.presets.length} presets`);
      } catch (error) {
        console.error("Error:", error);
        grid.innerHTML = `
    <div class="error">
      <p>❌ Failed to load presets</p>
      <button onclick="Gallery.init()">Retry</button>
    </div>
  `;
      }
    },

    getCategories() {
      const cats = new Set(this.presets.map((p) => p.category));
      return ["all", ...Array.from(cats)];
    },

    filterBy(category) {
      this.currentCategory = category;
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.category === category);
      });
      this.render();
    },

    renderFilters() {
      const container = document.getElementById("filters");
      if (!container) return;

      const categories = this.getCategories();
      container.innerHTML = categories
        .map(
          (cat) => `
  <button 
    class="filter-btn ${cat === this.currentCategory ? "active" : ""}" 
    data-category="${cat}"
    onclick="Gallery.filterBy('${cat}')"
  >
    ${cat.charAt(0).toUpperCase() + cat.slice(1)}
  </button>
`
        )
        .join("");
    },

    render() {
      const grid = document.getElementById("presetsGrid");
      if (!grid) return;

      const filtered =
        this.currentCategory === "all"
          ? this.presets
          : this.presets.filter((p) => p.category === this.currentCategory);

      if (filtered.length === 0) {
        grid.innerHTML = '<div class="loading">No presets found</div>';
        return;
      }

      grid.innerHTML = filtered
        .map(
          (preset) => `
  <div class="preset-card" onclick="Gallery.openPreset('${preset.id}')">
    <img 
      class="preset-card-img" 
      src="${preset.thumbnail || DEFAULT_THUMBNAIL}" 
      alt="${preset.name}"
      loading="lazy"
      onerror="this.src='${DEFAULT_THUMBNAIL}'"
    />
    <div class="preset-card-overlay"></div>
    <div class="preset-card-info">
      <div class="preset-card-name">${preset.name}</div>
      <div class="preset-card-tags">
        ${preset.tags
          .slice(0, 3)
          .map((t) => `<span class="preset-tag">${t}</span>`)
          .join("")}
      </div>
    </div>
  </div>
`
        )
        .join("");
    },

    openPreset(presetId) {
      const preset = this.presets.find((p) => p.id === presetId);
      if (!preset) return;

      sessionStorage.setItem("loadPreset", JSON.stringify(preset));
      window.location.href = EDITOR_URL;
    },
  };

  // Init
  document.addEventListener("DOMContentLoaded", () => Gallery.init());
  window.Gallery = Gallery;

const targets = document.querySelectorAll('.feature-content h3, .feature-content p, .btn-enter-editor');

function runSweep() {
  const el = targets[Math.floor(Math.random() * targets.length)];

  el.classList.remove('sweep-active');
  void el.offsetWidth;
  el.classList.add('sweep-active');

  const delay = 1000 + Math.random() * 3000;
  setTimeout(runSweep, delay);
}

setTimeout(runSweep, 1200);



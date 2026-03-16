// ========== CONFIGURATION ==========
const CONFIG = {
  canvas: {
    defaultWidth: 800,
    defaultHeight: 600,
    minWidth: 200,
    maxWidth: 3840,
    minHeight: 200,
    maxHeight: 2160,
  },
  mobile: {
    breakpoint: 768,
    hitRadius: 24,
    desktopHitRadius: 14,
  },
  colors: {
    palette: [
      "#ff0066",
      "#7c3aed",
      "#ff6600",
      "#ffdd00",
      "#ff3366",
      "#00ffcc",
      "#3a0ca3",
      "#00d4ff",
      "#00ff88",
      "#b3945b",
      "#fb5607",
      "#119da4",
      "#cf9893",
      "#6968a6",
      "#dd7a83",
      "#3f5e96",
      "#010528",
    ],
  },
};

// ========== DOM ELEMENTS ==========
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasWidth = document.getElementById("canvasWidth");
const canvasHeight = document.getElementById("canvasHeight");

let W = 800,
  H = 600,
  counter = 0;

// ========== STATE ==========
const state = {
  stops: [],
  selected: null,
  bgColor: "#0a0e14",
  bgAlpha: 100,
  bgBlendMode: "normal",
  bgEnabled: true,
  cssFormat: "rgba",
  canvasWidth: 800,
  canvasHeight: 600,
  lockVertical: false,
  showHandles: true,
};

let picker = { cb: null, h: 0, s: 100, v: 100, a: 100, fmt: "hex" };
let drag = null;
let activeAnglePicker = null;
let currentCSS = "";

// Resize states
let resizingW = false,
  resizingH = false;
let startX = 0,
  startY = 0,
  startW = 0,
  startH = 0;
let lastW = 0,
  lastH = 0;

// Picker drag states
let sbDrag = false,
  hueDrag = false,
  alphaDrag = false;
let pickerDragging = false;

// ========== ZOOM STATE ==========
const zoomState = {
  current: 100,
  min: 5,
  max: 350,
  step: 5,
  dynamicMin: 15,
  paddingX: 55,
  paddingY: 100,
  lastPinchDist: 0,
};

// ========== UTILITY FUNCTIONS ==========
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const uid = () => Math.random().toString(36).slice(2, 8);

function isMobile() {
  return (
    window.innerWidth <= CONFIG.mobile.breakpoint || "ontouchstart" in window
  );
}

function getGCD(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function simplifyRatio(w, h, maxValue = 50) {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 };

  w = Math.round(w);
  h = Math.round(h);

  // اول با GCD ساده کن
  const gcd = getGCD(w, h);
  let simpleW = w / gcd;
  let simpleH = h / gcd;

  // اگر اعداد کوچیکن، همین خوبه
  if (simpleW <= maxValue && simpleH <= maxValue) {
    return { w: simpleW, h: simpleH };
  }

  // اگر بزرگن، به نزدیک‌ترین نسبت معروف تبدیل کن
  const ratio = w / h;

  const commonRatios = [
    { w: 1, h: 1 },
    { w: 4, h: 3 },
    { w: 3, h: 4 },
    { w: 16, h: 9 },
    { w: 9, h: 16 },
    { w: 21, h: 9 },
    { w: 9, h: 21 },
    { w: 3, h: 2 },
    { w: 2, h: 3 },
    { w: 5, h: 4 },
    { w: 4, h: 5 },
    { w: 16, h: 10 },
    { w: 10, h: 16 },
    { w: 2, h: 1 },
    { w: 1, h: 2 },
    { w: 7, h: 5 },
    { w: 5, h: 7 },
    { w: 6, h: 5 },
    { w: 5, h: 6 },
  ];

  // پیدا کردن نزدیک‌ترین نسبت
  let closest = { w: simpleW, h: simpleH };
  let minDiff = Infinity;

  for (const cr of commonRatios) {
    const diff = Math.abs(ratio - cr.w / cr.h);
    if (diff < minDiff) {
      minDiff = diff;
      closest = cr;
    }
  }

  // اگر نزدیکه (کمتر از 2% اختلاف)، از نسبت معروف استفاده کن
  if (minDiff < 0.02) {
    return { w: closest.w, h: closest.h };
  }

  // در غیر این صورت، مقیاس کن به اعداد کوچکتر
  const scale = maxValue / Math.max(simpleW, simpleH);
  return {
    w: Math.round(simpleW * scale) || 1,
    h: Math.round(simpleH * scale) || 1,
  };
}
// ========== COLOR FUNCTIONS ==========
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.round(clamp(x, 0, 255))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0)
    return {
      r: Math.round(l * 255),
      g: Math.round(l * 255),
      b: Math.round(l * 255),
    };
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0,
    s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, v: max * 100 };
}

function hsvToRgb(h, s, v) {
  h /= 360;
  s /= 100;
  v /= 100;
  const i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function formatColor(hex, alpha, format) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const a = alpha / 100;

  switch (format) {
    case "hex":
      return a < 1
        ? `${hex}${Math.round(a * 255)
            .toString(16)
            .padStart(2, "0")}`
        : hex;
    case "rgb":
      return `rgb(${r}, ${g}, ${b})`;
    case "rgba":
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    case "hsl":
      return `hsl(${h}, ${s}%, ${l}%)`;
    case "hsla":
      return `hsla(${h}, ${s}%, ${l}%, ${a.toFixed(2)})`;
    default:
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function randColor() {
  return CONFIG.colors.palette[
    Math.floor(Math.random() * CONFIG.colors.palette.length)
  ];
}

function darken(hex, amount = 40) {
  hex = hex.replace("#", "");
  let r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amount);
  let g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amount);
  let b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amount);
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

function lighten(hex, amount = 20) {
  hex = hex.replace("#", "");
  let r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
  let g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
  let b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

// ========== FILE MANAGER ==========
const FileManager = {
  AUTO_SAVE_KEY: "AutoSave",
  AUTO_SAVE_DELAY: 1000,
  autoSaveTimer: null,
  initialized: false,

  getState() {
    return {
      timestamp: Date.now(),
      stops: state.stops,
      selected: state.selected,
      bgColor: state.bgColor,
      bgAlpha: state.bgAlpha,
      bgBlendMode: state.bgBlendMode,
      bgEnabled: state.bgEnabled,
      bgImage: state.bgImage || null,
      cssFormat: state.cssFormat,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      lockVertical: state.lockVertical,
      showHandles: state.showHandles,
      filterState: { ...filterState },
      noiseState: { ...noiseState },
      dimensionState: { ...dimensionState },
    };
  },

  setState(data) {
    if (!data) return false;
    try {
      if (data.stops)
        state.stops = data.stops.map((s) => ({ ...s, id: s.id || uid() }));
      state.selected = data.selected || null;
      state.bgColor = data.bgColor || "#0a0e14";
      state.bgAlpha = data.bgAlpha ?? 100;
      state.bgBlendMode = data.bgBlendMode || "normal";
      state.bgEnabled = data.bgEnabled ?? true;
      state.bgImage = data.bgImage || null;
      state.cssFormat = data.cssFormat || "rgba";
      state.canvasWidth = data.canvasWidth || 800;
      state.canvasHeight = data.canvasHeight || 600;
      state.lockVertical = data.lockVertical ?? false;
      state.showHandles = data.showHandles ?? true;
      if (data.filterState) Object.assign(filterState, data.filterState);
      if (data.noiseState) Object.assign(noiseState, data.noiseState);
      if (data.dimensionState)
        Object.assign(dimensionState, data.dimensionState);
      if (data.counter !== undefined) counter = data.counter;
      return true;
    } catch (e) {
      console.error("setState error:", e);
      return false;
    }
  },

  scheduleAutoSave() {
    if (!this.initialized) return;
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSave();
    }, this.AUTO_SAVE_DELAY);
  },

  autoSave() {
    if (!this.initialized) return;
    try {
      const data = this.getState();
      localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(data));
      console.log("✅ Auto-saved at", new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("Auto-save failed:", e);
    }
  },

  loadAutoSave() {
    try {
      const saved = localStorage.getItem(this.AUTO_SAVE_KEY);
      if (!saved) {
        console.log("ℹ️ No auto-save found");
        return false;
      }

      const data = JSON.parse(saved);
      console.log(
        "📂 Found auto-save from:",
        new Date(data.timestamp).toLocaleString(),
      );

      if (this.setState(data)) {
        counter = state.stops.length;
        console.log("✅ Auto-save loaded, stops:", state.stops.length);
        return true;
      }
    } catch (e) {
      console.error("Failed to load auto-save:", e);
      localStorage.removeItem(this.AUTO_SAVE_KEY);
    }
    return false;
  },

  clearAutoSave() {
    localStorage.removeItem(this.AUTO_SAVE_KEY);
    console.log("🗑️ Auto-save cleared");
  },

  exportJSON() {
    const data = this.getState();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gradient-${Date.now()}.json`;
    a.click();
  },

  importJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        History.saveState();
        if (this.setState(data)) {
          counter = state.stops.length;
          this.refreshAll();
          History.clear();
          this.autoSave();
        }
      } catch (err) {
        console.error("Import failed:", err);
      }
    };
    input.click();
  },

  loadPresetFromSession() {
    const json = sessionStorage.getItem("loadPreset");
    if (!json) return false;
    sessionStorage.removeItem("loadPreset");
    try {
      const preset = JSON.parse(json);
      if (this.setState(preset.data)) {
        counter = state.stops.length;
        console.log("✅ Session preset loaded");
        return true;
      }
    } catch (e) {
      console.error("Session preset load failed:", e);
    }
    return false;
  },

  refreshAll() {
    // چک کردن وجود توابع قبل از اجرا
    if (typeof resize === "function") resize();
    if (typeof draw === "function") draw();
    if (typeof renderList === "function") renderList();
    if (typeof renderInspector === "function") renderInspector();
    if (typeof updateCSS === "function") updateCSS();
    if (typeof updateBgPreview === "function") updateBgPreview();
    if (typeof updateSizeInputs === "function") updateSizeInputs();
    if (typeof updateAllDimensionUI === "function") updateAllDimensionUI();
    if (typeof updateFilterUI === "function") updateFilterUI();
    if (typeof updateNoiseUI === "function") updateNoiseUI();
    if (typeof updateBgUI === "function") updateBgUI();
    if (typeof updateZoomUI === "function") updateZoomUI();
    if (typeof applyNoiseFilter === "function") applyNoiseFilter();
    if (typeof fitToScreen === "function") fitToScreen();
    if (typeof initFiltersFromState === "function") initFiltersFromState();
  },
};

// ------ UNDO/REDO SYSTEM ------
const History = {
  undoStack: [],
  redoStack: [],
  maxSize: 50,
  isRestoring: false,
  lastSnapshot: null,
  inputSnapshot: null,
  dragSnapshot: null,

  createSnapshot() {
    return JSON.stringify({
      stops: state.stops,
      selected: state.selected,
      bgColor: state.bgColor,
      bgAlpha: state.bgAlpha,
      bgBlendMode: state.bgBlendMode,
      bgEnabled: state.bgEnabled,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      lockVertical: state.lockVertical,
      showHandles: state.showHandles,
      filterState: { ...filterState },
      noiseState: { ...noiseState },
      counter: counter,
    });
  },

  restoreSnapshot(snapshot) {
    if (!snapshot) return false;
    try {
      const data = JSON.parse(snapshot);
      state.stops = data.stops || [];
      state.selected = data.selected;
      state.bgColor = data.bgColor || "#0a0e14";
      state.bgAlpha = data.bgAlpha ?? 100;
      state.bgBlendMode = data.bgBlendMode || "normal";
      state.bgEnabled = data.bgEnabled ?? true;
      state.canvasWidth = data.canvasWidth || 800;
      state.canvasHeight = data.canvasHeight || 600;
      state.lockVertical = data.lockVertical ?? false;
      state.showHandles = data.showHandles ?? true;
      if (data.filterState) Object.assign(filterState, data.filterState);
      if (data.noiseState) Object.assign(noiseState, data.noiseState);
      if (data.counter !== undefined) counter = data.counter;
      return true;
    } catch (e) {
      return false;
    }
  },

  // ✅ وقتی focus میشه - ذخیره snapshot
  onInputFocus() {
    if (this.isRestoring) return;
    this.inputSnapshot = this.createSnapshot();
  },

  // ✅ وقتی blur میشه - ذخیره تغییرات
  onInputBlur() {
    if (this.isRestoring) return;
    if (!this.inputSnapshot) return;

    const current = this.createSnapshot();

    if (current !== this.inputSnapshot) {
      this.undoStack.push({ snapshot: this.inputSnapshot });
      if (this.undoStack.length > this.maxSize) this.undoStack.shift();
      this.redoStack = [];
      this.lastSnapshot = current;
      this.updateUI();
    }

    this.inputSnapshot = null;
  },

  // ✅ شروع drag
  onDragStart() {
    if (this.isRestoring) return;
    if (!this.dragSnapshot) {
      this.dragSnapshot = this.createSnapshot();
    }
  },

  // ✅ پایان drag
  onDragEnd() {
    if (this.isRestoring) return;
    if (!this.dragSnapshot) return;

    const current = this.createSnapshot();

    if (current !== this.dragSnapshot) {
      this.undoStack.push({ snapshot: this.dragSnapshot });
      if (this.undoStack.length > this.maxSize) this.undoStack.shift();
      this.redoStack = [];
      this.lastSnapshot = current;
      this.updateUI();
    }

    this.dragSnapshot = null;
  },

  // ✅ ذخیره فوری (برای دکمه‌ها)
  saveState() {
    if (this.isRestoring) return;

    const snapshot = this.createSnapshot();
    if (snapshot === this.lastSnapshot) return;

    this.undoStack.push({ snapshot });
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
    this.lastSnapshot = snapshot;
    this.inputSnapshot = null;
    this.dragSnapshot = null;
    this.updateUI();
  },

  undo() {
    if (this.undoStack.length === 0) return false;

    // لغو هر pending
    this.inputSnapshot = null;
    this.dragSnapshot = null;

    const current = this.createSnapshot();
    this.redoStack.push({ snapshot: current });

    const prev = this.undoStack.pop();

    this.isRestoring = true;
    if (this.restoreSnapshot(prev.snapshot)) {
      this.lastSnapshot = prev.snapshot;
      this.refreshUI();
    }
    this.isRestoring = false;
    this.updateUI();
    return true;
  },

  redo() {
    if (this.redoStack.length === 0) return false;

    const current = this.createSnapshot();
    this.undoStack.push({ snapshot: current });

    const next = this.redoStack.pop();

    this.isRestoring = true;
    if (this.restoreSnapshot(next.snapshot)) {
      this.lastSnapshot = next.snapshot;
      this.refreshUI();
    }
    this.isRestoring = false;
    this.updateUI();
    return true;
  },

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastSnapshot = this.createSnapshot();
    this.inputSnapshot = null;
    this.dragSnapshot = null;
    this.updateUI();
  },

  updateUI() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  },

  refreshUI() {
    resize();
    draw();
    renderList();
    renderInspector();
    updateCSS();
    updateBgPreview();
    if (typeof updateFilterUI === "function") updateFilterUI();
    if (typeof updateNoiseUI === "function") updateNoiseUI();
    if (typeof updateBgUI === "function") updateBgUI();
    if (typeof applyNoiseFilter === "function") applyNoiseFilter();
    if (typeof updateAllDimensionUI === "function") updateAllDimensionUI();
  },

  init() {
    this.lastSnapshot = this.createSnapshot();
    this.setupGlobalListeners();
    this.overrideFunctions();
    this.updateUI();
  },

  setupGlobalListeners() {
    // Canvas drag
    if (typeof canvas !== "undefined" && canvas) {
      canvas.addEventListener("mousedown", () => this.onDragStart());
      canvas.addEventListener("touchstart", () => this.onDragStart(), {
        passive: true,
      });
    }

    document.addEventListener("mouseup", () => {
      if (this.dragSnapshot) {
        setTimeout(() => this.onDragEnd(), 50);
      }
    });

    document.addEventListener("touchend", () => {
      if (this.dragSnapshot) {
        setTimeout(() => this.onDragEnd(), 50);
      }
    });
  },

  overrideFunctions() {
    const self = this;

    // addStop
    if (typeof window.addStop === "function") {
      const orig = window.addStop;
      window.addStop = function (type) {
        self.saveState();
        orig(type);
      };
    }

    // delStop
    if (typeof window.delStop === "function") {
      const orig = window.delStop;
      window.delStop = function (id) {
        self.saveState();
        orig(id);
      };
    }

    // dupStop
    if (typeof window.dupStop === "function") {
      const orig = window.dupStop;
      window.dupStop = function (id) {
        self.saveState();
        orig(id);
      };
    }

    // toggleVis
    if (typeof window.toggleVis === "function") {
      const orig = window.toggleVis;
      window.toggleVis = function (id) {
        self.saveState();
        orig(id);
      };
    }

    // addColorStop
    if (typeof window.addColorStop === "function") {
      const orig = window.addColorStop;
      window.addColorStop = function (s) {
        self.saveState();
        orig(s);
      };
    }

    // delColorStop
    if (typeof window.delColorStop === "function") {
      const orig = window.delColorStop;
      window.delColorStop = function (s, i) {
        self.saveState();
        orig(s, i);
      };
    }

    // swapDimensions
    if (typeof window.swapDimensions === "function") {
      const orig = window.swapDimensions;
      window.swapDimensions = function () {
        self.saveState();
        orig();
      };
    }

    // toggleAspectLock
    if (typeof window.toggleAspectLock === "function") {
      const orig = window.toggleAspectLock;
      window.toggleAspectLock = function () {
        self.saveState();
        orig();
      };
    }

    // setResolution
    if (typeof window.setResolution === "function") {
      const orig = window.setResolution;
      window.setResolution = function (w, h) {
        self.saveState();
        orig(w, h);
      };
    }

    // setAspectRatio
    if (typeof window.setAspectRatio === "function") {
      const orig = window.setAspectRatio;
      window.setAspectRatio = function (r) {
        self.saveState();
        orig(r);
      };
    }

    // resetFilters
    if (typeof window.resetFilters === "function") {
      const orig = window.resetFilters;
      window.resetFilters = function () {
        self.saveState();
        orig();
      };
    }

    // toggleFilters
    if (typeof window.toggleFilters === "function") {
      const orig = window.toggleFilters;
      window.toggleFilters = function () {
        self.saveState();
        orig();
      };
    }

    // toggleNoise
    if (typeof window.toggleNoise === "function") {
      const orig = window.toggleNoise;
      window.toggleNoise = function () {
        self.saveState();
        orig();
      };
    }

    // toggleBackground
    if (typeof window.toggleBackground === "function") {
      const orig = window.toggleBackground;
      window.toggleBackground = function () {
        self.saveState();
        orig();
      };
    }

    // handleLockClick
    if (typeof window.handleLockClick === "function") {
      const orig = window.handleLockClick;
      window.handleLockClick = function (e) {
        self.saveState();
        orig(e);
      };
    }

    // handleToggleClick
    if (typeof window.handleToggleClick === "function") {
      const orig = window.handleToggleClick;
      window.handleToggleClick = function (e) {
        self.saveState();
        orig(e);
      };
    }

    // openPicker
    if (typeof window.openPicker === "function") {
      const orig = window.openPicker;
      window.openPicker = function (hex, opacity, cb) {
        self.onDragStart();
        orig(hex, opacity, cb);
      };
    }

    // closePicker
    if (typeof window.closePicker === "function") {
      const orig = window.closePicker;
      window.closePicker = function () {
        orig();
        setTimeout(() => self.onDragEnd(), 50);
      };
    }

    // openStopColorPicker
    if (typeof window.openStopColorPicker === "function") {
      const orig = window.openStopColorPicker;
      window.openStopColorPicker = function (a, b, c) {
        self.onDragStart();
        orig(a, b, c);
      };
    }

    // setStopBlendMode
    if (typeof window.setStopBlendMode === "function") {
      const orig = window.setStopBlendMode;
      window.setStopBlendMode = function (id, mode) {
        self.saveState();
        orig(id, mode);
      };
    }

    // setBgBlendMode
    if (typeof window.setBgBlendMode === "function") {
      const orig = window.setBgBlendMode;
      window.setBgBlendMode = function (mode) {
        self.saveState();
        orig(mode);
      };
    }

    // startAngleDrag
    if (typeof window.startAngleDrag === "function") {
      const orig = window.startAngleDrag;
      window.startAngleDrag = function (e, id) {
        self.onDragStart();
        orig(e, id);
      };
    }

    // startConicAngleDrag
    if (typeof window.startConicAngleDrag === "function") {
      const orig = window.startConicAngleDrag;
      window.startConicAngleDrag = function (e, id) {
        self.onDragStart();
        orig(e, id);
      };
    }

    // stopAngleDrag
    if (typeof window.stopAngleDrag === "function") {
      const orig = window.stopAngleDrag;
      window.stopAngleDrag = function () {
        orig();
        setTimeout(() => self.onDragEnd(), 50);
      };
    }
  },
};

function HF() {
  History.onInputFocus();
}

function HB() {
  History.onInputBlur();
}

window.HF = HF;
window.HB = HB;

// ------ KEYBOARD ------
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    History.undo();
  } else if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    e.preventDefault();
    History.redo();
  } else if (isMod && e.key === "s") {
    e.preventDefault();
    FileManager.exportJSON();
  } else if (isMod && e.key === "o") {
    e.preventDefault();
    FileManager.importJSON();
  }
});

// ------ AUTO SAVE TRIGGER ------
const originalHistorySaveState = History.saveState;
History.saveState = function () {
  originalHistorySaveState.call(this);
  FileManager.scheduleAutoSave();
};

// ------ INIT ------
function initFileManager() {
  console.log("🚀 Initializing FileManager...");

  // اول History رو init کن
  if (typeof History !== "undefined" && History.init) {
    History.init();
  }

  // لود داده‌ها - اول session بعد auto-save
  let loaded = FileManager.loadPresetFromSession();
  if (!loaded) {
    loaded = FileManager.loadAutoSave();
  }

  // حالا UI رو آپدیت کن
  FileManager.refreshAll();

  // فعال کردن auto-save
  FileManager.initialized = true;

  // auto-save دوره‌ای
  setInterval(() => {
    if (FileManager.initialized) {
      FileManager.autoSave();
    }
  }, 5000);

  console.log("✅ FileManager initialized");
}

if (document.readyState === "complete") {
  setTimeout(initFileManager, 100);
} else {
  window.addEventListener("load", () => {
    setTimeout(initFileManager, 100);
  });
}

window.History = History;
window.FileManager = FileManager;
window.undo = () => History.undo();
window.redo = () => History.redo();
window.exportJSON = () => FileManager.exportJSON();
window.importJSON = () => FileManager.importJSON();

// ========== SECTION DRAG & DROP - PANEL ==========
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".panel");
  if (!container) return;

  // ------ CONFIG ------
  const STORAGE_KEY = "section-order";
  const DRAG_CONFIG = {
    delay: 300,
    scrollThreshold: 8,
    throttleMs: 16,
    moveCancel: 10,
  };

  // ------ STATE ------
  const sectionDrag = {
    active: false,
    pending: false,
    element: null,
    clone: null,
    placeholder: null,
    startY: 0,
    startX: 0,
    offsetY: 0,
    delayTimer: null,
    initialRect: null,
    scrollCancelled: false,
    rafId: null,
    lastMoveTime: 0,
    initialScrollTop: 0,
    touchId: null,
  };

  // ------ LOAD ORDER FROM STORAGE ------
  function loadOrder() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const order = JSON.parse(saved);
      const sections = container.querySelectorAll(".section");
      const sectionMap = new Map();

      sections.forEach((section) => {
        const id =
          section.dataset.id ||
          section.id ||
          section.querySelector(".section-header")?.textContent?.trim();
        if (id) sectionMap.set(id, section);
      });

      order.forEach((id) => {
        const section = sectionMap.get(id);
        if (section) {
          container.appendChild(section);
        }
      });

      console.log("✅ Section order loaded");
    } catch (e) {
      console.warn("Failed to load section order:", e);
    }
  }

  // ------ SAVE ORDER TO STORAGE ------
  function saveOrder() {
    try {
      const sections = container.querySelectorAll(
        ".section:not(.section-drag-placeholder)",
      );
      const order = [];

      sections.forEach((section) => {
        const id =
          section.dataset.id ||
          section.id ||
          section.querySelector(".section-header")?.textContent?.trim();
        if (id) order.push(id);
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      console.log("💾 Section order saved");
    } catch (e) {
      console.warn("Failed to save section order:", e);
    }
  }

  // ------ INIT ------
  loadOrder();

  container.querySelectorAll(".section").forEach((section) => {
    if (!section.dataset.id && !section.id) {
      section.dataset.id = "section-" + Math.random().toString(36).substr(2, 9);
    }

    const header = section.querySelector(".section-header");
    if (!header) return;

    section.draggable = false;

    // ========== MOUSE ==========
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("select, input, button, a, .control-btn, svg, span")) return;
      e.preventDefault();
      startPending(section, e.clientX, e.clientY, null);
    });

    // ========== TOUCH ==========
    header.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        if (e.target.closest("select, input, button, a, .control-btn, svg, span")) return;

        const touch = e.touches[0];
        startPending(section, touch.clientX, touch.clientY, touch.identifier);
      },
      { passive: true },
    );
  });

  // ------ START PENDING ------
  function startPending(section, clientX, clientY, touchId) {
    if (sectionDrag.pending || sectionDrag.active) {
      cancelPending();
    }

    const rect = section.getBoundingClientRect();

    Object.assign(sectionDrag, {
      pending: true,
      element: section,
      startX: clientX,
      startY: clientY,
      offsetY: clientY - rect.top,
      initialRect: rect,
      scrollCancelled: false,
      touchId: touchId,
      initialScrollTop: window.scrollY || document.documentElement.scrollTop,
    });

    sectionDrag.delayTimer = setTimeout(() => {
      if (!sectionDrag.pending || sectionDrag.scrollCancelled) return;

      const currentScroll =
        window.scrollY || document.documentElement.scrollTop;
      if (Math.abs(currentScroll - sectionDrag.initialScrollTop) > 2) {
        cancelPending();
        return;
      }

      startActualDrag();
    }, DRAG_CONFIG.delay);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMovePending, {passive: true});
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    window.addEventListener("scroll", onScrollDuringPending, { passive: true });
  }

  // ------ SCROLL DETECTION DURING PENDING ------
  function onScrollDuringPending() {
    if (!sectionDrag.pending || sectionDrag.active) return;
    cancelPending();
  }

  // ------ CANCEL PENDING ------
  function cancelPending() {
    clearTimeout(sectionDrag.delayTimer);
    sectionDrag.pending = false;
    sectionDrag.scrollCancelled = true;
    removeAllListeners();

    Object.assign(sectionDrag, {
      active: false,
      pending: false,
      element: null,
      delayTimer: null,
      initialRect: null,
      scrollCancelled: false,
      touchId: null,
    });
  }

  // ------ TOUCH MOVE DURING PENDING (passive) ------
  function onTouchMovePending(e) {
    if (!sectionDrag.pending || sectionDrag.active) {
      // اگر active شده، سوئیچ به onMove اصلی
      if (sectionDrag.active) {
        onMoveActive(e);
      }
      return;
    }

    const touch = getTouch(e);
    if (!touch) return;

    const dx = Math.abs(touch.clientX - sectionDrag.startX);
    const dy = Math.abs(touch.clientY - sectionDrag.startY);

    // 🆕 اگر انگشت حرکت کرد = اسکرول → لغو درگ
    if (dy > DRAG_CONFIG.moveCancel || dx > DRAG_CONFIG.moveCancel) {
      console.log(
        `🚫 Drag cancelled: finger moved (dx:${dx.toFixed(1)}, dy:${dy.toFixed(1)})`,
      );
      cancelPending();
    }
  }

  // ------ GET CORRECT TOUCH ------
  function getTouch(e) {
    if (!e.touches) return null;
    if (sectionDrag.touchId === null) return e.touches[0];

    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === sectionDrag.touchId) {
        return e.touches[i];
      }
    }
    return null;
  }

  // ------ ON MOVE (ONLY WHEN ACTIVE) ------
  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (sectionDrag.pending && !sectionDrag.active) {
      const dx = Math.abs(clientX - sectionDrag.startX);
      const dy = Math.abs(clientY - sectionDrag.startY);

      if (
        dy > DRAG_CONFIG.scrollThreshold ||
        dx > DRAG_CONFIG.scrollThreshold
      ) {
        cancelPending();
        return;
      }
      return;
    }

    if (!sectionDrag.active || !sectionDrag.clone) return;
    e.preventDefault();

    onMoveActive(e);
  }

  // ------ MOVE ACTIVE (shared logic) ------
  function onMoveActive(e) {
    if (!sectionDrag.active || !sectionDrag.clone) return;

    // فقط برای touch وقتی active هست باید prevent کنیم
    // اما چون listener passive هست، باید listener جدید اضافه کنیم
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const now = Date.now();
    if (now - sectionDrag.lastMoveTime < DRAG_CONFIG.throttleMs) return;
    sectionDrag.lastMoveTime = now;

    if (sectionDrag.rafId) {
      cancelAnimationFrame(sectionDrag.rafId);
    }

    sectionDrag.rafId = requestAnimationFrame(() => {
      if (!sectionDrag.clone) return;

      const newTop = clientY - sectionDrag.offsetY;
      sectionDrag.clone.style.transform = `translateY(${newTop - sectionDrag.initialRect.top}px) scale(1.02)`;

      updatePlaceholderPosition(clientY);
    });
  }

  // ------ UPDATE PLACEHOLDER ------
  function updatePlaceholderPosition(clientY) {
    const sections = container.querySelectorAll(
      ".section:not(.drag-original):not(.section-drag-placeholder)",
    );
    let targetSection = null;
    let insertBefore = true;

    for (const sec of sections) {
      const rect = sec.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (clientY < midY) {
        targetSection = sec;
        insertBefore = true;
        break;
      } else {
        targetSection = sec;
        insertBefore = false;
      }
    }

    if (!targetSection || !sectionDrag.placeholder) return;

    const placeholder = sectionDrag.placeholder;

    if (insertBefore) {
      if (placeholder.nextElementSibling !== targetSection) {
        container.insertBefore(placeholder, targetSection);
      }
    } else {
      const next = targetSection.nextElementSibling;
      if (next && next !== placeholder) {
        container.insertBefore(placeholder, next);
      } else if (!next && placeholder.nextElementSibling) {
        container.appendChild(placeholder);
      }
    }
  }

  // ------ START ACTUAL DRAG ------
  function startActualDrag() {
    if (sectionDrag.active || !sectionDrag.element) return;

    const section = sectionDrag.element;
    const rect = sectionDrag.initialRect;

    sectionDrag.pending = false;
    sectionDrag.active = true;

    document.removeEventListener("touchmove", onTouchMovePending);
    document.addEventListener("touchmove", onTouchMoveActive, {
      passive: false,
    });

    window.removeEventListener("scroll", onScrollDuringPending);

    // Clone
    sectionDrag.clone = section.cloneNode(true);
    sectionDrag.clone.classList.add("section-drag-clone");
    Object.assign(sectionDrag.clone.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      zIndex: "10000",
      pointerEvents: "none",
      opacity: "0.95",
      boxShadow: "var(--shadow)",
      borderRadius: "12px",
      background: "var(--bg-transparent)",
      backdropFilter: "blur(6px)",
      border: "2px solid var(--border)",
      willChange: "transform",
      transform: "scale(1.02)",
    });
    document.body.appendChild(sectionDrag.clone);

    // Placeholder
    sectionDrag.placeholder = document.createElement("div");
    sectionDrag.placeholder.className = "section-drag-placeholder";
    Object.assign(sectionDrag.placeholder.style, {
      height: rect.height + "px",
      marginBottom: "18px",
      border: "2px dashed var(--border)",
      borderRadius: "12px",
      background: "rgba(255,255,255,0.05)",
      transition: "height 0.2s ease",
    });

    section.classList.add("drag-original");
    Object.assign(section.style, {
      opacity: "0",
      height: "0",
      margin: "0",
      padding: "0",
      overflow: "hidden",
    });

    section.parentNode.insertBefore(sectionDrag.placeholder, section);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    if (navigator.vibrate) navigator.vibrate(30);
  }

  // ------ TOUCH MOVE WHEN ACTIVE (non-passive) ------
  function onTouchMoveActive(e) {
    if (!sectionDrag.active || !sectionDrag.clone) return;
    e.preventDefault();

    const touch = getTouch(e);
    if (!touch) return;

    const now = Date.now();
    if (now - sectionDrag.lastMoveTime < DRAG_CONFIG.throttleMs) return;
    sectionDrag.lastMoveTime = now;

    if (sectionDrag.rafId) {
      cancelAnimationFrame(sectionDrag.rafId);
    }

    sectionDrag.rafId = requestAnimationFrame(() => {
      if (!sectionDrag.clone) return;

      const newTop = touch.clientY - sectionDrag.offsetY;
      sectionDrag.clone.style.transform = `translateY(${newTop - sectionDrag.initialRect.top}px) scale(1.02)`;

      updatePlaceholderPosition(touch.clientY);
    });
  }

  // ------ REMOVE ALL LISTENERS ------
  function removeAllListeners() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onTouchMovePending);
    document.removeEventListener("touchmove", onTouchMoveActive);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
    window.removeEventListener("scroll", onScrollDuringPending);
  }

  // ------ ON END ------
  function onEnd() {
    clearTimeout(sectionDrag.delayTimer);
    if (sectionDrag.rafId) cancelAnimationFrame(sectionDrag.rafId);

    removeAllListeners();

    if (!sectionDrag.active) {
      cleanup();
      return;
    }

    if (sectionDrag.clone && sectionDrag.placeholder) {
      const placeholderRect = sectionDrag.placeholder.getBoundingClientRect();

      Object.assign(sectionDrag.clone.style, {
        transition: "all 0.2s ease-out",
        transform: "scale(1)",
        top: placeholderRect.top + "px",
        left: placeholderRect.left + "px",
        boxShadow: "var(--shadow)",
      });

      setTimeout(finalizeDrag, 200);
    } else {
      finalizeDrag();
    }
  }

  // ------ FINALIZE ------
  function finalizeDrag() {
    if (sectionDrag.element && sectionDrag.placeholder) {
      container.insertBefore(sectionDrag.element, sectionDrag.placeholder);
    }

    const wasActive = sectionDrag.active;
    cleanup();

    if (wasActive) {
      saveOrder();
    }
    refresh();
  }

  // ------ CLEANUP ------
  function cleanup() {
    sectionDrag.clone?.remove();
    sectionDrag.placeholder?.remove();

    if (sectionDrag.element) {
      sectionDrag.element.classList.remove("drag-original");
      sectionDrag.element.style.cssText = "";
    }

    Object.assign(document.body.style, {
      overflow: "",
      touchAction: "",
      userSelect: "",
      cursor: "",
    });

    Object.assign(sectionDrag, {
      active: false,
      pending: false,
      element: null,
      clone: null,
      placeholder: null,
      delayTimer: null,
      initialRect: null,
      scrollCancelled: false,
      rafId: null,
      lastMoveTime: 0,
      touchId: null,
      initialScrollTop: 0,
    });
  }
});

// ========== SECTION TOGGLE (ACCORDION) ==========
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".section").forEach((section) => {
    const header = section.querySelector(".section-header");
    const content = section.querySelector(".section-content");

    if (!header || !content) return;

    let isOpen = false;
    let isAnimating = false;

    // ------ Touch State ------
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouchMoved = false;

    // ------ CONFIG ------
    const TAP_THRESHOLD = 10;
    const TAP_MAX_DURATION = 300;

    content.style.height = "0px";

    // ------ Toggle Function ------
    function toggle() {
      if (isAnimating) return;
      isAnimating = true;

      if (isOpen) {
        content.style.height = content.scrollHeight + "px";
        content.offsetHeight;
        content.style.height = "0px";
        section.classList.remove("open");
      } else {
        content.style.height = content.scrollHeight + "px";
        section.classList.add("open");

        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }

      isOpen = !isOpen;
    }

    header.addEventListener("click", (e) => {
      if (e.target.closest("button, input, select, a, .control-btn, svg, span")) return;
      toggle();
    });

    // ------ Touch Events ------
    header.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        if (e.target.closest("select, input, button, a, .control-btn, svg, span")) return;

        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isTouchMoved = false;
      },
      { passive: true },
    );

    header.addEventListener(
      "touchmove",
      (e) => {
        if (!touchStartTime) return;

        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);

        if (deltaY > TAP_THRESHOLD) {
          isTouchMoved = true;
        }
      },
      { passive: true },
    );

    header.addEventListener(
      "touchend",
      (e) => {
        if (e.target.closest("button, input, select, a, .control-btn, svg, span")) return;

        const touchDuration = Date.now() - touchStartTime;

        if (!isTouchMoved && touchDuration < TAP_MAX_DURATION) {
          e.preventDefault();
          toggle();
        }

        touchStartY = 0;
        touchStartTime = 0;
        isTouchMoved = false;
      },
      { passive: false },
    );

    // ------ Transition End ------
    content.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "height") return;

      isAnimating = false;

      if (isOpen) {
        content.style.height = "auto";
      }
    });
  });
});

// ========== DIMENSION SYSTEM ==========
const aspectPresets = {
  free: { w: null, h: null },
  "1:1": { w: 1, h: 1 },
  "4:3": { w: 4, h: 3 },
  "16:9": { w: 16, h: 9 },
  "9:16": { w: 9, h: 16 },
};

const resolutionPresets = {
  "1280x720": { w: 1280, h: 720, name: "HD" },
  "1920x1080": { w: 1920, h: 1080, name: "FHD" },
  "2560x1440": { w: 2560, h: 1440, name: "2K" },
  "3840x2160": { w: 3840, h: 2160, name: "4K" },
};

const dimensionState = {
  aspectLocked: false,
  aspectW: null,
  aspectH: null,
  aspectRatio: null,
  activeAspectPreset: "free",

  activeResolutionPreset: null,
  isResolutionMode: false,
};

function clearAllPresetSelections() {
  dimensionState.activeAspectPreset = null;
  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;
  updateAllDimensionUI();
}

function setAspectRatio(ratioName) {
  const preset = aspectPresets[ratioName];
  if (!preset) return;

  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;

  if (preset.w === null) {
    // Free mode
    dimensionState.aspectW = null;
    dimensionState.aspectH = null;
    dimensionState.aspectRatio = null;
    dimensionState.aspectLocked = false;
    dimensionState.activeAspectPreset = "free";
  } else {
    dimensionState.aspectW = preset.w;
    dimensionState.aspectH = preset.h;
    dimensionState.aspectRatio = preset.w / preset.h;
    dimensionState.aspectLocked = true;
    dimensionState.activeAspectPreset = ratioName;
    applyAspectRatio(true);
  }

  updateAllDimensionUI();
}

function setCustomAspectRatio(w, h, applyToCanvas = true) {
  w = parseInt(w) || 0;
  h = parseInt(h) || 0;

  dimensionState.activeAspectPreset = null;
  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;

  if (w <= 0 || h <= 0) {
    dimensionState.aspectW = null;
    dimensionState.aspectH = null;
    dimensionState.aspectRatio = null;
    dimensionState.aspectLocked = false;
    dimensionState.activeAspectPreset = "free";
    updateAllDimensionUI();
    return;
  }

  // نسبت دقیقا با همان اعدادی که کاربر وارد کرده ذخیره شود
  dimensionState.aspectW = w;
  dimensionState.aspectH = h;
  dimensionState.aspectRatio = w / h;
  dimensionState.aspectLocked = true;

  // چک کن آیا با یک preset مطابقت داره
  for (const [name, preset] of Object.entries(aspectPresets)) {
    if (preset.w === w && preset.h === h) {
      dimensionState.activeAspectPreset = name;
      break;
    }
  }

  if (applyToCanvas) {
    applyAspectRatio(true);
  }

  updateAllDimensionUI();
}

function setResolution(w, h) {
  dimensionState.activeAspectPreset = null;

  state.canvasWidth = clamp(w, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
  state.canvasHeight = clamp(h,CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);

  const simple = simplifyRatio(w, h);
  dimensionState.aspectW = simple.w;
  dimensionState.aspectH = simple.h;
  dimensionState.aspectRatio = w / h;
  dimensionState.aspectLocked = true;

  const key = `${w}x${h}`;
  if (resolutionPresets[key]) {
    dimensionState.activeResolutionPreset = key;
    dimensionState.isResolutionMode = true;
  } else {
    dimensionState.activeResolutionPreset = null;
    dimensionState.isResolutionMode = false;
  }

  updateSizeInputs();
  updateAllDimensionUI();
  refresh();
  fitToScreen();
}

function applyAspectRatio(adjustHeight = true) {
  if (!dimensionState.aspectRatio) return;

  if (adjustHeight) {
    state.canvasHeight = Math.round(
      state.canvasWidth / dimensionState.aspectRatio,
    );
    state.canvasHeight = clamp(
      state.canvasHeight,
      CONFIG.canvas.minHeight,
      CONFIG.canvas.maxHeight,
    );

    if (
      state.canvasHeight === CONFIG.canvas.minHeight ||
      state.canvasHeight === CONFIG.canvas.maxHeight
    ) {
      state.canvasWidth = Math.round(
        state.canvasHeight * dimensionState.aspectRatio,
      );
      state.canvasWidth = clamp(
        state.canvasWidth,
        CONFIG.canvas.minWidth,
        CONFIG.canvas.maxWidth,
      );
    }
  } else {
    state.canvasWidth = Math.round(
      state.canvasHeight * dimensionState.aspectRatio,
    );
    state.canvasWidth = clamp(
      state.canvasWidth,
      CONFIG.canvas.minWidth,
      CONFIG.canvas.maxWidth,
    );

    if (
      state.canvasWidth === CONFIG.canvas.minWidth ||
      state.canvasWidth === CONFIG.canvas.maxWidth
    ) {
      state.canvasHeight = Math.round(
        state.canvasWidth / dimensionState.aspectRatio,
      );
      state.canvasHeight = clamp(
        state.canvasHeight,
        CONFIG.canvas.minHeight,
        CONFIG.canvas.maxHeight,
      );
    }
  }

  updateSizeInputs();
  refresh();
  fitToScreen();
}

function toggleAspectLock() {
  dimensionState.aspectLocked = !dimensionState.aspectLocked;

  if (dimensionState.aspectLocked) {
    const simple = simplifyRatio(state.canvasWidth, state.canvasHeight);
    dimensionState.aspectW = simple.w;
    dimensionState.aspectH = simple.h;
    dimensionState.aspectRatio = state.canvasWidth / state.canvasHeight;
  } else {
    dimensionState.activeAspectPreset = "free";
  }

  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;

  updateAllDimensionUI();
}

function swapDimensions() {
  const temp = state.canvasWidth;
  state.canvasWidth = state.canvasHeight;
  state.canvasHeight = temp;

  state.canvasWidth = clamp(
    state.canvasWidth,
    CONFIG.canvas.minWidth,
    CONFIG.canvas.maxWidth,
  );
  state.canvasHeight = clamp(
    state.canvasHeight,
    CONFIG.canvas.minHeight,
    CONFIG.canvas.maxHeight,
  );

  if (dimensionState.aspectW !== null && dimensionState.aspectH !== null) {
    const tempA = dimensionState.aspectW;
    dimensionState.aspectW = dimensionState.aspectH;
    dimensionState.aspectH = tempA;
    dimensionState.aspectRatio =
      dimensionState.aspectW / dimensionState.aspectH;
  }

  dimensionState.activeAspectPreset = null;
  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;

  checkAndSetMatchingPresets();

  updateSizeInputs();
  updateAllDimensionUI();
  refresh();
  fitToScreen();
}

function handleWidthChange(newWidth, fromInput = false) {
  newWidth = clamp(
    parseInt(newWidth) || CONFIG.canvas.minWidth,
    CONFIG.canvas.minWidth,
    CONFIG.canvas.maxWidth,
  );
  state.canvasWidth = newWidth;

  if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
    state.canvasHeight = Math.round(newWidth / dimensionState.aspectRatio);
    state.canvasHeight = clamp(
      state.canvasHeight,
      CONFIG.canvas.minHeight,
      CONFIG.canvas.maxHeight,
    );
  }

  if (fromInput) {
    clearResolutionPreset();
    checkAndSetMatchingPresets();
  }

  updateSizeInputs();
  updateSizeDisplay();
  draw();
  updateCSS();
  updateAllDimensionUI();
  resize();
}

function handleHeightChange(newHeight, fromInput = false) {
  newHeight = clamp(
    parseInt(newHeight) || CONFIG.canvas.minHeight,
    CONFIG.canvas.minHeight,
    CONFIG.canvas.maxHeight,
  );
  state.canvasHeight = newHeight;

  if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
    state.canvasWidth = Math.round(newHeight * dimensionState.aspectRatio);
    state.canvasWidth = clamp(
      state.canvasWidth,
      CONFIG.canvas.minWidth,
      CONFIG.canvas.maxWidth,
    );
  }

  if (fromInput) {
    clearResolutionPreset();
    checkAndSetMatchingPresets();
  }

  updateSizeInputs();
  updateSizeDisplay();
  draw();
  updateCSS();
  updateAllDimensionUI();
  resize();
}

function clearResolutionPreset() {
  dimensionState.activeResolutionPreset = null;
  dimensionState.isResolutionMode = false;
}

function checkAndSetMatchingPresets() {
  if (dimensionState.aspectW && dimensionState.aspectH) {
    dimensionState.activeAspectPreset = null;
    for (const [name, preset] of Object.entries(aspectPresets)) {
      if (
        preset.w === dimensionState.aspectW &&
        preset.h === dimensionState.aspectH
      ) {
        dimensionState.activeAspectPreset = name;
        break;
      }
    }
  }

  const key = `${state.canvasWidth}x${state.canvasHeight}`;
  if (resolutionPresets[key]) {
    dimensionState.activeResolutionPreset = key;
  }
}

// ------ UI UPDATE FUNCTIONS ------

function updateAllDimensionUI() {
  updateAspectButtonsUI();
  updateAspectInputsUI();
  updateResolutionButtonsUI();
  updateResolutionInputsUI();
  updateLockButtonUI();
}

function updateAspectButtonsUI() {
  document.querySelectorAll(".aspect-btn").forEach((btn) => {
    const ratio = btn.dataset.ratio;
    let isActive = false;

    if (ratio === "free" && !dimensionState.aspectLocked) {
      isActive = true;
    } else if (
      ratio === dimensionState.activeAspectPreset &&
      dimensionState.aspectLocked
    ) {
      isActive = true;
    }

    btn.classList.toggle("active", isActive);
  });
}

function updateAspectInputsUI() {
  const inputW = document.getElementById("aspectW");
  const inputH = document.getElementById("aspectH");

  if (!inputW || !inputH) return;

  if (
    dimensionState.aspectLocked &&
    dimensionState.aspectW &&
    dimensionState.aspectH
  ) {
    inputW.value = dimensionState.aspectW;
    inputH.value = dimensionState.aspectH;
  } else {
    const simple = simplifyRatio(state.canvasWidth, state.canvasHeight);
    inputW.value = simple.w;
    inputH.value = simple.h;
  }
}

function updateResolutionButtonsUI() {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    const w = parseInt(btn.dataset.w);
    const h = parseInt(btn.dataset.h);
    const key = `${w}x${h}`;

    const isActive = dimensionState.activeResolutionPreset === key;
    btn.classList.toggle("selected", isActive);
  });
}

function updateResolutionInputsUI() {
  const inputW = document.getElementById("canvasWidth");
  const inputH = document.getElementById("canvasHeight");

  if (!inputW || !inputH) return;

  inputW.value = Math.floor(state.canvasWidth);
  inputH.value = Math.floor(state.canvasHeight);
}

function updateLockButtonUI() {
  const lockBtn = document.getElementById("aspectLockBtn");
  const lockIcon = document
    .getElementById("aspectLockBtn")
    .querySelector("svg");
  const linkIcon = document.getElementById("sizeLinkBtn").querySelector("svg");
  const linkBtn = document.getElementById("sizeLinkBtn");

  if (lockBtn) {
    lockBtn.classList.toggle("locked", dimensionState.aspectLocked);
    lockIcon.innerHTML = dimensionState.aspectLocked
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>
          
<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
          
<g id="SVGRepo_iconCarrier"> <path d="M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C15.9474 10 16.5286 10 17 10.0288M7 10.0288C6.41168 10.0647 5.99429 10.1455 5.63803 10.327C5.07354 10.6146 4.6146 11.0735 4.32698 11.638C4 12.2798 4 13.1198 4 14.8V16.2C4 17.8802 4 18.7202 4.32698 19.362C4.6146 19.9265 5.07354 20.3854 5.63803 20.673C6.27976 21 7.11984 21 8.8 21H15.2C16.8802 21 17.7202 21 18.362 20.673C18.9265 20.3854 19.3854 19.9265 19.673 19.362C20 18.7202 20 17.8802 20 16.2V14.8C20 13.1198 20 12.2798 19.673 11.638C19.3854 11.0735 18.9265 10.6146 18.362 10.327C18.0057 10.1455 17.5883 10.0647 17 10.0288M7 10.0288V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V10.0288" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>
          
</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M16.584 6C15.8124 4.2341 14.0503 3 12 3C9.23858 3 7 5.23858 7 8V10.0288M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C16.8802 10 17.7202 10 18.362 10.327C18.9265 10.6146 19.3854 11.0735 19.673 11.638C20 12.2798 20 13.1198 20 14.8V16.2C20 17.8802 20 18.7202 19.673 19.362C19.3854 19.9265 18.9265 20.3854 18.362 20.673C17.7202 21 16.8802 21 15.2 21H8.8C7.11984 21 6.27976 21 5.63803 20.673C5.07354 20.3854 4.6146 19.9265 4.32698 19.362C4 18.7202 4 17.8802 4 16.2V14.8C4 13.1198 4 12.2798 4.32698 11.638C4.6146 11.0735 5.07354 10.6146 5.63803 10.327C5.99429 10.1455 6.41168 10.0647 7 10.0288Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>`;
  }

  if (linkBtn) {
    linkBtn.classList.toggle("linked", dimensionState.aspectLocked);
    linkBtn.innerHTML = dimensionState.aspectLocked
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

          <g id="SVGRepo_bgCarrier" stroke-width="0"></g>

          <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>

          <g id="SVGRepo_iconCarrier">
            <path d="M14 7H16C18.7614 7 21 9.23858 21 12C21 14.7614 18.7614 17 16 17H14M10 7H8C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10M8 12H16" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          </g>

        </svg>
`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
  <g id="SVGRepo_iconCarrier">
    <path d="M14 7H16C18.7614 7 21 9.23858 21 12C21 14.7614 18.7614 17 16 17H14M10 7H8C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10"
          stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
  }
}

function updateSizeInputs() {
  if (canvasWidth) canvasWidth.value = Math.floor(state.canvasWidth);
  if (canvasHeight) canvasHeight.value = Math.floor(state.canvasHeight);
}

function updateSizeDisplay() {
  const el = document.getElementById("sizeDisplay");
  if (el) {
    el.textContent = `${Math.round(state.canvasWidth)} × ${Math.round(
      state.canvasHeight,
    )}`;
  }
}

// ========== CENTER UI ==========
const toolbar = document.querySelector(".tool-bar");
const zoomControls = document.querySelector(".zoom-controls");
const canvasWrap = document.querySelector(".canvas-wrap");

canvasWrap.addEventListener("scroll", () => {
  const x = canvasWrap.scrollLeft;
  const y = canvasWrap.scrollTop;
  toolbar.style.transform = `translate(${x}px, ${y}px)`;
  zoomControls.style.transform = `translate(${x}px, ${y}px)`;
  zoomControls.style.transition = `none`;
  toolbar.style.transition = `none`;
});

function getEventPos(e) {
  const rect = canvas.getBoundingClientRect();

  let clientX, clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const scaleX = W / rect.width;
  const scaleY = H / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// ========== UTILITIES ==========
canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });
document.addEventListener("mousemove", onPointerMove);
document.addEventListener("touchmove", onPointerMove, { passive: false });
document.addEventListener("mouseup", onPointerUp);
document.addEventListener("touchend", onPointerUp);

function onPointerDown(e) {
  e.preventDefault();

  if (panState.mode || panState.isPinch) {
    return;
  }

  const pos = getEventPos(e);
  const mx = pos.x;
  const my = pos.y;
  const hitRadius = getHitRadius();

  for (const s of [...state.stops].reverse().filter((s) => s.visible)) {
    const cx = s.x * W;
    const cy = s.y * H;

    if (s.type === "radial") {
      if (Math.hypot(cx - mx, cy - my) < hitRadius) {
        drag = { t: "move", s };
        state.selected = s.id;
        refresh();
        return;
      }
    } else if (s.type === "linear") {
      const angleRad = ((s.angle - 90) * Math.PI) / 180;
      const handleLen = Math.min(W, H) * 0.35;
      const dx = Math.cos(angleRad) * handleLen;
      const dy = Math.sin(angleRad) * handleLen;
      const x1 = cx - dx,
        y1 = cy - dy;
      const x2 = cx + dx,
        y2 = cy + dy;

      // بررسی Color Stops
      for (let i = 0; i < s.stops.length; i++) {
        const px = lerp(x1, x2, s.stops[i].pos / 100);
        const py = lerp(y1, y2, s.stops[i].pos / 100);
        if (Math.hypot(px - mx, py - my) < hitRadius) {
          drag = { t: "cs", s, i, x1, y1, x2, y2 };
          state.selected = s.id;
          refresh();
          return;
        }
      }

      // بررسی مرکز
      if (Math.hypot(cx - mx, cy - my) < hitRadius) {
        drag = { t: "move", s };
        state.selected = s.id;
        refresh();
        return;
      }

      // ✅ بررسی خط برای چرخش - با ذخیره offset
      const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const t =
        ((mx - x1) * (x2 - x1) + (my - y1) * (y2 - y1)) / (lineLen * lineLen);
      if (t >= 0 && t <= 1) {
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        if (Math.hypot(projX - mx, projY - my) < hitRadius) {
          // ✅ محاسبه زاویه فعلی موس
          let mouseAngle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
          if (mouseAngle < 0) mouseAngle += 360;

          // ✅ ذخیره offset بین زاویه فعلی و زاویه موس
          const angleOffset = s.angle - mouseAngle;

          drag = { t: "angle", s, cx, cy, angleOffset };
          state.selected = s.id;
          refresh();
          return;
        }
      }
    } else if (s.type === "conic") {
      const radius = Math.min(W, H) * 0.25;
      const startAngleRad = ((s.startAngle - 90) * Math.PI) / 180;

      // بررسی Color Stops روی دایره
      for (let i = 0; i < s.stops.length; i++) {
        const stopAngle = startAngleRad + (s.stops[i].pos / 100) * Math.PI * 2;
        const px = cx + Math.cos(stopAngle) * radius;
        const py = cy + Math.sin(stopAngle) * radius;
        if (Math.hypot(px - mx, py - my) < hitRadius) {
          drag = { t: "conic-cs", s, i, radius };
          state.selected = s.id;
          refresh();
          return;
        }
      }

      // بررسی نقطه انتهای خط شعاعی (هندل چرخش)
      const rotateX = cx + Math.cos(startAngleRad) * radius;
      const rotateY = cy + Math.sin(startAngleRad) * radius;
      if (Math.hypot(rotateX - mx, rotateY - my) < hitRadius) {
        // ✅ ذخیره offset برای conic هم
        let mouseAngle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
        if (mouseAngle < 0) mouseAngle += 360;
        const angleOffset = s.startAngle - mouseAngle;

        drag = { t: "conic-angle", s, angleOffset };
        state.selected = s.id;
        refresh();
        return;
      }

      // بررسی کل خط شعاعی
      const lineDx = rotateX - cx;
      const lineDy = rotateY - cy;
      const lineLen2 = lineDx * lineDx + lineDy * lineDy;
      const t = ((mx - cx) * lineDx + (my - cy) * lineDy) / lineLen2;
      if (t >= 0.3 && t <= 1) {
        const projX = cx + t * lineDx;
        const projY = cy + t * lineDy;
        if (Math.hypot(projX - mx, projY - my) < hitRadius) {
          // ✅ ذخیره offset
          let mouseAngle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
          if (mouseAngle < 0) mouseAngle += 360;
          const angleOffset = s.startAngle - mouseAngle;

          drag = { t: "conic-angle", s, angleOffset };
          state.selected = s.id;
          refresh();
          return;
        }
      }

      // بررسی مرکز
      if (Math.hypot(cx - mx, cy - my) < hitRadius) {
        drag = { t: "move", s };
        state.selected = s.id;
        refresh();
        return;
      }
    }
  }

  state.selected = null;
  refresh();
}

function onPointerMove(e) {
  if (!drag) return;
  e.preventDefault();

  const pos = getEventPos(e);
  const mx = pos.x;
  const my = pos.y;
  const cx = drag.s.x * W;
  const cy = drag.s.y * H;

  switch (drag.t) {
    case "move":
      drag.s.x = clamp(mx / W, 0, 1);
      if (!state.lockVertical) {
        drag.s.y = clamp(my / H, 0, 1);
      }
      break;

    case "cs":
      const { x1, y1, x2, y2 } = drag;
      const dx = x2 - x1,
        dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      const t = clamp(((mx - x1) * dx + (my - y1) * dy) / len2, 0, 1);
      drag.s.stops[drag.i].pos = Math.round(t * 100);
      break;

    case "angle":
      // ✅ استفاده از offset ذخیره شده
      let newAngle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
      if (newAngle < 0) newAngle += 360;

      // ✅ اضافه کردن offset
      newAngle = (newAngle + (drag.angleOffset || 0)) % 360;
      if (newAngle < 0) newAngle += 360;

      drag.s.angle = Math.round(newAngle);
      break;

    case "conic-angle":
      // ✅ استفاده از offset برای conic
      let conicAngle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
      if (conicAngle < 0) conicAngle += 360;

      // ✅ اضافه کردن offset
      conicAngle = (conicAngle + (drag.angleOffset || 0)) % 360;
      if (conicAngle < 0) conicAngle += 360;

      drag.s.startAngle = Math.round(conicAngle);
      break;

    case "conic-cs":
      const startAngleRad = ((drag.s.startAngle - 90) * Math.PI) / 180;
      let relAngle = Math.atan2(my - cy, mx - cx) - startAngleRad;
      if (relAngle < 0) relAngle += Math.PI * 2;
      drag.s.stops[drag.i].pos = clamp(
        Math.round((relAngle / (Math.PI * 2)) * 100),
        0,
        100,
      );
      break;
  }

  throttledDraw();
  updateStopItem(drag.s.id);
  updateInspectorInputs(drag.s.id);
  updateCSS();
}

function onPointerUp() {
  if (drag) {
    updateCSS();
    updateInspectorInputs(drag.s.id);
  }
  drag = null;
}

function getCanvasBlendMode(mode) {
  return !mode || mode === "normal" ? "source-over" : mode;
}

function hasNonBlurFilters() {
  return (
    filterState.enabled &&
    (filterState.brightness !== 100 ||
      filterState.contrast !== 100 ||
      filterState.saturate !== 100 ||
      filterState.hue !== 0 ||
      filterState.grayscale > 0 ||
      filterState.sepia > 0 ||
      filterState.invert > 0)
  );
}

// ========== DRAWING FUNCTIONS ==========
const IS_MOBILE = (() => {
  try {
    return (
      matchMedia("(pointer: coarse)").matches ||
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
        window.innerWidth < 1024)
    );
  } catch {
    return false;
  }
})();

const _canvasPool = {};
function tmpCanvas(key, w, h) {
  let e = _canvasPool[key];
  if (!e || e.canvas.width !== w || e.canvas.height !== h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    e = { canvas: c, ctx: c.getContext("2d") };
    _canvasPool[key] = e;
  } else {
    e.ctx.clearRect(0, 0, w, h);
  }
  return e;
}

let _scale = 1;
function updateScale() {
  _scale = Math.max(W, H) / 800;
}
let _sceneCanvas = null;
let _sceneCtx = null;
let _blurCanvas = null;
let _blurCtx = null;

function getSceneCanvas(w, h) {
  if (!_sceneCanvas || _sceneCanvas.width !== w || _sceneCanvas.height !== h) {
    _sceneCanvas = document.createElement("canvas");
    _sceneCanvas.width = w;
    _sceneCanvas.height = h;
    _sceneCtx = _sceneCanvas.getContext("2d");
  } else {
    _sceneCtx.clearRect(0, 0, w, h);
  }
  return { canvas: _sceneCanvas, ctx: _sceneCtx };
}

function getBlurCanvas(w, h) {
  if (!_blurCanvas || _blurCanvas.width !== w || _blurCanvas.height !== h) {
    _blurCanvas = document.createElement("canvas");
    _blurCanvas.width = w;
    _blurCanvas.height = h;
    _blurCtx = _blurCanvas.getContext("2d");
  } else {
    _blurCtx.clearRect(0, 0, w, h);
  }
  return { canvas: _blurCanvas, ctx: _blurCtx };
}

// ------ THROTTLED DRAW ------
let drawRAF = null;
function throttledDraw() {
  if (drawRAF) return;
  drawRAF = requestAnimationFrame(() => {
    drawRAF = null;
    draw();
  });
}

// ------ MAIN DRAW ------
function draw() {
  const dpr = canvas.width / W;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateScale();

  const canvasW = canvas.width;
  const canvasH = canvas.height;

  const { canvas: sceneCanvas, ctx: sceneCtx } = getSceneCanvas(
    canvasW,
    canvasH,
  );

  sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawSceneContent(sceneCtx, W, H);

  if (hasActiveFilters()) {
    applyCanvasFilters(sceneCanvas, sceneCtx, dpr);
  }

  if (noiseState.enabled && noiseState.opacity > 0) {
    applyNoiseLayerSync(sceneCtx, canvasW, canvasH);
  }

  ctx.drawImage(sceneCanvas, 0, 0);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.lockVertical && state.showHandles) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2 * _scale;
    ctx.setLineDash([10 * _scale, 5 * _scale]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.showHandles) {
    state.stops.filter((s) => s.visible).forEach(drawHandle);
  }
}

function drawSceneContent(tCtx, w, h) {
  const visible = state.stops.filter((s) => s.visible);

  // 1. پس‌زمینه
  if (state.bgEnabled) {
    tCtx.fillStyle = rgba(state.bgColor, state.bgAlpha / 100);
    tCtx.fillRect(0, 0, w, h);
  }

  if (!visible.length) return;

  // 2. گرادینت‌ها
  const reversed = [...visible].reverse();
  const needsBgBlend =
    state.bgEnabled && state.bgBlendMode && state.bgBlendMode !== "normal";

  if (needsBgBlend) {
    const tmp = tmpCanvas("blend", w, h);
    reversed.forEach((s) => {
      tmp.ctx.globalCompositeOperation = getCanvasBlendMode(s.blendMode);
      drawGradient(s, tmp.ctx, w, h);
    });
    tmp.ctx.globalCompositeOperation = "source-over";

    tCtx.globalCompositeOperation = getCanvasBlendMode(state.bgBlendMode);
    tCtx.drawImage(tmp.canvas, 0, 0);
    tCtx.globalCompositeOperation = "source-over";
  } else {
    reversed.forEach((s) => {
      tCtx.globalCompositeOperation = getCanvasBlendMode(s.blendMode);
      drawGradient(s, tCtx, w, h);
    });
    tCtx.globalCompositeOperation = "source-over";
  }
}

// ------ APPLY FILTERS ------
function applyCanvasFilters(targetCanvas, targetCtx, dpr) {
  const w = targetCanvas.width;
  const h = targetCanvas.height;

  if (filterState.blur > 0) {
    const blurPx = filterState.blur * dpr;
    const padding = Math.ceil(blurPx * 3);

    const paddedW = w + padding * 2;
    const paddedH = h + padding * 2;

    const padded = document.createElement("canvas");
    padded.width = paddedW;
    padded.height = paddedH;
    const pCtx = padded.getContext("2d");

    // مرکز - تصویر اصلی
    pCtx.drawImage(targetCanvas, padding, padding);

    // لبه بالا (flip vertical)
    pCtx.save();
    pCtx.translate(padding, padding);
    pCtx.scale(1, -1);
    pCtx.drawImage(targetCanvas, 0, 0, w, padding, 0, 0, w, padding);
    pCtx.restore();

    // لبه پایین (flip vertical)
    pCtx.save();
    pCtx.translate(padding, h + padding);
    pCtx.scale(1, -1);
    pCtx.drawImage(
      targetCanvas,
      0,
      h - padding,
      w,
      padding,
      0,
      -padding,
      w,
      padding,
    );
    pCtx.restore();

    // لبه چپ (flip horizontal)
    pCtx.save();
    pCtx.translate(padding, padding);
    pCtx.scale(-1, 1);
    pCtx.drawImage(targetCanvas, 0, 0, padding, h, 0, 0, padding, h);
    pCtx.restore();

    // لبه راست (flip horizontal)
    pCtx.save();
    pCtx.translate(w + padding, padding);
    pCtx.scale(-1, 1);
    pCtx.drawImage(
      targetCanvas,
      w - padding,
      0,
      padding,
      h,
      -padding,
      0,
      padding,
      h,
    );
    pCtx.restore();

    // گوشه‌ها (flip both)
    // بالا-چپ
    pCtx.save();
    pCtx.translate(padding, padding);
    pCtx.scale(-1, -1);
    pCtx.drawImage(
      targetCanvas,
      0,
      0,
      padding,
      padding,
      0,
      0,
      padding,
      padding,
    );
    pCtx.restore();

    // بالا-راست
    pCtx.save();
    pCtx.translate(w + padding, padding);
    pCtx.scale(-1, -1);
    pCtx.drawImage(
      targetCanvas,
      w - padding,
      0,
      padding,
      padding,
      -padding,
      0,
      padding,
      padding,
    );
    pCtx.restore();

    // پایین-چپ
    pCtx.save();
    pCtx.translate(padding, h + padding);
    pCtx.scale(-1, -1);
    pCtx.drawImage(
      targetCanvas,
      0,
      h - padding,
      padding,
      padding,
      0,
      -padding,
      padding,
      padding,
    );
    pCtx.restore();

    // پایین-راست
    pCtx.save();
    pCtx.translate(w + padding, h + padding);
    pCtx.scale(-1, -1);
    pCtx.drawImage(
      targetCanvas,
      w - padding,
      h - padding,
      padding,
      padding,
      -padding,
      -padding,
      padding,
      padding,
    );
    pCtx.restore();

    // اعمال blur
    const { canvas: blurred, ctx: bCtx } = getBlurCanvas(paddedW, paddedH);
    bCtx.filter = `blur(${blurPx}px)`;
    bCtx.drawImage(padded, 0, 0);

    // برش و برگرداندن به سایز اصلی
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, w, h);
    targetCtx.drawImage(blurred, padding, padding, w, h, 0, 0, w, h);
  }

  // ========== سایر فیلترها با ImageData ==========
  if (hasNonBlurFilters()) {
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    const imageData = targetCtx.getImageData(0, 0, w, h);
    applyFiltersToImageData(imageData);
    targetCtx.putImageData(imageData, 0, 0);
  }
}

// ------ NOISE LAYER ------
function applyNoiseLayerSync(tCtx, w, h) {
  if (
    noiseCache.canvas &&
    noiseCache.width === W &&
    noiseCache.height === H &&
    noiseCache.frequency === noiseState.frequency
  ) {
    tCtx.save();
    tCtx.setTransform(1, 0, 0, 1, 0, 0);
    tCtx.globalCompositeOperation = noiseState.blend;
    tCtx.globalAlpha = noiseState.opacity / 100;
    tCtx.drawImage(noiseCache.canvas, 0, 0, w, h);
    tCtx.restore();
  } else {
    // تولید async و ذخیره در cache - دفعه بعد استفاده میشه
    getNoiseCanvas(W, H, noiseState.frequency).then(() => {
      // Redraw when noise is ready
      if (noiseState.enabled && noiseState.opacity > 0) {
        draw();
      }
    });
  }
}

// ------ UNIFIED GRADIENT ------
function drawGradient(s, tCtx, w, h) {
  const cx = s.x * w;
  const cy = s.y * h;

  if (s.type === "radial") {
    const scale = w !== W || h !== H ? Math.max(w, h) / Math.max(W, H) : 1;
    const r = s.size * scale;
    const solidEnd = 1 - (s.feather ?? 60) / 100;
    const color = rgba(s.color, s.opacity / 100);
    const grad = tCtx.createRadialGradient(cx, cy, 0, cx, cy, r);

    addRadialGradientStops(grad, color, s.color, solidEnd);

    tCtx.fillStyle = grad;
    tCtx.beginPath();
    tCtx.arc(cx, cy, r, 0, Math.PI * 2);
    tCtx.fill();
  } else if (s.type === "linear") {
    const rad = ((s.angle - 90) * Math.PI) / 180;
    const diag = Math.hypot(w, h);
    const mx = w / 2,
      my = h / 2;
    const dx = (Math.cos(rad) * diag) / 2;
    const dy = (Math.sin(rad) * diag) / 2;
    const grad = tCtx.createLinearGradient(mx - dx, my - dy, mx + dx, my + dy);

    s.stops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, w, h);
  } else if (s.type === "conic") {
    const grad = tCtx.createConicGradient(
      ((s.startAngle - 90) * Math.PI) / 180,
      cx,
      cy,
    );

    s.stops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, w, h);
  }
}

// ------ HANDLE SIZING ------
function getHandleSize(sel) {
  const mobileBoost = IS_MOBILE ? 1.6 : 1;
  const base = sel ? 12 : 8;
  const size = base * _scale * mobileBoost;
  return clamp(size, base * mobileBoost, (sel ? 50 : 35) * mobileBoost);
}

function getLineWidth(sel) {
  const mobileBoost = IS_MOBILE ? 1 : 0.6;
  const base = sel ? 5 : 4;
  const width = base * _scale * mobileBoost;
  return clamp(width, base * mobileBoost, (sel ? 16 : 12) * mobileBoost);
}

function getFontSize() {
  const mobileBoost = IS_MOBILE ? 1.3 : 1.2;
  const size = 10 * _scale * mobileBoost;
  return clamp(size, 10 * mobileBoost, 36 * mobileBoost);
}

function getHitRadius(sel) {
  const visualSize = getHandleSize(sel);
  const minHitSize = IS_MOBILE ? 22 : 12; // ۴۴px touch target روی موبایل (22*2)
  return Math.max(visualSize, minHitSize);
}

// ========== GRADIENT HANDLE ==========
function drawHandle(s) {
  const sel = state.selected === s.id;
  const cx = s.x * W,
    cy = s.y * H;

  if (s.type === "radial") drawRadialHandle(s, cx, cy, sel);
  else if (s.type === "linear") drawLinearHandle(s, cx, cy, sel);
  else if (s.type === "conic") drawConicHandle(s, cx, cy, sel);
}

function drawRadialHandle(s, cx, cy, sel) {
  const hs = getHandleSize(sel);
  const lw = getLineWidth(sel);
  const fillStyleValue = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--bg-transparent");

  ctx.save();

  ctx.fillStyle = fillStyleValue;
  ctx.beginPath();
  ctx.arc(cx, cy, hs * 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (sel) {
    ctx.save();
    ctx.strokeStyle = fillStyleValue;
    ctx.setLineDash([10 * _scale, 10 * _scale]);
    ctx.lineWidth = 2 * _scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, s.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  const innerGrad = ctx.createRadialGradient(
    cx - hs * 0.2,
    cy - hs * 0.2,
    0,
    cx,
    cy,
    hs * 0.6,
  );

  innerGrad.addColorStop(0, lighten(s.color, 30));
  innerGrad.addColorStop(1, s.color);

  ctx.fillStyle = innerGrad;

  ctx.beginPath();
  ctx.arc(cx, cy, hs * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = innerGrad;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, hs * 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLinearHandle(s, cx, cy, sel) {
  const hs = getHandleSize(sel);
  const lw = getLineWidth(sel);
  const fs = getFontSize();

  const rad = ((s.angle - 90) * Math.PI) / 180;
  const len = Math.min(W, H) * 0.35;
  const dx = Math.cos(rad) * len,
    dy = Math.sin(rad) * len;
  const x1 = cx - dx,
    y1 = cy - dy;
  const x2 = cx + dx,
    y2 = cy + dy;

  ctx.save();

  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 10 * _scale;

  const lineGrad = ctx.createLinearGradient(x1, y1, x2, y2);
  if (s.stops.length >= 2) {
    s.stops.forEach((cs) => {
      lineGrad.addColorStop(cs.pos / 100, rgba(cs.color, sel ? 0.8 : 0.4));
    });
  } else {
    const alpha = sel ? 0.6 : 0.3;
    lineGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    lineGrad.addColorStop(1, `rgba(255,255,255,${alpha})`);
  }

  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();

  drawCenterHandle(cx, cy, sel, hs * 0.6, lw);

  s.stops.forEach((cs) => {
    const px = lerp(x1, x2, cs.pos / 100);
    const py = lerp(y1, y2, cs.pos / 100);
    drawColorStop(px, py, cs, sel, hs, lw);

    if (sel) {
      drawStopLabel(px, py + hs + 20 * _scale, cs.pos + "%", fs, cs.color);
    }
  });
}

function drawConicHandle(s, cx, cy, sel) {
  const hs = getHandleSize(sel);
  const lw = getLineWidth(sel);
  const fs = getFontSize();
  const radius = Math.min(W, H) * 0.25;
  const startRad = ((s.startAngle - 90) * Math.PI) / 180;
  const fillStyleValue = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--bg-transparent");
  const shadow = getComputedStyle(document.documentElement).getPropertyValue(
    "--shadow-elevated",
  );

  if (sel) {
    ctx.save();
    ctx.strokeStyle = fillStyleValue;
    ctx.setLineDash([10 * _scale, 10 * _scale]);
    ctx.lineWidth = 2 * _scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const rx = cx + Math.cos(startRad) * radius;
  const ry = cy + Math.sin(startRad) * radius;

  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 10 * _scale;
  ctx.shadowOffsetY = 2 * _scale;
  ctx.strokeStyle = fillStyleValue;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.restore();

  s.stops.forEach((cs) => {
    const angle = startRad + (cs.pos / 100) * Math.PI * 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;

    drawColorStop(px, py, cs, sel, hs * 0.8, lw);

    if (sel) {
      const lr = radius + hs + 28 * _scale;
      drawStopLabel(
        cx + Math.cos(angle) * lr,
        cy + Math.sin(angle) * lr,
        cs.pos + "%",
        fs,
        cs.color,
      );
    }
  });

  drawCenterHandle(cx, cy, sel, hs * 0.6, lw);
}

function drawColorStop(px, py, cs, sel, hs, lw) {
  const fillStyleValue = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--bg-transparent");

  ctx.save();
  ctx.fillStyle = fillStyleValue;
  ctx.beginPath();
  ctx.arc(px, py, hs * 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const innerGrad = ctx.createRadialGradient(
    px - hs * 0.2,
    py - hs * 0.2,
    0,
    px,
    py,
    hs * 0.6,
  );
  innerGrad.addColorStop(0, lighten(cs.color, 30));
  innerGrad.addColorStop(1, cs.color);

  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(px, py, hs * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStopLabel(x, y, text, fs, color) {
  ctx.save();
  const pad = 6 * _scale;
  const bw = fs * 2.5 + pad * 2;
  const bh = fs + pad * 2;
  const shadow = getComputedStyle(document.documentElement)
    .getPropertyValue("--shadow-elevated")
    .trim();

  function invertColor(c) {
    c = c.trim();
    if (c.startsWith("rgb")) {
      const nums = c.match(/\d+/g);
      const r = 255 - parseInt(nums[0]);
      const g = 255 - parseInt(nums[1]);
      const b = 255 - parseInt(nums[2]);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (c.startsWith("#")) {
      let hex = c.replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((h) => h + h)
          .join("");
      const r = 255 - parseInt(hex.slice(0, 2), 16);
      const g = 255 - parseInt(hex.slice(2, 4), 16);
      const b = 255 - parseInt(hex.slice(4, 6), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return "#000";
  }

  const bgColor = color || "#fff";
  const textColor = invertColor(bgColor);

  ctx.beginPath();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 10 * _scale;
  ctx.shadowOffsetY = 2 * _scale;
  ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 8 * _scale);
  ctx.fillStyle = bgColor;
  ctx.fill();

  function drawTextWithSpacing(ctx, text, x, y, spacing, fs, color, shadow) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `bold ${fs}px 'SN Pro'`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 6 * _scale;
    ctx.shadowOffsetY = 2 * _scale;

    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      totalWidth += ctx.measureText(text[i]).width + spacing;
    }
    totalWidth -= spacing;
    let startX = x - totalWidth / 2;

    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], startX, y);
      startX += ctx.measureText(text[i]).width + spacing;
    }

    ctx.restore();
  }

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fs}px 'SN Pro'`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 3 * _scale;
  ctx.shadowOffsetY = 2 * _scale;
  drawTextWithSpacing(ctx, text, x, y, 1.5 * _scale, fs, textColor, shadow);

  ctx.restore();
}

function drawCenterHandle(cx, cy, sel, size, lw, color) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue(
    "--bg-secondary",
  );
  const shadow = getComputedStyle(document.documentElement).getPropertyValue(
    "--shadow-elevated",
  );

  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 10 * _scale;
  ctx.shadowOffsetY = 2 * _scale;

  const outerGrad = ctx.createRadialGradient(
    cx - size * 0.1,
    cy - size * 0.1,
    0,
    cx,
    cy,
    size,
  );

  outerGrad.addColorStop(0, bg);

  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ========== LOCK BUTTON ==========
const btnLock = document.getElementById("btnLock");
let lastLockTime = 0;

function handleLockClick(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  const now = Date.now();
  if (now - lastLockTime < 300) return;
  lastLockTime = now;

  state.lockVertical = !state.lockVertical;

  if (btnLock) {
    btnLock.classList.toggle("active", state.lockVertical);
    btnLock.innerHTML = state.lockVertical
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C15.9474 10 16.5286 10 17 10.0288M7 10.0288C6.41168 10.0647 5.99429 10.1455 5.63803 10.327C5.07354 10.6146 4.6146 11.0735 4.32698 11.638C4 12.2798 4 13.1198 4 14.8V16.2C4 17.8802 4 18.7202 4.32698 19.362C4.6146 19.9265 5.07354 20.3854 5.63803 20.673C6.27976 21 7.11984 21 8.8 21H15.2C16.8802 21 17.7202 21 18.362 20.673C18.9265 20.3854 19.3854 19.9265 19.673 19.362C20 18.7202 20 17.8802 20 16.2V14.8C20 13.1198 20 12.2798 19.673 11.638C19.3854 11.0735 18.9265 10.6146 18.362 10.327C18.0057 10.1455 17.5883 10.0647 17 10.0288M7 10.0288V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V10.0288" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M16.584 6C15.8124 4.2341 14.0503 3 12 3C9.23858 3 7 5.23858 7 8V10.0288M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C16.8802 10 17.7202 10 18.362 10.327C18.9265 10.6146 19.3854 11.0735 19.673 11.638C20 12.2798 20 13.1198 20 14.8V16.2C20 17.8802 20 18.7202 19.673 19.362C19.3854 19.9265 18.9265 20.3854 18.362 20.673C17.7202 21 16.8802 21 15.2 21H8.8C7.11984 21 6.27976 21 5.63803 20.673C5.07354 20.3854 4.6146 19.9265 4.32698 19.362C4 18.7202 4 17.8802 4 16.2V14.8C4 13.1198 4 12.2798 4.32698 11.638C4.6146 11.0735 5.07354 10.6146 5.63803 10.327C5.99429 10.1455 6.41168 10.0647 7 10.0288Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>`;
  }

  if (state.lockVertical) {
    state.stops.forEach((s) => (s.y = 0.5));
  }

  draw();
  renderList();
  renderInspector();
  updateCSS();
  updateBgPreview();
}

if (btnLock) {
  btnLock.addEventListener("click", handleLockClick);

  btnLock.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false },
  );

  btnLock.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLockClick(e);
    },
    { passive: false },
  );
}

// ========== RESIZE CANVAS HANDLES ==========
function resize() {
  W = state.canvasWidth;
  H = state.canvasHeight;

  const maxDim = Math.max(W, H);
  const isMobileDevice = window.innerWidth < 768;
  let dpr = devicePixelRatio || 1;

  if (isMobileDevice) dpr = Math.min(dpr, 1.5);
  else if (maxDim > 2000) dpr = 1;
  else if (maxDim > 1200) dpr = 1.5;
  else dpr = Math.min(dpr, 2);

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);

  const scale = zoomState.current / 100;
  canvas.style.width = W * scale + "px";
  canvas.style.height = H * scale + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const key = `${W}x${H}`;
  if (resolutionPresets[key]) {
    dimensionState.activeResolutionPreset = key;
    dimensionState.isResolutionMode = true;
  } else {
    dimensionState.activeResolutionPreset = null;
    dimensionState.isResolutionMode = false;
  }

  updateAllDimensionUI();
  calcDynamicMinZoom();
  updateZoomUI();
  updateSizeDisplay();
  checkAndFixZoom();

  draw();
}

const widthHandle = document.querySelector(".resize-h");
const heightHandle = document.querySelector(".resize-w");

function startResizeW(e) {
  resizingW = true;
  startY = e.clientY || e.touches?.[0]?.clientY || 0;
  startH = state.canvasHeight;
  document.body.classList.add("no-touch-scroll");
  e.preventDefault();
}

function startResizeH(e) {
  resizingH = true;
  startX = e.clientX || e.touches?.[0]?.clientX || 0;
  startW = state.canvasWidth;
  document.body.classList.add("no-touch-scroll");
  e.preventDefault();
}

if (widthHandle) {
  widthHandle.addEventListener("mousedown", startResizeW);
  widthHandle.addEventListener("touchstart", startResizeW, { passive: false });
}

if (heightHandle) {
  heightHandle.addEventListener("mousedown", startResizeH);
  heightHandle.addEventListener("touchstart", startResizeH, { passive: false });
}

document.addEventListener("mousemove", (e) => {
  if (!resizingW && !resizingH) return;

  if (resizingW) {
    let newH = startH + (e.clientY - startY);
    let newW = state.canvasWidth;

    if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
      newW = Math.round(newH * dimensionState.aspectRatio);

      if (newW < CONFIG.canvas.minWidth) {
        newW = CONFIG.canvas.minWidth;
        newH = Math.round(newW / dimensionState.aspectRatio);
      } else if (newW > CONFIG.canvas.maxWidth) {
        newW = CONFIG.canvas.maxWidth;
        newH = Math.round(newW / dimensionState.aspectRatio);
      }

      if (newH < CONFIG.canvas.minHeight) {
        newH = CONFIG.canvas.minHeight;
        newW = Math.round(newH * dimensionState.aspectRatio);
        newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
      } else if (newH > CONFIG.canvas.maxHeight) {
        newH = CONFIG.canvas.maxHeight;
        newW = Math.round(newH * dimensionState.aspectRatio);
        newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
      }
    } else {
      newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
    }

    if (newH !== lastH) {
      lastH = newH;
      state.canvasHeight = newH;
      state.canvasWidth = newW;

      if (canvasWidth) canvasWidth.value = Math.floor(state.canvasWidth);
      if (canvasHeight) canvasHeight.value = Math.floor(state.canvasHeight);
      clearResolutionPreset();
      refresh();
    }
  }

  if (resizingH) {
    let newW = startW + (e.clientX - startX);
    let newH = state.canvasHeight;

    if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
      newH = Math.round(newW / dimensionState.aspectRatio);

      if (newH < CONFIG.canvas.minHeight) {
        newH = CONFIG.canvas.minHeight;
        newW = Math.round(newH * dimensionState.aspectRatio);
      } else if (newH > CONFIG.canvas.maxHeight) {
        newH = CONFIG.canvas.maxHeight;
        newW = Math.round(newH * dimensionState.aspectRatio);
      }

      if (newW < CONFIG.canvas.minWidth) {
        newW = CONFIG.canvas.minWidth;
        newH = Math.round(newW / dimensionState.aspectRatio);
        newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
      } else if (newW > CONFIG.canvas.maxWidth) {
        newW = CONFIG.canvas.maxWidth;
        newH = Math.round(newW / dimensionState.aspectRatio);
        newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
      }
    } else {
      newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
    }

    if (newW !== lastW) {
      lastW = newW;
      state.canvasWidth = newW;
      state.canvasHeight = newH;

      if (canvasWidth) canvasWidth.value = Math.floor(state.canvasWidth);
      if (canvasHeight) canvasHeight.value = Math.floor(state.canvasHeight);
      clearResolutionPreset();
      refresh();
    }
  }
});

document.addEventListener(
  "touchmove",
  (e) => {
    if (!resizingW && !resizingH) return;
    e.preventDefault();

    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;

    if (resizingW) {
      let newH = startH + (clientY - startY);
      let newW = state.canvasWidth;

      if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
        newW = Math.round(newH * dimensionState.aspectRatio);

        if (newW < CONFIG.canvas.minWidth) {
          newW = CONFIG.canvas.minWidth;
          newH = Math.round(newW / dimensionState.aspectRatio);
        } else if (newW > CONFIG.canvas.maxWidth) {
          newW = CONFIG.canvas.maxWidth;
          newH = Math.round(newW / dimensionState.aspectRatio);
        }

        if (newH < CONFIG.canvas.minHeight) {
          newH = CONFIG.canvas.minHeight;
          newW = Math.round(newH * dimensionState.aspectRatio);
          newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
        } else if (newH > CONFIG.canvas.maxHeight) {
          newH = CONFIG.canvas.maxHeight;
          newW = Math.round(newH * dimensionState.aspectRatio);
          newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
        }
      } else {
        newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
      }

      if (newH !== lastH) {
        lastH = newH;
        state.canvasHeight = newH;
        state.canvasWidth = newW;

        if (canvasWidth) canvasWidth.value = Math.floor(state.canvasWidth);
        if (canvasHeight) canvasHeight.value = Math.floor(state.canvasHeight);
        clearResolutionPreset();
        refresh();
      }
    }

    if (resizingH) {
      let newW = startW + (clientX - startX);
      let newH = state.canvasHeight;

      if (dimensionState.aspectLocked && dimensionState.aspectRatio) {
        newH = Math.round(newW / dimensionState.aspectRatio);

        if (newH < CONFIG.canvas.minHeight) {
          newH = CONFIG.canvas.minHeight;
          newW = Math.round(newH * dimensionState.aspectRatio);
        } else if (newH > CONFIG.canvas.maxHeight) {
          newH = CONFIG.canvas.maxHeight;
          newW = Math.round(newH * dimensionState.aspectRatio);
        }

        if (newW < CONFIG.canvas.minWidth) {
          newW = CONFIG.canvas.minWidth;
          newH = Math.round(newW / dimensionState.aspectRatio);
          newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
        } else if (newW > CONFIG.canvas.maxWidth) {
          newW = CONFIG.canvas.maxWidth;
          newH = Math.round(newW / dimensionState.aspectRatio);
          newH = clamp(newH, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight);
        }
      } else {
        newW = clamp(newW, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth);
      }

      if (newW !== lastW) {
        lastW = newW;
        state.canvasWidth = newW;
        state.canvasHeight = newH;

        if (canvasWidth) canvasWidth.value = Math.floor(state.canvasWidth);
        if (canvasHeight) canvasHeight.value = Math.floor(state.canvasHeight);
        clearResolutionPreset();
        refresh();
      }
    }
  },
  { passive: false },
);

document.addEventListener("mouseup", () => {
  resizingW = false;
  resizingH = false;
  document.body.classList.remove("no-touch-scroll");
});

document.addEventListener("touchend", () => {
  resizingW = false;
  resizingH = false;
  document.body.classList.remove("no-touch-scroll");
});

// ========== PAN ==========
const panState = {
  active: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  mode: false,
};

function initPan() {
  const wrap = document.querySelector(".canvas-wrap");
  const canvas = document.getElementById("canvas");
  if (!wrap || !canvas) return;

  const panBtn = document.getElementById("panBtn");
  if (panBtn) {
    panBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanMode();
    });

    panBtn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePanMode();
      },
      { passive: false },
    );
  }

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1 || (e.button === 0 && panState.mode)) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e.clientX, e.clientY, wrap);
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (panState.active) {
      e.preventDefault();
      doPan(e.clientX, e.clientY, wrap);
    }
  });

  document.addEventListener("mouseup", () => {
    endPan(wrap);
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.target.closest("input, textarea")) {
      e.preventDefault();
      panState.mode = true;
      updatePanUI();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      panState.mode = false;
      updatePanUI();
    }
  });

  // ------ TOUCH ------
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (panState.mode && e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        startPan(e.touches[0].clientX, e.touches[0].clientY, wrap);
      }
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (panState.active && e.touches.length === 1) {
        e.preventDefault();
        doPan(e.touches[0].clientX, e.touches[0].clientY, wrap);
      }
    },
    { passive: false },
  );

  canvas.addEventListener("touchend", () => {
    endPan(wrap);
  });

  canvas.addEventListener("touchcancel", () => {
    endPan(wrap);
  });
}

function startPan(x, y, wrap) {
  panState.active = true;
  panState.startX = x;
  panState.startY = y;
  panState.scrollLeft = wrap.scrollLeft;
  panState.scrollTop = wrap.scrollTop;
  wrap.classList.add("panning");
}

function doPan(x, y, wrap) {
  if (!panState.active) return;

  const dx = x - panState.startX;
  const dy = y - panState.startY;

  wrap.scrollLeft = panState.scrollLeft - dx;
  wrap.scrollTop = panState.scrollTop - dy;
}

function endPan(wrap) {
  panState.active = false;
  wrap.classList.remove("panning");
}

function togglePanMode() {
  panState.mode = !panState.mode;
  updatePanUI();
}

function updatePanUI() {
  const wrap = document.querySelector(".canvas-wrap");
  const canvas = document.getElementById("canvas");
  const btn = document.getElementById("panBtn");

  if (wrap) {
    wrap.style.cursor = panState.mode ? "grab" : "";
  }

  if (canvas) {
    canvas.style.cursor = panState.mode ? "grab" : "crosshair";
  }

  if (btn) {
    btn.classList.toggle("active", panState.mode);
    btn.innerHTML = panState.mode
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="28" height="28" viewBox="0 0 256 256" id="Flat" stroke="#ffffff">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M188,80a27.82885,27.82885,0,0,0-13.35791,3.39716A27.97426,27.97426,0,0,0,128,72.43066,27.9817,27.9817,0,0,0,80,92v16H68a28.03146,28.03146,0,0,0-28,28v16a88,88,0,0,0,176,0V108A28.03146,28.03146,0,0,0,188,80Zm12,72a72,72,0,0,1-144,0V136a12.01343,12.01343,0,0,1,12-12H80v24a8,8,0,0,0,16,0V92a12,12,0,0,1,24,0v32a8,8,0,0,0,16,0V92a12,12,0,0,1,24,0v32a8,8,0,0,0,16,0V108a12,12,0,0,1,24,0Z"/> </g>

</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="28" height="28" viewBox="0 0 256 256" id="Flat" stroke="#ffffff">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M188,40a27.82979,27.82979,0,0,0-12,2.707V36a27.99792,27.99792,0,0,0-54.64209-8.60278A27.992,27.992,0,0,0,80,52v75.41016l-6.999-12.12354a28.00028,28.00028,0,0,0-48.6709,27.69629C56.77832,211.39941,78.39355,240,128,240a88.09957,88.09957,0,0,0,88-88V68A28.03146,28.03146,0,0,0,188,40Zm12,112a72.08124,72.08124,0,0,1-72,72c-20.17871,0-34.22656-5.45459-46.97461-18.23828-12.499-12.53369-24.77246-32.78565-42.36426-69.90137q-.13916-.293-.30175-.57422a12.00011,12.00011,0,0,1,20.78515-11.99951l21.92774,37.97949a7.9997,7.9997,0,0,0,14.92773-4V52a12,12,0,0,1,24,0v68a8,8,0,0,0,16,0V36a12,12,0,0,1,24,0v84a8,8,0,0,0,16,0V68a12,12,0,0,1,24,0Z"/> </g>

</svg>`;
  }
}
window.togglePanMode = togglePanMode;

// ========== TOGGLE HANDLES ==========
const toggleBtn = document.getElementById("toggleHandles");
let lastToggleTime = 0;

function handleToggleClick(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  const now = Date.now();
  if (now - lastToggleTime < 300) return;
  lastToggleTime = now;

  state.showHandles = !state.showHandles;

  if (toggleBtn) {
    toggleBtn.innerHTML = state.showHandles
      ? `        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">

          <g id="SVGRepo_bgCarrier" stroke-width="0" />

          <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />

          <g id="SVGRepo_iconCarrier">
            <path
              d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
              stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </g>

        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>`;
    toggleBtn.classList.toggle("handles-hidden", !state.showHandles);
  }
  draw();
}

if (toggleBtn) {
  toggleBtn.addEventListener("click", handleToggleClick);

  toggleBtn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false },
  );

  toggleBtn.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleToggleClick(e);
    },
    { passive: false },
  );
}

// ========== FULLSCREEN PREVIEW ==========
let fullscreenOverlay = null;
let fullscreenCanvas = null;
let fullscreenCtx = null;
let fullscreenRotation = 0;

const fullscreenZoom = {
  scale: 1,
  minScale: 0.5,
  maxScale: 10,
  translateX: 0,
  translateY: 0,

  isPinching: false,
  isPanning: false,
  startDist: 0,
  startScale: 1,
  startX: 0,
  startY: 0,
  startTranslateX: 0,
  startTranslateY: 0,
  pinchCenterX: 0,
  pinchCenterY: 0,
  lastTap: 0,
  lastTapX: 0,
  lastTapY: 0,
};

async function openFullscreenPreview() {
  fullscreenRotation = 0;
  Object.assign(fullscreenZoom, {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isPinching: false,
    isPanning: false,
  });

  history.pushState({ fullscreen: true }, "", "");

  fullscreenOverlay = document.createElement("div");
  fullscreenOverlay.className = "fullscreen-overlay";
  fullscreenOverlay.innerHTML = `
    <div class="fullscreen-canvas-container" id="fsContainer">
      <canvas id="fullscreenCanvas"></canvas>
    </div>
    <div class="fullscreen-controls">
      <button class="fullscreen-btn" id="fsZoomOut" title="Zoom Out">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M6 12L18 12" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>
      </button>
      <span class="fullscreen-zoom-value" id="fsZoomValue">100%</span>
      <button class="fullscreen-btn" id="fsZoomIn" title="Zoom In">
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M6 12H18M12 6V18" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>
      </button>
      <div class="fullscreen-divider"></div>
      <button class="fullscreen-btn" id="fsRotate" title="Rotate (R)">
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M21 3V8M21 8H16M21 8L18 5.29168C16.4077 3.86656 14.3051 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.2832 21 19.8675 18.008 20.777 14" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg>
      </button>
      <button class="fullscreen-btn" id="fsReset" title="Reset (0)">
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M3 18.25C3 18.6642 3.33579 19 3.75 19C4.16421 19 4.5 18.6642 4.5 18.25V5.75C4.5 5.33579 4.16421 5 3.75 5C3.33579 5 3 5.33579 3 5.75V18.25Z" fill="#ffffff"/> <path d="M19.5 18.25C19.5 18.6642 19.8358 19 20.25 19C20.6642 19 21 18.6642 21 18.25V5.75C21 5.33579 20.6642 5 20.25 5C19.8358 5 19.5 5.33579 19.5 5.75V18.25Z" fill="#ffffff"/> <path d="M14.1462 14.0535C13.9284 14.3472 13.9526 14.7638 14.2188 15.0301C14.5117 15.323 14.9866 15.323 15.2795 15.0301L17.6496 12.6627C17.858 12.537 18 12.2869 18 11.9988C18 11.7107 17.8578 11.4606 17.6493 11.335L15.2795 8.96778L15.1954 8.89517C14.9018 8.67731 14.4851 8.70152 14.2188 8.96778L14.1462 9.0519C13.9284 9.34551 13.9526 9.76218 14.2188 10.0284L15.44 11.2498H11.6562L11.6308 11.2517H8.56L9.78115 10.0304L9.86094 9.93645C10.0498 9.67306 10.0474 9.31484 9.85377 9.05386L9.78115 8.96974L9.6872 8.88995C9.42381 8.70108 9.0656 8.70347 8.80461 8.89712L8.72049 8.96974L6.35073 11.337L6.27578 11.3897C6.10886 11.5257 6 11.7487 6 12.0008C6 12.2888 6.14201 12.5389 6.35039 12.6646L8.72049 15.032L8.80461 15.1047C9.09822 15.3225 9.51488 15.2983 9.78115 15.032C10.0474 14.7658 10.0716 14.3491 9.85377 14.0555L9.78115 13.9714L8.56 12.7517H12.3437L12.3691 12.7498H15.44L14.2188 13.9694L14.1462 14.0535Z" fill="#ffffff"/> </g>

</svg>
      </button>
      <button class="fullscreen-btn" id="fsClose" title="Close (ESC)">
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M7 16L2 16C1.44772 16 1 15.5523 1 15C1 14.4477 1.44772 14 2 14L7 14C8.65685 14 10 15.3431 10 17V22C10 22.5523 9.55228 23 9 23C8.44772 23 8 22.5523 8 22V17C8 16.4477 7.55228 16 7 16Z" fill="#ffffff"/> <path d="M10 2C10 1.44772 9.55229 1 9 1C8.44772 1 8 1.44772 8 2L8 7C8 7.55228 7.55228 8 7 8L2 8C1.44772 8 1 8.44771 1 9C1 9.55228 1.44772 10 2 10L7 10C8.65685 10 10 8.65685 10 7L10 2Z" fill="#ffffff"/> <path d="M14 22C14 22.5523 14.4477 23 15 23C15.5523 23 16 22.5523 16 22V17C16 16.4477 16.4477 16 17 16H22C22.5523 16 23 15.5523 23 15C23 14.4477 22.5523 14 22 14H17C15.3431 14 14 15.3431 14 17V22Z" fill="#ffffff"/> <path d="M14 7C14 8.65686 15.3431 10 17 10L22 10C22.5523 10 23 9.55228 23 9C23 8.44772 22.5523 8 22 8L17 8C16.4477 8 16 7.55229 16 7L16 2C16 1.44772 15.5523 1 15 1C14.4477 1 14 1.44772 14 2L14 7Z" fill="#ffffff"/> </g>

</svg>
        </svg>
      </button>
    </div>
    <div class="fullscreen-info" id="fullscreenInfo">
      ${Math.round(state.canvasWidth)} × ${Math.round(state.canvasHeight)}
    </div>
  `;

  document.body.appendChild(fullscreenOverlay);
  document.body.style.overflow = "hidden";

  fullscreenCanvas = document.getElementById("fullscreenCanvas");
  fullscreenCtx = fullscreenCanvas.getContext("2d");

  const container = document.getElementById("fsContainer");

  await renderFullscreenCanvas();

  fullscreenOverlay.addEventListener("click", (e) => {
    if (e.target === fullscreenOverlay) history.back();
  });

  document
    .getElementById("fsClose")
    .addEventListener("click", () => history.back());
  document
    .getElementById("fsRotate")
    .addEventListener("click", rotateFullscreen);
  document
    .getElementById("fsReset")
    .addEventListener("click", resetFullscreenView);
  document
    .getElementById("fsZoomIn")
    .addEventListener("click", () => zoomFullscreen(1.5, null, null));
  document
    .getElementById("fsZoomOut")
    .addEventListener("click", () => zoomFullscreen(0.67, null, null));

  document.addEventListener("keydown", handleFullscreenKeys);
  window.addEventListener("popstate", handleFullscreenPopState);

  container.addEventListener("touchstart", handleFSTouchStart, {
    passive: false,
  });
  container.addEventListener("touchmove", handleFSTouchMove, {
    passive: false,
  });
  container.addEventListener("touchend", handleFSTouchEnd, { passive: false });
  container.addEventListener("touchcancel", handleFSTouchEnd, {
    passive: false,
  });

  container.addEventListener("wheel", handleFSWheel, { passive: false });
  container.addEventListener("mousedown", handleFSMouseDown);
  container.addEventListener("dblclick", handleFSDoubleClick);
  document.addEventListener("mousemove", handleFSMouseMove);
  document.addEventListener("mouseup", handleFSMouseUp);

  window.addEventListener("resize", handleFSResize);

  requestAnimationFrame(() => {
    fullscreenOverlay.classList.add("show");
    setTimeout(() => {
      const hint = document.getElementById("fullscreenHint");
      if (hint) hint.classList.add("hide");
    }, 3000);
  });
}

function closeFullscreenPreview() {
  if (!fullscreenOverlay) return;

  document.removeEventListener("keydown", handleFullscreenKeys);
  window.removeEventListener("popstate", handleFullscreenPopState);
  window.removeEventListener("resize", handleFSResize);
  document.removeEventListener("mousemove", handleFSMouseMove);
  document.removeEventListener("mouseup", handleFSMouseUp);

  fullscreenOverlay.classList.remove("show");

  setTimeout(() => {
    if (fullscreenOverlay?.parentNode) {
      fullscreenOverlay.parentNode.removeChild(fullscreenOverlay);
    }
    fullscreenOverlay = null;
    fullscreenCanvas = null;
    fullscreenCtx = null;
    fullscreenRotation = 0;
  }, 300);

  document.body.style.overflow = "";
}

function handleFullscreenPopState() {
  if (fullscreenOverlay) closeFullscreenPreview();
}

function handleFullscreenKeys(e) {
  if (!fullscreenOverlay) return;

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      history.back();
      break;
    case "r":
    case "R":
      e.preventDefault();
      rotateFullscreen();
      break;
    case "+":
    case "=":
      e.preventDefault();
      zoomFullscreen(1.25, null, null);
      break;
    case "-":
    case "_":
      e.preventDefault();
      zoomFullscreen(0.8, null, null);
      break;
    case "0":
      e.preventDefault();
      resetFullscreenView();
      break;
  }
}

async function renderFullscreenCanvas() {
  if (!fullscreenCanvas) return;

  const originalW = state.canvasWidth;
  const originalH = state.canvasHeight;

  // ------ DIMENSION CALCULATION ------
  const isRotated = fullscreenRotation === 90 || fullscreenRotation === 270;
  const sourceW = isRotated ? originalH : originalW;
  const sourceH = isRotated ? originalW : originalH;

  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const scaleX = vpW / sourceW;
  const scaleY = vpH / sourceH;
  const fitScale = Math.min(scaleX, scaleY, 1); // max 100%

  const dispW = sourceW * fitScale;
  const dispH = sourceH * fitScale;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // تنظیم سایز canvas نمایش
  fullscreenCanvas.width = dispW * dpr;
  fullscreenCanvas.height = dispH * dpr;
  fullscreenCanvas.style.width = dispW + "px";
  fullscreenCanvas.style.height = dispH + "px";

  // رندر در ابعاد اصلی (بدون چرخش)
  const workCanvas = document.createElement("canvas");
  workCanvas.width = originalW;
  workCanvas.height = originalH;
  const workCtx = workCanvas.getContext("2d");

  //  پاس دادن true برای isFullscreen
  await renderSceneToContext(workCtx, originalW, originalH, true);

  // انتقال به canvas نمایش با چرخش
  const ctx = fullscreenCanvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, fullscreenCanvas.width, fullscreenCanvas.height);

  ctx.save();

  // چرخش و مقیاس
  if (fullscreenRotation === 0) {
    ctx.scale((dispW / originalW) * dpr, (dispH / originalH) * dpr);
    ctx.drawImage(workCanvas, 0, 0);
  } else if (fullscreenRotation === 90) {
    ctx.translate(dispW * dpr, 0);
    ctx.rotate(Math.PI / 2);
    ctx.scale((dispH / originalW) * dpr, (dispW / originalH) * dpr);
    ctx.drawImage(workCanvas, 0, 0);
  } else if (fullscreenRotation === 180) {
    ctx.translate(dispW * dpr, dispH * dpr);
    ctx.rotate(Math.PI);
    ctx.scale((dispW / originalW) * dpr, (dispH / originalH) * dpr);
    ctx.drawImage(workCanvas, 0, 0);
  } else if (fullscreenRotation === 270) {
    ctx.translate(0, dispH * dpr);
    ctx.rotate(-Math.PI / 2);
    ctx.scale((dispH / originalW) * dpr, (dispW / originalH) * dpr);
    ctx.drawImage(workCanvas, 0, 0);
  }

  ctx.restore();
}

// ------ تابع اصلی رندر - مشترک بین canvas و fullscreen ------
async function renderSceneToContext(
  targetCtx,
  width,
  height,
  isFullscreen = false,
) {
  // ذخیره W و H اصلی
  const savedW = W;
  const savedH = H;

  // تنظیم موقت برای رندر
  W = width;
  H = height;

  targetCtx.clearRect(0, 0, width, height);

  const visibleStops = state.stops.filter((s) => s.visible);
  const needsFilter = hasActiveFilters();

  let renderCtx = targetCtx;
  let tempCanvas = null;

  if (needsFilter) {
    tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    renderCtx = tempCanvas.getContext("2d");
  }

  if (state.bgEnabled) {
    renderCtx.fillStyle = rgba(state.bgColor, state.bgAlpha / 100);
    renderCtx.fillRect(0, 0, width, height);
  }

  if (state.lockVertical && state.showHandles && !isFullscreen) {
    // ✅ چک isFullscreen
    const scale = Math.max(width, height) / 800;
    renderCtx.strokeStyle = "rgba(255,255,255,0.5)";
    renderCtx.lineWidth = 2 * scale;
    renderCtx.setLineDash([10 * scale, 5 * scale]);
    renderCtx.beginPath();
    renderCtx.moveTo(0, height / 2);
    renderCtx.lineTo(width, height / 2);
    renderCtx.stroke();
    renderCtx.setLineDash([]);
  }

  if (visibleStops.length > 0) {
    const reversedStops = [...visibleStops].reverse();

    reversedStops.forEach((s) => {
      renderCtx.globalCompositeOperation = s.blendMode || "screen";
      drawGradToCtxGeneric(s, renderCtx, width, height);
    });

    renderCtx.globalCompositeOperation = "source-over";
  }

  if (needsFilter && tempCanvas) {
    // Blur
    if (filterState.blur > 0) {
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = width;
      blurCanvas.height = height;
      const blurCtx = blurCanvas.getContext("2d");
      blurCtx.filter = `blur(${filterState.blur}px)`;
      blurCtx.drawImage(tempCanvas, 0, 0);
      tempCanvas = blurCanvas;
      renderCtx = blurCanvas.getContext("2d");
    }

    // سایر فیلترها
    if (hasNonBlurFilters()) {
      const imageData = renderCtx.getImageData(0, 0, width, height);
      applyFiltersToImageData(imageData);
      renderCtx.putImageData(imageData, 0, 0);
    }

    // کپی به context اصلی
    targetCtx.drawImage(tempCanvas, 0, 0);
  }

  if (noiseState.enabled && noiseState.opacity > 0) {
    const noiseCanvas = await getNoiseCanvas(
      width,
      height,
      noiseState.frequency,
    );

    if (noiseCanvas) {
      targetCtx.save();
      targetCtx.globalCompositeOperation = noiseState.blend;
      targetCtx.globalAlpha = noiseState.opacity / 100;
      targetCtx.drawImage(noiseCanvas, 0, 0, width, height);
      targetCtx.restore();
    }
  }

  W = savedW;
  H = savedH;
}
// ------ رسم گرادینت روی هر context با ابعاد دلخواه ------
function drawGradToCtxGeneric(s, ctx, width, height) {
  const cx = s.x * width;
  const cy = s.y * height;

  if (s.type === "radial") {
    const sizeScale = Math.max(width, height) / Math.max(W || 800, H || 600);
    const scaledSize = s.size * sizeScale;

    const solidEnd = 1 - (s.feather ?? 60) / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scaledSize);
    const color = rgba(s.color, s.opacity / 100);

    addRadialGradientStops(grad, color, s.color, solidEnd);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, scaledSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "linear") {
    const angleRad = ((s.angle - 90) * Math.PI) / 180;
    const diagonal = Math.hypot(width, height);
    const mx = width / 2;
    const my = height / 2;
    const dx = (Math.cos(angleRad) * diagonal) / 2;
    const dy = (Math.sin(angleRad) * diagonal) / 2;

    const grad = ctx.createLinearGradient(mx - dx, my - dy, mx + dx, my + dy);

    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (s.type === "conic") {
    const startAngle = ((s.startAngle - 90) * Math.PI) / 180;
    const grad = ctx.createConicGradient(startAngle, cx, cy);

    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

// ------ DRAW GRADIENT FOR FULLSCREEN ------
function drawGradientForFullscreen(s, ctx, W, H, sizeScale) {
  const cx = s.x * W;
  const cy = s.y * H;

  if (s.type === "radial") {
    const scaledSize = s.size * sizeScale;
    const solidEnd = 1 - (s.feather ?? 60) / 100;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scaledSize);
    const color = rgba(s.color, s.opacity / 100);

    addRadialGradientStops(grad, color, s.color, solidEnd);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, scaledSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "linear") {
    const angleRad = ((s.angle - 90) * Math.PI) / 180;
    const diagonal = Math.hypot(W, H);
    const midX = W / 2;
    const midY = H / 2;
    const dx = (Math.cos(angleRad) * diagonal) / 2;
    const dy = (Math.sin(angleRad) * diagonal) / 2;

    const grad = ctx.createLinearGradient(
      midX - dx,
      midY - dy,
      midX + dx,
      midY + dy,
    );

    const stops = s.stops || [];
    [...stops]
      .sort((a, b) => a.pos - b.pos)
      .forEach((cs) => {
        grad.addColorStop(
          Math.max(0, Math.min(1, cs.pos / 100)),
          rgba(cs.color, cs.opacity / 100),
        );
      });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (s.type === "conic") {
    const startAngle = ((s.startAngle - 90) * Math.PI) / 180;
    const grad = ctx.createConicGradient(startAngle, cx, cy);

    const stops = s.stops || [];
    [...stops]
      .sort((a, b) => a.pos - b.pos)
      .forEach((cs) => {
        grad.addColorStop(
          Math.max(0, Math.min(1, cs.pos / 100)),
          rgba(cs.color, cs.opacity / 100),
        );
      });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

// ------ RENDER GRADIENT ------
function renderGradientFS(s, ctx, W, H, sizeScale) {
  const cx = s.x * W;
  const cy = s.y * H;

  ctx.save();

  if (s.type === "radial") {
    const scaledSize = s.size * sizeScale;
    const solidEnd = 1 - (s.feather ?? 60) / 100;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scaledSize);
    const col = rgbaColor(s.color, s.opacity / 100);

    grad.addColorStop(0, col);
    if (solidEnd >= 0.99) {
      grad.addColorStop(0.99, col);
      grad.addColorStop(1, col);
    } else if (solidEnd > 0.01) {
      grad.addColorStop(solidEnd, col);
      grad.addColorStop(1, rgbaColor(s.color, 0));
    } else {
      grad.addColorStop(1, rgbaColor(s.color, 0));
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, scaledSize, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "linear") {
    const angle = (((s.angle || 0) - 90) * Math.PI) / 180;
    const diagonal = Math.hypot(W, H);
    const midX = W / 2;
    const midY = H / 2;
    const dx = (Math.cos(angle) * diagonal) / 2;
    const dy = (Math.sin(angle) * diagonal) / 2;

    const grad = ctx.createLinearGradient(
      midX - dx,
      midY - dy,
      midX + dx,
      midY + dy,
    );

    const stops = s.stops || [
      { pos: 0, color: "#ff0000", opacity: 100 },
      { pos: 100, color: "#0000ff", opacity: 100 },
    ];

    [...stops]
      .sort((a, b) => a.pos - b.pos)
      .forEach((cs) => {
        grad.addColorStop(
          Math.max(0, Math.min(1, cs.pos / 100)),
          rgbaColor(cs.color, cs.opacity / 100),
        );
      });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (s.type === "conic") {
    const startAngle = (((s.startAngle || 0) - 90) * Math.PI) / 180;

    const grad = ctx.createConicGradient(startAngle, cx, cy);

    const stops = s.stops || [
      { pos: 0, color: "#ff0000", opacity: 100 },
      { pos: 100, color: "#0000ff", opacity: 100 },
    ];

    [...stops]
      .sort((a, b) => a.pos - b.pos)
      .forEach((cs) => {
        grad.addColorStop(
          Math.max(0, Math.min(1, cs.pos / 100)),
          rgbaColor(cs.color, cs.opacity / 100),
        );
      });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// ------ RGBA HELPER - LOCAL ------
function rgbaColor(hex, alpha) {
  if (typeof rgba === "function") {
    return rgba(hex, alpha);
  }

  hex = hex || "#000000";
  hex = hex.replace("#", "");

  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ------ ZOOM FUNCTIONS ------
function zoomFullscreen(factor, clientX, clientY) {
  const container = document.getElementById("fsContainer");
  if (!container || !fullscreenCanvas) return;

  const containerRect = container.getBoundingClientRect();
  const canvasRect = fullscreenCanvas.getBoundingClientRect();

  const oldScale = fullscreenZoom.scale;
  const newScale = Math.max(
    fullscreenZoom.minScale,
    Math.min(fullscreenZoom.maxScale, oldScale * factor),
  );

  if (Math.abs(newScale - oldScale) < 0.001) return;

  // محاسبه نقطه مرکزی برای زوم
  let zoomPointX, zoomPointY;

  if (
    clientX === undefined ||
    clientX === null ||
    clientY === undefined ||
    clientY === null
  ) {
    // اگر موقعیت موس مشخص نیست، از مرکز container استفاده کن
    zoomPointX = containerRect.width / 2;
    zoomPointY = containerRect.height / 2;
  } else {
    // تبدیل موقعیت موس به موقعیت نسبت به container
    zoomPointX = clientX - containerRect.left;
    zoomPointY = clientY - containerRect.top;
  }

  // محاسبه موقعیت فعلی canvas
  const currentCanvasX =
    (containerRect.width - canvasRect.width) / 2 + fullscreenZoom.translateX;
  const currentCanvasY =
    (containerRect.height - canvasRect.height) / 2 + fullscreenZoom.translateY;

  // محاسبه موقعیت نقطه زوم نسبت به canvas
  const pointX = (zoomPointX - currentCanvasX) / oldScale;
  const pointY = (zoomPointY - currentCanvasY) / oldScale;

  // محاسبه translate جدید
  const scaleRatio = newScale / oldScale;
  fullscreenZoom.translateX =
    zoomPointX -
    pointX * newScale -
    (containerRect.width - (canvasRect.width / oldScale) * newScale) / 2;
  fullscreenZoom.translateY =
    zoomPointY -
    pointY * newScale -
    (containerRect.height - (canvasRect.height / oldScale) * newScale) / 2;
  fullscreenZoom.scale = newScale;

  applyFullscreenTransform();
  updateFullscreenZoomUI();

  requestAnimationFrame(() => constrainFullscreenPan());
}

function resetFullscreenView() {
  fullscreenZoom.scale = 1;
  fullscreenZoom.translateX = 0;
  fullscreenZoom.translateY = 0;

  applyFullscreenTransform(true);
  updateFullscreenZoomUI();
  updateFullscreenCursor();
}

function applyFullscreenTransform(animate = false) {
  if (!fullscreenCanvas) return;

  if (animate) {
    fullscreenCanvas.style.transition = "var(--transition-fast)";
  } else {
    fullscreenCanvas.style.transition = "none";
  }

  fullscreenCanvas.style.transform = `translate(${fullscreenZoom.translateX}px, ${fullscreenZoom.translateY}px) scale(${fullscreenZoom.scale})`;
  fullscreenCanvas.style.transformOrigin = "center center";

  if (animate) {
    setTimeout(() => {
      if (fullscreenCanvas) fullscreenCanvas.style.transition = "none";
    }, 300);
  }
}

function constrainFullscreenPan() {
  if (!fullscreenCanvas) return;

  const container = document.getElementById("fsContainer");
  if (!container) return;

  const containerRect = container.getBoundingClientRect();

  const canvasRect = fullscreenCanvas.getBoundingClientRect();
  const originalWidth = canvasRect.width / fullscreenZoom.scale;
  const originalHeight = canvasRect.height / fullscreenZoom.scale;

  const scaledW = originalWidth * fullscreenZoom.scale;
  const scaledH = originalHeight * fullscreenZoom.scale;

  let newTranslateX = fullscreenZoom.translateX;
  let newTranslateY = fullscreenZoom.translateY;

  if (scaledW <= containerRect.width) {
    newTranslateX = 0;
  } else {
    const maxTranslateX = (scaledW - containerRect.width) / 2;
    newTranslateX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, fullscreenZoom.translateX),
    );
  }

  if (scaledH <= containerRect.height) {
    newTranslateY = 0;
  } else {
    const maxTranslateY = (scaledH - containerRect.height) / 2;
    newTranslateY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, fullscreenZoom.translateY),
    );
  }

  if (
    newTranslateX !== fullscreenZoom.translateX ||
    newTranslateY !== fullscreenZoom.translateY
  ) {
    fullscreenZoom.translateX = newTranslateX;
    fullscreenZoom.translateY = newTranslateY;
    applyFullscreenTransform(true);
  }

  updateFullscreenCursor();
}

function updateFullscreenZoomUI() {
  const el = document.getElementById("fsZoomValue");
  if (el) {
    el.textContent = Math.round(fullscreenZoom.scale * 100) + "%";
  }

  const zoomOut = document.getElementById("fsZoomOut");
  const zoomIn = document.getElementById("fsZoomIn");

  if (zoomOut) {
    zoomOut.disabled = fullscreenZoom.scale <= fullscreenZoom.minScale + 0.01;
  }
  if (zoomIn) {
    zoomIn.disabled = fullscreenZoom.scale >= fullscreenZoom.maxScale - 0.01;
  }
}

function updateFullscreenCursor() {
  const container = document.getElementById("fsContainer");
  if (!container || !fullscreenCanvas) return;

  if (fullscreenZoom.isPanning) {
    container.style.cursor = "grabbing";
  } else if (fullscreenZoom.scale > 1.01) {
    container.style.cursor = "grab";
  } else {
    container.style.cursor = "default";
  }
}

function zoomAtPoint(factor, mouseEvent) {
  if (mouseEvent) {
    zoomFullscreen(factor, mouseEvent.clientX, mouseEvent.clientY);
  } else {
    zoomFullscreen(factor, null, null);
  }
}

function handleWheelZoom(event) {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.1 : 0.9;
  zoomAtPoint(factor, event);
}

// ------ TOUCH ------
function handleFSTouchStart(e) {
  const container = document.getElementById("fsContainer");
  if (!container) return;

  if (e.touches.length === 2) {
    e.preventDefault();
    fullscreenZoom.isPinching = true;
    fullscreenZoom.isPanning = false;
    fullscreenZoom.startDist = getPinchDistance(e.touches);
    fullscreenZoom.startScale = fullscreenZoom.scale;
    fullscreenZoom.startTranslateX = fullscreenZoom.translateX;
    fullscreenZoom.startTranslateY = fullscreenZoom.translateY;

    const center = getPinchCenter(e.touches);
    fullscreenZoom.pinchCenterX = center.x;
    fullscreenZoom.pinchCenterY = center.y;
  } else if (e.touches.length === 1) {
    const touch = e.touches[0];
    const now = Date.now();

    const dx = touch.clientX - fullscreenZoom.lastTapX;
    const dy = touch.clientY - fullscreenZoom.lastTapY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (now - fullscreenZoom.lastTap < 300 && dist < 50) {
      e.preventDefault();
      handleFSDoubleTap(touch.clientX, touch.clientY);
      fullscreenZoom.lastTap = 0;
      return;
    }

    fullscreenZoom.lastTap = now;
    fullscreenZoom.lastTapX = touch.clientX;
    fullscreenZoom.lastTapY = touch.clientY;

    e.preventDefault();
    fullscreenZoom.isPanning = true;
    fullscreenZoom.startX = touch.clientX;
    fullscreenZoom.startY = touch.clientY;
    fullscreenZoom.startTranslateX = fullscreenZoom.translateX;
    fullscreenZoom.startTranslateY = fullscreenZoom.translateY;
    updateFullscreenCursor();
  }
}

function handleFSTouchMove(e) {
  if (fullscreenZoom.isPinching && e.touches.length === 2) {
    e.preventDefault();

    const container = document.getElementById("fsContainer");
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const dist = getPinchDistance(e.touches);
    const scaleFactor = dist / fullscreenZoom.startDist;
    const newScale = Math.max(
      fullscreenZoom.minScale,
      Math.min(
        fullscreenZoom.maxScale,
        fullscreenZoom.startScale * scaleFactor,
      ),
    );

    const center = getPinchCenter(e.touches);
    const canvasCenterX = containerRect.left + containerRect.width / 2;
    const canvasCenterY = containerRect.top + containerRect.height / 2;

    const panX = center.x - fullscreenZoom.pinchCenterX;
    const panY = center.y - fullscreenZoom.pinchCenterY;
    const scaleRatio = newScale / fullscreenZoom.startScale;
    const pivotX = fullscreenZoom.pinchCenterX - canvasCenterX;
    const pivotY = fullscreenZoom.pinchCenterY - canvasCenterY;

    fullscreenZoom.translateX =
      fullscreenZoom.startTranslateX - pivotX * (scaleRatio - 1) + panX;
    fullscreenZoom.translateY =
      fullscreenZoom.startTranslateY - pivotY * (scaleRatio - 1) + panY;
    fullscreenZoom.scale = newScale;

    applyFullscreenTransform();
    updateFullscreenZoomUI();
  } else if (fullscreenZoom.isPanning && e.touches.length === 1) {
    e.preventDefault();
    const touch = e.touches[0];
    fullscreenZoom.translateX =
      fullscreenZoom.startTranslateX + (touch.clientX - fullscreenZoom.startX);
    fullscreenZoom.translateY =
      fullscreenZoom.startTranslateY + (touch.clientY - fullscreenZoom.startY);
    applyFullscreenTransform();
  }
}

function handleFSTouchEnd(e) {
  if (e.touches.length === 0) {
    if (fullscreenZoom.isPinching || fullscreenZoom.isPanning) {
      fullscreenZoom.isPinching = false;
      fullscreenZoom.isPanning = false;
      constrainFullscreenPan();
    }
  } else if (e.touches.length === 1 && fullscreenZoom.isPinching) {
    fullscreenZoom.isPinching = false;
    fullscreenZoom.isPanning = true;
    const touch = e.touches[0];
    fullscreenZoom.startX = touch.clientX;
    fullscreenZoom.startY = touch.clientY;
    fullscreenZoom.startTranslateX = fullscreenZoom.translateX;
    fullscreenZoom.startTranslateY = fullscreenZoom.translateY;
  }
  updateFullscreenCursor();
}

function handleFSDoubleTap(clientX, clientY) {
  if (fullscreenZoom.scale > 1.1) {
    resetFullscreenView();
  } else {
    zoomFullscreen(3, clientX, clientY);
  }
}

// ------ MOUSE ------
function handleFSWheel(e) {
  e.preventDefault();
  zoomFullscreen(e.deltaY > 0 ? 0.85 : 1.18, e.clientX, e.clientY);
}

function handleFSMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  fullscreenZoom.isPanning = true;
  fullscreenZoom.startX = e.clientX;
  fullscreenZoom.startY = e.clientY;
  fullscreenZoom.startTranslateX = fullscreenZoom.translateX;
  fullscreenZoom.startTranslateY = fullscreenZoom.translateY;
  updateFullscreenCursor();
}

function handleFSMouseMove(e) {
  if (!fullscreenZoom.isPanning) return;
  fullscreenZoom.translateX =
    fullscreenZoom.startTranslateX + (e.clientX - fullscreenZoom.startX);
  fullscreenZoom.translateY =
    fullscreenZoom.startTranslateY + (e.clientY - fullscreenZoom.startY);
  applyFullscreenTransform();
}

function handleFSMouseUp() {
  if (!fullscreenZoom.isPanning) return;
  fullscreenZoom.isPanning = false;
  constrainFullscreenPan();
}

function handleFSDoubleClick(e) {
  e.preventDefault();
  if (fullscreenZoom.scale > 1.1) {
    resetFullscreenView();
  } else {
    zoomFullscreen(3, e.clientX, e.clientY);
  }
}

// ------ RESIZE ------
async function handleFSResize() {
  if (!fullscreenCanvas) return;
  await renderFullscreenCanvas();
  resetFullscreenView();
}

// ------ ROTATE ------
async function rotateFullscreen() {
  fullscreenRotation = (fullscreenRotation + 90) % 360;

  fullscreenZoom.scale = 1;
  fullscreenZoom.translateX = 0;
  fullscreenZoom.translateY = 0;

  await renderFullscreenCanvas();
  applyFullscreenTransform();
  updateFullscreenZoomUI();
  updateFullscreenCursor();

  const info = document.getElementById("fullscreenInfo");
  if (info) {
    const isRotated = fullscreenRotation === 90 || fullscreenRotation === 270;
    const w = isRotated ? state.canvasHeight : state.canvasWidth;
    const h = isRotated ? state.canvasWidth : state.canvasHeight;
    info.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  }
}

// ------ UTILS ------
function getPinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function getPinchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}
window.openFullscreenPreview = openFullscreenPreview;
window.closeFullscreenPreview = closeFullscreenPreview;
window.rotateFullscreen = rotateFullscreen;

// ========== ZOOM SYSTEM ==========
function calcDynamicMinZoom() {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return 10;

  const rect = wrap.getBoundingClientRect();

  const minScaleX = (rect.width - zoomState.paddingX * 2) / state.canvasWidth;
  const minScaleY = (rect.height - zoomState.paddingY * 2) / state.canvasHeight;

  let minZoom = Math.min(minScaleX, minScaleY) * 100;
  minZoom = clamp(Math.floor(minZoom), 5, 30);

  zoomState.dynamicMin = minZoom;
  return minZoom;
}

function setZoom(zoom, center = null) {
  const minZoom = calcDynamicMinZoom();
  zoom = clamp(zoom, minZoom, zoomState.max);

  if (zoom === zoomState.current) return;

  zoomState.current = zoom;
  const scale = zoom / 100;

  canvas.style.width = state.canvasWidth * scale + "px";
  canvas.style.height = state.canvasHeight * scale + "px";

  if (center) centerCanvasAt(center, scale);

  updateZoomUI();
  showZoomIndicator(zoom);
}

function centerCanvasAt(point, scale) {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  wrap.scrollLeft = point.x * scale - wrap.clientWidth / 2;
  wrap.scrollTop = point.y * scale - wrap.clientHeight / 2;
}

function zoomIn() {
  setZoom(zoomState.current + zoomState.step);
}

function zoomOut() {
  setZoom(zoomState.current - zoomState.step);
}

function fitToScreen() {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();

  const scaleX = (rect.width - zoomState.paddingX * 2) / state.canvasWidth;
  const scaleY = (rect.height - zoomState.paddingY * 2) / state.canvasHeight;
  let fitScale = Math.min(scaleX, scaleY);

  fitScale = Math.min(fitScale, 1);

  const minZoom = calcDynamicMinZoom();
  let zoom = Math.round(fitScale * 100);
  zoom = Math.max(zoom, minZoom);

  setZoom(zoom);
}

function updateZoomUI() {
  const slider = document.getElementById("zoomSlider");
  const value = document.getElementById("zoomValue");
  const minZoom = zoomState.dynamicMin;

  if (slider) {
    slider.min = minZoom;
    slider.max = zoomState.max;
    slider.value = zoomState.current;
  }

  if (value) {
    value.textContent = zoomState.current + "%";
  }

  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomInBtn = document.getElementById("zoomIn");

  if (zoomOutBtn) zoomOutBtn.disabled = zoomState.current <= minZoom;
  if (zoomInBtn) zoomInBtn.disabled = zoomState.current >= zoomState.max;
}

let indicatorTimeout;
function showZoomIndicator(zoom) {
  const indicator = document.getElementById("zoomIndicator");
  if (!indicator) return;

  indicator.textContent = zoom + "%";
  indicator.classList.add("show");

  clearTimeout(indicatorTimeout);
  indicatorTimeout = setTimeout(() => indicator.classList.remove("show"), 800);
}

function setupWheelZoom() {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  wrap.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const center = {
          x: (e.clientX - rect.left) / (zoomState.current / 100),
          y: (e.clientY - rect.top) / (zoomState.current / 100),
        };

        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom(zoomState.current + delta, center);
      }
    },
    { passive: false },
  );
}

function setupTouchZoom() {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  let initialPinchDist = 0;
  let initialZoom = 100;

  function getPinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function getPinchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  wrap.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialPinchDist = getPinchDist(e.touches);
        initialZoom = zoomState.current;
      }
    },
    { passive: false },
  );

  wrap.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const currentDist = getPinchDist(e.touches);
        const scale = currentDist / initialPinchDist;
        const newZoom = Math.round(initialZoom * scale);

        const center = getPinchCenter(e.touches);
        const rect = canvas.getBoundingClientRect();
        const canvasCenter = {
          x: (center.x - rect.left) / (zoomState.current / 100),
          y: (center.y - rect.top) / (zoomState.current / 100),
        };

        setZoom(newZoom, canvasCenter);
      }
    },
    { passive: false },
  );

  wrap.addEventListener("touchend", () => {
    initialPinchDist = 0;
  });
}

function setupKeyboardZoom() {
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    const isMod = e.ctrlKey || e.metaKey;

    if (isMod) {
      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
      }
    }

    switch (e.key.toLowerCase()) {
      case "f":
        if (!isMod) {
          e.preventDefault();
          fitToScreen();
        }
        break;
      case "h":
        if (!isMod) {
          handleToggleClick(e);
        }
        break;
        break;
      case "l":
        if (!isMod) {
          e.preventDefault();
          toggleAspectLock();
        }
        break;
      case "delete":
      case "backspace":
        if (state.selected) {
          e.preventDefault();
          delStop(state.selected);
        }
        //       case "p":
        // if (!isMod) {
        //   e.preventDefault();
        //   openFullscreenPreview();
        // }
        break;
        break;
      case "escape":
        state.selected = null;
        closePicker();
        refresh();
        break;
    }
  });
}

let isButtonInteraction = false;

function setupResizeObserver() {
  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  let resizeTimeout = null;
  let lastWidth = wrap.clientWidth;
  let lastHeight = wrap.clientHeight;

  const observer = new ResizeObserver((entries) => {
    if (isButtonInteraction) return;

    const entry = entries[0];
    const newWidth = entry.contentRect.width;
    const newHeight = entry.contentRect.height;

    if (
      Math.abs(newWidth - lastWidth) < 10 &&
      Math.abs(newHeight - lastHeight) < 10
    ) {
      return;
    }

    lastWidth = newWidth;
    lastHeight = newHeight;

    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newMin = calcDynamicMinZoom();
      if (zoomState.current < newMin) {
        setZoom(newMin);
      }
      updateZoomUI();
    }, 200);
  });

  observer.observe(wrap);
}

function setupZoomSlider() {
  const slider = document.getElementById("zoomSlider");
  if (!slider) return;

  slider.addEventListener("input", (e) => {
    setZoom(parseInt(e.target.value));
  });
}

let lastCanvasW = 0;
let lastCanvasH = 0;
function checkAndFixZoom() {
  if (state.canvasWidth === lastCanvasW && state.canvasHeight === lastCanvasH) {
    return;
  }

  lastCanvasW = state.canvasWidth;
  lastCanvasH = state.canvasHeight;

  const wrap = document.querySelector(".canvas-wrap");
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();
  const scale = zoomState.current / 100;

  const displayWidth = state.canvasWidth * scale;
  const displayHeight = state.canvasHeight * scale;

  const tooLarge =
    displayWidth > rect.width - zoomState.paddingX * 2 ||
    displayHeight > rect.height - zoomState.paddingY * 2;

  const tooSmall =
    displayWidth < (rect.width - zoomState.paddingX * 2) * 0.93 &&
    displayHeight < (rect.height - zoomState.paddingY * 2) * 0.3;

  if (tooLarge || tooSmall) {
    fitToScreen();
  } else {
    canvas.style.width = state.canvasWidth * scale + "px";
    canvas.style.height = state.canvasHeight * scale + "px";
    updateZoomUI();
  }
}

function setCanvasSize(w, h) {
  state.canvasWidth = Math.floor(
    clamp(w, CONFIG.canvas.minWidth, CONFIG.canvas.maxWidth),
  );
  state.canvasHeight = Math.floor(
    clamp(h, CONFIG.canvas.minHeight, CONFIG.canvas.maxHeight),
  );
  refresh();
}

function initZoom() {
  calcDynamicMinZoom();

  document.getElementById("zoomIn")?.addEventListener("click", zoomIn);
  document.getElementById("zoomOut")?.addEventListener("click", zoomOut);
  document.getElementById("zoomFit")?.addEventListener("click", fitToScreen);

  setupZoomSlider();
  setupWheelZoom();
  setupTouchZoom();
  setupKeyboardZoom();
  setupResizeObserver();

  setTimeout(() => {
    fitToScreen();
  }, 100);
}

function refreshUI() {
  draw();
  renderList();
  renderInspector();
  updateCSS();
  updateBgPreview();
}

// ========== FILTERS ==========

const filterState = {
  enabled: true,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

const filterDefaults = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

let lastFilterString = "";
let filterUpdateScheduled = false;

function getFilterString() {
  if (!filterState.enabled) return "";

  const filters = [];

  if (filterState.brightness !== 100) {
    filters.push(`brightness(${filterState.brightness}%)`);
  }
  if (filterState.contrast !== 100) {
    filters.push(`contrast(${filterState.contrast}%)`);
  }
  if (filterState.saturate !== 100) {
    filters.push(`saturate(${filterState.saturate}%)`);
  }
  if (filterState.hue !== 0) {
    filters.push(`hue-rotate(${filterState.hue}deg)`);
  }
  if (filterState.blur > 0) {
    filters.push(`blur(${filterState.blur}px)`);
  }
  if (filterState.grayscale > 0) {
    filters.push(`grayscale(${filterState.grayscale}%)`);
  }
  if (filterState.sepia > 0) {
    filters.push(`sepia(${filterState.sepia}%)`);
  }
  if (filterState.invert > 0) {
    filters.push(`invert(${filterState.invert}%)`);
  }

  return filters.join(" ");
}

function hasActiveFilters() {
  return (
    filterState.enabled &&
    (filterState.brightness !== 100 ||
      filterState.contrast !== 100 ||
      filterState.saturate !== 100 ||
      filterState.hue !== 0 ||
      filterState.blur > 0 ||
      filterState.grayscale > 0 ||
      filterState.sepia > 0 ||
      filterState.invert > 0)
  );
}

function setFilter(name, value) {
  const numValue = parseFloat(value);

  const limits = {
    brightness: [0, 200],
    contrast: [0, 200],
    saturate: [0, 200],
    hue: [0, 360],
    blur: [0, 100],
    grayscale: [0, 100],
    sepia: [0, 100],
    invert: [0, 100],
  };

  const [min, max] = limits[name] || [0, 100];
  filterState[name] = clamp(numValue, min, max);

  updateFilterDisplay();
}

function updateFilterDisplay() {
  if (filterUpdateScheduled) return;

  filterUpdateScheduled = true;
  requestAnimationFrame(() => {
    updateFilterUI();

    draw();
    updateCSS();

    filterUpdateScheduled = false;
  });
}

function toggleFilters() {
  filterState.enabled = !filterState.enabled;
  updateFilterDisplay();
}

function resetFilters() {
  Object.keys(filterDefaults).forEach((key) => {
    filterState[key] = filterDefaults[key];
  });
  filterState.enabled = true;

  updateFilterDisplay();
}

function updateFilterUI() {
  const filters = [
    "brightness",
    "contrast",
    "saturate",
    "hue",
    "blur",
    "grayscale",
    "sepia",
    "invert",
  ];

  filters.forEach((name) => {
    const slider = document.getElementById(`filter${capitalize(name)}`);
    const numInput = document.getElementById(`filter${capitalize(name)}Num`);

    if (slider && slider !== document.activeElement) {
      slider.value = filterState[name];
    }
    if (numInput && numInput !== document.activeElement) {
      numInput.value = filterState[name];
    }

    const row = slider?.closest(".filter-row");
    if (row) {
      const isDefault = filterState[name] === filterDefaults[name];
      row.classList.toggle("active", !isDefault);
    }
  });

  const toggleBtn = document.getElementById("filtersToggleBtn");

  if (toggleBtn) {
    toggleBtn.classList.toggle("disabled", !filterState.enabled);
    toggleBtn.innerHTML = filterState.enabled
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">

              <g id="SVGRepo_bgCarrier" stroke-width="0" />

              <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />

              <g id="SVGRepo_iconCarrier">
                <path
                  d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
                  stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </g>

            </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
           <g stroke-width="0"></g>
           <g stroke-linecap="round" stroke-linejoin="round"></g>
           <g>
             <path d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21"
               stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </g>
         </svg>`;
  }

  const controls = document.querySelector(".filter-controls");
  if (controls) {
    controls.classList.toggle("disabled", !filterState.enabled);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function initFilterEvents() {
  const filters = [
    "brightness",
    "contrast",
    "saturate",
    "hue",
    "blur",
    "grayscale",
    "sepia",
    "invert",
  ];

  filters.forEach((name) => {
    const slider = document.getElementById(`filter${capitalize(name)}`);
    const numInput = document.getElementById(`filter${capitalize(name)}Num`);

    if (!slider) return;

    let sliderTimer = null;
    slider.addEventListener("input", (e) => {
      const value = e.target.value;

      if (slider) {
        slider.addEventListener("input", (e) => {
          const value = e.target.value;
          filterState[name] = parseFloat(value);

          // ✅ Sync number input
          if (numInput) numInput.value = value;

          updateFilterDisplay();
        });
      }

      if (numInput) {
        numInput.addEventListener("input", (e) => {
          const value = e.target.value;
          filterState[name] = parseFloat(value);

          // ✅ Sync slider
          if (slider) slider.value = value;

          updateFilterDisplay();
        });
      }

      // آپدیت فوری state و UI
      filterState[name] = parseFloat(value);
      if (numInput && numInput !== document.activeElement) {
        numInput.value = value;
      }

      // آپدیت CSS با تاخیر
      clearTimeout(sliderTimer);
      sliderTimer = setTimeout(() => {
        updateFilterDisplay();
      }, 16); // ~60fps
    });

    slider.addEventListener("mousedown", () => History.onDragStart());
    slider.addEventListener("mouseup", () => History.onDragEnd());
    slider.addEventListener("touchstart", () => History.onDragStart(), {
      passive: true,
    });
    slider.addEventListener("touchend", () => History.onDragEnd());

    if (numInput) {
      numInput.addEventListener("input", (e) => {
        setFilter(name, e.target.value);
      });
      numInput.addEventListener("focus", () => History.onInputFocus());
      numInput.addEventListener("blur", () => History.onInputBlur());
    }

    const row = slider.closest(".filter-row");
    if (row) {
      row.addEventListener("dblclick", (e) => {
        if (e.target.tagName === "INPUT") return;
        History.saveState();
        resetSingleFilter(name);
      });

      // Mobile double tap
      let lastTap = 0;
      row.addEventListener("touchend", (e) => {
        if (e.target.tagName === "INPUT") return;

        const now = Date.now();
        if (now - lastTap < 300) {
          e.preventDefault();
          History.saveState();
          resetSingleFilter(name);
          lastTap = 0;
        } else {
          lastTap = now;
        }
      });
    }
  });

  document
    .getElementById("filtersToggleBtn")
    ?.addEventListener("click", toggleFilters);
  document
    .getElementById("filtersResetBtn")
    ?.addEventListener("click", resetFilters);
}

function resetSingleFilter(name) {
  filterState[name] = filterDefaults[name];
  updateFilterDisplay();
}
function initFiltersFromState() {
  console.log("Initializing filters from state:", filterState);

  if (canvas) {
    canvas.style.filter = "none";
  }

  updateFilterUI();

  draw();
}

// ------ EXPORT SUPPORT ------
function applyFiltersToImageData(imageData) {
  if (!hasActiveFilters()) return imageData;

  const data = imageData.data;
  const len = data.length;

  const brightness = filterState.brightness / 100;
  const contrast = filterState.contrast / 100;
  const saturate = filterState.saturate / 100;
  const grayscale = filterState.grayscale / 100;
  const sepia = filterState.sepia / 100;
  const invert = filterState.invert / 100;
  const hue = filterState.hue;

  let hueMatrix = null;
  if (hue !== 0) {
    hueMatrix = getHueRotationMatrix(hue);
  }

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 1) {
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }

    if (contrast !== 1) {
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
    }

    if (saturate !== 1) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray + (r - gray) * saturate;
      g = gray + (g - gray) * saturate;
      b = gray + (b - gray) * saturate;
    }

    if (hueMatrix) {
      const nr = r * hueMatrix[0] + g * hueMatrix[1] + b * hueMatrix[2];
      const ng = r * hueMatrix[3] + g * hueMatrix[4] + b * hueMatrix[5];
      const nb = r * hueMatrix[6] + g * hueMatrix[7] + b * hueMatrix[8];
      r = nr;
      g = ng;
      b = nb;
    }

    if (grayscale > 0) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (gray - r) * grayscale;
      g += (gray - g) * grayscale;
      b += (gray - b) * grayscale;
    }

    if (sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }

    if (invert > 0) {
      r += (255 - 2 * r) * invert;
      g += (255 - 2 * g) * invert;
      b += (255 - 2 * b) * invert;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  return imageData;
}

function getHueRotationMatrix(degrees) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ];
}

// ------ INIT ON PAGE LOAD ------
if (document.readyState === "complete") {
  setTimeout(initFiltersFromState, 100);
} else {
  window.addEventListener("load", () => {
    setTimeout(initFiltersFromState, 100);
  });
}

window.setFilter = setFilter;
window.toggleFilters = toggleFilters;
window.resetFilters = resetFilters;
window.updateFilterUI = updateFilterUI;
window.initFiltersFromState = initFiltersFromState;

// ========== BACKGROUND CONTROLS ==========
function toggleBackground() {
  state.bgEnabled = !state.bgEnabled;
  updateBgUI();
  draw();
  updateCSS();
}

function setBgBlendMode(mode) {
  state.bgBlendMode = mode;
  draw();
  updateCSS();
}

function updateBgUI() {
  const toggleBtn = document.getElementById("bgToggleBtn");
  const bgControls = document.querySelector(".bg-controls");

  if (toggleBtn) {
    toggleBtn.classList.toggle("disabled", !state.bgEnabled);

    toggleBtn.innerHTML = state.bgEnabled
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">

              <g id="SVGRepo_bgCarrier" stroke-width="0" />

              <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />

              <g id="SVGRepo_iconCarrier">
                <path
                  d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
                  stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </g>

            </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
           <g stroke-width="0"></g>
           <g stroke-linecap="round" stroke-linejoin="round"></g>
           <g>
             <path d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21"
               stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </g>
         </svg>`;
  }

  if (bgControls) {
    bgControls.classList.toggle("disabled", !state.bgEnabled);
  }

  const blendSelect = document.getElementById("bgBlendMode");
  if (blendSelect) {
    blendSelect.value = state.bgBlendMode;
  }
}

function initBackgroundEvents() {
  // Toggle button
  document
    .getElementById("bgToggleBtn")
    ?.addEventListener("click", toggleBackground);

  // Blend mode select
  document.getElementById("bgBlendMode")?.addEventListener("change", (e) => {
    History.saveState();
    setBgBlendMode(e.target.value);
  });
}
window.toggleBackground = toggleBackground;
window.setBgBlendMode = setBgBlendMode;

// ========== NOISE CONTROLS ==========
const noiseState = {
  enabled: true,
  opacity: 0,
  frequency: 0.65,
  blend: "overlay",
};

function getNoiseWrap() {
  return document.querySelector(".canvas-wrap");
}

function applyNoiseFilter() {
  draw();
}

function setNoiseOpacity(value) {
  noiseState.opacity = clamp(parseFloat(value) || 0, 0, 100);
  updateNoiseUI();
  applyNoiseFilter();
  updateCSS();
}

function setNoiseFrequency(value) {
  noiseState.frequency = clamp(parseFloat(value) || 0.65, 0.01, 1);
  updateNoiseUI();
  applyNoiseFilter();
  updateCSS();
}

function setNoiseBlend(value) {
  noiseState.blend = value;
  updateNoiseUI();
  applyNoiseFilter();
  updateCSS();
}

function toggleNoise() {
  noiseState.enabled = !noiseState.enabled;
  updateNoiseUI();
  draw();
  updateCSS();
}

const noiseCache = {
  canvas: null,
  width: 0,
  height: 0,
  frequency: null,
};

async function getNoiseCanvas(width, height, frequency) {
  if (
    noiseCache.canvas &&
    noiseCache.width === width &&
    noiseCache.height === height &&
    noiseCache.frequency === frequency
  ) {
    return noiseCache.canvas;
  }

  if (noiseCache.canvas) {
    noiseCache.canvas.width = 0;
    noiseCache.canvas.height = 0;
    noiseCache.canvas = null;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">
      <filter id="n">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="${frequency}"
          numOctaves="4"
          stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#n)"/>
    </svg>
  `;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  return new Promise((resolve) => {
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d").drawImage(img, 0, 0);

      URL.revokeObjectURL(url);
      img.src = "";

      noiseCache.canvas = c;
      noiseCache.width = width;
      noiseCache.height = height;
      noiseCache.frequency = frequency;

      resolve(c);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      img.src = "";
      resolve(null);
    };

    img.src = url;
  });
}

// ------ UI SYNC ------
function updateNoiseUI() {
  const opacityInput = document.getElementById("noiseOpacity");
  const frequencyInput = document.getElementById("noiseFrequency");
  const blendSelect = document.getElementById("noiseBlend");
  const toggleBtn = document.getElementById("noiseToggleBtn");

  if (opacityInput && opacityInput !== document.activeElement) {
    opacityInput.value = noiseState.opacity;
  }
  if (frequencyInput && frequencyInput !== document.activeElement) {
    frequencyInput.value = noiseState.frequency;
  }
  if (blendSelect) blendSelect.value = noiseState.blend;

  if (toggleBtn) {
    toggleBtn.classList.toggle("disabled", !noiseState.enabled);

    toggleBtn.innerHTML = noiseState.enabled
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">

          <g id="SVGRepo_bgCarrier" stroke-width="0" />

          <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />

          <g id="SVGRepo_iconCarrier">
            <path
              d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
              stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </g>

        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
       <g stroke-width="0"></g>
       <g stroke-linecap="round" stroke-linejoin="round"></g>
       <g>
         <path d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21"
           stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
       </g>
     </svg>`;
  }
}

// ------ EVENTS ------
function initNoiseEvents() {
  const opacityInput = document.getElementById("noiseOpacity");
  const frequencyInput = document.getElementById("noiseFrequency");
  const blendSelect = document.getElementById("noiseBlend");
  const toggleBtn = document.getElementById("noiseToggleBtn");

  if (opacityInput) {
    if (opacityInput.type === "range") {
      opacityInput.addEventListener("mousedown", () => History.onDragStart());
      opacityInput.addEventListener("touchstart", () => History.onDragStart(), {
        passive: true,
      });
      opacityInput.addEventListener("mouseup", () => History.onDragEnd());
      opacityInput.addEventListener("touchend", () => History.onDragEnd());
    } else {
      opacityInput.addEventListener("focus", () => History.onInputFocus());
      opacityInput.addEventListener("blur", () => History.onInputBlur());
    }
    opacityInput.addEventListener("input", (e) =>
      setNoiseOpacity(e.target.value),
    );
    opacityInput.addEventListener("change", (e) =>
      setNoiseOpacity(e.target.value),
    );
  }

  if (frequencyInput) {
    if (frequencyInput.type === "range") {
      frequencyInput.addEventListener("mousedown", () => History.onDragStart());
      frequencyInput.addEventListener(
        "touchstart",
        () => History.onDragStart(),
        { passive: true },
      );
      frequencyInput.addEventListener("mouseup", () => History.onDragEnd());
      frequencyInput.addEventListener("touchend", () => History.onDragEnd());
    } else {
      frequencyInput.addEventListener("focus", () => History.onInputFocus());
      frequencyInput.addEventListener("blur", () => History.onInputBlur());
    }
    frequencyInput.addEventListener("input", (e) =>
      setNoiseFrequency(e.target.value),
    );
    frequencyInput.addEventListener("change", (e) =>
      setNoiseFrequency(e.target.value),
    );
  }

  if (blendSelect) {
    blendSelect.addEventListener("change", (e) => {
      History.saveState();
      setNoiseBlend(e.target.value);
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleNoise);
  }
}

// ------ INIT ------
document.addEventListener("DOMContentLoaded", () => {
  initNoiseEvents();
  applyNoiseFilter();
});

// ========== ANGLE PICKER ==========
function startAngleDrag(e, stopId) {
  e.preventDefault();
  activeAnglePicker = stopId;
  handleAngleMove(e);

  document.addEventListener("mousemove", handleAngleMove);
  document.addEventListener("mouseup", stopAngleDrag);
  document.addEventListener("touchmove", handleAngleMove, { passive: false });
  document.addEventListener("touchend", stopAngleDrag);
}

function handleAngleMove(e) {
  if (!activeAnglePicker) return;
  e.preventDefault();

  const stopId = activeAnglePicker;
  const handle = document.getElementById(`angleHandle_${stopId}`);
  const pickerEl = handle?.closest(".angle-picker");
  if (!pickerEl) return;

  const rect = pickerEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  let angle =
    Math.atan2(clientX - centerX, centerY - clientY) * (180 / Math.PI);
  angle = Math.round((angle + 360) % 360);

  const stop = getStop(stopId);
  if (stop) {
    stop.angle = angle;

    handle.style.transform = `rotate(${angle}deg)`;
    document.getElementById(`angleCenter_${stopId}`).textContent = `${angle}°`;

    const numInput = document.getElementById(`angleNum_${stopId}`);
    if (numInput && numInput !== document.activeElement) {
      numInput.value = angle;
    }

    draw();
    updateCSS();
    updateStopItem(stopId);
  }
}

function startAngleDrag(e, stopId) {
  e.preventDefault();
  activeAnglePicker = stopId;

  if (typeof History !== "undefined" && History.onDragStart) {
    History.onDragStart();
  }

  handleAngleMove(e);

  document.addEventListener("mousemove", handleAngleMove);
  document.addEventListener("mouseup", stopAngleDrag);
  document.addEventListener("touchmove", handleAngleMove, { passive: false });
  document.addEventListener("touchend", stopAngleDrag);
}

function stopAngleDrag() {
  if (typeof History !== "undefined" && History.onDragEnd) {
    History.onDragEnd();
  }

  activeAnglePicker = null;
  document.removeEventListener("mousemove", handleAngleMove);
  document.removeEventListener("mouseup", stopAngleDrag);
  document.removeEventListener("touchmove", handleAngleMove);
  document.removeEventListener("touchend", stopAngleDrag);
}

// ------ Export ------
window.liveUpdate = liveUpdate;
window.updateInspectorInputs = updateInspectorInputs;
window.updateStopItem = updateStopItem;
window.updateAllStopItems = updateAllStopItems;

function updateAngleFromInput(stopId, value) {
  let angle = parseInt(value) || 0;
  angle = clamp(angle, 0, 360);

  const stop = getStop(stopId);
  if (stop) {
    stop.angle = angle;
    document.getElementById(`angleHandle_${stopId}`).style.transform =
      `rotate(${angle}deg)`;
    document.getElementById(`angleCenter_${stopId}`).textContent = `${angle}°`;
    draw();
    updateCSS();
  }
}

function startConicAngleDrag(e, id) {
  e.preventDefault();

  if (typeof History !== "undefined" && History.onDragStart) {
    History.onDragStart();
  }

  function move(ev) {
    ev.preventDefault();
    const center = document.querySelector(`#conicAngleCenter_${id}`);
    const handle = document.querySelector(`#conicAngleHandle_${id}`);
    if (!center || !handle) return;

    const rect = center.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let clientX, clientY;
    if (ev.touches && ev.touches.length > 0) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }

    let ang = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    ang = (ang + 360) % 360;

    const stop = getStop(id);
    if (stop) {
      stop.startAngle = Math.round(ang);

      handle.style.transform = `rotate(${ang}deg)`;
      center.textContent = stop.startAngle + "°";

      const numInput = document.getElementById(`conicAngleNum_${id}`);
      if (numInput && numInput !== document.activeElement) {
        numInput.value = stop.startAngle;
      }

      draw();
      updateCSS();
      updateStopItem(id);
    }
  }

  function up() {
    if (typeof History !== "undefined" && History.onDragEnd) {
      History.onDragEnd();
    }

    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
}

function updateConicAngleFromInput(id, val) {
  val = clamp(+val, 0, 360);
  const stop = getStop(id);
  if (stop) {
    stop.startAngle = val;
    document.getElementById(`conicAngleHandle_${id}`).style.transform =
      `rotate(${val}deg)`;
    document.getElementById(`conicAngleCenter_${id}`).textContent = val + "°";
    draw();
    updateCSS();
  }
}

// ========== ADD GRADIENT ==========
function getStop(id) {
  return state.stops.find((s) => s.id === id);
}

function addStop(type) {
  counter++;
  const typeNames = { radial: "Radial", linear: "Linear", conic: "Conic" };
  const s = {
    id: uid(),
    name: `${typeNames[type]} ${counter}`,
    type,
    visible: true,
    x: 0.2 + Math.random() * 0.6,
    y: state.lockVertical ? 0.5 : 0.2 + Math.random() * 0.6,
    color: randColor(),
    size: 80 + Math.random() * 100,
    feather: 60,
    opacity: 100,
    angle: Math.floor(Math.random() * 180),
    startAngle: 0,
    blendMode: "screen",
    stops: [
      { pos: 0, color: randColor(), opacity: 100 },
      { pos: 100, color: randColor(), opacity: 100 },
    ],
  };
  state.stops.push(s);
  state.selected = s.id;
  refresh();
}

function delStop(id) {
  state.stops = state.stops.filter((s) => s.id !== id);
  if (state.selected === id) state.selected = null;
  refresh();
}

function dupStop(id) {
  const o = getStop(id);
  if (!o) return;

  const c = JSON.parse(JSON.stringify(o));
  c.id = uid();

  // === Name logic ===
  const baseName = o.name.replace(/\sCopy(\s\d+)?$/, "");
  const copies = state.stops.filter(
    (s) =>
      s.name === `${baseName} Copy` ||
      s.name.match(new RegExp(`^${baseName} Copy \\d+$`)),
  );

  if (copies.length === 0) {
    c.name = `${baseName} Copy`;
  } else {
    c.name = `${baseName} Copy ${copies.length + 1}`;
  }

  c.x = clamp(c.x + 0.04, 0, 1);
  c.y = clamp(c.y + 0.04, 0, 1);

  state.stops.push(c);
  state.selected = c.id;
  refresh();
}

function toggleVis(id) {
  const s = getStop(id);
  if (s) {
    s.visible = !s.visible;
    refresh();
  }
}

function addColorStop(s) {
  const pos =
    s.stops.length < 5
      ? Math.round(100 / (s.stops.length + 1)) * s.stops.length
      : 50;
  s.stops.push({ pos, color: randColor(), opacity: 100 });
  s.stops.sort((a, b) => a.pos - b.pos);
  refresh();
}

function delColorStop(s, i) {
  if (s.stops.length > 2) {
    s.stops.splice(i, 1);
    refresh();
  }
}

function safeButtonAction(action) {
  isButtonInteraction = true;

  try {
    action();
  } finally {
    setTimeout(() => {
      isButtonInteraction = false;
    }, 100);
  }
}

// ========== GRAIENT PROPERTIES ==========
function updateBgPreview() {
  const el = document.getElementById("bgPreview");
  if (el) el.style.background = rgba(state.bgColor, state.bgAlpha / 100);
}

function addRadialGradientStops(grad, color, hex, solidEnd) {
  grad.addColorStop(0, color);
  if (solidEnd >= 0.99) {
    grad.addColorStop(0.99, color);
    grad.addColorStop(1, color);
  } else if (solidEnd > 0.01) {
    grad.addColorStop(solidEnd, color);
    grad.addColorStop(1, rgba(hex, 0));
  } else {
    grad.addColorStop(1, rgba(hex, 0));
  }
}

function getGradPreview(s) {
  if (s.type === "radial") {
    const solidEnd = 1 - (s.feather ?? 60) / 100;
    const color = rgba(s.color, s.opacity / 100);
    const transparent = rgba(s.color, 0);

    if (solidEnd >= 0.99) {
      return `radial-gradient(circle at center, ${color} 0%, ${color} 100%)`;
    }
    if (solidEnd > 0.01) {
      return `radial-gradient(circle at center, ${color} 0%, ${color} ${Math.round(solidEnd * 100)}%, ${transparent} 100%)`;
    }
    return `radial-gradient(circle at center, ${color} 0%, ${transparent} 100%)`;
  }

  if (s.type === "conic") {
    if (!s.stops || s.stops.length === 0) {
      return `conic-gradient(from ${s.startAngle || 0}deg at center, #ff0066 0%, #00ff88 100%)`;
    }

    const sortedStops = [...s.stops].sort((a, b) => a.pos - b.pos);
    const stopsStr = sortedStops
      .map((c) => `${rgba(c.color, c.opacity / 100)} ${c.pos}%`)
      .join(", ");

    return `conic-gradient(from ${s.startAngle || 0}deg at center, ${stopsStr})`;
  }

  if (!s.stops || s.stops.length === 0) {
    return `linear-gradient(${s.angle || 0}deg, #ff0066 0%, #00ff88 100%)`;
  }

  const sortedStops = [...s.stops].sort((a, b) => a.pos - b.pos);
  const stopsStr = sortedStops
    .map((c) => `${rgba(c.color, c.opacity / 100)} ${c.pos}%`)
    .join(", ");

  return `linear-gradient(${s.angle || 0}deg, ${stopsStr})`;
}

function updateStopItem(stopId) {
  const s = getStop(stopId);
  if (!s) return;

  const item = document.querySelector(`.stop-item[data-id="${stopId}"]`);
  if (!item) return;

  const previewInner = item.querySelector(".stop-preview-inner");
  if (previewInner) {
    previewInner.style.background = getGradPreview(s);
  }

  const meta = item.querySelector(".stop-meta");
  if (meta) {
    meta.textContent = `${s.type} · ${
      s.type === "radial"
        ? Math.round(s.size) + "px"
        : s.type === "conic"
          ? s.startAngle + "°"
          : s.angle + "°"
    }`;
  }

  const name = item.querySelector(".stop-name");
  if (name && name.textContent !== s.name) {
    name.textContent = s.name;
  }
}

function updateAllStopItems() {
  state.stops.forEach((s) => updateStopItem(s.id));
}

// ========== LAYER DRAG & DROP ==========
(function () {
  const HOLD_DURATION = 300;

  let drag = {
    active: false,
    pending: false,
    element: null,
    clone: null,
    placeholder: null,
    stopId: null,
    offsetY: 0,
    initialRect: null,
    holdTimer: null,
    startX: 0,
    startY: 0,
  };

  function initLayerDragDrop() {
    const list = document.getElementById("list");
    if (!list) return;

    list.removeEventListener("mousedown", onPointerDown);
    list.removeEventListener("touchstart", onPointerDown);

    list.addEventListener("mousedown", onPointerDown);
    list.addEventListener("touchstart", onPointerDown, { passive: true });
  }

  function onPointerDown(e) {
    if (drag.active || drag.pending) return;

    const stopItem = e.target.closest(".stop-item");
    if (!stopItem) return;
    if (!isValidDragTarget(e.target)) return;

    const isTouch = e.type === "touchstart";
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    if (!isTouch) e.preventDefault();

    const rect = stopItem.getBoundingClientRect();

    drag.pending = true;
    drag.element = stopItem;
    drag.stopId = stopItem.dataset.id;
    drag.startX = clientX;
    drag.startY = clientY;
    drag.offsetY = clientY - rect.top;
    drag.initialRect = rect;

    drag.holdTimer = setTimeout(() => {
      if (drag.pending) {
        startDrag();
      }
    }, HOLD_DURATION);

    document.addEventListener("mousemove", onMovePending);
    document.addEventListener("mouseup", onUpPending);
    document.addEventListener("touchmove", onMovePending, { passive: true }); // ✅ passive
    document.addEventListener("touchend", onUpPending);
    document.addEventListener("touchcancel", onUpPending);
  }

  function onMovePending(e) {
    if (!drag.pending) return;

    const isTouch = e.type === "touchmove";
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    const dx = Math.abs(clientX - drag.startX);
    const dy = Math.abs(clientY - drag.startY);

    // اگر حرکت کرد = اسکرول → لغو
    if (dx > 10 || dy > 10) {
      cancelPending();
    }
  }

  function onUpPending() {
    if (drag.pending && !drag.active) {
      cancelPending();
    }
  }

  function cancelPending() {
    clearTimeout(drag.holdTimer);
    removePendingListeners();

    drag.pending = false;
    drag.element = null;
    drag.holdTimer = null;
  }

  function removePendingListeners() {
    document.removeEventListener("mousemove", onMovePending);
    document.removeEventListener("mouseup", onUpPending);
    document.removeEventListener("touchmove", onMovePending);
    document.removeEventListener("touchend", onUpPending);
    document.removeEventListener("touchcancel", onUpPending);
  }

  function startDrag() {
    if (drag.active || !drag.element) return;

    drag.pending = false;
    drag.active = true;

    removePendingListeners();

    const stopItem = drag.element;
    const rect = drag.initialRect;

    // Clone
    drag.clone = stopItem.cloneNode(true);
    drag.clone.classList.add("drag-clone");
    Object.assign(drag.clone.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      zIndex: "10000",
      pointerEvents: "none",
      opacity: "0.95",
      boxShadow: "var(--shadow)",
      borderRadius: "8px",
      background: "var(--bg-transparent, rgba(30,30,30,0.95))",
      backdropFilter: "blur(6px)",
      border: "2px solid var(--border, #444)",
      transform: "scale(1.03)",
    });
    document.body.appendChild(drag.clone);

    // Placeholder
    drag.placeholder = document.createElement("div");
    drag.placeholder.className = "drag-placeholder";
    Object.assign(drag.placeholder.style, {
      height: rect.height + "px",
      margin: "4px 0",
      border: "2px dashed var(--accent, #666)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.05)",
    });

    stopItem.classList.add("drag-original");
    stopItem.style.cssText =
      "opacity:0 !important;height:0 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;";

    stopItem.parentNode.insertBefore(drag.placeholder, stopItem);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    if (navigator.vibrate) navigator.vibrate(30);

    // Listeners برای درگ واقعی
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false }); // ❗ non-passive
    document.addEventListener("touchend", onDragEnd);
    document.addEventListener("touchcancel", onDragEnd);
  }

  function onDragMove(e) {
    if (!drag.active || !drag.clone) return;
    e.preventDefault();

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    drag.clone.style.top = clientY - drag.offsetY + "px";

    // Update placeholder
    const list = document.getElementById("list");
    if (!list) return;

    const items = list.querySelectorAll(".stop-item:not(.drag-original)");

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        if (drag.placeholder !== item.previousElementSibling) {
          list.insertBefore(drag.placeholder, item);
        }
        return;
      }
    }

    if (items.length > 0) {
      const last = items[items.length - 1];
      if (drag.placeholder !== last.nextElementSibling) {
        last.after(drag.placeholder);
      }
    }
  }

  function onDragEnd() {
    if (!drag.active) return;

    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
    document.removeEventListener("touchcancel", onDragEnd);

    const list = document.getElementById("list");
    if (list && drag.placeholder) {
      let newIndex = 0;
      for (const child of list.children) {
        if (child === drag.placeholder) break;
        if (
          child.classList.contains("stop-item") &&
          !child.classList.contains("drag-original")
        ) {
          newIndex++;
        }
      }

      const oldIndex = state.stops.findIndex((s) => s.id === drag.stopId);

      if (oldIndex !== -1 && oldIndex !== newIndex) {
        History.saveState();
        const [removed] = state.stops.splice(oldIndex, 1);
        state.stops.splice(newIndex, 0, removed);
      }
    }

    cleanup();
    refresh();
  }

  function cleanup() {
    clearTimeout(drag.holdTimer);
    drag.clone?.remove();
    drag.placeholder?.remove();

    if (drag.element) {
      drag.element.classList.remove("drag-original");
      drag.element.style.cssText = "";
    }

    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    document.body.style.overflow = "";
    document.body.style.touchAction = "";

    drag = {
      active: false,
      pending: false,
      element: null,
      clone: null,
      placeholder: null,
      stopId: null,
      offsetY: 0,
      initialRect: null,
      holdTimer: null,
      startX: 0,
      startY: 0,
    };
  }

  function isValidDragTarget(target) {
    if (target.closest(".control-btn, button, input, select, svg")) return false;
    const handle = target.closest(".drag-handle");
    const preview = target.closest(".stop-preview");
    const info = target.closest(".stop-info");
    return handle || preview || info;
  }

  window.initLayerDragDrop = initLayerDragDrop;
})();

// ========== LAYER ==========
function renderList() {
  const el = document.getElementById("list");
  if (!state.stops.length) {
    el.innerHTML = '<div class="empty-msg">Add a layer</div>';
    return;
  }

  el.innerHTML = state.stops
    .map((s) => `
<div class="stop-item ${state.selected === s.id ? "selected" : ""} ${!s.visible ? "hidden" : ""}" 
  data-id="${s.id}" onclick="state.selected='${s.id}';refresh()">
    <div class="stop-header">
      <div class="stop-preview">
    <div class="stop-preview-inner" style="background:${getGradPreview(s)}"></div>
  </div>
  <div class="stop-info">
  <div class="stop-name">${s.name}</div>
  <div class="stop-meta">${s.type} · ${
    s.type === "radial"
    ? Math.round(s.size) + "px"
    : s.type === "conic"
    ? s.startAngle + "°"
    : s.angle + "°"
    } · <span class="blend-tag">${s.blendMode || "screen"}</span></div>
  </div>
  <div class="stop-actions">
  <button class="control-btn" onclick="event.stopPropagation();toggleVis('${s.id}')">
    ${s.visible
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <g id="SVGRepo_bgCarrier" stroke-width="0" />
          <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />
          <g id="SVGRepo_iconCarrier">
        <path
          d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
            stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </g>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="SVGRepo_iconCarrier"> <path d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21"
            stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>
      </svg>`}
  </button>
    <button class="control-btn" onclick="event.stopPropagation();dupStop('${s.id}')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <g id="SVGRepo_bgCarrier" stroke-width="0" />
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />
        <g id="SVGRepo_iconCarrier">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M21 8C21 6.34315 19.6569 5 18 5H10C8.34315 5 7 6.34315 7 8V20C7 21.6569 8.34315 23 10 23H18C19.6569 23 21 21.6569 21 20V8ZM19 8C19 7.44772 18.5523 7 18 7H10C9.44772 7 9 7.44772 9 8V20C9 20.5523 9.44772 21 10 21H18C18.5523 21 19 20.5523 19 20V8Z"
          fill="#ffffff" />
        <path
          d="M6 3H16C16.5523 3 17 2.55228 17 2C17 1.44772 16.5523 1 16 1H6C4.34315 1 3 2.34315 3 4V18C3 18.5523 3.44772 19 4 19C4.55228 19 5 18.5523 5 18V4C5 3.44772 5.44772 3 6 3Z"
          fill="#ffffff" />
        </g>
        </svg>
      </button>
        <button class="control-btn del-layer" onclick="event.stopPropagation();delStop('${s.id}')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="SVGRepo_iconCarrier"> <path d="M20.7457 3.32851C20.3552 2.93798 19.722 2.93798 19.3315 3.32851L12.0371 10.6229L4.74275 3.32851C4.35223 2.93798 3.71906 2.93798 3.32854 3.32851C2.93801 3.71903 2.93801 4.3522 3.32854 4.74272L10.6229 12.0371L3.32856 19.3314C2.93803 19.722 2.93803 20.3551 3.32856 20.7457C3.71908 21.1362 4.35225 21.1362 4.74277 20.7457L12.0371 13.4513L19.3315 20.7457C19.722 21.1362 20.3552 21.1362 20.7457 20.7457C21.1362 20.3551 21.1362 19.722 20.7457 19.3315L13.4513 12.0371L20.7457 4.74272C21.1362 4.3522 21.1362 3.71903 20.7457 3.32851Z" fill="#ffffff"/> </g>        
      </svg>
      </button>
    </div>
  </div>
</div>
  `)
.join("");
}

function updateInspectorInputs(stopId) {
  const s = getStop(stopId);
  if (!s || state.selected !== stopId) return;

  const inspector = document.getElementById("inspector");
  if (!inspector) return;

  // ------ Position X, Y ------
  const allInputs = inspector.querySelectorAll("input");
  allInputs.forEach((input) => {
    if (input === document.activeElement) return; // Skip focused inputs

    const oninput = input.getAttribute("oninput") || "";

    // X position
    if (oninput.includes(`getStop('${stopId}').x`)) {
      input.value = Math.round(s.x * 100);
    }
    // Y position
    else if (oninput.includes(`getStop('${stopId}').y`)) {
      input.value = Math.round(s.y * 100);
    }
    // Size (radial)
    else if (oninput.includes(`getStop('${stopId}').size`)) {
      input.value = Math.round(s.size);
    }
    // Feather (radial)
    else if (oninput.includes(`getStop('${stopId}').feather`)) {
      input.value = Math.round(s.feather);
    }
  });

  // ------ Radial opacity ------
  if (s.type === "radial") {
    const opacityInput = document.getElementById(`opacity_${stopId}`);
    if (opacityInput && opacityInput !== document.activeElement) {
      opacityInput.value = Math.round(s.opacity);
    }
  }

  // ------ Linear angle ------
  if (s.type === "linear") {
    const angleNum = document.getElementById(`angleNum_${stopId}`);
    const angleCenter = document.getElementById(`angleCenter_${stopId}`);
    const angleHandle = document.getElementById(`angleHandle_${stopId}`);

    if (angleNum && angleNum !== document.activeElement) {
      angleNum.value = s.angle;
    }
    if (angleCenter) {
      angleCenter.textContent = `${s.angle}°`;
    }
    if (angleHandle) {
      angleHandle.style.transform = `rotate(${s.angle}deg)`;
    }
  }

  // ------ Conic angle ------
  if (s.type === "conic") {
    const angleNum = document.getElementById(`conicAngleNum_${stopId}`);
    const angleCenter = document.getElementById(`conicAngleCenter_${stopId}`);
    const angleHandle = document.getElementById(`conicAngleHandle_${stopId}`);

    if (angleNum && angleNum !== document.activeElement) {
      angleNum.value = s.startAngle;
    }
    if (angleCenter) {
      angleCenter.textContent = `${s.startAngle}°`;
    }
    if (angleHandle) {
      angleHandle.style.transform = `rotate(${s.startAngle}deg)`;
    }
  }

  // ------ Color Stops (linear/conic) ------
  if (s.stops && (s.type === "linear" || s.type === "conic")) {
    s.stops.forEach((cs, i) => {
      const row = inspector.querySelector(
        `[data-stop-id="${stopId}"][data-color-index="${i}"]`,
      );
      if (!row) return;

      // Position
      const posInputs = row.querySelectorAll("input");
      posInputs.forEach((input) => {
        if (input === document.activeElement) return;

        const oninput = input.getAttribute("oninput") || "";
        if (oninput.includes(".pos=") || oninput.includes(".pos =")) {
          input.value = cs.pos;
        }
        if (oninput.includes("updateColorStopOpacity")) {
          input.value = cs.opacity;
        }
      });

      // Color swatch
      const swatch = row.querySelector(".color-swatch-inner");
      if (swatch) {
        swatch.style.background = rgba(cs.color, cs.opacity / 100);
      }
    });
  }

  // ------ Radial color swatch ------
  if (s.type === "radial") {
    const container = inspector.querySelector(`[data-stop-id="${stopId}"]`);
    if (container) {
      const swatch = container.querySelector(".color-swatch-inner");
      if (swatch) {
        swatch.style.background = rgba(s.color, s.opacity / 100);
      }
    }
  }
}

function liveUpdate(stopId = null) {
  draw();
  updateCSS();

  const id = stopId || state.selected;
  if (id) {
    updateStopItem(id);
    updateInspectorInputs(id);
  }
}

function updateInspectorPreview(stopId) {
  const s = getStop(stopId);
  if (!s) return;

  if (s.type === "radial") {
    const container = document.querySelector(`[data-stop-id="${stopId}"]`);
    if (container) {
      const swatch = container.querySelector(".color-swatch-inner");
      if (swatch) {
        swatch.style.background = rgba(s.color, s.opacity / 100);
      }
    }
  }

  s.stops?.forEach((cs, i) => {
    const row = document.querySelector(
      `[data-stop-id="${stopId}"][data-color-stop="${i}"]`,
    );
    if (row) {
      const swatch = row.querySelector(".color-swatch-inner");
      if (swatch) {
        swatch.style.background = rgba(cs.color, cs.opacity / 100);
      }
    }
  });
}

function updateStopOpacity(stopId, value) {
  const s = getStop(stopId);
  if (!s) return;

  s.opacity = clamp(+value, 0, 100);
  liveUpdate(stopId);
}

function updateColorStopOpacity(stopId, index, value) {
  const s = getStop(stopId);
  if (!s || !s.stops[index]) return;

  s.stops[index].opacity = clamp(+value, 0, 100);
  liveUpdate(stopId);
}

function updateAngleFromInput(stopId, value) {
  let angle = parseInt(value) || 0;
  angle = clamp(angle, 0, 360);

  const stop = getStop(stopId);
  if (stop) {
    stop.angle = angle;
    document.getElementById(`angleHandle_${stopId}`).style.transform =
      `rotate(${angle}deg)`;
    document.getElementById(`angleCenter_${stopId}`).textContent = `${angle}°`;
    liveUpdate(stopId);
  }
}

function updateConicAngleFromInput(id, val) {
  val = clamp(+val, 0, 360);
  const stop = getStop(id);
  if (stop) {
    stop.startAngle = val;
    document.getElementById(`conicAngleHandle_${id}`).style.transform =
      `rotate(${val}deg)`;
    document.getElementById(`conicAngleCenter_${id}`).textContent = val + "°";
    liveUpdate(id);
  }
}

// ------ STOP Blend Mode ------
function setStopBlendMode(stopId, mode) {
  const s = getStop(stopId);
  if (s) {
    s.blendMode = mode;
    liveUpdate(stopId);
  }
}
window.setStopBlendMode = setStopBlendMode;

// ------ Update angle drag ------
function handleAngleMove(e) {
  if (!activeAnglePicker) return;
  e.preventDefault();

  const stopId = activeAnglePicker;
  const handle = document.getElementById(`angleHandle_${stopId}`);
  const pickerEl = handle?.closest(".angle-picker");
  if (!pickerEl) return;

  const rect = pickerEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  let angle =
    Math.atan2(clientX - centerX, centerY - clientY) * (180 / Math.PI);
  angle = Math.round((angle + 360) % 360);

  const stop = getStop(stopId);
  if (stop) {
    stop.angle = angle;
    handle.style.transform = `rotate(${angle}deg)`;
    document.getElementById(`angleCenter_${stopId}`).textContent = `${angle}°`;
    document.getElementById(`angleNum_${stopId}`).value = angle;

    draw();
    updateCSS();
    updateStopItem(stopId);
  }
}

// ------ conic angle drag ------
function startConicAngleDrag(e, id) {
  e.preventDefault();

  function move(ev) {
    ev.preventDefault();
    const center = document.querySelector(`#conicAngleCenter_${id}`);
    const handle = document.querySelector(`#conicAngleHandle_${id}`);
    if (!center || !handle) return;

    const rect = center.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let clientX, clientY;
    if (ev.touches && ev.touches.length > 0) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }

    let ang = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    ang = (ang + 360) % 360;

    const stop = getStop(id);
    if (stop) {
      stop.startAngle = Math.round(ang);
      handle.style.transform = `rotate(${ang}deg)`;
      center.textContent = stop.startAngle + "°";
      document.getElementById(`conicAngleNum_${id}`).value = stop.startAngle;

      draw();
      updateCSS();
      updateStopItem(id);
    }
  }

  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
}

// ------ picker callback ------
function openStopColorPicker(stopId, isColorStop = false, colorStopIndex = 0) {
  const s = getStop(stopId);
  if (!s) return;

  if (isColorStop) {
    const cs = s.stops[colorStopIndex];
    if (!cs) return;
    openPicker(cs.color, cs.opacity, (c, a) => {
      const stop = getStop(stopId);
      if (stop && stop.stops[colorStopIndex]) {
        stop.stops[colorStopIndex].color = c;
        stop.stops[colorStopIndex].opacity = a;
        liveUpdate(stopId);
      }
    });
  } else {
    openPicker(s.color, s.opacity, (c, a) => {
      const stop = getStop(stopId);
      if (stop) {
        stop.color = c;
        stop.opacity = a;
        liveUpdate(stopId);
      }
    });
  }
}
// ------ update renderInspector ------
function renderInspector() {
  const el = document.getElementById("inspector");
  const s = getStop(state.selected);
  if (!s) {
    el.innerHTML = '<div class="empty-msg">Select a layer</div>';
    return;
  }

  const blendModes = [
    { value: "normal", label: "Normal" },
    { value: "screen", label: "Screen" },
    { value: "multiply", label: "Multiply" },
    { value: "overlay", label: "Overlay" },
    { value: "darken", label: "Darken" },
    { value: "lighten", label: "Lighten" },
    { value: "color-dodge", label: "Color Dodge" },
    { value: "color-burn", label: "Color Burn" },
    { value: "hard-light", label: "Hard Light" },
    { value: "soft-light", label: "Soft Light" },
    { value: "difference", label: "Difference" },
    { value: "exclusion", label: "Exclusion" },
    { value: "hue", label: "Hue" },
    { value: "saturation", label: "Saturation" },
    { value: "color", label: "Color" },
    { value: "luminosity", label: "Luminosity" },
  ];

  const blendOptions = blendModes
    .map(
      (m) =>
        `<option value="${m.value}" ${s.blendMode === m.value ? "selected" : ""}>${m.label}</option>`,
    )
    .join("");

  let h = `
    <div class="form-group">
      <div class="form-group-title">General</div>
      <div class="form-row">
        <label>Name</label>
        <input style="width:10rem;text-align:left" value="${s.name}" 
          onfocus="HF()" onblur="HB()"
          oninput="getStop('${s.id}').name=this.value;liveUpdate('${s.id}')">
      </div>
      <div class="form-row">
        <label>Blend</label>
        <select class="blend-select" onchange="History.saveState(); setStopBlendMode('${s.id}', this.value)">
          ${blendOptions}
        </select>
      </div>
      <div class="form-row">
        <label>X</label>
        <input type="number" class="num-input" min="0" max="100" value="${Math.round(s.x * 100)}" 
          onfocus="HF()" onblur="HB()"
          oninput="getStop('${s.id}').x=+this.value/100;liveUpdate('${s.id}')">
      </div>
      <div class="form-row">
        <label>Y</label>
        <input type="number" class="num-input" min="0" max="100" value="${Math.round(s.y * 100)}" 
          onfocus="HF()" onblur="HB()"
          oninput="getStop('${s.id}').y=+this.value/100;liveUpdate('${s.id}')"
          ${state.lockVertical ? "disabled" : ""}>
        ${
          state.lockVertical
            ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M7 10.0288C7.47142 10 8.05259 10 8.8 10H15.2C15.9474 10 16.5286 10 17 10.0288M7 10.0288C6.41168 10.0647 5.99429 10.1455 5.63803 10.327C5.07354 10.6146 4.6146 11.0735 4.32698 11.638C4 12.2798 4 13.1198 4 14.8V16.2C4 17.8802 4 18.7202 4.32698 19.362C4.6146 19.9265 5.07354 20.3854 5.63803 20.673C6.27976 21 7.11984 21 8.8 21H15.2C16.8802 21 17.7202 21 18.362 20.673C18.9265 20.3854 19.3854 19.9265 19.673 19.362C20 18.7202 20 17.8802 20 16.2V14.8C20 13.1198 20 12.2798 19.673 11.638C19.3854 11.0735 18.9265 10.6146 18.362 10.327C18.0057 10.1455 17.5883 10.0647 17 10.0288M7 10.0288V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V10.0288" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>

</svg></span>`
            : ""
        }
      </div>
    </div>
  `;

  if (s.type === "radial") {
    h += `
      <div class="form-group" data-stop-id="${s.id}">
        <div class="form-group-title">Radial</div>
        <div class="form-row">
          <div class="color-swatch" onclick="openStopColorPicker('${s.id}')">
            <div class="color-swatch-inner" style="background:${rgba(s.color, s.opacity / 100)}"></div>
          </div>
        </div>
        <div class="form-row">
          <label>Size</label>
          <input type="number" style="width:4rem;text-align:left" class="num-input" min="10" value="${Math.round(s.size)}" 
            onfocus="HF()" onblur="HB()"
            oninput="getStop('${s.id}').size=+this.value;liveUpdate('${s.id}')">
        </div>
        <div class="form-row">
          <label>Feather</label>
          <input type="number" class="num-input" min="0" max="100" value="${Math.round(s.feather)}" 
            onfocus="HF()" onblur="HB()"
            oninput="getStop('${s.id}').feather=+this.value;liveUpdate('${s.id}')">
        </div>
        <div class="form-row form-Opacity">
          <label>Opacity</label>
          <input type="number" class="num-input" id="opacity_${s.id}" min="0" max="100" value="${Math.round(s.opacity)}" 
            onfocus="HF()" onblur="HB()"
            oninput="updateStopOpacity('${s.id}', this.value)">
        </div>
      </div>
    `;
  }

  if (s.type === "linear") {
    h += `
      <div class="form-group">
        <div class="form-group-title">Angle</div>
        <div class="form-row" style="margin: auto; gap: 15px;">
          <div class="angle-picker" onmousedown="startAngleDrag(event, '${s.id}')" ontouchstart="startAngleDrag(event, '${s.id}')">
            <div class="angle-dial">
              <div class="angle-handle" id="angleHandle_${s.id}" style="transform: rotate(${s.angle}deg)">
                <div class="handle-dot"></div>
              </div>
              <div class="angle-center" id="angleCenter_${s.id}">${s.angle}°</div>
            </div>
          </div>
          <input type="number" id="angleNum_${s.id}" class="num-input" min="0" max="360" value="${s.angle}" 
            onfocus="HF()" onblur="HB()"
            oninput="updateAngleFromInput('${s.id}', this.value)" style="width:55px">
        </div>
      </div>
    `;
  }

  if (s.type === "conic") {
    h += `
      <div class="form-group">
        <div class="form-group-title">Angle</div>
        <div class="form-row" style="margin: auto; gap: 15px;">
          <div class="angle-picker" onmousedown="startConicAngleDrag(event, '${s.id}')" ontouchstart="startConicAngleDrag(event, '${s.id}')">
            <div class="angle-dial">
              <div class="angle-handle" id="conicAngleHandle_${s.id}" style="transform: rotate(${s.startAngle}deg)">
                <div class="handle-dot"></div>
              </div>
              <div class="angle-center" id="conicAngleCenter_${s.id}">${s.startAngle}°</div>
            </div>
          </div>
          <input type="number" id="conicAngleNum_${s.id}" class="num-input" min="0" max="360" value="${s.startAngle}" 
            onfocus="HF()" onblur="HB()"
            oninput="updateConicAngleFromInput('${s.id}', this.value)" style="width:55px">
        </div>
      </div>
    `;
  }

  if (s.type === "linear" || s.type === "conic") {
    h += `
      <div class="form-group">
        <div class="form-group-title">
          <span>Color Stops</span>
          <button class="sm" onclick="addColorStop(getStop('${s.id}'))">Add Color</button>
        </div>
  
        <div class="color-stop-list">
          ${s.stops
            .map(
              (cs, i) => `
            <div class="color-stop-row stop-item"
     data-stop-id="${s.id}"
     data-color-index="${i}">

                 
                <span class="drag-handle">☰</span>
  
                <div class="color-swatch"
                     onclick="openStopColorPicker('${s.id}', true, ${i})">
                  <div class="color-swatch-inner"
                       style="background:${rgba(cs.color, cs.opacity / 100)}"></div>
                </div>
  
                <span class="cs-label">Stop ${i + 1}</span>
  

  
              <div class="color-stop-fields">
                <div class="field-group">
                  <label>Position</label>
                  <input type="number" class="num-input" min="0" max="100"
                    value="${cs.pos}"
                    onfocus="HF()" onblur="HB()"
                    oninput="getStop('${s.id}').stops[${i}].pos=+this.value;liveUpdate('${s.id}')">
                </div>
  
                <div class="field-group">
                  <label>Opacity</label>
                  <input type="number" class="num-input" min="0" max="100"
                    value="${cs.opacity}"
                    onfocus="HF()" onblur="HB()"
                    oninput="updateColorStopOpacity('${s.id}', ${i}, this.value)">
                </div>
              </div>
                              ${
                                s.stops.length > 2
                                  ? `<button class="control-btn"
                       onclick="delColorStop(getStop('${s.id}'),${i})">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">

<g id="SVGRepo_bgCarrier" stroke-width="0"/>

<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>

<g id="SVGRepo_iconCarrier"> <path d="M20.7457 3.32851C20.3552 2.93798 19.722 2.93798 19.3315 3.32851L12.0371 10.6229L4.74275 3.32851C4.35223 2.93798 3.71906 2.93798 3.32854 3.32851C2.93801 3.71903 2.93801 4.3522 3.32854 4.74272L10.6229 12.0371L3.32856 19.3314C2.93803 19.722 2.93803 20.3551 3.32856 20.7457C3.71908 21.1362 4.35225 21.1362 4.74277 20.7457L12.0371 13.4513L19.3315 20.7457C19.722 21.1362 20.3552 21.1362 20.7457 20.7457C21.1362 20.3551 21.1362 19.722 20.7457 19.3315L13.4513 12.0371L20.7457 4.74272C21.1362 4.3522 21.1362 3.71903 20.7457 3.32851Z" fill="#ffffff"/> </g>

</svg>
                     </button>`
                                  : ``
                              }
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  el.innerHTML = h;
  initColorStopDrag();
}

// ------ COLOR STOP DRAG ------
(function () {
  // ========== CONFIG ==========
  const DRAG_CONFIG = {
    delay: 200,
    scrollThreshold: 12,
    throttleMs: 16,
  };

  // ========== STATE ==========
  const drag = {
    active: false,
    pending: false,
    stopId: null,
    fromIndex: null,
    element: null,
    clone: null,
    placeholder: null,
    startX: 0,
    startY: 0,
    offsetY: 0,
    delayTimer: null,
    initialRect: null,
    scrollCancelled: false,
    rafId: null,
    lastMoveTime: 0,
    list: null,
  };

  // ========== INIT ==========
  function initColorStopDrag() {
    const list = document.querySelector(".color-stop-list");
    if (!list) return;

    list.removeEventListener("mousedown", onMouseDown);
    list.removeEventListener("touchstart", onTouchStart);

    list.addEventListener("mousedown", onMouseDown);
    list.addEventListener("touchstart", onTouchStart, { passive: true });

    drag.list = list;
  }

  // ========== MOUSE ==========
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (drag.active || drag.pending) return;

    const row = e.target.closest(".color-stop-row.stop-item");
    if (!row) return;
    if (!isValidTarget(e.target)) return;

    e.preventDefault();
    startPending(row, e.clientX, e.clientY);
  }

  // ========== TOUCH ==========
  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    if (drag.active || drag.pending) return;

    const row = e.target.closest(".color-stop-row.stop-item");
    if (!row) return;
    if (!isValidTarget(e.target)) return;

    startPending(row, e.touches[0].clientX, e.touches[0].clientY);
  }

  // ========== START PENDING ==========
  function startPending(row, clientX, clientY) {
    const rect = row.getBoundingClientRect();

    Object.assign(drag, {
      pending: true,
      element: row,
      stopId: row.dataset.stopId,
      fromIndex: +row.dataset.colorIndex,
      startX: clientX,
      startY: clientY,
      offsetY: clientY - rect.top,
      initialRect: rect,
      scrollCancelled: false,
    });

    drag.delayTimer = setTimeout(() => {
      if (drag.pending && !drag.scrollCancelled) {
        startActualDrag();
      }
    }, DRAG_CONFIG.delay);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
  }

  // ========== ON MOVE ==========
  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (drag.pending && !drag.active) {
      const dx = Math.abs(clientX - drag.startX);
      const dy = Math.abs(clientY - drag.startY);

      if (
        dy > DRAG_CONFIG.scrollThreshold ||
        dx > DRAG_CONFIG.scrollThreshold
      ) {
        clearTimeout(drag.delayTimer);
        drag.scrollCancelled = true;
        drag.pending = false;
        cleanup();
        return;
      }

      if (dy > 5 || dx > 5) {
        clearTimeout(drag.delayTimer);
        startActualDrag();
      }
      return;
    }

    if (!drag.active || !drag.clone) return;
    e.preventDefault();

    const now = Date.now();
    if (now - drag.lastMoveTime < DRAG_CONFIG.throttleMs) return;
    drag.lastMoveTime = now;

    if (drag.rafId) {
      cancelAnimationFrame(drag.rafId);
    }

    drag.rafId = requestAnimationFrame(() => {
      if (!drag.clone) return;

      const newTop = clientY - drag.offsetY;
      drag.clone.style.transform = `translateY(${newTop - drag.initialRect.top}px) scale(1.03)`;

      updatePlaceholderPosition(clientY);
    });
  }

  // ========== UPDATE PLACEHOLDER (اصلاح شده) ==========
  function updatePlaceholderPosition(clientY) {
    const list = drag.placeholder?.parentNode;
    if (!list) return;

    // فقط آیتم‌های قابل مشاهده (بدون drag-original و placeholder)
    const items = [
      ...list.querySelectorAll(".color-stop-row.stop-item:not(.drag-original)"),
    ];

    if (items.length === 0) return;

    const placeholder = drag.placeholder;
    let inserted = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (clientY < midY) {
        // قبل از این آیتم قرار بده
        if (placeholder.nextElementSibling !== item) {
          list.insertBefore(placeholder, item);
        }
        inserted = true;
        break;
      }
    }

    // اگر پایین‌تر از همه آیتم‌ها بود، به آخر ببر
    if (!inserted) {
      // پیدا کردن آخرین آیتم واقعی (بدون drag-original)
      const lastVisibleItem = items[items.length - 1];

      // placeholder را بعد از آخرین آیتم قابل مشاهده قرار بده
      let insertPoint = lastVisibleItem.nextElementSibling;

      // از روی drag-original رد شو
      while (insertPoint && insertPoint === drag.element) {
        insertPoint = insertPoint.nextElementSibling;
      }

      if (insertPoint) {
        if (insertPoint !== placeholder) {
          list.insertBefore(placeholder, insertPoint);
        }
      } else {
        // واقعاً آخر لیست
        if (list.lastElementChild !== placeholder) {
          list.appendChild(placeholder);
        }
      }
    }
  }

  // ========== START ACTUAL DRAG ==========
  function startActualDrag() {
    if (drag.active || !drag.element) return;

    const row = drag.element;
    const rect = drag.initialRect;

    drag.pending = false;
    drag.active = true;

    drag.clone = row.cloneNode(true);
    drag.clone.classList.add("drag-clone");
    Object.assign(drag.clone.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      zIndex: "10000",
      pointerEvents: "none",
      opacity: "0.95",
      boxShadow: "0 15px 50px rgba(0,0,0,0.5)",
      borderRadius: "8px",
      background: "var(--bg-transparent, rgba(30,30,30,0.95))",
      backdropFilter: "blur(6px)",
      border: "2px solid var(--border, #444)",
      willChange: "transform",
      transform: "scale(1.03)",
    });
    document.body.appendChild(drag.clone);

    drag.placeholder = document.createElement("div");
    drag.placeholder.className = "color-stop-placeholder";
    Object.assign(drag.placeholder.style, {
      height: rect.height + "px",
      margin: "4px 0",
      border: "2px dashed var(--border, #444)",
      borderRadius: "8px",
      background: "var(--accent)",
      transition: "height 0.15s ease",
      opacity: "0.3",
    });

    row.classList.add("drag-original");
    Object.assign(row.style, {
      opacity: "0",
      height: "0",
      margin: "0",
      padding: "0",
      overflow: "hidden",
      pointerEvents: "none",
    });

    // placeholder را دقیقاً جای آیتم اصلی قرار بده
    row.parentNode.insertBefore(drag.placeholder, row);

    Object.assign(document.body.style, {
      userSelect: "none",
      cursor: "grabbing",
      overflow: "hidden",
      touchAction: "none",
    });

    if (navigator.vibrate) navigator.vibrate(30);
  }

  // ========== ON END ==========
  function onEnd() {
    clearTimeout(drag.delayTimer);
    if (drag.rafId) cancelAnimationFrame(drag.rafId);

    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);

    if (!drag.active) {
      cleanup();
      return;
    }

    if (drag.clone && drag.placeholder) {
      const placeholderRect = drag.placeholder.getBoundingClientRect();

      Object.assign(drag.clone.style, {
        transition: "all 0.2s ease-out",
        transform: "scale(1)",
        top: placeholderRect.top + "px",
        left: placeholderRect.left + "px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      });

      setTimeout(finalizeDrag, 200);
    } else {
      finalizeDrag();
    }
  }

  // ========== FINALIZE (اصلاح شده) ==========
  function finalizeDrag() {
    const list = drag.placeholder?.parentNode;

    if (list && drag.element) {
      // روش ساده و مطمئن: شمارش آیتم‌های قبل از placeholder
      const allChildren = [...list.children];
      let toIndex = 0;

      for (const child of allChildren) {
        // وقتی به placeholder رسیدیم، متوقف شو
        if (child === drag.placeholder) break;

        // drag-original را نشمار
        if (child === drag.element) continue;

        // فقط آیتم‌های واقعی را بشمار
        if (child.classList.contains("stop-item")) {
          toIndex++;
        }
      }

      console.log(`Moving from ${drag.fromIndex} to ${toIndex}`);

      const stop = getStop(drag.stopId);
      if (stop && stop.stops && toIndex !== drag.fromIndex) {
        History.saveState();
        const [moved] = stop.stops.splice(drag.fromIndex, 1);
        stop.stops.splice(toIndex, 0, moved);
      }
    }

    const wasActive = drag.active;
    cleanup();

    if (wasActive) {
      renderInspector();
      refresh();
    }
  }

  // ========== CLEANUP ==========
  function cleanup() {
    drag.clone?.remove();
    drag.placeholder?.remove();

    if (drag.element) {
      drag.element.classList.remove("drag-original");
      drag.element.style.cssText = "";
    }

    Object.assign(document.body.style, {
      overflow: "",
      touchAction: "",
      userSelect: "",
      cursor: "",
    });

    Object.assign(drag, {
      active: false,
      pending: false,
      element: null,
      clone: null,
      placeholder: null,
      stopId: null,
      fromIndex: null,
      delayTimer: null,
      initialRect: null,
      scrollCancelled: false,
      rafId: null,
      lastMoveTime: 0,
    });
  }

  // ========== HELPER ==========
  function isValidTarget(target) {
    if (target.closest("input, button, .color-swatch, select")) return false;
    return !!target.closest(".drag-handle");
  }

  window.initColorStopDrag = initColorStopDrag;
})();

window.liveUpdate = liveUpdate;
window.updateStopItem = updateStopItem;
window.updateAllStopItems = updateAllStopItems;
window.openStopColorPicker = openStopColorPicker;
window.updateStopOpacity = updateStopOpacity;
window.updateColorStopOpacity = updateColorStopOpacity;

// ========== CSS OUTPUT ==========
// ========== CSS OUTPUT - FIXED ==========
function updateCSS() {
  const fmt = state.cssFormat;
  const vis = state.stops.filter((s) => s.visible);
  const bgColorFmt = formatColor(state.bgColor, state.bgAlpha, fmt);

  let gradientLines = [];

  gradientLines.push(`width: ${Math.floor(W)}px;`);
  gradientLines.push(`height: ${Math.floor(H)}px;`);

  if (state.bgEnabled) {
    gradientLines.push(`background-color: ${bgColorFmt};`);
  }

  const grads = vis.map((s) => {
    if (s.type === "radial") {
      const x = (s.x * 100).toFixed(0);
      const y = (s.y * 100).toFixed(0);
      const size = Math.round(s.size);
      const feather = (s.feather ?? 60) / 100;
      const solidStop = Math.round((1 - feather) * 100);
      const colorFmt = formatColor(s.color, s.opacity, fmt);
      const transFmt = formatColor(s.color, 0, fmt);

      if (solidStop >= 99) {
        // بدون feather → دایره ثابت
        return `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${colorFmt} 0%, ${colorFmt} 100%)`;
      }
      if (solidStop > 0) {
        return `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${colorFmt} 0%, ${colorFmt} ${solidStop}%, ${transFmt} 100%)`;
      }
      return `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${colorFmt} 0%, ${transFmt} 100%)`;
    } else if (s.type === "linear") {
      const sorted = [...s.stops].sort((a, b) => a.pos - b.pos);
      const cs = sorted
        .map((c) => `${formatColor(c.color, c.opacity, fmt)} ${c.pos}%`)
        .join(", ");
      return `linear-gradient(${s.angle}deg, ${cs})`;
    } else if (s.type === "conic") {
      const x = (s.x * 100).toFixed(0);
      const y = (s.y * 100).toFixed(0);
      const sorted = [...s.stops].sort((a, b) => a.pos - b.pos);
      const cs = sorted
        .map((c) => `${formatColor(c.color, c.opacity, fmt)} ${c.pos}%`)
        .join(", ");
      return `conic-gradient(from ${s.startAngle}deg at ${x}% ${y}%, ${cs})`;
    }
  });

  gradientLines.push(`background-image:`);
  gradientLines.push(`  ${grads.join(",\n  ")};`);

  const individualBlends = vis.map((s) => s.blendMode || "screen");

  gradientLines.push(`background-blend-mode: ${individualBlends.join(", ")};`);

  if (state.bgEnabled && state.bgBlendMode !== "normal") {
    gradientLines.push(`mix-blend-mode: ${state.bgBlendMode};`);
  }
  const hasFilters = hasActiveFilters();
  if (hasFilters) {
    gradientLines.push(`filter: ${getFilterString()};`);
  }

  currentGradientCSS = gradientLines.join("\n");

  currentFilterCSS = "";

  const hasNoise = noiseState.enabled && noiseState.opacity > 0;

  if (hasNoise) {
    currentNoiseCSS = `content: '';
position: absolute;
top: 0;
left: 0;
width: 100%;
height: 100%;
pointer-events: none;
opacity: ${(noiseState.opacity / 100).toFixed(2)};
filter: url(#noiseFilter);
mix-blend-mode: ${noiseState.blend};`;

    currentSVGFilter = `<svg width="0" height="0" style="position:absolute">
  <filter id="noiseFilter" x="0%" y="0%" width="100%" height="100%">    
    <feTurbulence type="fractalNoise" baseFrequency="${noiseState.frequency}" numOctaves="4" stitchTiles="stitch"/>    
    <feColorMatrix type="saturate" values="0"/>
  </filter>
</svg>`;
  } else {
    currentNoiseCSS = "";
    currentSVGFilter = "";
  }

  // UI Updates
  const noiseBlock = document.getElementById("noiseOutputBlock");
  const svgBlock = document.getElementById("svgOutputBlock");

  if (noiseBlock) noiseBlock.style.display = hasNoise ? "block" : "none";
  if (svgBlock) svgBlock.style.display = hasNoise ? "block" : "none";

  // Render
  renderIframe("cssGradient", currentGradientCSS);
  if (hasNoise) {
    renderIframe("cssNoise", currentNoiseCSS);
    renderIframe("cssSVG", currentSVGFilter, true);
  }
}

function highlightCSS_DOM(container, doc) {
  const html = container.textContent
    .replace(
      /\b(radial-gradient|linear-gradient|conic-gradient|url)\b/g,
      '<span class="f">$1</span>',
    )
    .replace(
      /(rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\)|#[0-9a-fA-F]{3,8})/g,
      '<span class="v">$1</span>',
    )
    .replace(/^(\s*)([a-z-]+)(\s*:)/gm, '$1<span class="p">$2</span>$3')
    .replace(
      /\b(\d+\.?\d*(?:px|%|deg|rem|em)?)\b/g,
      '<span class="n">$1</span>',
    )
    .replace(
      /\b(normal|screen|overlay|multiply|darken|lighten|difference|exclusion|color-(?:dodge|burn)|hue|saturation|luminosity|soft-light|hard-light|transparent|absolute|relative|none|brightness|contrast|saturate|hue-rotate|blur|grayscale|sepia|invert)\b/g,
      '<span class="k">$1</span>'
    )
  container.innerHTML = html;
}

function highlightSVG_DOM(container, doc) {
  const text = container.textContent;
  container.textContent = "";

  const lines = text.split("\n");
  const frag = doc.createDocumentFragment();

  lines.forEach((line) => {
    const lineDiv = doc.createElement("div");

    if (line.trim() === "") {
      lineDiv.innerHTML = "&nbsp;";
      frag.appendChild(lineDiv);
      return;
    }

    const tokens = [];

    // Tags
    const tagRegex = /<\/?[\w:-]+/g;
    let m;
    while ((m = tagRegex.exec(line)) !== null) {
      tokens.push({
        type: "tag",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        priority: 10,
      });
    }

    // Attributes
    const attrRegex = /\s([\w:-]+)=/g;
    while ((m = attrRegex.exec(line)) !== null) {
      tokens.push({
        type: "attr",
        start: m.index + 1,
        end: m.index + m[1].length + 1,
        text: m[1],
        priority: 9,
      });
    }

    // Values
    const valRegex = /"[^"]*"/g;
    while ((m = valRegex.exec(line)) !== null) {
      tokens.push({
        type: "val",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        priority: 8,
      });
    }

    tokens.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.start - b.start;
    });

    const finalTokens = [];
    for (const token of tokens) {
      const hasOverlap = finalTokens.some(
        (t) =>
          (token.start >= t.start && token.start < t.end) ||
          (token.end > t.start && token.end <= t.end) ||
          (token.start <= t.start && token.end >= t.end),
      );
      if (!hasOverlap) {
        finalTokens.push(token);
      }
    }

    finalTokens.sort((a, b) => a.start - b.start);

    let cursor = 0;
    finalTokens.forEach((token) => {
      if (token.start > cursor) {
        lineDiv.appendChild(
          doc.createTextNode(line.slice(cursor, token.start)),
        );
      }

      const span = doc.createElement("span");
      switch (token.type) {
        case "tag":
          span.className = "t";
          break;
        case "attr":
          span.className = "s";
          break;
        case "val":
          span.className = "v";
          break;
      }
      span.textContent = token.text;
      lineDiv.appendChild(span);

      cursor = token.end;
    });

    if (cursor < line.length) {
      lineDiv.appendChild(doc.createTextNode(line.slice(cursor)));
    }

    frag.appendChild(lineDiv);
  });

  container.appendChild(frag);
}

function renderIframe(id, content, isSVG = false) {
  const iframe = document.getElementById(id);
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow.document;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<style>
  *::-webkit-scrollbar {
    height: 6px;
    width: 4px;
  }
  
  *::-webkit-scrollbar-track {
    border-radius: 3px;
    background-color: var(--bg);
  }
  
  *::-webkit-scrollbar-thumb {
    border-radius: 5px;
    background-color: #666;
  }

*{margin:0;padding:0;box-sizing:border-box}

*::selection{
  background:rgba(56, 191, 248, 0.2);
  color:var(--text-primary);
}
  
body{
  color:#c9d1d9;
  font-family:'Fira Code', monospace;
  font-size:12px;
  line-height:1.6;
  padding:12px;
  overflow-x: hidden;
  
pre, div {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}

.p{
  background: linear-gradient(90deg, #00d4ff 0%, #0099ff 50%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 500;
}

/* Function*/
.f{
  background-image:
  linear-gradient(139deg, rgba(207, 152, 147, 0.49) 0%, rgba(207, 152, 147, 0.50) 20%, rgba(207, 152, 147, 0.45) 40%, rgba(255, 0, 102, 0.73) 60%, rgba(255, 0, 102, 0.44) 80%, rgba(221, 122, 131, 0.52) 100%),
  radial-gradient(155px 155px at 70% 55%, rgba(255, 0, 102, 0.84) 0%, rgba(255, 0, 102, 0.84) 26%, rgba(255, 0, 102, 0.00) 100%),
  linear-gradient(216deg, rgba(105, 104, 166, 0.62) 0%, rgba(105, 104, 166, 0.66) 50%, rgba(105, 104, 166, 0.33) 100%),
  linear-gradient(315deg, rgba(105, 104, 166, 0.45) 0%, rgba(221, 122, 131, 0.40) 25%, rgba(255, 0, 102, 0.63) 50%, rgba(255, 0, 102, 0.66) 75%, rgba(255, 0, 102, 0.20) 100%),
  radial-gradient(167px 167px at 24% 23%, rgba(105, 104, 166, 0.25) 0%, rgba(105, 104, 166, 0.25) 6%, rgba(105, 104, 166, 0.00) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 500;
}

/* Value/Color */
.v{
background-image:
  linear-gradient(236deg, rgba(105, 104, 166, 0.48) 0%, rgba(0, 255, 136, 0.50) 9%, rgba(0, 255, 136, 0.77) 20%, rgba(0, 255, 136, 0.50) 60%, rgba(0, 255, 136, 0.64) 80%, rgba(105, 104, 166, 0.67) 100%),
  linear-gradient(127deg, rgba(0, 255, 136, 0.36) 0%, rgba(0, 255, 136, 0.50) 33%, rgba(105, 104, 166, 0.67) 68%, rgba(207, 152, 147, 0.26) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Number */
.n{
background-image:
  conic-gradient(from 220deg at 40% 100%, rgba(251, 86, 7, 0.72) 35%, rgba(221, 122, 131, 0.59) 73%, rgba(221, 122, 131, 0.56) 86%),
  conic-gradient(from 343deg at 0% 54%, rgba(251, 86, 7, 0.69) 22%, rgba(221, 122, 131, 0.32) 71%, rgba(221, 122, 131, 0.67) 92%),
  linear-gradient(316deg, rgba(207, 152, 147, 0.57) 0%, rgba(207, 152, 147, 0.48) 25%, rgba(207, 152, 147, 0.54) 50%, rgba(207, 152, 147, 0.66) 75%, rgba(221, 122, 131, 0.61) 100%),
  linear-gradient(129deg, rgba(251, 86, 7, 0.68) 0%, rgba(207, 152, 147, 0.59) 25%, rgba(207, 152, 147, 0.21) 50%, rgba(0, 212, 255, 0.38) 75%, rgba(207, 152, 147, 0.32) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Keyword */
.k{
background-image:
  linear-gradient(332deg, rgba(255, 0, 0, 0.73) 0%, rgba(251, 86, 7, 0.56) 50%, rgba(255, 0, 0, 0.54) 100%),
  linear-gradient(30deg, rgba(255, 0, 0, 0.38) 0%, rgba(255, 0, 0, 0.67) 0%, rgba(251, 86, 7, 0.30) 20%, rgba(251, 86, 7, 0.65) 77%, rgba(255, 0, 0, 0.28) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Tag */
.t{
  background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 500;
}

/* Attribute */
.s{
  background: linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
</head>
<body><pre id="code"></pre></body>
</html>`);
  doc.close();

  const pre = doc.getElementById("code");
  pre.textContent = content;

  if (isSVG) {
    highlightSVG_DOM(pre, doc);
  } else {
    highlightCSS_DOM(pre, doc);
  }
}

// ------ COPY FUNCTION ------
function copyCSS(btn) {
  let allCSS = currentGradientCSS || "";

  if (currentNoiseCSS) {
    allCSS += "\n \n" + currentNoiseCSS;
  }

  if (currentSVGFilter) {
    allCSS += "\n \n" + currentSVGFilter;
  }

  copyToClipboard(allCSS, btn);
}

function copyGradientCSS(btn) {
  copyToClipboard(currentGradientCSS, btn);
}

function copyNoiseCSS(btn) {
  copyToClipboard(currentNoiseCSS, btn);
}

function copySVGFilter(btn) {
  copyToClipboard(currentSVGFilter, btn);
}

function copyToClipboard(text, btn = null) {
  if (!text || !text.trim()) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => feedback(btn))
      .catch(() => legacyCopy(text, btn));
  } else {
    legacyCopy(text, btn);
  }
}

function legacyCopy(text, btn) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    document.execCommand("copy");
    feedback(btn);
  } catch (err) {
    console.error("Copy failed", err);
  }

  document.body.removeChild(textarea);
}

const feedbackTimers = new WeakMap();

function feedback(btn) {
  if (!btn) return;

  if (feedbackTimers.has(btn)) {
    clearTimeout(feedbackTimers.get(btn));
    feedbackTimers.delete(btn);
  }

  const originalHTML = btn.dataset.originalHtml || btn.innerHTML;
  btn.dataset.originalHtml = originalHTML;

  btn.classList.add("copied");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="#4ade80">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
    <span>Copied !</span>
  `;

  const timer = setTimeout(() => {
    btn.classList.remove("copied");
    btn.innerHTML = originalHTML;
    feedbackTimers.delete(btn);
  }, 1200);

  feedbackTimers.set(btn, timer);
}

// ------ EXPORT ------
document
  .getElementById("exportSelect")
  ?.addEventListener("change", function (e) {
    const format = e.target.value;
    if (!format) return;

    if (format === "svg") {
      exportAsSVG();
    } else {
      exportAsImage(format);
    }
    this.value = "";
  });


async function exportAsImage(format = "png", quality = 0.92) {
  const width = state.canvasWidth;
  const height = state.canvasHeight;

  const exportCanvas = document.createElement("canvas");
  const exportCtx = exportCanvas.getContext("2d", { willReadFrequently: true });

  exportCanvas.width = width;
  exportCanvas.height = height;

  const visibleStops = state.stops.filter((s) => s.visible);
  const reversedStops = [...visibleStops].reverse();

  if (state.bgEnabled) {
    exportCtx.fillStyle = rgba(state.bgColor, state.bgAlpha / 100);
    exportCtx.fillRect(0, 0, width, height);
  }

  if (reversedStops.length > 0) {
    const needsBgBlend =
      state.bgEnabled && state.bgBlendMode && state.bgBlendMode !== "normal";

    if (needsBgBlend) {
      const gradCanvas = document.createElement("canvas");
      gradCanvas.width = width;
      gradCanvas.height = height;
      const gradCtx = gradCanvas.getContext("2d");

      reversedStops.forEach((s) => {
        gradCtx.globalCompositeOperation = getCanvasBlendMode(s.blendMode);
        drawGradForExport(s, gradCtx, width, height);
      });
      gradCtx.globalCompositeOperation = "source-over";

      exportCtx.globalCompositeOperation = getCanvasBlendMode(
        state.bgBlendMode,
      );
      exportCtx.drawImage(gradCanvas, 0, 0);
      exportCtx.globalCompositeOperation = "source-over";
    } else {
      reversedStops.forEach((s) => {
        exportCtx.globalCompositeOperation = getCanvasBlendMode(s.blendMode);
        drawGradForExport(s, exportCtx, width, height);
      });
      exportCtx.globalCompositeOperation = "source-over";
    }
  }

  if (hasActiveFilters()) {
    // Blur با padding
    if (filterState.blur > 0) {
      const blurPx = filterState.blur;
      const padding = Math.ceil(blurPx * 3);

      const padded = document.createElement("canvas");
      padded.width = width + padding * 2;
      padded.height = height + padding * 2;
      const pCtx = padded.getContext("2d");

      // Mirror edges
      pCtx.drawImage(exportCanvas, padding, padding);

      // Top
      pCtx.save();
      pCtx.translate(padding, padding);
      pCtx.scale(1, -1);
      pCtx.drawImage(exportCanvas, 0, 0, width, padding, 0, 0, width, padding);
      pCtx.restore();

      // Bottom
      pCtx.save();
      pCtx.translate(padding, height + padding);
      pCtx.scale(1, -1);
      pCtx.drawImage(
        exportCanvas,
        0,
        height - padding,
        width,
        padding,
        0,
        -padding,
        width,
        padding,
      );
      pCtx.restore();

      // Left
      pCtx.save();
      pCtx.translate(padding, padding);
      pCtx.scale(-1, 1);
      pCtx.drawImage(
        exportCanvas,
        0,
        0,
        padding,
        height,
        0,
        0,
        padding,
        height,
      );
      pCtx.restore();

      // Right
      pCtx.save();
      pCtx.translate(width + padding, padding);
      pCtx.scale(-1, 1);
      pCtx.drawImage(
        exportCanvas,
        width - padding,
        0,
        padding,
        height,
        -padding,
        0,
        padding,
        height,
      );
      pCtx.restore();

      // Apply blur
      const blurred = document.createElement("canvas");
      blurred.width = padded.width;
      blurred.height = padded.height;
      const bCtx = blurred.getContext("2d");
      bCtx.filter = `blur(${blurPx}px)`;
      bCtx.drawImage(padded, 0, 0);

      // Crop back
      exportCtx.clearRect(0, 0, width, height);
      exportCtx.drawImage(
        blurred,
        padding,
        padding,
        width,
        height,
        0,
        0,
        width,
        height,
      );
    }

    // Other filters
    if (hasNonBlurFilters()) {
      const imageData = exportCtx.getImageData(0, 0, width, height);
      applyFiltersToImageData(imageData);
      exportCtx.putImageData(imageData, 0, 0);
    }
  }

  if (noiseState.enabled && noiseState.opacity > 0) {
    const noiseCanvas = await getNoiseCanvas(
      width,
      height,
      noiseState.frequency,
    );

    if (noiseCanvas instanceof HTMLCanvasElement) {
      exportCtx.save();
      exportCtx.globalCompositeOperation = noiseState.blend;
      exportCtx.globalAlpha = noiseState.opacity / 100;
      exportCtx.drawImage(noiseCanvas, 0, 0, width, height);
      exportCtx.restore();
    }
  }

  // ========== 4. دانلود ==========
  const mimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  const ext = format.toLowerCase();
  const mime = mimeTypes[ext] || "image/png";
  const filename = `gradient-${width}x${height}.${ext === "jpeg" ? "jpg" : ext}`;

  exportCanvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    mime,
    quality,
  );
}

function drawGradForExport(s, ctx, width, height) {
  const cx = s.x * width;
  const cy = s.y * height;

  if (s.type === "radial") {
    const solidEnd = 1 - (s.feather ?? 60) / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.size);
    const col = rgba(s.color, s.opacity / 100);

    addRadialGradientStops(grad, col, s.color, solidEnd);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, s.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "linear") {
    const a = ((s.angle - 90) * Math.PI) / 180;
    const d = Math.hypot(width, height);
    const mx = width / 2,
      my = height / 2;
    const dx = (Math.cos(a) * d) / 2;
    const dy = (Math.sin(a) * d) / 2;

    const grad = ctx.createLinearGradient(mx - dx, my - dy, mx + dx, my + dy);

    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(cs.pos / 100, rgba(cs.color, cs.opacity / 100));
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (s.type === "conic") {
    const start = ((s.startAngle - 90) * Math.PI) / 180;
    const grad = ctx.createConicGradient(start, cx, cy);

    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(cs.pos / 100, rgba(cs.color, cs.opacity / 100));
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

// ------ EXPORT AS SVG ------
// ========== EXPORT AS SVG - PIXEL PERFECT ==========
// ========== RASTER SVG EXPORT (بهینه‌شده) ==========
async function exportAsSVG() {
  const width = state.canvasWidth;
  const height = state.canvasHeight;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext("2d");

  await renderSceneToContext(exportCtx, width, height);

  // ✅ انتخاب هوشمند فرمت تصویر
  const needsAlpha = !state.bgEnabled || state.bgAlpha < 100;
  let imageData;

  if (needsAlpha) {
    // فقط وقتی شفافیت لازمه PNG بزن
    imageData = exportCanvas.toDataURL("image/png");
  } else {
    // ✅ اول WebP رو تست کن (کوچکترین)
    const webp = exportCanvas.toDataURL("image/webp", 0.88);
    const jpeg = exportCanvas.toDataURL("image/jpeg", 0.9);

    if (webp.startsWith("data:image/webp") && webp.length < jpeg.length) {
      imageData = webp;
    } else {
      imageData = jpeg;
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<image width="${width}" height="${height}" xlink:href="${imageData}"/>
</svg>`;

  downloadFile(
    svg,
    "image/svg+xml;charset=utf-8",
    `gradient-${width}x${height}.svg`,
  );
}

function renderGradient(s, ctx, width, height) {
  const cx = s.x * width;
  const cy = s.y * height;

  if (s.type === "radial") {
    const solidEnd = 1 - (s.feather ?? 60) / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.size);
    const color = rgba(s.color, s.opacity / 100);

    addRadialGradientStops(grad, color, s.color, solidEnd);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, s.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "linear") {
    const angleRad = ((s.angle - 90) * Math.PI) / 180;
    const diagonal = Math.hypot(width, height);
    const mx = width / 2;
    const my = height / 2;
    const dx = (Math.cos(angleRad) * diagonal) / 2;
    const dy = (Math.sin(angleRad) * diagonal) / 2;

    const grad = ctx.createLinearGradient(mx - dx, my - dy, mx + dx, my + dy);
    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (s.type === "conic") {
    const startAngle = ((s.startAngle - 90) * Math.PI) / 180;
    const grad = ctx.createConicGradient(startAngle, cx, cy);
    const fixedStops = s.stops;
    fixedStops.forEach((cs) => {
      grad.addColorStop(
        clamp(cs.pos / 100, 0, 1),
        rgba(cs.color, cs.opacity / 100),
      );
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

function getCanvasBlendMode(cssBlendMode) {
  if (!cssBlendMode || cssBlendMode === "normal") return "source-over";
  return cssBlendMode;
}

function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function n(val, decimals = 2) {
  const num = +parseFloat(val).toFixed(decimals);
  return String(num);
}

function exportAsVectorSVG() {
  const width = state.canvasWidth;
  const height = state.canvasHeight;
  const visibleStops = state.stops.filter((s) => s.visible);
  const reversedStops = [...visibleStops].reverse();

  let defs = "";
  let content = "";

  // ========== 1. تعریف گرادینت‌ها ==========
  reversedStops.forEach((s, i) => {
    const id = `g${i}`;

    if (s.type === "radial") {
      const cx = n(s.x * width);
      const cy = n(s.y * height);
      const rgb = hexToRgb(s.color);
      const op = n(s.opacity / 100, 3);
      const c = `${rgb.r},${rgb.g},${rgb.b}`;
      const solidEnd = Math.max(0, Math.min(1, 1 - (s.feather ?? 60) / 100));

      // و بخش stops:
      defs += `<stop offset="0" stop-color="rgb(${c})" stop-opacity="${op}"/>`;
      if (solidEnd >= 0.99) {
        defs += `<stop offset="1" stop-color="rgb(${c})" stop-opacity="${op}"/>`;
      } else {
        if (solidEnd > 0.01) {
          defs += `<stop offset="${n(solidEnd, 3)}" stop-color="rgb(${c})" stop-opacity="${op}"/>`;
        }
        defs += `<stop offset="1" stop-color="rgb(${c})" stop-opacity="0"/>`;
      }

      defs += `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${s.size}">`;
      defs += `<stop offset="0" stop-color="rgb(${c})" stop-opacity="${op}"/>`;
      if (solidEnd > 0.01 && solidEnd < 0.99) {
        defs += `<stop offset="${n(solidEnd, 3)}" stop-color="rgb(${c})" stop-opacity="${op}"/>`;
      }
      defs += `<stop offset="1" stop-color="rgb(${c})" stop-opacity="0"/>`;
      defs += `</radialGradient>`;
    } else if (s.type === "linear") {
      const angleRad = ((s.angle - 90) * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      defs += `<linearGradient id="${id}" x1="${n(50 - cos * 50)}%" y1="${n(50 - sin * 50)}%" x2="${n(50 + cos * 50)}%" y2="${n(50 + sin * 50)}%">`;

      s.stops.forEach((cs) => {
        const c = hexToRgb(cs.color);
        defs += `<stop offset="${cs.pos}%" stop-color="rgb(${c.r},${c.g},${c.b})" stop-opacity="${n(cs.opacity / 100, 3)}"/>`;
      });
      defs += `</linearGradient>`;
    }
  });

  // ========== 2. Noise Filter ==========
  if (noiseState.enabled && noiseState.opacity > 0) {
    defs +=
      `<filter id="noise" x="0%" y="0%" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${noiseState.frequency}" numOctaves="4" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/>` +
      `</filter>`;
  }

  // ========== 3. فیلتر CSS ==========
  if (hasActiveFilters()) {
    defs += generateSVGFilterFromCSS();
  }

  // ========== 4. پس‌زمینه ==========
  if (state.bgEnabled) {
    const bg = hexToRgb(state.bgColor);
    content += `<rect width="100%" height="100%" fill="rgb(${bg.r},${bg.g},${bg.b})" fill-opacity="${n(state.bgAlpha / 100, 3)}"/>`;
  }

  // ========== 5. گرادینت‌ها ==========
  const hasBgBlend =
    state.bgEnabled && state.bgBlendMode && state.bgBlendMode !== "normal";
  const wrapFilter = hasActiveFilters();

  if (hasBgBlend || wrapFilter) {
    const styles = [];
    if (hasBgBlend) styles.push(`mix-blend-mode:${state.bgBlendMode}`);
    const filterAttr = wrapFilter ? ' filter="url(#cssFilter)"' : "";
    content += `<g style="${styles.join(";")}"${filterAttr}>`;
  }

  reversedStops.forEach((s, i) => {
    const id = `g${i}`;
    const blend = s.blendMode || "screen";

    if (s.type === "radial") {
      content += `<circle cx="${n(s.x * width)}" cy="${n(s.y * height)}" r="${s.size}" fill="url(#${id})" style="mix-blend-mode:${blend}"/>`;
    } else if (s.type === "linear") {
      content += `<rect width="100%" height="100%" fill="url(#${id})" style="mix-blend-mode:${blend}"/>`;
    } else if (s.type === "conic") {
      const x = n(s.x * 100);
      const y = n(s.y * 100);
      const stopsCSS = s.stops
        .map((cs) => {
          const c = hexToRgb(cs.color);
          return `rgba(${c.r},${c.g},${c.b},${n(cs.opacity / 100, 3)}) ${cs.pos}%`;
        })
        .join(",");

      content +=
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background:conic-gradient(from ${s.startAngle}deg at ${x}% ${y}%,${stopsCSS});mix-blend-mode:${blend}"></div>` +
        `</foreignObject>`;
    }
  });

  if (hasBgBlend || wrapFilter) {
    content += `</g>`;
  }

  // ========== 6. نویز ==========
  if (noiseState.enabled && noiseState.opacity > 0) {
    content += `<rect width="100%" height="100%" fill="#fff" filter="url(#noise)" opacity="${n(noiseState.opacity / 100, 3)}" style="mix-blend-mode:${noiseState.blend}"/>`;
  }

  // ========== 7. SVG نهایی ==========
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${defs}</defs>
${content}
</svg>`;

  downloadFile(
    svg,
    "image/svg+xml;charset=utf-8",
    `gradient-${width}x${height}.svg`,
  );
}

function generateSVGFilterFromCSS() {
  if (!hasActiveFilters()) return "";

  let parts = [];
  let last = "SourceGraphic";
  let idx = 0;

  function nextResult(prefix) {
    const r = `${prefix}${idx++}`;
    return r;
  }

  // 1. Brightness
  if (filterState.brightness !== 100) {
    const v = n(filterState.brightness / 100, 3);
    const r = nextResult("b");
    parts.push(
      `<feComponentTransfer in="${last}" result="${r}">` +
        `<feFuncR type="linear" slope="${v}" intercept="0"/>` +
        `<feFuncG type="linear" slope="${v}" intercept="0"/>` +
        `<feFuncB type="linear" slope="${v}" intercept="0"/>` +
        `</feComponentTransfer>`,
    );
    last = r;
  }

  // 2. Contrast
  if (filterState.contrast !== 100) {
    const slope = n(filterState.contrast / 100, 3);
    const intercept = n(0.5 - (0.5 * filterState.contrast) / 100, 3);
    const r = nextResult("c");
    parts.push(
      `<feComponentTransfer in="${last}" result="${r}">` +
        `<feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>` +
        `<feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>` +
        `<feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>` +
        `</feComponentTransfer>`,
    );
    last = r;
  }

  // 3. Saturate
  if (filterState.saturate !== 100) {
    const r = nextResult("s");
    parts.push(
      `<feColorMatrix type="saturate" values="${n(filterState.saturate / 100, 3)}" in="${last}" result="${r}"/>`,
    );
    last = r;
  }

  // 4. Hue-rotate
  if (filterState.hue !== 0) {
    const r = nextResult("h");
    parts.push(
      `<feColorMatrix type="hueRotate" values="${filterState.hue}" in="${last}" result="${r}"/>`,
    );
    last = r;
  }

  // 5. Grayscale
  if (filterState.grayscale > 0) {
    const g = 1 - filterState.grayscale / 100;
    const m = [
      0.2126 + 0.7874 * g,
      0.7152 - 0.7152 * g,
      0.0722 - 0.0722 * g,
      0,
      0,
      0.2126 - 0.2126 * g,
      0.7152 + 0.2848 * g,
      0.0722 - 0.0722 * g,
      0,
      0,
      0.2126 - 0.2126 * g,
      0.7152 - 0.7152 * g,
      0.0722 + 0.9278 * g,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]
      .map((v) => n(v, 3))
      .join(" ");
    const r = nextResult("gr");
    parts.push(
      `<feColorMatrix type="matrix" values="${m}" in="${last}" result="${r}"/>`,
    );
    last = r;
  }

  // 6. Sepia
  if (filterState.sepia > 0) {
    const s = 1 - filterState.sepia / 100;
    const m = [
      0.393 + 0.607 * s,
      0.769 - 0.769 * s,
      0.189 - 0.189 * s,
      0,
      0,
      0.349 - 0.349 * s,
      0.686 + 0.314 * s,
      0.168 - 0.168 * s,
      0,
      0,
      0.272 - 0.272 * s,
      0.534 - 0.534 * s,
      0.131 + 0.869 * s,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]
      .map((v) => n(v, 3))
      .join(" ");
    const r = nextResult("sp");
    parts.push(
      `<feColorMatrix type="matrix" values="${m}" in="${last}" result="${r}"/>`,
    );
    last = r;
  }

  // 7. Invert
  if (filterState.invert > 0) {
    const i = filterState.invert / 100;
    const r = nextResult("i");
    parts.push(
      `<feComponentTransfer in="${last}" result="${r}">` +
        `<feFuncR type="table" tableValues="${n(1 - i, 3)} ${n(i, 3)}"/>` +
        `<feFuncG type="table" tableValues="${n(1 - i, 3)} ${n(i, 3)}"/>` +
        `<feFuncB type="table" tableValues="${n(1 - i, 3)} ${n(i, 3)}"/>` +
        `</feComponentTransfer>`,
    );
    last = r;
  }

  // 8. Blur
  if (filterState.blur > 0) {
    const r = nextResult("bl");
    parts.push(
      `<feGaussianBlur stdDeviation="${filterState.blur}" in="${last}" result="${r}"/>`,
    );
    last = r;
  }

  const pad = filterState.blur > 0 ? Math.ceil(filterState.blur * 3) + 10 : 0;

  return `<filter id="cssFilter" x="-${pad}%" y="-${pad}%" width="${100 + pad * 2}%" height="${100 + pad * 2}%">${parts.join("")}</filter>`;
}

function hasNonBlurFilters() {
  return (
    filterState.enabled &&
    (filterState.brightness !== 100 ||
      filterState.contrast !== 100 ||
      filterState.saturate !== 100 ||
      filterState.hue !== 0 ||
      filterState.grayscale > 0 ||
      filterState.sepia > 0 ||
      filterState.invert > 0)
  );
}

// ------ DIMENSION EVENT LISTENERS ------
function initDimensionEvents() {
  // Aspect ratio buttons
  document.querySelectorAll(".aspect-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAspectRatio(btn.dataset.ratio);
    });
  });

  // Aspect ratio inputs
  const aspectW = document.getElementById("aspectW");
  const aspectH = document.getElementById("aspectH");

  if (aspectW && aspectH) {
    const applyAspectInputs = () => {
      const w = aspectW.value;
      const h = aspectH.value;

      if (w && h) {
        setCustomAspectRatio(w, h, true);
      } else if (!w && !h) {
        setAspectRatio("free");
      }
    };

    aspectW.addEventListener("blur", applyAspectInputs);
    aspectH.addEventListener("blur", applyAspectInputs);

    const handleAspectInputScrub = () => {
      if (window.__isNumberScrubbing) {
        applyAspectInputs();
      }
    };

    aspectW.addEventListener("input", handleAspectInputScrub);
    aspectH.addEventListener("input", handleAspectInputScrub);

    aspectW.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        aspectH.focus();
      }
      if (e.key === "Escape") aspectW.blur();
    });

    aspectH.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyAspectInputs();
        aspectH.blur();
      }
      if (e.key === "Escape") aspectH.blur();
    });

    aspectW.addEventListener("focus", () => aspectW.select());
    aspectH.addEventListener("focus", () => aspectH.select());
  }

  document
    .getElementById("aspectLockBtn")
    ?.addEventListener("click", toggleAspectLock);
  document
    .getElementById("sizeLinkBtn")
    ?.addEventListener("click", toggleAspectLock);

  document
    .getElementById("swapSizeBtn")
    ?.addEventListener("click", swapDimensions);

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const w = parseInt(btn.dataset.w);
      const h = parseInt(btn.dataset.h);
      setResolution(w, h);
    });
  });

  if (canvasWidth) {
    canvasWidth.addEventListener("blur", (e) => {
      handleWidthChange(e.target.value, true);
    });

    canvasWidth.addEventListener("input", (e) => {
      if (window.__isNumberScrubbing) {
        handleWidthChange(e.target.value, true);
      }
    });

    canvasWidth.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
        handleWidthChange(e.target.value, true);
      }
    });

    canvasHeight.addEventListener("blur", (e) => {
      handleHeightChange(e.target.value, true);
    });

    canvasHeight.addEventListener("input", (e) => {
      if (window.__isNumberScrubbing) {
        handleHeightChange(e.target.value, true);
      }
    });

    canvasHeight.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleHeightChange(e.target.value, true);
      }
    });
  }
}

// ========== COLOR PICKER ==========
const MAX_RECENT_COLORS = 16;
let recentColors = [];

try {
  recentColors = JSON.parse(localStorage.getItem("recentColors") || "[]");
} catch (e) {
  recentColors = [];
}

function addToRecentColors(hex, alpha) {
  const colorKey = `${hex}_${alpha}`;
  recentColors = recentColors.filter((c) => `${c.hex}_${c.alpha}` !== colorKey);
  recentColors.unshift({ hex, alpha });
  if (recentColors.length > MAX_RECENT_COLORS) {
    recentColors = recentColors.slice(0, MAX_RECENT_COLORS);
  }
  try {
    localStorage.setItem("recentColors", JSON.stringify(recentColors));
  } catch (e) {}
  renderRecentColors();
}

function renderRecentColors() {
  const container = document.getElementById("recentColorsList");
  if (!container) return;

  if (recentColors.length === 0) {
    container.innerHTML =
      '<span class="recent-colors-empty">No recent colors</span>';
    return;
  }

  container.innerHTML = recentColors
    .map(
      (c, i) => `
    <div class="recent-color-item" 
         onclick="selectRecentColor(${i})" 
         title="${c.hex} (${c.alpha}%)">
      <div class="recent-color-inner" style="background: ${rgba(
        c.hex,
        c.alpha / 100,
      )}"></div>
    </div>
  `,
    )
    .join("");
}

function selectRecentColor(index) {
  const color = recentColors[index];
  if (!color) return;

  const rgb = hexToRgb(color.hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  picker.h = hsv.h;
  picker.s = hsv.s;
  picker.v = hsv.v;
  picker.a = color.alpha;

  updatePicker();
}

function openPicker(hex, opacity, cb) {
  picker.cb = cb;
  const rgb = hexToRgb(hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  picker.h = hsv.h;
  picker.s = hsv.s;
  picker.v = hsv.v;
  picker.a = opacity;

  pickerDragging = false;

  updatePicker();
  renderRecentColors();

  const overlay = document.getElementById("pickerOverlay");
  if (overlay) overlay.classList.add("show");
}

function closePicker() {
  const rgb = hsvToRgb(picker.h, picker.s, picker.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  addToRecentColors(hex, Math.round(picker.a));

  const overlay = document.getElementById("pickerOverlay");
  if (overlay) overlay.classList.remove("show");
}

function updatePicker() {
  const { h, s, v, a, fmt } = picker;
  const rgb = hsvToRgb(h, s, v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const sbBox = document.getElementById("sbBox");
  const sbCursor = document.getElementById("sbCursor");
  const hueThumb = document.getElementById("hueThumb");
  const alphaThumb = document.getElementById("alphaThumb");
  const alphaTrack = document.getElementById("alphaTrack");

  if (sbBox) {
    sbBox.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`;
  }
  if (sbCursor) {
    sbCursor.style.cssText = `left: ${s}%; top: ${
      100 - v
    }%; background: ${hex}`;
  }
  if (hueThumb) {
    hueThumb.style.left = (h / 360) * 100 + "%";
  }
  if (alphaThumb) {
    alphaThumb.style.left = a + "%";
  }
  if (alphaTrack) {
    alphaTrack.style.setProperty("--ac", hex);
  }

  document.querySelectorAll(".format-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.f === fmt);
  });

  const f = document.getElementById("fields");
  if (f) {
    if (fmt === "hex") {
      const alphaHex = Math.round(picker.a / 100 * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(); // ✅ حروف بزرگ
      const fullHex = `${hex}${alphaHex}`.toUpperCase(); // ✅ حروف بزرگ
    f.innerHTML = `
        <div class="picker-field" style="flex:2">
          <label>HEX</label>
          <input id="fHex" value="${fullHex}">
        </div>
        <div class="picker-field">
          <label>A</label>
          <input type="number" id="fA" min="0" max="100" value="${Math.round(picker.a)}">
        </div>`;
    }else if (fmt === "rgb") {
      f.innerHTML = `
        <div class="picker-field"><label>R</label><input type="number" id="fR" min="0" max="255" value="${
          rgb.r
        }"></div>
        <div class="picker-field"><label>G</label><input type="number" id="fG" min="0" max="255" value="${
          rgb.g
        }"></div>
        <div class="picker-field"><label>B</label><input type="number" id="fB" min="0" max="255" value="${
          rgb.b
        }"></div>
        <div class="picker-field"><label>A</label><input type="number" id="fA" min="0" max="100" value="${Math.round(
          a,
        )}"></div>`;
    } else {
      f.innerHTML = `
        <div class="picker-field"><label>H</label><input type="number" id="fH" min="0" max="360" value="${
          hsl.h
        }"></div>
        <div class="picker-field"><label>S</label><input type="number" id="fS" min="0" max="100" value="${
          hsl.s
        }"></div>
        <div class="picker-field"><label>L</label><input type="number" id="fL" min="0" max="100" value="${
          hsl.l
        }"></div>
        <div class="picker-field"><label>A</label><input type="number" id="fA" min="0" max="100" value="${Math.round(
          a,
        )}"></div>`;
    }

    bindInputs();
  }

  if (picker.cb) picker.cb(hex, Math.round(a));
}

function bindInputs() {
  const fHex = document.getElementById("fHex");
  const fA = document.getElementById("fA");
  const fR = document.getElementById("fR");
  const fG = document.getElementById("fG");
  const fB = document.getElementById("fB");
  const fH = document.getElementById("fH");
  const fS = document.getElementById("fS");
  const fL = document.getElementById("fL");

  if (fHex) {
    fHex.onchange = () => {
      let v = fHex.value.trim().toUpperCase();

      if (!v.startsWith("#")) v = "#" + v;
  
      const hex6 = /^#[0-9A-F]{6}$/.test(v);
      const hex8 = /^#[0-9A-F]{8}$/.test(v);
  
      if (hex6 || hex8) {
        try {
          const r = parseInt(v.substr(1, 2), 16);
          const g = parseInt(v.substr(3, 2), 16);
          const b = parseInt(v.substr(5, 2), 16);
          const a = hex8 ? parseInt(v.substr(7, 2), 16) : 255;
  
          if ([r, g, b, a].some(isNaN)) {
            console.warn("Invalid value");
            return;
          }
  
          const rgb = { r, g, b };
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          picker.h = hsv.h;
          picker.s = hsv.s;
          picker.v = hsv.v;
          picker.a = Math.round((a / 255) * 100);
          updatePicker();
        } catch (e) {
          console.error("error Hex:", e);
        }
      } else {
        console.warn("Invalid hex format. Expected #RRGGBBAA");
      }
    };
  
    fHex.onfocus = () => fHex.select();
  }
  

  
  if (fA) {
    fA.oninput = () => {
      picker.a = clamp(+fA.value, 0, 100);
      updatePicker();
    };
  }

  if (fR && fG && fB) {
    [fR, fG, fB].forEach((el) => {
      el.oninput = () => {
        const hsv = rgbToHsv(
          clamp(+fR.value, 0, 255),
          clamp(+fG.value, 0, 255),
          clamp(+fB.value, 0, 255),
        );
        picker.h = hsv.h;
        picker.s = hsv.s;
        picker.v = hsv.v;
        updatePicker();
      };
    });
  }

  if (fH && fS && fL) {
    [fH, fS, fL].forEach((el) => {
      el.oninput = () => {
        const rgb = hslToRgb(
          clamp(+fH.value, 0, 360),
          clamp(+fS.value, 0, 100),
          clamp(+fL.value, 0, 100),
        );
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        picker.h = hsv.h;
        picker.s = hsv.s;
        picker.v = hsv.v;
        updatePicker();
      };
    });
  }
}

function getPickerPos(e, element) {
  if (!element) return { x: 0, y: 0, width: 1, height: 1 };

  const r = element.getBoundingClientRect();
  let clientX, clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: clientX - r.left,
    y: clientY - r.top,
    width: r.width,
    height: r.height,
  };
}

function updSB(e) {
  const sbBox = document.getElementById("sbBox");
  if (!sbBox) return;

  const pos = getPickerPos(e, sbBox);
  picker.s = clamp((pos.x / pos.width) * 100, 0, 100);
  picker.v = clamp(100 - (pos.y / pos.height) * 100, 0, 100);
  updatePicker();
}

function updHue(e) {
  const hueTrack = document.getElementById("hueTrack");
  if (!hueTrack) return;

  const pos = getPickerPos(e, hueTrack);
  picker.h = clamp((pos.x / pos.width) * 360, 0, 360);
  updatePicker();
}

function updAlpha(e) {
  const alphaTrack = document.getElementById("alphaTrack");
  if (!alphaTrack) return;

  const pos = getPickerPos(e, alphaTrack);
  picker.a = clamp((pos.x / pos.width) * 100, 0, 100);
  updatePicker();
}

function initPickerEvents() {
  const sbBox = document.getElementById("sbBox");
  const hueTrack = document.getElementById("hueTrack");
  const alphaTrack = document.getElementById("alphaTrack");
  const pickerClose = document.getElementById("pickerClose");
  const pickerOverlay = document.getElementById("pickerOverlay");
  const pickerModal = document.querySelector(".picker-modal");

  if (sbBox) {
    sbBox.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      sbDrag = true;
      pickerDragging = true;
      updSB(e);
    });
    sbBox.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        sbDrag = true;
        pickerDragging = true;
        updSB(e);
      },
      { passive: false },
    );
  }

  if (hueTrack) {
    hueTrack.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      hueDrag = true;
      pickerDragging = true;
      updHue(e);
    });
    hueTrack.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        hueDrag = true;
        pickerDragging = true;
        updHue(e);
      },
      { passive: false },
    );
  }

  if (alphaTrack) {
    alphaTrack.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      alphaDrag = true;
      pickerDragging = true;
      updAlpha(e);
    });
    alphaTrack.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        alphaDrag = true;
        pickerDragging = true;
        updAlpha(e);
      },
      { passive: false },
    );
  }

  document.addEventListener("mousemove", (e) => {
    if (sbDrag) updSB(e);
    if (hueDrag) updHue(e);
    if (alphaDrag) updAlpha(e);
  });

  document.addEventListener(
    "touchmove",
    (e) => {
      if (sbDrag) {
        e.preventDefault();
        updSB(e);
      }
      if (hueDrag) {
        e.preventDefault();
        updHue(e);
      }
      if (alphaDrag) {
        e.preventDefault();
        updAlpha(e);
      }
    },
    { passive: false },
  );

  document.addEventListener("mouseup", () => {
    sbDrag = hueDrag = alphaDrag = false;
    setTimeout(() => {
      pickerDragging = false;
    }, 50);
  });

  document.addEventListener("touchend", () => {
    sbDrag = hueDrag = alphaDrag = false;
    setTimeout(() => {
      pickerDragging = false;
    }, 50);
  });

  document.querySelectorAll(".format-btn").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      picker.fmt = b.dataset.f;
      updatePicker();
    };
  });

  if (pickerClose) {
    pickerClose.onclick = (e) => {
      e.stopPropagation();
      closePicker();
    };
  }

  if (pickerOverlay) {
    pickerOverlay.addEventListener("click", (e) => {
      if (e.target === pickerOverlay && !pickerDragging) {
        closePicker();
      }
    });
  }

  if (pickerModal) {
    pickerModal.addEventListener("mousedown", (e) => e.stopPropagation());
    pickerModal.addEventListener("touchstart", (e) => e.stopPropagation(), {
      passive: true,
    });
  }
}

// ========== GLOBALS ==========
window.setNoiseOpacity = setNoiseOpacity;
window.setNoiseFrequency = setNoiseFrequency;
window.setNoiseBlend = setNoiseBlend;
window.toggleNoise = toggleNoise;
window.copyCSS = copyCSS;
window.copyGradientCSS = copyGradientCSS;
window.copyNoiseCSS = copyNoiseCSS;
window.copySVGFilter = copySVGFilter;
window.getStop = getStop;
window.delStop = delStop;
window.dupStop = dupStop;
window.toggleVis = toggleVis;
window.addColorStop = addColorStop;
window.delColorStop = delColorStop;
window.openPicker = openPicker;
window.closePicker = closePicker;
window.selectRecentColor = selectRecentColor;
window.refresh = refresh;
window.updateCSS = updateCSS;
window.setCanvasSize = setCanvasSize;
window.startAngleDrag = startAngleDrag;
window.updateAngleFromInput = updateAngleFromInput;
window.startConicAngleDrag = startConicAngleDrag;
window.updateConicAngleFromInput = updateConicAngleFromInput;
window.copyCSS = copyCSS;
window.exportAsImage = exportAsImage;
window.exportAsSVG = exportAsSVG;
window.setAspectRatio = setAspectRatio;
window.setCustomAspectRatio = setCustomAspectRatio;
window.toggleAspectLock = toggleAspectLock;
window.swapDimensions = swapDimensions;
window.setResolution = setResolution;

// ========== EVENT BINDINGS ==========
document.getElementById("bgBtn")?.addEventListener("click", () => {
  openPicker(state.bgColor, state.bgAlpha, (c, a) => {
    state.bgColor = c;
    state.bgAlpha = a;
    refresh();
  });
});

document.getElementById("cssFormat")?.addEventListener("change", (e) => {
  History.saveState();
  state.cssFormat = e.target.value;
  updateCSS();
});

function syncCSSFormat() {
  const select = document.getElementById("cssFormat");
  if (!select) return;

  select.value = state.cssFormat;
}

document
  .getElementById("btnRadial")
  ?.addEventListener("click", () => addStop("radial"));
document
  .getElementById("btnLinear")
  ?.addEventListener("click", () => addStop("linear"));
document
  .getElementById("btnConic")
  ?.addEventListener("click", () => addStop("conic"));
document.getElementById("btnReset")?.addEventListener("click", () => {
  if (!state.stops.length || confirm("Clear all layers?")) {
    state.stops = [];
    state.selected = null;
    counter = 0;
    refresh();
  }
});

window.addEventListener("resize", () => draw());

// ========== MOBILE OPTIMIZATIONS ==========
function initMobile() {
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        if (e.target.closest("#canvas, .panel, .picker-modal")) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false },
  );

  // ========== pinch zoom ==========
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) {
        if (!e.target.closest(".canvas-wrap")) {
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );

  // ========== gesture ==========
  document.addEventListener(
    "gesturestart",
    (e) => {
      e.preventDefault();
    },
    { passive: false },
  );
}


// ========== RANDOM GRADIENT GENERATOR ==========
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max));
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePalette(baseCount = 3) {
  const base = randFrom(CONFIG.colors.palette);
  const colors = [base];
  while (colors.length < baseCount) {
    const c = randFrom(CONFIG.colors.palette);
    if (!colors.includes(c)) colors.push(c);
  }
  return colors;
}

function createGradientStops(
  palette,
  countRange = [2, 5],
  opacityRange = [40, 90],
) {
  const count = randInt(countRange[0], countRange[1] + 1);
  const stops = [];
  for (let i = 0; i < count; i++) {
    const pos =
      i === count - 1 ? 100 : Math.round((100 / (count - 1 || 1)) * i);
    stops.push({
      pos,
      color: randFrom(palette),
      opacity: randInt(opacityRange[0], opacityRange[1]),
    });
  }
  return stops;
}

function generateRandomGradient() {
  // پاک کردن تمام استاپ‌ها
  state.stops = [];
  counter = 1;

  const palette = generatePalette(randInt(3, 5));

  // تعداد لایه‌ها بین 2 تا 5
  const layerCount = randInt(2, 5);

  // انواع لایه‌ها
  const LAYER_TYPES = ["radial", "conic", "linear"];
  const usedTypes = [];

  for (let i = 0; i < layerCount; i++) {
    const type = randFrom(LAYER_TYPES);

    addStop(type);
    const stop = state.stops[i];

    // نام‌گذاری خلاقانه‌تر
    const namePrefix = {
      radial: ["Radial Glow", "Soft Aura", "Halo", "Pulse"],
      conic: ["Conic Flow", "Spectrum Arc", "Spiral", "Vortex"],
      linear: ["Linear Blend", "Stream", "Beam", "Gradient Ray"],
    };
    stop.name = randFrom(namePrefix[type]);

    // موقعیت
    stop.x = rand(0.15, 0.85);
    stop.y = rand(0.15, 0.85);

    // بر اساس نوع لایه
    if (type === "radial") {
      stop.color = randFrom(palette);
      stop.feather = randInt(30, 90);
      stop.opacity = randInt(50, 90);
    }

    if (type === "conic") {
      stop.startAngle = randInt(0, 360);

      const conicCount = randInt(3, 6);
      const conicStops = [];
      for (let j = 0; j < conicCount; j++) {
        conicStops.push({
          pos: randInt(0, 100),
          color: randFrom(palette),
          opacity: randInt(30, 80),
        });
      }
      conicStops.sort((a, b) => a.pos - b.pos);
      stop.stops = conicStops;
    }

    if (type === "linear") {
      const favAngles = [0, 45, 60, 90, 120, 135, 180, 225, 270, 315];
      stop.angle = Math.random() < 0.6 ? randFrom(favAngles) : randInt(0, 360);

      const isPrimaryLinear = !usedTypes.includes("linear");
      const opacityRange = isPrimaryLinear ? [40, 80] : [20, 70];
      stop.stops = createGradientStops(palette, [3, 6], opacityRange);
    }

    usedTypes.push(type);
  }

  // لایه subtle اضافی
  if (layerCount < 5 && Math.random() < 0.4) {
    addStop("radial");
    const s = state.stops[state.stops.length - 1];
    s.name = "Subtle Glow";
    s.color = randFrom(palette);
    s.x = rand(0.2, 0.8);
    s.y = rand(0.2, 0.8);
    s.feather = randInt(60, 95);
    s.opacity = randInt(10, 35);
  }

  state.selected = null;

  // ذخیره در history
  if (typeof History !== "undefined" && History.saveState) {
    History.saveState();
  }

  refresh();
}

function addGenerateButton() {
  // پیدا کردن container (کنار undo/redo)
  const undoBtn = document.getElementById("undoBtn");
  if (!undoBtn) return;

  const container = undoBtn.parentElement;

  // چک کنیم دکمه از قبل وجود نداشته باشه
  document.getElementById("generateBtn");
}

document.addEventListener("keydown", (e) => {
  // Ctrl+G یا Cmd+G برای Generate
  if ((e.ctrlKey || e.metaKey) && e.key === "g") {
    e.preventDefault();
    generateRandomGradient();
  }
});

// ========== init ==========
async function init() {
  initMobile();
  initPickerEvents();
  initDimensionEvents();
  initNoiseEvents();
  initFilterEvents();
  initBackgroundEvents();
  initZoom();
  initPan();

  resize();
  updateZoomUI();
  updateAllDimensionUI();
  updateNoiseUI();
  updateFilterUI();
  updateBgUI();
  initLayerDragDrop();
  syncCSSFormat();

  if (typeof History !== "undefined" && History.init) {
    History.init();
  }

  const hasAutoSave = localStorage.getItem(
    History?.autoSaveKey || "gradientEditor_autoSave",
  );

  if (!hasAutoSave) {
    generateRandomGradient();
  } else {
    refresh();
  }

  addGenerateButton();
}

function refresh() {
  resize();
  draw();
  renderList();
  renderInspector();
  updateCSS();
  updateBgPreview();
}
// ========== FALLBACK HTML ==========

document.addEventListener("DOMContentLoaded", () => {
  const existingBtn = document.getElementById("generateBtn");
  if (existingBtn) {
    existingBtn.onclick = generateRandomGradient;
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// ========== SCRUBBING ==========
(() => {
  let activeInput = null;
  let isTouchScrub = false;
  let lastMoveTime = 0;
  let lastMoveX = 0;
  let accumulatedValue = 0; // ✅ مقدار تجمیعی

  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = 300;

  const getStep = (input) => {
    const s = parseFloat(input.step);
    return isNaN(s) || s <= 0 ? 1 : s;
  };

  const clampValue = (v, min, max) => Math.min(max, Math.max(min, v));

  window.__isNumberScrubbing = false;

  const style = document.createElement("style");
  style.textContent = `input[type="number"] { touch-action: none; }`;
  document.head.appendChild(style);

  document.addEventListener(
    "touchmove",
    (e) => {
      if (activeInput) e.preventDefault();
    },
    { passive: false },
  );

  // ========== BACK BUTTON / ESCAPE = BLUR ==========
  let _inputHistoryPushed = false;

  document.addEventListener("focusin", (e) => {
    const input = e.target.closest('input[type="number"]');
    if (!input) return;
    if (!_inputHistoryPushed) {
      _inputHistoryPushed = true;
      history.pushState({ inputFocused: true }, "");
    }
  });

  document.addEventListener("focusout", (e) => {
    const input = e.target.closest('input[type="number"]');
    if (!input) return;
    input.style.cursor = "ew-resize";
    if (_inputHistoryPushed) {
      _inputHistoryPushed = false;
      if (history.state && history.state.inputFocused) {
        history.back();
      }
    }
  });

  window.addEventListener("popstate", () => {
    if (_inputHistoryPushed) {
      _inputHistoryPushed = false;
      const focused = document.activeElement;
      if (focused && focused.matches('input[type="number"]')) {
        focused.blur();
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const focused = document.activeElement;
      if (focused && focused.matches('input[type="number"]')) {
        e.preventDefault();
        focused.blur();
      }
    }
  });
  // =================================================

  document.addEventListener("pointerdown", (e) => {
    const input = e.target.closest('input[type="number"]');
    if (!input) return;

    const now = Date.now();

    // Double-tap to focus
    if (e.pointerType === "touch" && now - lastTapTime < DOUBLE_TAP_DELAY) {
      input.focus();
      input.style.cursor = "text";
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    if (input === document.activeElement) return;

    e.preventDefault();

    try {
      input.setPointerCapture(e.pointerId);
    } catch {}

    activeInput = input;
    lastMoveX = e.clientX;
    lastMoveTime = performance.now();
    accumulatedValue = parseFloat(input.value) || 0; // ✅ شروع از مقدار فعلی
    isTouchScrub = e.pointerType === "touch";

    window.__isNumberScrubbing = true;
    document.body.style.cursor = "ew-resize";

    if (typeof History !== "undefined" && History.onDragStart) {
      History.onDragStart();
    }
  });

  document.addEventListener("pointermove", (e) => {
    if (!activeInput) return;
    if (activeInput === document.activeElement) return;

    e.preventDefault();

    const now = performance.now();
    const dt = now - lastMoveTime;
    const dx = e.clientX - lastMoveX; // ✅ فقط تغییر از فریم قبل

    if (dt <= 0 || dx === 0) {
      lastMoveX = e.clientX;
      lastMoveTime = now;
      return;
    }

    // ✅ سرعت لحظه‌ای (pixels per second)
    const speed = Math.abs(dx / dt) * 1000;

    // ✅ ضریب سرعت
    // آهسته (< 100 px/s) = 1x
    // متوسط (100-500) = 1-3x
    // سریع (> 500) = 3-8x
    const speedMultiplier = 1 + Math.pow(speed / 150, 1.2);
    const clampedMultiplier = Math.min(8, speedMultiplier);

    const step = getStep(activeInput);
    const baseSensitivity = isTouchScrub ? 2 : 5;

    // ✅ تغییر لحظه‌ای
    let delta = (dx / baseSensitivity) * step * clampedMultiplier;

    if (e.shiftKey) delta *= 5;
    if (e.altKey) delta *= 0.2;

    // ✅ اضافه کردن به مقدار تجمیعی
    accumulatedValue += delta;

    const min = activeInput.min === "" ? -Infinity : +activeInput.min;
    const max = activeInput.max === "" ? Infinity : +activeInput.max;

    let value = clampValue(accumulatedValue, min, max);
    value = Math.round(value / step) * step;

    activeInput.value = value;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));

    lastMoveX = e.clientX;
    lastMoveTime = now;
  });

  const end = (e) => {
    if (!activeInput) return;

    if (typeof History !== "undefined" && History.onDragEnd) {
      History.onDragEnd();
    }

    try {
      activeInput.releasePointerCapture(e.pointerId);
    } catch {}

    activeInput = null;
    isTouchScrub = false;
    accumulatedValue = 0;
    document.body.style.cursor = "";
    window.__isNumberScrubbing = false;
  };

  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);

  document.addEventListener("dblclick", (e) => {
    const input = e.target.closest('input[type="number"]');
    if (!input) return;
    input.focus();
    input.style.cursor = "text";
  });
})();


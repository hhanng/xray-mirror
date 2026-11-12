const CAL_KEY = "xray-mirror:calibration";

const DEFAULT_CAL = { scale: 1, x: 0, y: 0, z: 0, pitch: 0 };

export function loadCalibration() {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return { ...DEFAULT_CAL };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CAL, ...parsed };
  } catch (e) {
    return { ...DEFAULT_CAL };
  }
}

export function saveCalibration(cal) {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify(cal));
  } catch (e) {
    /* ignore */
  }
}

export class UI {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.calibration = loadCalibration();
    this._bindLayers();
    this._bindLook();
    this._bindBlend();
    this._bindLens();
    this._bindCutaway();
    this._bindCalibration();
    this._bindPanel();
    this._bindKeyboard();
  }

  _bindLayers() {
    document.querySelectorAll('[data-layer]').forEach((el) => {
      el.addEventListener("change", () => {
        this.callbacks.onLayerToggle(el.dataset.layer, el.checked);
      });
    });
  }

  toggleLayer(name) {
    const el = document.querySelector(`[data-layer="${name}"]`);
    if (!el) return;
    el.checked = !el.checked;
    this.callbacks.onLayerToggle(name, el.checked);
  }

  _bindLook() {
    const buttons = document.querySelectorAll(".look-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.callbacks.onLookChange(btn.dataset.look);
      });
    });
  }

  setLook(look) {
    document.querySelectorAll(".look-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.look === look);
    });
    this.callbacks.onLookChange(look);
  }

  getLook() {
    return document.querySelector(".look-btn.active")?.dataset.look || "xray";
  }

  _bindBlend() {
    const slider = document.getElementById("blend-slider");
    slider.addEventListener("input", () => {
      this.callbacks.onBlendChange(Number(slider.value) / 100);
    });
    this.callbacks.onBlendChange(Number(slider.value) / 100);
  }

  _bindLens() {
    const toggle = document.getElementById("lens-toggle");
    const radius = document.getElementById("lens-radius");
    toggle.addEventListener("change", () => {
      this.callbacks.onLensChange(toggle.checked, Number(radius.value));
    });
    radius.addEventListener("input", () => {
      this.callbacks.onLensChange(toggle.checked, Number(radius.value));
    });
  }

  toggleLens() {
    const toggle = document.getElementById("lens-toggle");
    toggle.checked = !toggle.checked;
    const radius = document.getElementById("lens-radius");
    this.callbacks.onLensChange(toggle.checked, Number(radius.value));
  }

  _bindCutaway() {
    const select = document.getElementById("cutaway-select");
    select.addEventListener("change", () => {
      this.callbacks.onCutawayChange(select.value);
    });
  }

  _bindCalibration() {
    const ids = {
      scale: "cal-scale",
      x: "cal-x",
      y: "cal-y",
      z: "cal-z",
      pitch: "cal-pitch",
    };
    const els = {};
    for (const [key, id] of Object.entries(ids)) {
      els[key] = document.getElementById(id);
    }
    els.scale.value = this.calibration.scale * 100;
    els.x.value = this.calibration.x;
    els.y.value = this.calibration.y;
    els.z.value = this.calibration.z;
    els.pitch.value = this.calibration.pitch;

    const update = () => {
      this.calibration = {
        scale: Number(els.scale.value) / 100,
        x: Number(els.x.value),
        y: Number(els.y.value),
        z: Number(els.z.value),
        pitch: Number(els.pitch.value),
      };
      saveCalibration(this.calibration);
      this.callbacks.onCalibrationChange(this.calibration);
    };

    Object.values(els).forEach((el) => el.addEventListener("input", update));
    this.callbacks.onCalibrationChange(this.calibration);

    document.getElementById("cal-reset").addEventListener("click", () => {
      els.scale.value = 100;
      els.x.value = 0;
      els.y.value = 0;
      els.z.value = 0;
      els.pitch.value = 0;
      update();
    });
  }

  toggleCalibrationPanel() {
    const panel = document.getElementById("calibration-panel");
    panel.hidden = !panel.hidden;
  }

  _bindPanel() {
    document.getElementById("panel-collapse").addEventListener("click", () => {
      document.getElementById("panel").classList.toggle("collapsed");
    });
    document.getElementById("toggle-ui").addEventListener("click", () => this.toggleUi());
  }

  toggleUi() {
    document.getElementById("panel").classList.toggle("hidden");
  }

  _bindKeyboard() {
    const layerKeys = { 1: "skull", 2: "brain", 3: "muscles", 4: "eyes", 5: "outline", 6: "hands" };
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      const key = e.key.toLowerCase();
      if (layerKeys[key]) {
        this.toggleLayer(layerKeys[key]);
      } else if (key === "x") {
        this.setLook(this.getLook() === "xray" ? "solid" : "xray");
      } else if (key === "l") {
        this.toggleLens();
      } else if (key === "c") {
        this.toggleCalibrationPanel();
      } else if (key === "h") {
        this.toggleUi();
      }
    });
  }
}

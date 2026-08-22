(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const AREAS = [
    ["undereye", "Ojeras"],
    ["midface", "Soporte tercio medio"],
    ["cheeks", "Pómulos"],
    ["lips", "Labios"],
    ["chin", "Mentón"],
    ["jawline", "Mandíbula"],
    ["wrinkles", "Arrugas"]
  ];

  const DEFAULT_FULL_FACE = new Set(["undereye", "midface", "cheeks", "chin", "wrinkles"]);

  const state = {
    img: null,
    fullFace: true,
    areas: new Set(DEFAULT_FULL_FACE),
    intensity: 35,
    raf: 0,
    sourceCanvas: document.createElement("canvas"),
    blurCanvas: document.createElement("canvas"),
    sourceData: null,
    blurData: null,
    workingData: null
  };

  init();

  function init() {
    injectStyles();
    rebuildControls();
    setupStrength();
    setupCompare();
    bindUploads();
    hidePaidGenerationUI();
    updateStatus("Subí una selfie para comenzar.");
  }

  function injectStyles() {
    if (document.getElementById("prp-v7-style")) return;
    const style = document.createElement("style");
    style.id = "prp-v7-style";
    style.textContent = `
      #generateBtn { display: none !important; }
      .prp-v7-note {
        margin: 12px 0 4px;
        color: #6f685f;
        font-size: 14px;
        line-height: 1.45;
      }
      .prp-v7-live {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin: 8px 0 4px;
        padding: 7px 11px;
        border-radius: 999px;
        background: #edf4ef;
        color: #294b3d;
        font-size: 13px;
        font-weight: 650;
      }
      .prp-v7-live::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4c8a6b;
      }
      #zoneList button.active {
        position: relative;
      }
      #zoneList button.active::after {
        content: "✓";
        margin-left: 6px;
      }
      .prp-v7-intensity-value {
        font-variant-numeric: tabular-nums;
        min-width: 54px;
        display: inline-block;
      }
    `;
    document.head.appendChild(style);
  }

  function hidePaidGenerationUI() {
    const generate = $("#generateBtn");
    if (generate) {
      generate.hidden = true;
      generate.setAttribute("aria-hidden", "true");
    }
  }

  function bindUploads() {
    [$("#fileInput"), $("#fileInput2")].filter(Boolean).forEach((input) => {
      input.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          alert("Elegí una foto válida.");
          return;
        }

        const image = new Image();
        image.onload = () => {
          startImage(image);
          URL.revokeObjectURL(image.src);
        };
        image.onerror = () => alert("No pudimos abrir esa foto.");
        image.src = URL.createObjectURL(file);
      });
    });
  }

  function rebuildControls() {
    const list = $("#zoneList");
    if (!list) return;

    list.innerHTML = "";

    const full = document.createElement("button");
    full.type = "button";
    full.id = "fullFaceBtn";
    full.className = "active";
    full.textContent = "Full Face Armónico";
    full.addEventListener("click", () => {
      state.fullFace = !state.fullFace;
      full.classList.toggle("active", state.fullFace);

      if (state.fullFace) {
        state.areas = new Set(DEFAULT_FULL_FACE);
        syncAreaButtons();
      }
      scheduleRender();
    });
    list.appendChild(full);

    for (const [id, label] of AREAS) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.zone = id;
      button.textContent = label;
      button.classList.toggle("active", state.areas.has(id));

      button.addEventListener("click", () => {
        if (state.areas.has(id)) state.areas.delete(id);
        else state.areas.add(id);

        state.fullFace = false;
        full.classList.remove("active");
        button.classList.toggle("active", state.areas.has(id));
        scheduleRender();
      });

      list.appendChild(button);
    }

    let live = document.getElementById("prpV7Live");
    if (!live) {
      live = document.createElement("div");
      live.id = "prpV7Live";
      live.className = "prp-v7-live";
      live.textContent = "Vista en vivo · sin costo por generación";
      list.insertAdjacentElement("afterend", live);
    }

    let note = document.getElementById("prpV7Note");
    if (!note) {
      note = document.createElement("div");
      note.id = "prpV7Note";
      note.className = "prp-v7-note";
      note.textContent =
        "Mové la intensidad y el lado “Después” cambia instantáneamente en tu dispositivo. No usa Workers AI ni consume neurons.";
      live.insertAdjacentElement("afterend", note);
    }
  }

  function syncAreaButtons() {
    for (const [id] of AREAS) {
      const button = document.querySelector(`#zoneList button[data-zone="${id}"]`);
      if (button) button.classList.toggle("active", state.areas.has(id));
    }
  }

  function setupStrength() {
    const slider = $("#strength");
    const label = $("#strengthText");
    if (!slider) return;

    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(state.intensity);

    const writeLabel = () => {
      if (!label) return;
      const n = state.intensity;
      const word = n <= 25 ? "Sutil" : n <= 60 ? "Balanceado" : "Definido";
      label.innerHTML = `<span class="prp-v7-intensity-value">${n}%</span> ${word}`;
    };

    writeLabel();

    slider.addEventListener("input", () => {
      state.intensity = clamp(Number(slider.value), 0, 100);
      writeLabel();
      scheduleRender();
    });
  }

  function setupCompare() {
    const compareSlider = $("#compareSlider");
    if (!compareSlider) return;

    compareSlider.addEventListener("input", () => {
      const value = clamp(Number(compareSlider.value), 0, 100);
      const after = $("#afterCanvas");
      const divider = $("#divider");
      if (after) after.style.clipPath = `inset(0 0 0 ${value}%)`;
      if (divider) divider.style.left = `${value}%`;
    });
  }

  function startImage(img) {
    state.img = img;
    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");

    const before = $("#beforeCanvas");
    const after = $("#afterCanvas");
    if (!before || !after) {
      alert("No encontramos el visor de Antes/Después.");
      return;
    }

    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    [before, after, state.sourceCanvas, state.blurCanvas].forEach((canvas) => {
      canvas.width = w;
      canvas.height = h;
    });

    if ($("#compare")) $("#compare").style.aspectRatio = `${w}/${h}`;

    const bctx = before.getContext("2d", { willReadFrequently: true });
    const actx = after.getContext("2d", { willReadFrequently: true });
    const sctx = state.sourceCanvas.getContext("2d", { willReadFrequently: true });
    const blurCtx = state.blurCanvas.getContext("2d", { willReadFrequently: true });

    bctx.clearRect(0, 0, w, h);
    bctx.drawImage(img, 0, 0, w, h);

    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);
    state.sourceData = sctx.getImageData(0, 0, w, h);

    blurCtx.clearRect(0, 0, w, h);
    blurCtx.save();
    blurCtx.filter = "blur(1.15px)";
    blurCtx.drawImage(img, 0, 0, w, h);
    blurCtx.restore();
    state.blurData = blurCtx.getImageData(0, 0, w, h);

    actx.clearRect(0, 0, w, h);
    actx.drawImage(img, 0, 0, w, h);

    updateStatus("Vista en vivo lista.");
    scheduleRender();
  }

  function scheduleRender() {
    if (!state.img || !state.sourceData) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(renderPreview);
  }

  function renderPreview() {
    state.raf = 0;

    const after = $("#afterCanvas");
    if (!after || !state.sourceData || !state.blurData) return;

    const w = after.width;
    const h = after.height;
    const src = state.sourceData.data;
    const blurred = state.blurData.data;

    const output = new Uint8ClampedArray(src);
    const amount = state.intensity / 100;

    if (amount > 0.001 && state.areas.size) {
      applyGeometricWarp(src, output, w, h, amount);
      applyTextureSoftening(output, blurred, w, h, amount);
    }

    const ctx = after.getContext("2d", { willReadFrequently: true });
    const imageData = new ImageData(output, w, h);
    ctx.putImageData(imageData, 0, 0);

    updateStatus(`Vista en vivo · ${state.intensity}%`);
  }

  function applyGeometricWarp(src, out, w, h, amount) {
    // All deformations are deliberately small. They are visual preview controls,
    // not a clinical prediction.
    const zones = [];

    if (state.areas.has("lips")) {
      zones.push({ cx: 0.50, cy: 0.705, rx: 0.165, ry: 0.070, bulgeX: 0.024, bulgeY: 0.055, moveY: 0 });
    }

    if (state.areas.has("cheeks")) {
      zones.push({ cx: 0.35, cy: 0.515, rx: 0.155, ry: 0.115, bulgeX: 0.020, bulgeY: 0.018, moveY: 0.008 });
      zones.push({ cx: 0.65, cy: 0.515, rx: 0.155, ry: 0.115, bulgeX: 0.020, bulgeY: 0.018, moveY: 0.008 });
    }

    if (state.areas.has("midface")) {
      zones.push({ cx: 0.39, cy: 0.515, rx: 0.145, ry: 0.125, bulgeX: 0.010, bulgeY: 0.014, moveY: 0.006 });
      zones.push({ cx: 0.61, cy: 0.515, rx: 0.145, ry: 0.125, bulgeX: 0.010, bulgeY: 0.014, moveY: 0.006 });
    }

    if (state.areas.has("chin")) {
      zones.push({ cx: 0.50, cy: 0.805, rx: 0.155, ry: 0.105, bulgeX: 0.010, bulgeY: 0.020, moveY: -0.005 });
    }

    for (const zone of zones) {
      warpEllipse(src, out, w, h, zone, amount);
    }

    if (state.areas.has("jawline")) {
      warpJaw(src, out, w, h, amount);
    }
  }

  function warpEllipse(src, out, w, h, z, amount) {
    const cx = z.cx * w;
    const cy = z.cy * h;
    const rx = z.rx * w;
    const ry = z.ry * h;

    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(w - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(h - 1, Math.ceil(cy + ry));

    for (let y = minY; y <= maxY; y++) {
      const ny = (y - cy) / ry;
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - cx) / rx;
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;

        const feather = (1 - r2) * (1 - r2);
        const bx = 1 + z.bulgeX * amount * feather;
        const by = 1 + z.bulgeY * amount * feather;

        let sx = cx + (x - cx) / bx;
        let sy = cy + (y - cy) / by + z.moveY * h * amount * feather;

        copyBilinear(src, out, w, h, sx, sy, x, y);
      }
    }
  }

  function warpJaw(src, out, w, h, amount) {
    const cy = 0.735 * h;
    const ry = 0.16 * h;
    const center = 0.5 * w;

    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(h, Math.ceil(cy + ry)); y++) {
      const vy = (y - cy) / ry;
      const vertical = Math.max(0, 1 - vy * vy);
      for (let x = 0; x < w; x++) {
        const dx = (x - center) / w;
        if (Math.abs(dx) < 0.16 || Math.abs(dx) > 0.34) continue;

        const sideWeight = smoothstep(0.16, 0.25, Math.abs(dx)) * (1 - smoothstep(0.29, 0.35, Math.abs(dx)));
        const weight = vertical * sideWeight;
        if (weight <= 0) continue;

        // Slight narrowing/definition only.
        const sx = center + (x - center) * (1 + 0.018 * amount * weight);
        copyBilinear(src, out, w, h, sx, y, x, y);
      }
    }
  }

  function applyTextureSoftening(out, blurred, w, h, amount) {
    if (state.areas.has("undereye")) {
      blendEllipse(out, blurred, w, h, 0.39, 0.415, 0.125, 0.055, 0.28 * amount);
      blendEllipse(out, blurred, w, h, 0.61, 0.415, 0.125, 0.055, 0.28 * amount);
    }

    if (state.areas.has("wrinkles")) {
      // Forehead, glabella, crow's-feet. Low alpha preserves real texture.
      blendEllipse(out, blurred, w, h, 0.50, 0.285, 0.235, 0.115, 0.22 * amount);
      blendEllipse(out, blurred, w, h, 0.50, 0.355, 0.060, 0.075, 0.22 * amount);
      blendEllipse(out, blurred, w, h, 0.25, 0.405, 0.060, 0.055, 0.20 * amount);
      blendEllipse(out, blurred, w, h, 0.75, 0.405, 0.060, 0.055, 0.20 * amount);
    }
  }

  function blendEllipse(out, blur, w, h, cxN, cyN, rxN, ryN, alphaMax) {
    const cx = cxN * w, cy = cyN * h, rx = rxN * w, ry = ryN * h;
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(w - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(h - 1, Math.ceil(cy + ry));

    for (let y = minY; y <= maxY; y++) {
      const ny = (y - cy) / ry;
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - cx) / rx;
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;

        const feather = (1 - r2) * (1 - r2);
        const a = alphaMax * feather;
        const i = (y * w + x) * 4;

        out[i] = out[i] * (1 - a) + blur[i] * a;
        out[i + 1] = out[i + 1] * (1 - a) + blur[i + 1] * a;
        out[i + 2] = out[i + 2] * (1 - a) + blur[i + 2] * a;
      }
    }
  }

  function copyBilinear(src, out, w, h, sx, sy, dx, dy) {
    sx = clamp(sx, 0, w - 1.001);
    sy = clamp(sy, 0, h - 1.001);

    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const fx = sx - x0, fy = sy - y0;

    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;
    const di = (dy * w + dx) * 4;

    for (let c = 0; c < 3; c++) {
      const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
      const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
      out[di + c] = top * (1 - fy) + bottom * fy;
    }
    out[di + 3] = 255;
  }

  function updateStatus(text) {
    const node = $("#simStatus");
    if (node) node.textContent = text;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }
})();
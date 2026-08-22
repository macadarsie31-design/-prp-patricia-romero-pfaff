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

  const DEFAULT_FULL_FACE = new Set([
    "undereye", "midface", "cheeks", "lips", "chin", "jawline", "wrinkles"
  ]);

  const state = {
    img: null,
    faceLandmarks: null,
    fullFace: true,
    areas: new Set(DEFAULT_FULL_FACE),
    intensity: 35,
    raf: 0,
    sourceCanvas: document.createElement("canvas"),
    blurCanvas: document.createElement("canvas"),
    sourceData: null,
    blurData: null,
    faceLandmarker: null,
    mpReady: false,
    detecting: false
  };

  init();

  async function init() {
    removeEntityMedCopy();
    observeEntityMedCopy();
    injectStyles();
    rebuildControls();
    setupStrength();
    setupCompare();
    bindUploads();
    hidePaidGenerationUI();
    updateStatus("Cargando detector facial…");
    await initFaceLandmarker();
    updateStatus(state.mpReady ? "Detector facial listo · subí una selfie." : "Modo compatible listo · subí una selfie.");
  }

  /* ---------------------------------------------------------
     REMOVE THE EXACT COPY REQUESTED BY THE USER
     --------------------------------------------------------- */
  function removeEntityMedCopy(root = document.body) {
    if (!root) return;
    const forbidden = /No\s+se\s+env[ií]a\s+a\s+EntityMed\.?/gi;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      if (!forbidden.test(node.nodeValue || "")) return;
      forbidden.lastIndex = 0;
      node.nodeValue = (node.nodeValue || "").replace(forbidden, "").replace(/\s{2,}/g, " ").trim();

      const parent = node.parentElement;
      if (parent && !parent.textContent.trim() && !parent.querySelector("img,button,input,a,svg")) {
        parent.style.display = "none";
      }
    });
  }

  function observeEntityMedCopy() {
    if (!document.body || !("MutationObserver" in window)) return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) removeEntityMedCopy(node);
          else if (node.nodeType === Node.TEXT_NODE && /EntityMed/i.test(node.nodeValue || "")) {
            removeEntityMedCopy(node.parentElement || document.body);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------------------------------------------------
     FREE CLIENT-SIDE FACE LANDMARKS
     --------------------------------------------------------- */
  async function initFaceLandmarker() {
    try {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

      state.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });

      state.mpReady = true;
    } catch (error) {
      console.warn("MediaPipe Face Landmarker unavailable; using fallback geometry.", error);
      state.mpReady = false;
    }
  }

  function injectStyles() {
    if (document.getElementById("prp-v8-style")) return;
    const style = document.createElement("style");
    style.id = "prp-v8-style";
    style.textContent = `
      #generateBtn { display: none !important; }
      .prp-v8-note {
        margin: 12px 0 4px;
        color: #6f685f;
        font-size: 14px;
        line-height: 1.45;
      }
      .prp-v8-live {
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
      .prp-v8-live::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4c8a6b;
      }
      #zoneList button.active::after {
        content: "✓";
        margin-left: 6px;
      }
      .prp-v8-intensity-value {
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
        const objectUrl = URL.createObjectURL(file);
        image.onload = async () => {
          try {
            await startImage(image);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          alert("No pudimos abrir esa foto.");
        };
        image.src = objectUrl;
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

    let live = document.getElementById("prpV8Live");
    if (!live) {
      live = document.createElement("div");
      live.id = "prpV8Live";
      live.className = "prp-v8-live";
      live.textContent = "Vista facial en vivo · gratis";
      list.insertAdjacentElement("afterend", live);
    }

    let note = document.getElementById("prpV8Note");
    if (!note) {
      note = document.createElement("div");
      note.id = "prpV8Note";
      note.className = "prp-v8-note";
      note.textContent =
        "La cara se detecta automáticamente para que Ojeras, Labios, Pómulos, Mentón y Arrugas sigan las facciones reales aunque la foto esté inclinada.";
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
      const word = n <= 20 ? "Sutil" : n <= 55 ? "Balanceado" : n <= 80 ? "Visible" : "Definido";
      label.innerHTML = `<span class="prp-v8-intensity-value">${n}%</span> ${word}`;
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

  async function startImage(img) {
    state.img = img;
    state.faceLandmarks = null;

    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");

    const before = $("#beforeCanvas");
    const after = $("#afterCanvas");
    if (!before || !after) {
      alert("No encontramos el visor de Antes/Después.");
      return;
    }

    const maxSide = 760;
    const scale = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)
    );
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
    blurCtx.filter = "blur(1.45px)";
    blurCtx.drawImage(img, 0, 0, w, h);
    blurCtx.restore();
    state.blurData = blurCtx.getImageData(0, 0, w, h);

    actx.clearRect(0, 0, w, h);
    actx.drawImage(img, 0, 0, w, h);

    if (state.mpReady && state.faceLandmarker && !state.detecting) {
      state.detecting = true;
      updateStatus("Detectando facciones…");
      try {
        const result = state.faceLandmarker.detect(state.sourceCanvas);
        const landmarks = result && result.faceLandmarks && result.faceLandmarks[0];
        if (landmarks && landmarks.length > 400) {
          state.faceLandmarks = landmarks;
          updateStatus("Facciones detectadas · vista en vivo lista.");
        } else {
          updateStatus("Vista en vivo lista · usando ajuste compatible.");
        }
      } catch (error) {
        console.warn("Face detection failed.", error);
        updateStatus("Vista en vivo lista · usando ajuste compatible.");
      } finally {
        state.detecting = false;
      }
    } else {
      updateStatus("Vista en vivo lista.");
    }

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
      const geometry = getFaceGeometry(w, h);
      applyStructuralChanges(src, output, w, h, amount, geometry);
      applySkinChanges(output, blurred, w, h, amount, geometry);
    }

    after.getContext("2d", { willReadFrequently: true }).putImageData(
      new ImageData(output, w, h),
      0,
      0
    );

    updateStatus(`Vista en vivo · ${state.intensity}%`);
  }

  /* ---------------------------------------------------------
     LANDMARK-ALIGNED FACE GEOMETRY
     --------------------------------------------------------- */
  function getFaceGeometry(w, h) {
    const lm = state.faceLandmarks;

    if (!lm) {
      return {
        leftEye: pt(.37, .405, w, h),
        rightEye: pt(.63, .405, w, h),
        leftCheek: pt(.35, .535, w, h),
        rightCheek: pt(.65, .535, w, h),
        lips: pt(.50, .69, w, h),
        chin: pt(.50, .82, w, h),
        forehead: pt(.50, .26, w, h),
        leftJaw: pt(.25, .73, w, h),
        rightJaw: pt(.75, .73, w, h),
        faceWidth: .52 * w,
        faceHeight: .58 * h,
        lipWidth: .22 * w,
        eyeDistance: .26 * w
      };
    }

    const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
    const avg = (...points) => ({
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length
    });

    const leftEye = avg(P(33), P(133), P(159), P(145));
    const rightEye = avg(P(362), P(263), P(386), P(374));
    const lips = avg(P(61), P(291), P(13), P(14));
    const chin = P(152);
    const forehead = avg(P(10), P(109), P(338));
    const leftJaw = P(234);
    const rightJaw = P(454);

    const faceWidth = distance(leftJaw, rightJaw);
    const faceHeight = distance(forehead, chin);
    const lipWidth = distance(P(61), P(291));
    const eyeDistance = distance(leftEye, rightEye);

    const leftCheek = {
      x: leftEye.x - faceWidth * 0.035,
      y: leftEye.y + faceHeight * 0.18
    };
    const rightCheek = {
      x: rightEye.x + faceWidth * 0.035,
      y: rightEye.y + faceHeight * 0.18
    };

    return {
      leftEye, rightEye, leftCheek, rightCheek, lips, chin, forehead,
      leftJaw, rightJaw, faceWidth, faceHeight, lipWidth, eyeDistance
    };
  }

  function applyStructuralChanges(src, out, w, h, amount, g) {
    if (state.areas.has("lips")) {
      warpEllipse(src, out, w, h, {
        cx: g.lips.x, cy: g.lips.y,
        rx: g.lipWidth * 0.62,
        ry: g.faceHeight * 0.065,
        scaleX: 0.030,
        scaleY: 0.095
      }, amount);
    }

    if (state.areas.has("cheeks")) {
      [g.leftCheek, g.rightCheek].forEach((p) => {
        warpEllipse(src, out, w, h, {
          cx: p.x, cy: p.y,
          rx: g.faceWidth * 0.20,
          ry: g.faceHeight * 0.16,
          scaleX: 0.030,
          scaleY: 0.035,
          lift: 0.018
        }, amount);
      });
    }

    if (state.areas.has("midface")) {
      [g.leftCheek, g.rightCheek].forEach((p) => {
        warpEllipse(src, out, w, h, {
          cx: p.x, cy: p.y - g.faceHeight * 0.025,
          rx: g.faceWidth * 0.16,
          ry: g.faceHeight * 0.14,
          scaleX: 0.018,
          scaleY: 0.025,
          lift: 0.015
        }, amount);
      });
    }

    if (state.areas.has("chin")) {
      warpEllipse(src, out, w, h, {
        cx: g.chin.x,
        cy: g.chin.y - g.faceHeight * 0.035,
        rx: g.faceWidth * 0.18,
        ry: g.faceHeight * 0.13,
        scaleX: 0.010,
        scaleY: 0.040,
        lift: -0.006
      }, amount);
    }

    if (state.areas.has("jawline")) {
      warpJaw(src, out, w, h, amount, g);
    }
  }

  function applySkinChanges(out, blurred, w, h, amount, g) {
    if (state.areas.has("undereye")) {
      const rx = g.eyeDistance * 0.38;
      const ry = g.faceHeight * 0.060;

      blendEllipse(out, blurred, w, h, g.leftEye.x, g.leftEye.y + ry * 0.78, rx, ry, 0.38 * amount);
      blendEllipse(out, blurred, w, h, g.rightEye.x, g.rightEye.y + ry * 0.78, rx, ry, 0.38 * amount);

      // Slightly lift dark under-eye luminance without whitening the whole skin.
      liftShadowEllipse(out, w, h, g.leftEye.x, g.leftEye.y + ry * 0.82, rx, ry, 7.5 * amount);
      liftShadowEllipse(out, w, h, g.rightEye.x, g.rightEye.y + ry * 0.82, rx, ry, 7.5 * amount);
    }

    if (state.areas.has("wrinkles")) {
      const foreheadCy = g.forehead.y + g.faceHeight * 0.10;
      blendEllipse(
        out, blurred, w, h,
        g.forehead.x, foreheadCy,
        g.faceWidth * 0.32, g.faceHeight * 0.15,
        0.34 * amount
      );

      // Crow's feet stay centered on the actual eye positions.
      blendEllipse(out, blurred, w, h, g.leftEye.x - g.eyeDistance * 0.45, g.leftEye.y, g.eyeDistance * 0.17, g.faceHeight * 0.055, 0.28 * amount);
      blendEllipse(out, blurred, w, h, g.rightEye.x + g.eyeDistance * 0.45, g.rightEye.y, g.eyeDistance * 0.17, g.faceHeight * 0.055, 0.28 * amount);
    }
  }

  function warpEllipse(src, out, w, h, z, amount) {
    const rx = Math.max(8, z.rx);
    const ry = Math.max(8, z.ry);
    const minX = Math.max(0, Math.floor(z.cx - rx));
    const maxX = Math.min(w - 1, Math.ceil(z.cx + rx));
    const minY = Math.max(0, Math.floor(z.cy - ry));
    const maxY = Math.min(h - 1, Math.ceil(z.cy + ry));

    for (let y = minY; y <= maxY; y++) {
      const ny = (y - z.cy) / ry;
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - z.cx) / rx;
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;

        const feather = Math.pow(1 - r2, 2.3);
        const bx = 1 + (z.scaleX || 0) * amount * feather;
        const by = 1 + (z.scaleY || 0) * amount * feather;
        const lift = (z.lift || 0) * h * amount * feather;

        const sx = z.cx + (x - z.cx) / bx;
        const sy = z.cy + (y - z.cy) / by + lift;

        copyBilinear(src, out, w, h, sx, sy, x, y);
      }
    }
  }

  function warpJaw(src, out, w, h, amount, g) {
    const centerX = (g.leftJaw.x + g.rightJaw.x) / 2;
    const minY = Math.max(0, Math.floor(g.leftEye.y + g.faceHeight * 0.30));
    const maxY = Math.min(h - 1, Math.ceil(g.chin.y + g.faceHeight * 0.02));

    for (let y = minY; y <= maxY; y++) {
      const vertical = clamp((y - minY) / Math.max(1, maxY - minY), 0, 1);
      const centerWeight = Math.sin(vertical * Math.PI);

      for (let x = 0; x < w; x++) {
        const side = Math.sign(x - centerX);
        const abs = Math.abs(x - centerX);
        const inner = g.faceWidth * 0.28;
        const outer = g.faceWidth * 0.56;

        if (abs < inner || abs > outer) continue;

        const sideWeight =
          smoothstep(inner, inner + g.faceWidth * 0.08, abs) *
          (1 - smoothstep(outer - g.faceWidth * 0.08, outer, abs));

        const weight = centerWeight * sideWeight;
        if (weight <= 0) continue;

        // Small visual refinement, not aggressive V-line.
        const sx = x + side * g.faceWidth * 0.010 * amount * weight;
        copyBilinear(src, out, w, h, sx, y, x, y);
      }
    }
  }

  function blendEllipse(out, blur, w, h, cx, cy, rx, ry, alphaMax) {
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

        const feather = Math.pow(1 - r2, 2.2);
        const a = alphaMax * feather;
        const i = (y * w + x) * 4;

        out[i] = out[i] * (1 - a) + blur[i] * a;
        out[i + 1] = out[i + 1] * (1 - a) + blur[i + 1] * a;
        out[i + 2] = out[i + 2] * (1 - a) + blur[i + 2] * a;
      }
    }
  }

  function liftShadowEllipse(out, w, h, cx, cy, rx, ry, liftMax) {
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

        const feather = Math.pow(1 - r2, 2.6);
        const i = (y * w + x) * 4;

        // Lift luminance gently while preserving color relationships.
        const delta = liftMax * feather;
        out[i] = clamp(out[i] + delta, 0, 255);
        out[i + 1] = clamp(out[i + 1] + delta, 0, 255);
        out[i + 2] = clamp(out[i + 2] + delta, 0, 255);
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

  function pt(x, y, w, h) {
    return { x: x * w, y: y * h };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function updateStatus(text) {
    const node = $("#simStatus");
    if (node) node.textContent = text;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }
})();
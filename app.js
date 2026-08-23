(() => {
"use strict";

const $ = s => document.querySelector(s);


const MEDIAPIPE_VERSION = "0.10.22";
const MEDIAPIPE_WASM =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let faceLandmarker = null;
let faceLandmarkerPromise = null;


const AREA_LABELS = {
  undereye: "Ojeras",
  temples: "Sienes",
  midface: "Soporte tercio medio",
  cheeks: "Pómulos",
  nose: "Nariz",
  perioral: "Nasolabial / Perioral",
  lips: "Labios",
  chin: "Mentón",
  prejowl: "Pre-jowl",
  jaw: "Mandíbula",
  wrinkles: "Arrugas"
};


const AREA_ORDER = [
  "undereye","temples","midface","cheeks","nose",
  "perioral","lips","chin","prejowl","jaw","wrinkles"
];

const state = {
  sourceCanvas: null,
  aiCanvas: null,
  sourceImageDataUrl: null,
  aiReady: false,
  intensity: 70,
  fullFace: true,
  areas: new Set(),
  generationSeq: 0,
  regenTimer: null,
  currentRequest: null,
  plan: {
    filler: [],
    botox: [],
    threads: []
  },
  faceAnalysis: null
};

init();

function init() {
  removeEntityMed();
  observeEntityMed();
  injectStyles();
  buildControls();
  bindUpload();
  setupStrength();
  setupCompare();
  setupDownload();
  hideLegacyGenerate();

  setStatus("Listo · subí una selfie.");
}

function removeEntityMed(root = document.body) {
  if (!root) return;
  const rx = /No\s+se\s+env[ií]a\s+a\s+EntityMed\.?/gi;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const n of nodes) {
    const text = n.nodeValue || "";
    if (!rx.test(text)) continue;
    rx.lastIndex = 0;
    n.nodeValue = text.replace(rx, "").replace(/\s{2,}/g, " ").trim();
  }
}

function observeEntityMed() {
  if (!document.body || !window.MutationObserver) return;
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1) removeEntityMed(n);
        if (n.nodeType === 3 && /EntityMed/i.test(n.nodeValue || "")) {
          removeEntityMed(n.parentElement || document.body);
        }
      });
    });
  }).observe(document.body, { subtree: true, childList: true });
}

function injectStyles() {
  if ($("#prpAiHybridStyle")) return;

  const style = document.createElement("style");
  style.id = "prpAiHybridStyle";
  style.textContent = `
    #generateBtn{display:none!important}

    .prp-ai-live{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      margin:10px 0 8px;
      background:#edf4ef;
      color:#294b3d;
      font-weight:700;
      font-size:13px;
    }

    .prp-ai-live::before{
      content:"";
      width:8px;
      height:8px;
      border-radius:50%;
      background:#4e9a72;
    }

    .prp-ai-note{
      margin:10px 0 14px;
      padding:12px 14px;
      border:1px solid #e4ddd3;
      background:#fffdfa;
      border-radius:16px;
      font-size:13px;
      line-height:1.45;
      color:#6d665f;
    }

    #zoneList button.active::after{content:" ✓"}

    .prp-update-simulation{
      width:100%;
      min-height:48px;
      margin:0 0 14px;
      border:0;
      border-radius:999px;
      background:#203a2f;
      color:#fff;
      font-weight:750;
      font-size:15px;
      cursor:pointer;
    }
    .prp-update-simulation[disabled]{
      opacity:.45;
      cursor:not-allowed;
    }

    .prp-download{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:46px;
      padding:0 18px;
      border-radius:999px;
      border:0;
      background:#203a2f;
      color:#fff;
      font-weight:700;
      cursor:pointer;
    }

    .prp-download[disabled]{
      opacity:.45;
      cursor:not-allowed;
    }

    .prp-ai-error{
      color:#9a2d28;
      font-weight:600;
    }

    .prp-treatment-panel{
      margin:16px 0 0;
      padding:16px;
      border:1px solid #e4ddd3;
      border-radius:18px;
      background:#fffdfa;
      color:#2e2b28;
      line-height:1.45;
    }
    .prp-treatment-panel h3{
      margin:0 0 12px;
      font-size:18px;
    }
    .prp-treatment-group{
      margin:0 0 14px;
    }
    .prp-treatment-group:last-of-type{
      margin-bottom:8px;
    }
    .prp-treatment-group strong{
      display:block;
      margin-bottom:6px;
      font-size:13px;
      letter-spacing:.04em;
    }
    .prp-treatment-group ul{
      margin:0 0 0 18px;
      padding:0;
    }
    .prp-treatment-group li{
      margin:4px 0;
    }
    .prp-treatment-disclaimer{
      margin-top:12px;
      font-size:12px;
      color:#6d665f;
    }

    .prp-scan-panel{
      margin:14px 0;
      padding:14px;
      border:1px solid #dfe7e2;
      border-radius:16px;
      background:#f4f8f5;
      color:#294b3d;
      font-size:13px;
      line-height:1.45;
    }
    .prp-scan-panel strong{
      display:block;
      margin-bottom:6px;
      font-size:14px;
    }
    .prp-scan-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px 12px;
      margin-top:10px;
    }
    .prp-scan-metric{
      padding:8px 10px;
      background:#fff;
      border-radius:12px;
      border:1px solid #e6ebe8;
    }
    .prp-scan-metric small{
      display:block;
      color:#7b817d;
      margin-bottom:2px;
    }
    .prp-scan-warning{
      margin-top:10px;
      color:#7a5f21;
    }
  `;
  document.head.appendChild(style);
}

function hideLegacyGenerate() {
  const b = $("#generateBtn");
  if (b) b.style.display = "none";
}

function buildControls() {
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

    if (state.fullFace) {
      state.areas.clear();
      full.classList.add("active");
    } else {
      full.classList.remove("active");
    }

    syncButtons();
    markSimulationDirty();
  });
  list.appendChild(full);

  for (const id of AREA_ORDER) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.zone = id;
    b.textContent = AREA_LABELS[id];

    b.addEventListener("click", () => {
      state.fullFace = false;
      full.classList.remove("active");

      if (state.areas.has(id)) state.areas.delete(id);
      else state.areas.add(id);

      syncButtons();
      markSimulationDirty();
    });

    list.appendChild(b);
  }

  const live = document.createElement("div");
  live.id = "prpAiLive";
  live.className = "prp-ai-live";
  live.textContent = "Best Version IA · análisis local + FLUX";
  list.insertAdjacentElement("afterend", live);

  const note = document.createElement("div");
  note.id = "prpAiNote";
  note.className = "prp-ai-note";
  note.textContent =
    "El análisis facial se realiza localmente con MediaPipe y reglas clínicas orientativas basadas en los estudios cargados. FLUX genera una sola imagen “Después”. La intensidad 0–100% funciona en vivo en tu teléfono sin volver a usar IA.";
  live.insertAdjacentElement("afterend", note);

  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.id = "prpUpdateSimulationBtn";
  updateBtn.className = "prp-update-simulation";
  updateBtn.textContent = "Actualizar simulación";
  updateBtn.disabled = true;
  updateBtn.addEventListener("click", () => generateAiBestVersion());
  note.insertAdjacentElement("afterend", updateBtn);
}

function syncButtons() {
  const full = $("#fullFaceBtn");
  if (full) full.classList.toggle("active", state.fullFace);

  AREA_ORDER.forEach(id => {
    const b = document.querySelector(`#zoneList button[data-zone="${id}"]`);
    if (b) b.classList.toggle("active", !state.fullFace && state.areas.has(id));
  });
}


async function getFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

  faceLandmarkerPromise = (async () => {
    const vision = await import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`
    );
    const { FilesetResolver, FaceLandmarker } = vision;

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

    try {
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODEL,
          delegate: "GPU"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5
      });
    } catch (gpuError) {
      console.warn("MediaPipe GPU init failed; falling back to CPU", gpuError);
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODEL,
          delegate: "CPU"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5
      });
    }
  })();

  try {
    faceLandmarker = await faceLandmarkerPromise;
    return faceLandmarker;
  } finally {
    faceLandmarkerPromise = null;
  }
}

function dist(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((a.x - b.x), (a.y - b.y));
}

function safeRatio(a, b) {
  return b > 0 ? a / b : 0;
}

function pct(v, digits = 1) {
  return Number.isFinite(v) ? Number((v * 100).toFixed(digits)) : null;
}

async function analyzeFaceGeometry(canvas) {
  const detector = await getFaceLandmarker();
  const result = detector.detect(canvas);

  const faces = result?.faceLandmarks || [];
  if (faces.length !== 1) {
    throw new Error(
      faces.length === 0
        ? "No detectamos un rostro frontal con suficiente claridad."
        : "La foto debe contener una sola persona."
    );
  }

  const lm = faces[0];
  if (lm.length < 468) {
    throw new Error("El escaneo facial quedó incompleto.");
  }

  // Stable MediaPipe Face Mesh landmarks.
  const top = lm[10];
  const chin = lm[152];
  const leftCheek = lm[234];
  const rightCheek = lm[454];
  const noseTip = lm[1];
  const noseBase = lm[2];
  const leftEyeOuter = lm[33];
  const rightEyeOuter = lm[263];
  const leftEyeInner = lm[133];
  const rightEyeInner = lm[362];
  const leftMouth = lm[61];
  const rightMouth = lm[291];
  const jawLeft = lm[172];
  const jawRight = lm[397];

  const faceHeight = dist(top, chin);
  const faceWidth = dist(leftCheek, rightCheek);
  const eyeSpan = dist(leftEyeOuter, rightEyeOuter);
  const innerEyeGap = dist(leftEyeInner, rightEyeInner);
  const mouthWidth = dist(leftMouth, rightMouth);
  const jawWidth = dist(jawLeft, jawRight);
  const lowerThird = dist(noseBase, chin);

  const midX = (leftCheek.x + rightCheek.x) / 2;
  const cheekHalf = Math.max(faceWidth / 2, 0.0001);
  const noseMidDeviation = Math.abs(noseTip.x - midX) / cheekHalf;
  const mouthMidX = (leftMouth.x + rightMouth.x) / 2;
  const mouthMidDeviation = Math.abs(mouthMidX - midX) / cheekHalf;

  const leftNoseCheek = Math.abs(noseTip.x - leftCheek.x);
  const rightNoseCheek = Math.abs(rightCheek.x - noseTip.x);
  const transverseAsymmetry =
    Math.abs(leftNoseCheek - rightNoseCheek) /
    Math.max(leftNoseCheek + rightNoseCheek, 0.0001);

  const blendshapeCategories = result?.faceBlendshapes?.[0]?.categories || [];
  const blendshapes = {};
  for (const item of blendshapeCategories) {
    if (item?.categoryName) blendshapes[item.categoryName] = item.score;
  }

  const expressionActivity = Math.max(
    blendshapes.mouthSmileLeft || 0,
    blendshapes.mouthSmileRight || 0,
    blendshapes.jawOpen || 0,
    blendshapes.browInnerUp || 0,
    blendshapes.eyeSquintLeft || 0,
    blendshapes.eyeSquintRight || 0
  );

  const metrics = {
    landmarkCount: lm.length,
    faceAspect: safeRatio(faceHeight, faceWidth),
    eyeSpanToFaceWidth: safeRatio(eyeSpan, faceWidth),
    innerEyeGapToFaceWidth: safeRatio(innerEyeGap, faceWidth),
    mouthToFaceWidth: safeRatio(mouthWidth, faceWidth),
    jawToFaceWidth: safeRatio(jawWidth, faceWidth),
    lowerThirdToFaceHeight: safeRatio(lowerThird, faceHeight),
    noseMidDeviation,
    mouthMidDeviation,
    transverseAsymmetry,
    expressionActivity
  };

  const quality = {
    singleFace: true,
    frontalUsable:
      noseMidDeviation < 0.12 &&
      transverseAsymmetry < 0.18 &&
      expressionActivity < 0.55,
    neutralExpression: expressionActivity < 0.55
  };

  const observations = [];

  if (metrics.lowerThirdToFaceHeight > 0.39) {
    observations.push("El tercio inferior se ve relativamente largo en esta toma.");
  } else if (metrics.lowerThirdToFaceHeight < 0.31) {
    observations.push("El tercio inferior se ve relativamente corto en esta toma.");
  } else {
    observations.push("El tercio inferior está dentro de un rango proporcional equilibrado.");
  }

  if (metrics.jawToFaceWidth > 0.86) {
    observations.push("El ancho mandibular es relativamente dominante respecto del ancho facial.");
  } else if (metrics.jawToFaceWidth < 0.68) {
    observations.push("La mandíbula es relativamente estrecha respecto del ancho facial.");
  } else {
    observations.push("La relación ancho mandibular / ancho facial es equilibrada.");
  }

  if (metrics.transverseAsymmetry > 0.08 || metrics.mouthMidDeviation > 0.05) {
    observations.push("Se detecta una asimetría frontal leve que debe preservarse o corregirse solo de forma conservadora.");
  } else {
    observations.push("La simetría frontal global es alta en esta fotografía.");
  }

  return {
    version: "mediapipe-face-landmarker-v8",
    landmarkCount: lm.length,
    metrics,
    quality,
    observations,
    // Keep only derived metrics; never transmit the full biometric landmark mesh.
    landmarkMeshStored: false
  };
}

function renderScanPanel() {
  let panel = $("#prpScanPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "prpScanPanel";
    panel.className = "prp-scan-panel";

    const list = $("#zoneList");
    if (list) list.insertAdjacentElement("afterend", panel);
    else $("#simWorkspace")?.prepend(panel);
  }

  const a = state.faceAnalysis;
  if (!a) {
    panel.innerHTML = `
      <strong>Escaneo estructural</strong>
      Preparando análisis facial…
    `;
    return;
  }

  const m = a.metrics;
  panel.innerHTML = `
    <strong>Escaneo estructural · ${escapeHtml(a.landmarkCount)} landmarks</strong>
    MediaPipe analiza proporciones y simetría localmente antes de generar la simulación; no requiere Kimi API.
    <div class="prp-scan-grid">
      <div class="prp-scan-metric">
        <small>Tercio inferior / rostro</small>
        ${escapeHtml(pct(m.lowerThirdToFaceHeight))}%
      </div>
      <div class="prp-scan-metric">
        <small>Mandíbula / ancho facial</small>
        ${escapeHtml(pct(m.jawToFaceWidth))}%
      </div>
      <div class="prp-scan-metric">
        <small>Asimetría transversal</small>
        ${escapeHtml(pct(m.transverseAsymmetry))}%
      </div>
      <div class="prp-scan-metric">
        <small>Desviación de línea media</small>
        ${escapeHtml(pct(m.noseMidDeviation))}%
      </div>
    </div>
    ${
      a.quality.frontalUsable
        ? ""
        : `<div class="prp-scan-warning">La toma no es totalmente frontal/neutra. La simulación puede ser menos precisa.</div>`
    }
  `;
}

function bindUpload() {
  [$("#fileInput"), $("#fileInput2")]
    .filter(Boolean)
    .forEach(input => {
      input.addEventListener("change", async e => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          alert("Elegí una foto.");
          return;
        }

        try {
          setStatus("Preparando selfie…");

          const img = await fileToImage(file);
          await startImage(img);
        } catch (err) {
          console.error(err);
          setStatus("No pudimos abrir esa foto.");
          alert("No pudimos abrir esa foto. Probá con otra imagen.");
        } finally {
          input.value = "";
        }
      });
    });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };

    img.src = url;
  });
}

async function startImage(img) {
  $("#simEmpty")?.classList.add("hidden");
  $("#simWorkspace")?.classList.remove("hidden");

  const before = $("#beforeCanvas");
  const after = $("#afterCanvas");
  if (!before || !after) throw new Error("Simulator canvases not found");

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // Cloudflare FLUX.2 editing requires reference images smaller than 512x512.
  // 500px keeps the request compatible, fast and inexpensive.
  const maxSide = 500;
  const scale = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  before.width = after.width = w;
  before.height = after.height = h;

  const compare = $("#compare");
  if (compare) compare.style.aspectRatio = `${w}/${h}`;

  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;

  const sctx = source.getContext("2d", { alpha: false });
  sctx.drawImage(img, 0, 0, w, h);

  state.sourceCanvas = source;
  state.sourceImageDataUrl = source.toDataURL("image/jpeg", 0.90);
  state.aiCanvas = null;
  state.aiReady = false;
  $("#prpTreatmentPanel")?.remove();

  before.getContext("2d").drawImage(source, 0, 0);
  after.getContext("2d").drawImage(source, 0, 0);

  setDownloadEnabled(false);
  render();

  state.faceAnalysis = null;
  renderScanPanel();
  setStatus("Escaneando estructura facial…");

  try {
    state.faceAnalysis = await analyzeFaceGeometry(source);
    renderScanPanel();
  } catch (scanError) {
    console.error("Face scan failed:", scanError);
    setStatus("No pudimos completar el escaneo facial.");
    alert(scanError?.message || "No pudimos analizar esta foto.");
    return;
  }

  // Full Face is the default initial proposal.
  state.fullFace = true;
  state.areas.clear();
  syncButtons();

  await generateAiBestVersion();
}

function setupStrength() {
  const slider = $("#strength");
  const label = $("#strengthText");
  if (!slider) return;

  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = String(state.intensity);

  const updateLabel = () => {
    if (!label) return;
    const n = state.intensity;
    const name =
      n < 25 ? "Natural" :
      n < 55 ? "Sutil" :
      n < 80 ? "Balanceado" :
      "Definido";

    label.textContent = `${n}% · ${name}`;
  };

  updateLabel();

  slider.addEventListener("input", () => {
    state.intensity = clamp(Number(slider.value), 0, 100);
    updateLabel();
    render();
  });
}

function setupCompare() {
  const slider = $("#compareSlider");
  if (!slider) return;

  const update = () => {
    const v = clamp(Number(slider.value), 0, 100);
    const after = $("#afterCanvas");
    const divider = $("#divider");

    if (after) after.style.clipPath = `inset(0 0 0 ${v}%)`;
    if (divider) divider.style.left = `${v}%`;
  };

  slider.addEventListener("input", update);
  update();
}

function setupDownload() {
  const actions = document.querySelector(".sim-actions");
  if (!actions || $("#prpDownloadBtn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "prpDownloadBtn";
  btn.className = "prp-download";
  btn.disabled = true;
  btn.textContent = "Descargar resultado";

  btn.addEventListener("click", () => {
    const after = $("#afterCanvas");
    if (!after || !state.aiReady) return;

    const a = document.createElement("a");
    a.download = "PRP-simulacion-armonizacion.jpg";
    a.href = after.toDataURL("image/jpeg", 0.94);
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  actions.appendChild(btn);
}

function setDownloadEnabled(enabled) {
  const btn = $("#prpDownloadBtn");
  if (btn) btn.disabled = !enabled;
}

function selectedZonesForApi() {
  if (state.fullFace) return ["full"];

  const zones = [...state.areas];
  return zones.length ? zones : ["full"];
}

function markSimulationDirty() {
  if (!state.sourceImageDataUrl) return;

  const btn = $("#prpUpdateSimulationBtn");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Actualizar simulación";
  }

  const live = $("#prpAiLive");
  if (live) {
    live.textContent = "Zonas modificadas · actualizá cuando quieras";
    live.classList.remove("prp-ai-error");
  }

  setStatus("Cambiaste las zonas · tocá Actualizar simulación.");
}


function buildSuggestedPlan() {
  const a = state.faceAnalysis;
  const m = a?.metrics || {};

  const selected = state.fullFace
    ? new Set(["midface", "undereye", "chin", "jaw", "wrinkles"])
    : new Set([...state.areas]);

  const filler = [];
  const botox = [];
  const threads = [];
  const mdCodes = [];
  const priorities = [];
  const noTreatment = [];

  const addCode = code => { if (code && !mdCodes.includes(code)) mdCodes.push(code); };

  // FOUNDATION — midface support first, following the MD Codes planning sequence.
  if (selected.has("midface") || state.fullFace) {
    filler.push({
      area: "Soporte de tercio medio",
      ml: "volumen conservador a definir clínicamente"
    });
    addCode("Ck — familia mejilla / soporte");
    priorities.push("PRIORIDAD 1 · Foundation: valorar soporte de mejilla y tercio medio antes de refinamientos aislados.");
  }

  // CONTOUR — chin and jaw only if the derived proportions justify review.
  if (selected.has("chin") || state.fullFace) {
    if ((m.lowerThirdToFaceHeight || 0) < 0.34) {
      filler.push({ area: "Mentón", ml: "rango orientativo a definir clínicamente" });
      addCode("C — familia mentón");
      priorities.push("PRIORIDAD 2 · Contour: valorar mentón por balance del tercio inferior.");
    } else {
      noTreatment.push("Mentón: sin indicación automática por proporción frontal.");
    }
  }

  if (selected.has("jaw") || selected.has("prejowl") || state.fullFace) {
    if ((m.jawToFaceWidth || 0) < 0.74 || (m.transverseAsymmetry || 0) > 0.08) {
      filler.push({
        area: "Pre-jowl / continuidad mandibular",
        ml: "rango orientativo a definir clínicamente"
      });
      addCode("Jw — familia mandíbula / jowl");
      priorities.push("PRIORIDAD 2 · Contour: valorar continuidad mandibular de forma conservadora.");
    } else {
      noTreatment.push("Mandíbula: no sobredefinir si el ancho facial ya está equilibrado.");
    }
  }

  // REFINEMENT — only after foundation/contour.
  if (selected.has("undereye") || state.fullFace) {
    filler.push({
      area: "Ojeras / tear trough",
      ml: "solo si persiste tras valorar soporte de midface"
    });
    addCode("Tt — familia tear trough");
    priorities.push("REFINEMENT · Ojeras: valorar después del soporte del tercio medio, no como primer paso por defecto.");
  }

  if (selected.has("temples")) {
    filler.push({ area: "Sienes", ml: "según pérdida de volumen visible" });
    addCode("T — familia sien");
  }

  if (selected.has("cheeks")) {
    filler.push({ area: "Pómulos / soporte malar", ml: "conservador; evitar proyección lateral exagerada" });
    addCode("Ck — familia mejilla");
  }

  if (selected.has("perioral")) {
    filler.push({
      area: "Nasolabial / perioral",
      ml: "solo si el soporte estructural no es suficiente"
    });
    addCode("NL / M — familias nasolabial y marionette");
  }

  if (selected.has("lips")) {
    filler.push({ area: "Labios", ml: "conservador; definir tras evaluación clínica" });
    addCode("Lp — familia labios");
  }

  if (selected.has("nose")) {
    filler.push({ area: "Nariz", ml: "solo si la profesional considera indicado refinamiento no quirúrgico" });
    addCode("N — familia nariz");
  }

  if (selected.has("wrinkles") || state.fullFace) {
    botox.push({ area: "Glabella / frente / lateral orbital: valorar según dinámica real" });
  }

  if (selected.has("midface") && selected.has("prejowl")) {
    threads.push({ area: "Hilos tensores: valorar solo si filler/Botox no ofrecen un resultado más natural" });
  }

  if (!threads.length) {
    threads.push({ area: "No indicados por defecto en esta simulación frontal." });
  }

  if (noTreatment.length) {
    priorities.push(...noTreatment.map(x => `SIN TRATAR · ${x}`));
  }

  state.plan = {
    filler,
    botox,
    threads,
    mdCodes,
    priorities,
    provider: "MediaPipe + reglas MD Codes locales",
    summary: "Plan orientativo gratuito sin Kimi API"
  };
}

function renderTreatmentPanel() {
  let panel = $("#prpTreatmentPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "prpTreatmentPanel";
    panel.className = "prp-treatment-panel";

    const compare = $("#compare");
    if (compare) compare.insertAdjacentElement("afterend", panel);
    else $("#simWorkspace")?.appendChild(panel);
  }

  const listOrNone = (items, formatter) =>
    items?.length
      ? items.map(formatter).join("")
      : "<li>No indicado en esta simulación</li>";

  const priorityHtml = listOrNone(
    state.plan.priorities,
    item => `<li>${escapeHtml(item)}</li>`
  );

  const codesHtml = listOrNone(
    state.plan.mdCodes,
    item => `<li>${escapeHtml(item)}</li>`
  );

  const fillerHtml = listOrNone(
    state.plan.filler,
    i => `<li><strong style="display:inline;font-size:inherit;letter-spacing:0">${escapeHtml(i.area)}:</strong> ${escapeHtml(i.ml)}</li>`
  );

  const botoxHtml = listOrNone(
    state.plan.botox,
    i => `<li>${escapeHtml(i.area)}</li>`
  );

  const threadsHtml = listOrNone(
    state.plan.threads,
    i => `<li>${escapeHtml(i.area)}</li>`
  );

  panel.innerHTML = `
    <h3>Plan orientativo basado en análisis facial</h3>
    <div style="margin:0 0 12px;color:#6d665f;font-size:13px">Fuente: ${escapeHtml(state.plan.provider || "MediaPipe")}${state.plan.summary ? ` · ${escapeHtml(state.plan.summary)}` : ""}</div>

    <div class="prp-treatment-group">
      <strong>SECUENCIA / PRIORIDAD</strong>
      <ul>${priorityHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>FAMILIAS MD CODES CANDIDATAS</strong>
      <ul>${codesHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>FILLER · EVALUACIÓN ORIENTATIVA</strong>
      <ul>${fillerHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>BOTULINUM TOXIN · EFECTO VISUAL</strong>
      <ul>${botoxHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>THREAD-LIFT</strong>
      <ul>${threadsHtml}</ul>
    </div>

    <div class="prp-treatment-disclaimer">
      Simulación orientativa basada en una fotografía frontal y métricas geométricas.
      No prescribe dosis, unidades, producto, profundidad, técnica ni puntos de inyección.
      La indicación y cantidad definitiva requieren evaluación clínica presencial.
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[ch]));
}

async function generateAiBestVersion() {
  if (!state.sourceImageDataUrl) return;

  const requestNumber = ++state.generationSeq;

  if (state.currentRequest) {
    try { state.currentRequest.abort(); } catch {}
  }

  const controller = new AbortController();
  state.currentRequest = controller;

  state.aiReady = false;
  setDownloadEnabled(false);

  const updateBtn = $("#prpUpdateSimulationBtn");
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.textContent = "Generando…";
  }

  setStatus("Generando Best Version con FLUX…");

  const live = $("#prpAiLive");
  if (live) live.textContent = "Generando Best Version con FLUX…";

  try {
    const response = await fetch("/api/harmonize", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        imageDataUrl: state.sourceImageDataUrl,
        zones: selectedZonesForApi(),
        width: state.sourceCanvas.width,
        height: state.sourceCanvas.height,
        analysis: state.faceAnalysis
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);

    if (requestNumber !== state.generationSeq) return;

    if (!response.ok || !data?.ok || !data?.imageDataUrl) {
      const err = new Error(data?.error || `Error ${response.status}`);
      err.apiCode = data?.code || null;
      err.cloudflareCode = data?.cloudflareCode || null;
      err.httpStatus = response.status;
      throw err;
    }

    const aiImg = await loadDataUrlImage(data.imageDataUrl);

    if (requestNumber !== state.generationSeq) return;

    const aiCanvas = document.createElement("canvas");
    aiCanvas.width = state.sourceCanvas.width;
    aiCanvas.height = state.sourceCanvas.height;

    const ctx = aiCanvas.getContext("2d", { alpha: false });
    ctx.drawImage(
      aiImg,
      0, 0,
      aiCanvas.width,
      aiCanvas.height
    );

    state.aiCanvas = aiCanvas;
    state.aiReady = true;

    buildSuggestedPlan();
    renderTreatmentPanel();

    render();
    setDownloadEnabled(true);

    if (live) {
      live.textContent = "Best Version lista · intensidad en vivo sin nuevas generaciones";
      live.classList.remove("prp-ai-error");
    }

    setStatus("Simulación IA lista · mové la intensidad.");

    const updateBtn = $("#prpUpdateSimulationBtn");
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = "Simulación actualizada";
    }
  } catch (err) {
    if (err?.name === "AbortError") return;

    console.error("AI harmonization failed:", err);

    state.aiReady = false;
    state.aiCanvas = null;

    render();

    if (live) {
      live.textContent = "No pudimos generar el Best Version";
      live.classList.add("prp-ai-error");
    }

    setStatus("La IA devolvió un error. Tocá una zona para reintentar.");

    let friendly = "No pudimos generar la simulación en este momento. Probá nuevamente.";

    if (err?.apiCode === "OUT_OF_CAPACITY" || err?.cloudflareCode === "3040") {
      friendly = "Cloudflare está temporalmente sin capacidad para este modelo. Ya reintentamos automáticamente varias veces. Probá nuevamente en unos minutos.";
    } else if (err?.apiCode === "ACCOUNT_LIMITED" || err?.cloudflareCode === "3036") {
      friendly = "Cloudflare todavía está aplicando el límite de cuenta al proyecto. Tu plan es pago, así que revisaremos la activación/facturación de Workers AI.";
    } else if (err?.apiCode === "PAID_PLAN_REQUIRED" || err?.cloudflareCode === "5035") {
      friendly = "Este modelo requiere Workers Paid. Tu cuenta ya figura como Paid, así que revisaremos que el proyecto esté en la misma cuenta.";
    } else if (err?.apiCode === "TIMEOUT") {
      friendly = "La generación tardó demasiado. Probá nuevamente.";
    }

    console.error("PRP harmonize diagnostic", {
      apiCode: err?.apiCode,
      cloudflareCode: err?.cloudflareCode,
      httpStatus: err?.httpStatus,
      message: err?.message
    });

    alert(friendly);
  } finally {
    if (state.currentRequest === controller) {
      state.currentRequest = null;
    }

    const updateBtn = $("#prpUpdateSimulationBtn");
    if (updateBtn) {
      updateBtn.disabled = !state.sourceImageDataUrl;
      updateBtn.textContent = state.aiReady ? "Actualizar simulación" : "Reintentar simulación";
    }
  }
}

function loadDataUrlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo abrir la imagen generada por IA."));
    img.src = dataUrl;
  });
}

function render() {
  if (!state.sourceCanvas) return;

  const before = $("#beforeCanvas");
  const after = $("#afterCanvas");
  if (!before || !after) return;

  const bctx = before.getContext("2d", { alpha: false });
  const actx = after.getContext("2d", { alpha: false });

  bctx.clearRect(0, 0, before.width, before.height);
  bctx.drawImage(state.sourceCanvas, 0, 0);

  actx.clearRect(0, 0, after.width, after.height);
  actx.drawImage(state.sourceCanvas, 0, 0);

  if (state.aiReady && state.aiCanvas) {
    const amount = clamp(state.intensity / 100, 0, 1);

    // Real-time intensity happens locally: no API call here.
    actx.save();
    actx.globalAlpha = amount;
    actx.drawImage(state.aiCanvas, 0, 0, after.width, after.height);
    actx.restore();

    setStatus(`Vista en vivo · ${state.intensity}% · IA lista`);
  } else {
    setStatus("Esperando Best Version de IA…");
  }
}

function setStatus(text) {
  const n = $("#simStatus");
  if (n) n.textContent = text;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

})();

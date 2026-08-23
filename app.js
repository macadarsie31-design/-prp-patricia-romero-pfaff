(() => {
"use strict";

const $ = s => document.querySelector(s);

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
  currentRequest: null
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
    scheduleAiRegeneration();
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
      scheduleAiRegeneration();
    });

    list.appendChild(b);
  }

  const live = document.createElement("div");
  live.id = "prpAiLive";
  live.className = "prp-ai-live";
  live.textContent = "IA para Best Version · slider local en tiempo real";
  list.insertAdjacentElement("afterend", live);

  const note = document.createElement("div");
  note.id = "prpAiNote";
  note.className = "prp-ai-note";
  note.textContent =
    "La IA genera una sola imagen “Después”. La intensidad mezcla Original ↔ Best Version directamente en el teléfono, sin volver a generar en cada movimiento.";
  live.insertAdjacentElement("afterend", note);
}

function syncButtons() {
  const full = $("#fullFaceBtn");
  if (full) full.classList.toggle("active", state.fullFace);

  AREA_ORDER.forEach(id => {
    const b = document.querySelector(`#zoneList button[data-zone="${id}"]`);
    if (b) b.classList.toggle("active", !state.fullFace && state.areas.has(id));
  });
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

  // Keep request reasonably sized for mobile + Cloudflare.
  const maxSide = 1024;
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

  before.getContext("2d").drawImage(source, 0, 0);
  after.getContext("2d").drawImage(source, 0, 0);

  setDownloadEnabled(false);
  render();

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

function scheduleAiRegeneration() {
  if (!state.sourceImageDataUrl) return;

  clearTimeout(state.regenTimer);
  setStatus("Cambio de zonas pendiente…");

  state.regenTimer = setTimeout(() => {
    generateAiBestVersion();
  }, 1200);
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
  setStatus("IA analizando rostro y generando Best Version…");

  const live = $("#prpAiLive");
  if (live) live.textContent = "Generando Best Version con IA…";

  try {
    const response = await fetch("/api/harmonize", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        imageDataUrl: state.sourceImageDataUrl,
        zones: selectedZonesForApi()
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);

    if (requestNumber !== state.generationSeq) return;

    if (!response.ok || !data?.ok || !data?.imageDataUrl) {
      const msg = data?.error || `Error ${response.status}`;
      throw new Error(msg);
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

    render();
    setDownloadEnabled(true);

    if (live) {
      live.textContent = "Best Version lista · intensidad en vivo sin nuevas generaciones";
      live.classList.remove("prp-ai-error");
    }

    setStatus("Simulación IA lista · mové la intensidad.");
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

    alert(
      "No pudimos generar la armonización con IA.\n\n" +
      (err?.message || "Error desconocido")
    );
  } finally {
    if (state.currentRequest === controller) {
      state.currentRequest = null;
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

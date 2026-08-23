(() => {
"use strict";
console.info("PRP simulator build V22-formspree-report");

const $ = s => document.querySelector(s);
const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MEDIAPIPE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let faceLandmarker = null;
let faceLandmarkerPromise = null;

const PROFILE_CONFIG = {
  best: {
    label: "Mejor versión",
    title: "Mejor versión",
    shortStatus: "Mejor versión",
    recommendation: "La simulación busca la versión más atractiva, joven, refinada y armónica del mismo rostro, con cambios visibles pero realistas: mirada más descansada y sutilmente elevada, menos arrugas, mejor soporte del tercio medio, labios más hidratados y definidos, nariz armonizada solo si beneficia las proporciones y un contorno inferior más limpio y elegante.",
    note: "Simulación orientativa basada en una fotografía frontal y métricas geométricas. Se preserva la identidad y se prioriza una armonización Full Face visible, rejuvenecida y realista.",
    planScale: 1.08,
    blendCap: 0.94,
    liveReady: "Simulación Mejor versión lista · ajustá la intensidad"
  }
};

const state = {
  sourceCanvas: null,
  aiCanvas: null,
  sourceImageDataUrl: null,
  apiImageDataUrl: null,
  aiReady: false,
  intensity: 70,
  fullFace: true,
  profile: "best",
  generationSeq: 0,
  currentRequest: null,
  faceAnalysis: null,
  plan: {
    priorities: [],
    juvederm: [],
    botox: [],
    sculptra: [],
    radiesse: [],
    threads: [],
    totalJuvederm: ""
  }
};

init();

function init() {
  injectStyles();
  bindUpload();
  buildControls();
  setupStrength();
  setupCompare();
  setupDownload();
  hideLegacyGenerate();
  setStatus("Listo · subí una selfie.");
}

function injectStyles() {
  if ($("#prpV16Style")) return;
  const style = document.createElement("style");
  style.id = "prpV16Style";
  style.textContent = `
    .pill-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
    .pill-btn{appearance:none;border:1px solid #d8d0c5;background:#fff;border-radius:999px;padding:12px 18px;font:inherit;font-size:15px;color:#3879eb;cursor:pointer;transition:.18s ease}
    .pill-btn.active,.pill-btn:disabled{background:#203a2f;color:#fff;border-color:#203a2f}
    .mode-block{margin:0 0 14px}
    .prp-ai-live{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;margin:10px 0 8px;background:#edf4ef;color:#294b3d;font-weight:700;font-size:13px}
    .prp-ai-live::before{content:"";width:8px;height:8px;border-radius:50%;background:#4e9a72}
    .prp-ai-note{margin:10px 0 14px;padding:12px 14px;border:1px solid #e4ddd3;background:#fffdfa;border-radius:16px;font-size:13px;line-height:1.45;color:#6d665f}
    .prp-update-simulation{width:100%;min-height:48px;margin:0 0 14px;border:0;border-radius:999px;background:#203a2f;color:#fff;font-weight:750;font-size:15px;cursor:pointer}
    .prp-update-simulation[disabled]{opacity:.45;cursor:not-allowed}
    .prp-download{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:999px;border:0;background:#203a2f;color:#fff;font-weight:700;cursor:pointer}
    .prp-download[disabled]{opacity:.45;cursor:not-allowed}
    .prp-ai-error{color:#9a2d28;font-weight:600}
    .prp-treatment-panel{margin:16px 0 0;padding:16px;border:1px solid #e4ddd3;border-radius:18px;background:#fffdfa;color:#2e2b28;line-height:1.45}
    .prp-treatment-panel h3{margin:0 0 12px;font-size:18px}
    .prp-treatment-group{margin:0 0 14px}
    .prp-treatment-group:last-of-type{margin-bottom:8px}
    .prp-treatment-group strong{display:block;margin-bottom:6px;font-size:13px;letter-spacing:.04em}
    .prp-treatment-group ul{margin:0 0 0 18px;padding:0}
    .prp-treatment-group li{margin:6px 0}
    .prp-treatment-disclaimer{margin-top:12px;font-size:12px;color:#6d665f}
    .strength-row{display:flex;align-items:center;gap:12px;margin:14px 0 10px;flex-wrap:wrap}
    .strength-row input[type="range"]{flex:1;min-width:140px}
    .strength-row strong{font-size:15px}
    .recommendation-box{margin-top:10px}
    #generateBtn{display:none!important}
    .prp-lead-overlay{position:fixed;inset:0;z-index:9999;background:rgba(18,24,21,.62);display:flex;align-items:center;justify-content:center;padding:18px}
    .prp-lead-overlay.hidden{display:none}
    .prp-lead-modal{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
    .prp-lead-modal h3{margin:0 0 8px;font-size:22px}
    .prp-lead-modal p{margin:0 0 16px;color:#6d665f;line-height:1.45}
    .prp-lead-field{display:block;margin:12px 0}
    .prp-lead-field span{display:block;font-weight:700;font-size:13px;margin-bottom:6px}
    .prp-lead-field input{width:100%;box-sizing:border-box;border:1px solid #d8d0c5;border-radius:14px;padding:13px 14px;font:inherit;background:#fff}
    .prp-consent{display:flex;gap:10px;align-items:flex-start;margin:14px 0;font-size:12px;line-height:1.4;color:#625b55}
    .prp-consent input{margin-top:3px}
    .prp-lead-actions{display:flex;gap:10px;margin-top:16px}
    .prp-lead-actions button{flex:1;min-height:46px;border-radius:999px;font:inherit;font-weight:750;cursor:pointer}
    .prp-lead-cancel{background:#fff;border:1px solid #d8d0c5;color:#3e3935}
    .prp-lead-submit{background:#203a2f;border:1px solid #203a2f;color:#fff}
    .prp-lead-submit:disabled{opacity:.55;cursor:not-allowed}
    .prp-lead-error{min-height:18px;margin-top:10px;color:#9a2d28;font-size:13px;font-weight:650}
  `;
  document.head.appendChild(style);
}

function buildControls() {
  const zoneList = $("#zoneList");
  if (zoneList) {
    zoneList.innerHTML = "";
    const full = document.createElement("button");
    full.type = "button";
    full.id = "fullFaceBtn";
    full.className = "pill-btn active";
    full.textContent = "Full Face ✓";
    full.disabled = true;
    zoneList.appendChild(full);
  }

  const profileBlock = $("#zoneList")?.closest('.mode-block');
  if (profileBlock && !$("#prpAiLive")) {
    const live = document.createElement("div");
    live.id = "prpAiLive";
    live.className = "prp-ai-live";
    live.textContent = "Simulación Full Face personalizada";
    profileBlock.insertAdjacentElement("afterend", live);

    const note = document.createElement("div");
    note.id = "prpAiNote";
    note.className = "prp-ai-note";
    note.textContent = PROFILE_CONFIG.best.note;
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

  updateProfileTexts();
}


function updateProfileTexts() {
  const cfg = PROFILE_CONFIG.best;
  const title = $("#proposalTitle");
  const rec = $("#aiRecommendation");
  const note = $("#prpAiNote");
  const live = $("#prpAiLive");
  if (title) title.textContent = cfg.title;
  if (rec) rec.textContent = cfg.recommendation;
  if (note) note.textContent = cfg.note;
  if (live && !state.aiReady) live.textContent = "Simulación Full Face · Mejor versión";
}

function hideLegacyGenerate() {
  const b = $("#generateBtn");
  if (b) b.style.display = "none";
}

function bindUpload() {
  const fileInput = $("#fileInput");
  const cameraInput = $("#cameraInput");

  const openPicker = input => {
    if (!input) return;
    input.value = "";
    input.click();
  };

  $("#choosePhotoBtn")?.addEventListener("click", () => openPicker(fileInput));
  $("#takePhotoBtn")?.addEventListener("click", () => openPicker(cameraInput || fileInput));
  $("#changePhotoBtn")?.addEventListener("click", () => openPicker(fileInput));

  [fileInput, cameraInput].filter(Boolean).forEach(input => {
    input.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type && !file.type.startsWith("image/")) {
        alert("Elegí una foto válida.");
        input.value = "";
        return;
      }
      try {
        setStatus("Preparando selfie…");
        const img = await fileToImage(file);
        await startImage(img);
      } catch (err) {
        console.error("Photo upload failed:", err);
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
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image decode failed")); };
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

  // DISPLAY / OUTPUT resolution: what the user actually sees on screen and
  // what we ask Flux to generate at. 900px keeps things sharp on modern
  // phone screens (device pixel ratio 2-3x) without ballooning file size.
  const displayMaxSide = 720;
  const dScale = Math.min(1, displayMaxSide / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * dScale));
  const h = Math.max(1, Math.round(ih * dScale));

  // REFERENCE image sent to the model as input_image_0: Cloudflare requires
  // this to be smaller than 512x512, so it's kept separate and smaller than
  // the display canvas above — this does NOT limit the output resolution.
  const apiMaxSide = 480;
  const aScale = Math.min(1, apiMaxSide / Math.max(iw, ih));
  const aw = Math.max(1, Math.round(iw * aScale));
  const ah = Math.max(1, Math.round(ih * aScale));

  before.width = after.width = w;
  before.height = after.height = h;
  const compare = $("#compare");
  if (compare) compare.style.aspectRatio = `${w}/${h}`;

  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const sctx = source.getContext("2d", { alpha: false });
  sctx.drawImage(img, 0, 0, w, h);

  const apiCanvas = document.createElement("canvas");
  apiCanvas.width = aw;
  apiCanvas.height = ah;
  apiCanvas.getContext("2d", { alpha: false }).drawImage(img, 0, 0, aw, ah);

  state.sourceCanvas = source;
  state.sourceImageDataUrl = source.toDataURL("image/jpeg", 0.92);
  state.apiImageDataUrl = apiCanvas.toDataURL("image/jpeg", 0.92);
  state.aiCanvas = null;
  state.aiReady = false;
  state.faceAnalysis = null;
  $("#prpTreatmentPanel")?.remove();

  before.getContext("2d").drawImage(source, 0, 0);
  after.getContext("2d").drawImage(source, 0, 0);
  render();
  setDownloadEnabled(false);

  try {
    setStatus("Analizando el rostro…");
    state.faceAnalysis = await analyzeFaceGeometry(source);
  } catch (scanError) {
    console.error("Face scan failed:", scanError);
    setStatus("No pudimos completar el análisis facial.");
    alert(scanError?.message || "No pudimos analizar esta foto.");
    return;
  }

  await generateAiBestVersion();
}

function setupStrength() {
  const slider = $("#strength");
  const label = $("#strengthText");
  if (!slider) return;

  slider.value = String(state.intensity);

  const updateLabel = () => {
    if (!label) return;
    const n = state.intensity;
    const name = n < 25 ? "Muy sutil" : n < 55 ? "Sutil" : n < 80 ? "Balanceado" : "Definido";
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
  btn.textContent = "Descargar informe completo";
  btn.addEventListener("click", openLeadModal);
  actions.appendChild(btn);
  ensureLeadModal();
}

const FORMSPREE_ENDPOINT = "https://formspree.io/f/maewkrvr";

function ensureLeadModal() {
  if ($("#prpLeadOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "prpLeadOverlay";
  overlay.className = "prp-lead-overlay hidden";
  overlay.innerHTML = `
    <div class="prp-lead-modal" role="dialog" aria-modal="true" aria-labelledby="prpLeadTitle">
      <h3 id="prpLeadTitle">Recibí tu informe Full Face</h3>
      <p>Completá tus datos para guardar tu propuesta y descargar el informe completo.</p>
      <form id="prpLeadForm">
        <label class="prp-lead-field"><span>Nombre y apellido *</span><input name="name" autocomplete="name" required maxlength="120"></label>
        <label class="prp-lead-field"><span>WhatsApp / teléfono *</span><input name="phone" autocomplete="tel" inputmode="tel" required maxlength="60"></label>
        <label class="prp-lead-field"><span>Email *</span><input name="email" type="email" autocomplete="email" required maxlength="160"></label>
        <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
        <label class="prp-consent"><input name="consent" type="checkbox" required><span>Acepto recibir mi simulación orientativa y ser contactado por PRP respecto de una consulta. Entiendo que la simulación no reemplaza una evaluación clínica presencial.</span></label>
        <div class="prp-lead-actions"><button type="button" class="prp-lead-cancel">Cancelar</button><button type="submit" class="prp-lead-submit">Guardar y descargar PDF</button></div>
        <div id="prpLeadError" class="prp-lead-error" aria-live="polite"></div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".prp-lead-cancel").addEventListener("click", closeLeadModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeLeadModal(); });
  overlay.querySelector("#prpLeadForm").addEventListener("submit", submitLeadAndDownload);
}

function openLeadModal() {
  if (!state.aiReady) return;
  ensureLeadModal();
  $("#prpLeadError").textContent = "";
  $("#prpLeadOverlay").classList.remove("hidden");
  setTimeout(() => $("#prpLeadForm input[name='name']")?.focus(), 50);
}
function closeLeadModal() { $("#prpLeadOverlay")?.classList.add("hidden"); }

async function submitLeadAndDownload(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector(".prp-lead-submit");
  const error = $("#prpLeadError");
  if (!form.reportValidity()) return;
  const fd = new FormData(form);
  if (fd.get("website")) return;
  const patient = { name: String(fd.get("name")||"").trim(), phone: String(fd.get("phone")||"").trim(), email: String(fd.get("email")||"").trim() };
  submit.disabled = true;
  submit.textContent = "Guardando…";
  error.textContent = "";
  try {
    const payload = {
      name: patient.name,
      whatsapp: patient.phone,
      email: patient.email,
      consent: "Sí",
      source: "PRP Facial Simulator",
      simulation: "Full Face · Mejor versión",
      juvederm_estimate: state.plan.totalJuvederm || "A definir",
      treatments: buildLeadSummary(),
      _subject: `Nueva simulación PRP · ${patient.name}`
    };
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(()=>null);
      throw new Error(data?.errors?.[0]?.message || "No pudimos guardar tus datos.");
    }
    submit.textContent = "Creando PDF…";
    await generateFullReportPdf(patient);
    closeLeadModal();
    form.reset();
  } catch (err) {
    console.error("Lead/PDF error", err);
    error.textContent = err?.message || "No pudimos completar la descarga. Intentá nuevamente.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Guardar y descargar PDF";
  }
}

function buildLeadSummary() {
  const parts = [];
  if (state.plan.juvederm?.length) parts.push("Juvéderm: " + state.plan.juvederm.map(x => `${x.area} (${x.amount})`).join("; "));
  if (state.plan.botox?.length) parts.push("Botox: " + state.plan.botox.map(x => x.area).join(", "));
  if (state.plan.sculptra?.length) parts.push("Sculptra: " + state.plan.sculptra.map(x => x.area).join(", "));
  if (state.plan.radiesse?.length) parts.push("Radiesse: " + state.plan.radiesse.map(x => x.area).join(", "));
  if (state.plan.threads?.length) parts.push("Hilos: " + state.plan.threads.map(x => x.area).join(", "));
  return parts.join(" | ").slice(0, 4500);
}

function canvasToJpeg(canvas, quality=.9) { return canvas.toDataURL("image/jpeg", quality); }
function splitPdfText(doc, text, width) { return doc.splitTextToSize(String(text || ""), width); }

async function generateFullReportPdf(patient) {
  if (!window.jspdf?.jsPDF) throw new Error("No se pudo cargar el generador de PDF. Recargá la página e intentá nuevamente.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210, margin = 16, contentW = pageW - margin*2;
  let y = 18;
  const addPageIfNeeded = (need=18) => { if (y + need > 280) { doc.addPage(); y = 18; } };
  const heading = (t) => { addPageIfNeeded(14); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text(t, margin, y); y += 7; };
  const paragraph = (t, size=9) => { doc.setFont("helvetica","normal"); doc.setFontSize(size); const lines=splitPdfText(doc,t,contentW); addPageIfNeeded(lines.length*4.3+4); doc.text(lines,margin,y); y += lines.length*4.3+4; };
  const bullets = (items, formatter=x=>x) => { for (const item of items||[]) { const txt="• "+formatter(item); const lines=splitPdfText(doc,txt,contentW-2); addPageIfNeeded(lines.length*4.1+2); doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.text(lines,margin+2,y); y += lines.length*4.1+2; } };

  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text("PRP · Dra. Patricia Romero Pfaff", margin, y); y += 7;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text("Propuesta Full Face · Mejor versión", margin, y); y += 6;
  doc.setFontSize(8.5); doc.text(`Paciente: ${patient.name}`, margin, y); y += 4.5; doc.text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, margin, y); y += 8;

  const beforeData = canvasToJpeg(state.sourceCanvas, .9);
  const afterData = canvasToJpeg(state.aiCanvas || $("#afterCanvas"), .9);
  const gap=5, imgW=(contentW-gap)/2, imgH=imgW*(state.sourceCanvas.height/state.sourceCanvas.width);
  const maxH=92, scale=Math.min(1,maxH/imgH), finalW=imgW*scale, finalH=imgH*scale;
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("ANTES",margin,y); doc.text("MEJOR VERSIÓN",margin+imgW+gap,y); y+=4;
  doc.addImage(beforeData,"JPEG",margin,y,finalW,finalH,undefined,"FAST");
  doc.addImage(afterData,"JPEG",margin+imgW+gap,y,finalW,finalH,undefined,"FAST"); y+=finalH+9;

  heading("Objetivo visual"); paragraph(PROFILE_CONFIG.best.recommendation, 9);
  heading("JUVÉDERM · Ácido hialurónico");
  paragraph(`Volumen estimado para esta simulación: ${state.plan.totalJuvederm || "A definir"}`, 9);
  bullets(state.plan.juvederm, i => `${i.area}: ${i.amount}. ${i.rationale}${i.mdCodes?.length ? " · MD Codes de referencia: "+i.mdCodes.join(", ") : ""}`);
  heading("BOTOX COSMETIC · ALLERGAN"); bullets(state.plan.botox, i => `${i.area}: ${i.recommendation}`);
  heading("SCULPTRA"); bullets(state.plan.sculptra, i => `${i.area}: ${i.recommendation}`);
  heading("RADIESSE"); bullets(state.plan.radiesse, i => `${i.area}: ${i.recommendation}`);
  heading("HILOS TENSORES"); bullets(state.plan.threads, i => `${i.area}: ${i.recommendation}`);
  heading("Prioridades"); bullets(state.plan.priorities, i => i);
  heading("Importante");
  paragraph("Simulación orientativa basada en una fotografía frontal y métricas geométricas. No prescribe dosis, unidades, producto, profundidad, técnica ni puntos de inyección. Los MD Codes mostrados son referencias anatómicas orientativas para la planificación visual. La indicación y cantidad definitiva requieren evaluación clínica presencial.", 8);
  paragraph("PRP · Dra. Patricia Romero Pfaff · Bernardo O'Higgins 5435, Córdoba, Argentina · WhatsApp +54 9 3512 64-1380", 8);
  const safeName = patient.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase() || "paciente";
  doc.save(`PRP-Propuesta-Full-Face-${safeName}.pdf`);
}

function setDownloadEnabled(enabled) {
  const btn = $("#prpDownloadBtn");
  if (btn) btn.disabled = !enabled;
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
    live.textContent = `Mejor versión seleccionada · actualizá la simulación`;
    live.classList.remove("prp-ai-error");
  }
  setStatus("Actualizá la simulación cuando quieras regenerar la propuesta.");
}

async function getFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

  faceLandmarkerPromise = (async () => {
    let vision;
    let lastImportError;
    const moduleUrls = [
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`,
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs"
    ];
    for (const url of moduleUrls) {
      try {
        vision = await import(url);
        if (vision?.FilesetResolver && vision?.FaceLandmarker) break;
      } catch (err) {
        lastImportError = err;
      }
    }
    if (!vision?.FilesetResolver || !vision?.FaceLandmarker) {
      throw new Error("No se pudo cargar el análisis facial en este navegador.");
    }
    const { FilesetResolver, FaceLandmarker } = vision;
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    try {
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5
      });
    } catch {
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL, delegate: "CPU" },
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

function dist(a, b) { return (!a || !b) ? 0 : Math.hypot((a.x - b.x), (a.y - b.y)); }
function safeRatio(a, b) { return b > 0 ? a / b : 0; }

async function analyzeFaceGeometry(canvas) {
  const detector = await getFaceLandmarker();
  const result = detector.detect(canvas);
  const faces = result?.faceLandmarks || [];
  if (faces.length !== 1) {
    throw new Error(faces.length === 0 ? "No detectamos un rostro frontal con suficiente claridad." : "La foto debe contener una sola persona.");
  }
  const lm = faces[0];
  if (lm.length < 468) throw new Error("El análisis facial quedó incompleto.");

  const top = lm[10], chin = lm[152], leftCheek = lm[234], rightCheek = lm[454], noseTip = lm[1], noseBase = lm[2],
        leftEyeOuter = lm[33], rightEyeOuter = lm[263], leftEyeInner = lm[133], rightEyeInner = lm[362],
        leftMouth = lm[61], rightMouth = lm[291], jawLeft = lm[172], jawRight = lm[397];

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
  const transverseAsymmetry = Math.abs(leftNoseCheek - rightNoseCheek) / Math.max(leftNoseCheek + rightNoseCheek, 0.0001);

  const blendshapeCategories = result?.faceBlendshapes?.[0]?.categories || [];
  const blendshapes = {};
  for (const item of blendshapeCategories) if (item?.categoryName) blendshapes[item.categoryName] = item.score;
  const expressionActivity = Math.max(blendshapes.mouthSmileLeft || 0, blendshapes.mouthSmileRight || 0, blendshapes.jawOpen || 0, blendshapes.browInnerUp || 0, blendshapes.eyeSquintLeft || 0, blendshapes.eyeSquintRight || 0);

  return {
    landmarkCount: lm.length,
    metrics: {
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
    }
  };
}

function formatRange(min, max) {
  return `${min.toFixed(1)}–${max.toFixed(1)} mL total`;
}

function buildSuggestedPlan() {
  const m = state.faceAnalysis?.metrics || {};
  const scale = PROFILE_CONFIG.best?.planScale || 1;
  const priorities = [];
  const juvederm = [];
  const botox = [];
  const sculptra = [];
  const radiesse = [];
  const threads = [];

  const addJuvederm = (area, min, max, rationale, mdCodes, mdNote) => {
    const scaledMin = +(min * scale).toFixed(1);
    const scaledMax = +(max * scale).toFixed(1);
    juvederm.push({ area, min: scaledMin, max: scaledMax, amount: formatRange(scaledMin, scaledMax), rationale, mdCodes, mdNote });
  };

  addJuvederm(
    "Tercio medio / pómulos",
    0.8, 1.6,
    "Mejorar soporte y transición del tercio medio de forma armónica.",
    ["Ck1 · arco cigomático", "Ck2 · eminencia cigomática", "Ck3 · mejilla anteromedial", "Ck4 · mejilla lateral inferior"],
    "Referencia Foundation: valorar soporte antes de refinamientos aislados."
  );
  priorities.push("Prioridad 1 · Soporte del tercio medio antes de refinamientos aislados.");
  if (state.profile === "best") priorities.push("Prioridad 2 · Suavizar mirada cansada, mejorar labios y abrir la mirada de forma armónica.");

  addJuvederm(
    "Ojeras / transición párpado-mejilla",
    0.5, 1.1,
    "Suavizar la transición infraorbitaria y la apariencia cansada sin borrar por completo la anatomía natural.",
    ["Tt1 · infraorbital central", "Tt2 · infraorbital lateral", "Tt3 · infraorbital medial"],
    "Referencia Refinement: considerar luego de valorar primero el soporte del tercio medio."
  );

  addJuvederm(
    "Labios · hidratación / volumen",
    0.5, 0.9,
    "Aportar hidratación, definición y volumen suave, preservando proporción y naturalidad.",
    ["Lp1 · labio superior", "Lp2 · labio inferior", "Lp3 · contorno / arco de Cupido"],
    "Buscar un efecto de labios más frescos y armónicos, sin proyección exagerada."
  );

  {
    addJuvederm(
      "Sienes / soporte temporal",
      0.4, 1.0,
      "Valorar restauración temporal si ayuda a la continuidad del contorno facial y a una mirada más descansada.",
      ["T1 · sien anterior", "T2 · sien posterior"],
      "Puede contribuir a una mirada más abierta cuando está clínicamente indicado."
    );
  }

  if ((m.lowerThirdToFaceHeight || 0) < 0.34) {
    addJuvederm(
      "Mentón",
      0.5, 1.0,
      "Mejorar suavemente el balance del tercio inferior.",
      ["C1 · región labiomental", "C2 · ápice del mentón", "C6 · mentón lateral / transición pre-jowl"],
      "A confirmar presencialmente según la proporción frontal real."
    );
    priorities.push("Prioridad 2 · Valorar proyección/longitud del mentón.");
  } else {
    priorities.push("Sin tratamiento automático · Mentón: conservar si el tercio inferior ya está equilibrado.");
  }

  if ((m.jawToFaceWidth || 0) < 0.74 || (m.transverseAsymmetry || 0) > 0.08 ) {
    addJuvederm(
      "Pre-jowl / continuidad mandibular",
      0.5, 1.4,
      "Mejorar continuidad sin crear una mandíbula artificialmente marcada.",
      ["Jw4 · pre-jowl inferior", "Jw5 · mentón anterior inferior", "Jw1 · ángulo mandibular, solo si está indicado"],
      "Usar solo si mejora el equilibrio global del tercio inferior."
    );
    priorities.push("Prioridad 2 · Valorar continuidad mandibular / pre-jowl.");
  } else {
    priorities.push("Sin tratamiento automático · Mandíbula: conservar si el ancho facial ya está equilibrado.");
  }

  botox.push({ area: "Glabella", recommendation: "Valorar suavizado de líneas de expresión si hay actividad muscular visible." });
  botox.push({ area: "Frente", recommendation: "Valorar suavizado conservador para una apariencia más descansada y joven, sin rigidez." });
  botox.push({ area: "Lateral orbital / patas de gallo", recommendation: "Valorar para suavizar arrugas perioculares y refrescar la mirada." });
  botox.push({ area: "Cola de ceja / brow tail", recommendation: "Valorar elevación sutil de cola de ceja para una mirada más abierta, almendrada y armónica." });
  if ((m.jawToFaceWidth || 0) > 0.88) botox.push({ area: "Maseteros", recommendation: "Considerar solo si la evaluación dinámica confirma predominio muscular." });

  sculptra.push({ area: "Soporte global / bioestimulación", recommendation: "Considerar si en consulta se confirma necesidad de bioestimulación y pérdida global de soporte." });
  radiesse.push({ area: "Tercio inferior / contorno", recommendation: "Considerar si se necesita soporte estructural adicional del contorno inferior." });
  threads.push({ area: "Hilos tensores / efecto lifting", recommendation: "Valorar elevación sutil de cola de ceja, tercio medio y contorno mandibular si la profesional considera que mejora la armonía sin exageración." });

  const totalMin = juvederm.reduce((sum, item) => sum + item.min, 0);
  const totalMax = juvederm.reduce((sum, item) => sum + item.max, 0);
  state.plan = {
    priorities,
    juvederm,
    botox,
    sculptra,
    radiesse,
    threads,
    totalJuvederm: `${totalMin.toFixed(1)}–${totalMax.toFixed(1)} mL total`
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

  const listOrNone = (items, formatter) => items?.length ? items.map(formatter).join("") : "<li>No indicado en esta simulación</li>";
  const priorityHtml = listOrNone(state.plan.priorities, item => `<li>${escapeHtml(item)}</li>`);
  const juvedermHtml = listOrNone(state.plan.juvederm, i => {
    const codes = Array.isArray(i.mdCodes) && i.mdCodes.length
      ? `<div style="margin-top:8px;padding:9px 11px;border-radius:10px;background:#f7f4ef">
           <strong style="display:block;margin-bottom:4px;font-size:13px">MD Codes de referencia</strong>
           ${i.mdCodes.map(code => `<div style="font-size:13px;line-height:1.45">${escapeHtml(code)}</div>`).join("")}
           ${i.mdNote ? `<div style="margin-top:5px;font-size:12px;color:#77706a">${escapeHtml(i.mdNote)}</div>` : ""}
         </div>`
      : "";
    return `<li><strong>${escapeHtml(i.area)}:</strong> ${escapeHtml(i.amount)}<br><span style="color:#6d665f">${escapeHtml(i.rationale)}</span>${codes}</li>`;
  });
  const botoxHtml = listOrNone(state.plan.botox, i => `<li><strong>${escapeHtml(i.area)}:</strong> ${escapeHtml(i.recommendation)}</li>`);
  const sculptraHtml = listOrNone(state.plan.sculptra, i => `<li><strong>${escapeHtml(i.area)}:</strong> ${escapeHtml(i.recommendation)}</li>`);
  const radiesseHtml = listOrNone(state.plan.radiesse, i => `<li><strong>${escapeHtml(i.area)}:</strong> ${escapeHtml(i.recommendation)}</li>`);
  const threadsHtml = listOrNone(state.plan.threads, i => `<li><strong>${escapeHtml(i.area)}:</strong> ${escapeHtml(i.recommendation)}</li>`);

  panel.innerHTML = `
    <h3>Tu propuesta Full Face</h3>

    <div style="margin:0 0 16px;padding:12px 14px;border-radius:14px;background:#f7f4ef;color:#5e5751">${escapeHtml(PROFILE_CONFIG.best.recommendation)}</div>

    <div style="margin:0 0 16px;padding:14px;border-radius:14px;background:#f4f8f5">
      <strong style="display:block;margin-bottom:4px">JUVÉDERM · volumen estimado para esta simulación</strong>
      <span style="font-size:22px;font-weight:700">${escapeHtml(state.plan.totalJuvederm || "A definir")}</span>
      <small style="display:block;margin-top:5px;color:#6d665f">Rango visual orientativo calculado para las áreas sugeridas en esta fotografía.</small>
    </div>

    <div class="prp-treatment-group">
      <strong>PRIORIDADES</strong>
      <ul>${priorityHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>JUVÉDERM · ÁCIDO HIALURÓNICO</strong>
      <ul>${juvedermHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>BOTOX COSMETIC · ALLERGAN</strong>
      <ul>${botoxHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>SCULPTRA</strong>
      <ul>${sculptraHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>RADIESSE</strong>
      <ul>${radiesseHtml}</ul>
    </div>

    <div class="prp-treatment-group">
      <strong>HILOS TENSORES</strong>
      <ul>${threadsHtml}</ul>
    </div>

    <div class="prp-treatment-disclaimer">
      Simulación orientativa basada en una fotografía frontal y métricas geométricas.<br>
      No prescribe dosis, unidades, producto, profundidad, técnica ni puntos de inyección.<br>
      Los MD Codes mostrados son referencias anatómicas orientativas para la planificación visual.<br>
      La indicación y cantidad definitiva requieren evaluación clínica presencial.
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[ch]));
}

async function generateAiBestVersion() {
  if (!state.sourceImageDataUrl) return;
  const requestNumber = ++state.generationSeq;
  if (state.currentRequest) { try { state.currentRequest.abort(); } catch {} }
  const controller = new AbortController();
  state.currentRequest = controller;
  state.aiReady = false;
  setDownloadEnabled(false);

  const updateBtn = $("#prpUpdateSimulationBtn");
  if (updateBtn) { updateBtn.disabled = true; updateBtn.textContent = "Generando…"; }
  const live = $("#prpAiLive");
  if (live) { live.textContent = `Generando ${PROFILE_CONFIG.best.shortStatus}…`; live.classList.remove("prp-ai-error"); }
  setStatus(`Generando ${PROFILE_CONFIG.best.shortStatus}…`);

  try {
    const response = await fetch("/api/harmonize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: state.apiImageDataUrl || state.sourceImageDataUrl,
        zones: ["full"],
        width: state.sourceCanvas.width,
        height: state.sourceCanvas.height,
        analysis: state.faceAnalysis,
        profile: "best"
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    if (requestNumber !== state.generationSeq) return;
    if (!response.ok || !data?.ok || !data?.imageDataUrl) throw new Error(data?.error || `Error ${response.status}`);

    const aiImg = await loadDataUrlImage(data.imageDataUrl);
    if (requestNumber !== state.generationSeq) return;

    const aiCanvas = document.createElement("canvas");
    aiCanvas.width = state.sourceCanvas.width;
    aiCanvas.height = state.sourceCanvas.height;
    aiCanvas.getContext("2d", { alpha: false }).drawImage(aiImg, 0, 0, aiCanvas.width, aiCanvas.height);

    state.aiCanvas = aiCanvas;
    state.aiReady = true;
    buildSuggestedPlan();
    renderTreatmentPanel();
    render();
    setDownloadEnabled(true);
    if (live) live.textContent = PROFILE_CONFIG.best.liveReady;
    setStatus("Simulación lista · ajustá la intensidad.");
    if (updateBtn) { updateBtn.disabled = true; updateBtn.textContent = "Simulación actualizada"; }
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.error("AI harmonization failed:", err);
    state.aiReady = false;
    state.aiCanvas = null;
    render();
    if (live) { live.textContent = "No pudimos generar la simulación"; live.classList.add("prp-ai-error"); }
    setStatus("No pudimos generar la simulación. Reintentá.");
    alert("No pudimos generar la simulación en este momento. Probá nuevamente.");
  } finally {
    if (state.currentRequest === controller) state.currentRequest = null;
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
    img.onerror = () => reject(new Error("No se pudo abrir la imagen generada."));
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
    const blendCap = PROFILE_CONFIG.best?.blendCap ?? 1;
    const amount = clamp((state.intensity / 100) * blendCap, 0, 1);
    actx.save();
    actx.globalAlpha = amount;
    actx.drawImage(state.aiCanvas, 0, 0, after.width, after.height);
    actx.restore();
  }
}

function setStatus(text) {
  const n = $("#simStatus");
  if (n) n.textContent = text;
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); }
})();

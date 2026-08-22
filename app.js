(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const AREA_LABELS = {
    undereye: "Ojeras",
    midface: "Soporte tercio medio",
    cheeks: "Pómulos",
    lips: "Labios",
    chin: "Mentón",
    jawline: "Mandíbula",
    wrinkles: "Arrugas"
  };

  const AREA_ORDER = ["undereye","midface","cheeks","lips","chin","jawline","wrinkles"];

  const state = {
    img: null,
    intensity: 35,
    fullFace: true,
    areas: new Set(),
    analysis: null,
    landmarks: null,
    detector: null,
    detectorReady: false,
    sourceCanvas: document.createElement("canvas"),
    sourceData: null,
    blur1Data: null,
    blur2Data: null,
    raf: 0
  };

  init();

  async function init() {
    removeEntityMedCopy();
    watchEntityMedCopy();
    injectStyles();
    buildControls();
    setupStrength();
    setupCompare();
    bindUploads();
    hideOldGenerateButton();
    setStatus("Preparando escaneo facial…");
    await initDetector();
    setStatus(state.detectorReady ? "Escáner facial listo · subí una selfie." : "Modo compatible listo · subí una selfie.");
  }

  /* -------------------- COPY CLEANUP -------------------- */
  function removeEntityMedCopy(root = document.body) {
    if (!root) return;
    const exact = /No\s+se\s+env[ií]a\s+a\s+EntityMed\.?/gi;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const original = node.nodeValue || "";
      exact.lastIndex = 0;
      if (!exact.test(original)) continue;
      exact.lastIndex = 0;
      node.nodeValue = original.replace(exact, "").replace(/\s{2,}/g, " ").trim();
      const parent = node.parentElement;
      if (parent && !parent.textContent.trim() && !parent.querySelector("img,svg,button,input,a")) {
        parent.style.display = "none";
      }
    }
  }

  function watchEntityMedCopy() {
    if (!document.body || !window.MutationObserver) return;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) removeEntityMedCopy(node);
          if (node.nodeType === Node.TEXT_NODE && /EntityMed/i.test(node.nodeValue || "")) {
            removeEntityMedCopy(node.parentElement || document.body);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* -------------------- MEDIAPIPE -------------------- */
  async function initDetector() {
    try {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );
      state.detector = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
      state.detectorReady = true;
    } catch (err) {
      console.warn("Face Landmarker unavailable; fallback geometry will be used.", err);
      state.detectorReady = false;
    }
  }

  /* -------------------- UI -------------------- */
  function injectStyles() {
    if ($("#prp-v9-style")) return;
    const style = document.createElement("style");
    style.id = "prp-v9-style";
    style.textContent = `
      #generateBtn{display:none!important}
      .v9-plan{margin:14px 0;padding:14px;border:1px solid #e3dbd1;border-radius:18px;background:rgba(255,255,255,.55)}
      .v9-plan.hidden{display:none}
      .v9-plan h4{margin:0 0 8px;font-family:"Playfair Display",Georgia,serif;font-size:20px}
      .v9-plan p{margin:0 0 10px;color:#6f685f;line-height:1.42}
      .v9-row{display:grid;grid-template-columns:34px 1fr;gap:9px;padding:8px 0;border-top:1px solid #ece5dd;align-items:start}
      .v9-row:first-of-type{border-top:0}
      .v9-badge{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:13px}
      .v9-badge.a{background:#223a30;color:#fff}.v9-badge.b{background:#eadfca;color:#6a5737}.v9-badge.c{background:#eeeae5;color:#777}
      .v9-title{font-weight:700}.v9-copy{font-size:12px;color:#746d65;line-height:1.35;margin-top:2px}
      .v9-live{display:inline-flex;align-items:center;gap:7px;margin:9px 0;padding:7px 11px;border-radius:999px;background:#edf4ef;color:#294b3d;font-size:13px;font-weight:700}
      .v9-live:before{content:"";width:8px;height:8px;border-radius:50%;background:#4c8a6b}
      #zoneList button.active::after{content:"✓";margin-left:6px}
      .v9-percent{font-variant-numeric:tabular-nums;min-width:50px;display:inline-block}
    `;
    document.head.appendChild(style);
  }

  function buildControls() {
    const list = $("#zoneList");
    if (!list) return;
    list.innerHTML = "";

    const full = document.createElement("button");
    full.type = "button";
    full.id = "fullFaceBtn";
    full.className = "active";
    full.textContent = "Full Face — Best Version";
    full.onclick = () => {
      state.fullFace = !state.fullFace;
      full.classList.toggle("active", state.fullFace);
      if (state.fullFace && state.analysis) activateRecommendedAreas();
      renderAreaButtons();
      scheduleRender();
    };
    list.appendChild(full);

    for (const id of AREA_ORDER) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.zone = id;
      b.textContent = AREA_LABELS[id];
      b.onclick = () => {
        state.fullFace = false;
        full.classList.remove("active");
        state.areas.has(id) ? state.areas.delete(id) : state.areas.add(id);
        renderAreaButtons();
        scheduleRender();
      };
      list.appendChild(b);
    }

    const live = document.createElement("div");
    live.id = "v9Live";
    live.className = "v9-live";
    live.textContent = "Escaneo facial + vista en vivo";
    list.insertAdjacentElement("afterend", live);

    const plan = document.createElement("div");
    plan.id = "v9Plan";
    plan.className = "v9-plan hidden";
    live.insertAdjacentElement("afterend", plan);
  }

  function renderAreaButtons() {
    for (const id of AREA_ORDER) {
      const b = document.querySelector(`#zoneList button[data-zone="${id}"]`);
      if (b) b.classList.toggle("active", state.areas.has(id));
    }
  }

  function setupStrength() {
    const slider = $("#strength");
    const text = $("#strengthText");
    if (!slider) return;
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(state.intensity);

    const updateText = () => {
      const n = state.intensity;
      const label = n <= 20 ? "Sutil" : n <= 55 ? "Balanceado" : n <= 80 ? "Visible" : "Definido";
      if (text) text.innerHTML = `<span class="v9-percent">${n}%</span> ${label}`;
    };
    updateText();

    slider.addEventListener("input", () => {
      state.intensity = clamp(Number(slider.value), 0, 100);
      updateText();
      scheduleRender();
    });
  }

  function setupCompare() {
    const slider = $("#compareSlider");
    if (!slider) return;
    slider.addEventListener("input", () => {
      const v = clamp(Number(slider.value), 0, 100);
      if ($("#afterCanvas")) $("#afterCanvas").style.clipPath = `inset(0 0 0 ${v}%)`;
      if ($("#divider")) $("#divider").style.left = `${v}%`;
    });
  }

  function hideOldGenerateButton() {
    const btn = $("#generateBtn");
    if (btn) btn.style.display = "none";
  }

  function bindUploads() {
    [$("#fileInput"), $("#fileInput2")].filter(Boolean).forEach((input) => {
      input.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return alert("Elegí una imagen.");

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = async () => {
          try { await startImage(img); }
          finally { URL.revokeObjectURL(url); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); alert("No pudimos abrir esa foto."); };
        img.src = url;
      });
    });
  }

  /* -------------------- IMAGE SETUP -------------------- */
  async function startImage(img) {
    state.img = img;
    state.landmarks = null;
    state.analysis = null;

    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");

    const before = $("#beforeCanvas");
    const after = $("#afterCanvas");
    if (!before || !after) return alert("No encontramos el visor Antes/Después.");

    const maxSide = 720;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    [before, after, state.sourceCanvas].forEach(c => { c.width = w; c.height = h; });
    if ($("#compare")) $("#compare").style.aspectRatio = `${w}/${h}`;

    const bctx = before.getContext("2d", {willReadFrequently:true});
    const actx = after.getContext("2d", {willReadFrequently:true});
    const sctx = state.sourceCanvas.getContext("2d", {willReadFrequently:true});

    bctx.drawImage(img, 0, 0, w, h);
    actx.drawImage(img, 0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);

    state.sourceData = sctx.getImageData(0,0,w,h);
    state.blur1Data = makeBlurData(state.sourceCanvas, 1.5);
    state.blur2Data = makeBlurData(state.sourceCanvas, 3.0);

    setStatus("Escaneando facciones y proporciones…");

    if (state.detectorReady && state.detector) {
      try {
        const result = state.detector.detect(state.sourceCanvas);
        if (result?.faceLandmarks?.[0]?.length > 400) {
          state.landmarks = result.faceLandmarks[0];
        }
      } catch (err) {
        console.warn("Detection failed; using fallback.", err);
      }
    }

    const geometry = getGeometry(w,h);
    state.analysis = analyzeFace(geometry, w, h);
    activateRecommendedAreas();
    renderAreaButtons();
    renderAnalysisPanel();
    scheduleRender();

    setStatus(state.landmarks ? "Escaneo completo · vista en vivo lista." : "Vista en vivo lista · ajuste compatible.");
  }

  function makeBlurData(canvas, radius) {
    const c = document.createElement("canvas");
    c.width = canvas.width; c.height = canvas.height;
    const ctx = c.getContext("2d", {willReadFrequently:true});
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(canvas,0,0);
    return ctx.getImageData(0,0,c.width,c.height);
  }

  /* -------------------- VISUAL ANALYSIS -------------------- */
  function analyzeFace(g, w, h) {
    const src = state.sourceData.data;
    const faceRatio = g.faceHeight / Math.max(1,g.faceWidth);
    const lipRatio = g.lipWidth / Math.max(1,g.faceWidth);
    const jawRatio = distance(g.leftJaw,g.rightJaw) / Math.max(1,g.faceWidth);

    const underEyeDark = (
      darknessDelta(src,w,h,g.leftEye,g.faceHeight) +
      darknessDelta(src,w,h,g.rightEye,g.faceHeight)
    ) / 2;

    const foreheadTexture = localTexture(src,w,h,g.forehead.x,g.forehead.y + g.faceHeight*.11,g.faceWidth*.24,g.faceHeight*.09);

    const lowerThird = distance(g.lips,g.chin) / Math.max(1,g.faceHeight);

    const areas = {
      undereye: scorePriority(underEyeDark, 5, 12, "Mejorar transición párpado–mejilla manteniendo color y textura natural."),
      wrinkles: scorePriority(foreheadTexture, 9, 18, "Suavizar líneas visibles sin borrar textura ni congelar la expresión."),
      lips: lipRatio < .19
        ? item("B","Optimizar proporción labial de forma conservadora, preservando anatomía y color.")
        : item("C","Conservar proporción y anatomía labial actual."),
      chin: lowerThird < .20 || lowerThird > .30
        ? item("B","Refinar balance del tercio inferior sin crear un mentón puntiagudo.")
        : item("C","Conservar balance actual del mentón."),
      jawline: jawRatio > .92
        ? item("B","Refinar continuidad mandibular de forma muy sutil.")
        : item("C","Conservar contorno mandibular actual."),
      midface: underEyeDark > 8
        ? item("A","Mejorar soporte visual del tercio medio y transición con ojeras.")
        : item("B","Refinamiento opcional del soporte del tercio medio."),
      cheeks: faceRatio > 1.42
        ? item("B","Aportar soporte visual muy sutil para mejorar la curva Ogee.")
        : item("C","Conservar proyección actual de pómulos.")
    };

    return {
      summary: "La propuesta Full Face prioriza el menor número de cambios con mayor impacto visual y conserva las zonas que ya están equilibradas.",
      areas
    };
  }

  function item(priority, objective){ return {priority,objective}; }

  function scorePriority(value,bCut,aCut,objective){
    return value >= aCut ? item("A",objective) : value >= bCut ? item("B",objective) : item("C","Conservar esta zona.");
  }

  function activateRecommendedAreas() {
    state.areas.clear();
    if (!state.analysis) return;
    for (const id of AREA_ORDER) {
      const p = state.analysis.areas[id]?.priority;
      if (p === "A" || p === "B") state.areas.add(id);
    }
  }

  function renderAnalysisPanel() {
    const panel = $("#v9Plan");
    if (!panel || !state.analysis) return;
    panel.classList.remove("hidden");

    const rows = AREA_ORDER.map(id => {
      const a = state.analysis.areas[id];
      const cls = a.priority.toLowerCase();
      return `<div class="v9-row">
        <span class="v9-badge ${cls}">${a.priority}</span>
        <div><div class="v9-title">${escapeHTML(AREA_LABELS[id])}</div>
        <div class="v9-copy">${escapeHTML(a.objective)}</div></div>
      </div>`;
    }).join("");

    panel.innerHTML = `
      <h4>Full Face — Best Version</h4>
      <p>${escapeHTML(state.analysis.summary)}</p>
      ${rows}
      <p style="margin-top:10px;font-size:12px">A = mayor impacto visual · B = refinamiento opcional · C = conservar. Simulación visual, no indicación clínica ni dosis.</p>
    `;
  }

  /* -------------------- REAL-TIME SIMULATION -------------------- */
  function scheduleRender() {
    if (!state.sourceData) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(renderPreview);
  }

  function renderPreview() {
    state.raf = 0;
    const after = $("#afterCanvas");
    if (!after || !state.sourceData) return;

    const w = after.width, h = after.height;
    const src = state.sourceData.data;
    const out = new Uint8ClampedArray(src);
    const amount = state.intensity / 100;
    const g = getGeometry(w,h);

    if (amount > .001) {
      // Structural changes first.
      if (state.areas.has("midface")) {
        liftCheek(src,out,w,h,g.leftCheek,g.faceWidth*.17,g.faceHeight*.14,amount*.045);
        liftCheek(src,out,w,h,g.rightCheek,g.faceWidth*.17,g.faceHeight*.14,amount*.045);
      }

      if (state.areas.has("cheeks")) {
        volumeZone(src,out,w,h,g.leftCheek,g.faceWidth*.19,g.faceHeight*.15,amount*.060,amount*.038);
        volumeZone(src,out,w,h,g.rightCheek,g.faceWidth*.19,g.faceHeight*.15,amount*.060,amount*.038);
      }

      if (state.areas.has("lips")) {
        volumeZone(src,out,w,h,g.lips,g.lipWidth*.66,g.faceHeight*.064,amount*.045,amount*.135);
      }

      if (state.areas.has("chin")) {
        shapeChin(src,out,w,h,g,amount);
      }

      if (state.areas.has("jawline")) {
        refineJaw(src,out,w,h,g,amount);
      }

      // Texture/transition changes use the already-warped image.
      if (state.areas.has("undereye")) {
        improveUnderEye(out,state.blur1Data.data,w,h,g.leftEye,g,amount);
        improveUnderEye(out,state.blur1Data.data,w,h,g.rightEye,g,amount);
      }

      if (state.areas.has("wrinkles")) {
        softenWrinkles(out,state.blur2Data.data,w,h,g,amount);
      }
    }

    after.getContext("2d",{willReadFrequently:true}).putImageData(new ImageData(out,w,h),0,0);
    setStatus(`Vista en vivo · ${state.intensity}%`);
  }

  function liftCheek(src,out,w,h,p,rx,ry,liftAmount){
    warpZone(src,out,w,h,p.x,p.y,rx,ry,1.025,1.025,-liftAmount*h);
  }

  function volumeZone(src,out,w,h,p,rx,ry,xGain,yGain){
    warpZone(src,out,w,h,p.x,p.y,rx,ry,1+xGain,1+yGain,0);
  }

  function warpZone(src,out,w,h,cx,cy,rx,ry,scaleX,scaleY,shiftY){
    const minX=Math.max(0,Math.floor(cx-rx)),maxX=Math.min(w-1,Math.ceil(cx+rx));
    const minY=Math.max(0,Math.floor(cy-ry)),maxY=Math.min(h-1,Math.ceil(cy+ry));

    for(let y=minY;y<=maxY;y++){
      const ny=(y-cy)/ry;
      for(let x=minX;x<=maxX;x++){
        const nx=(x-cx)/rx, r2=nx*nx+ny*ny;
        if(r2>=1) continue;
        const f=Math.pow(1-r2,2.1);
        const sx=cx+(x-cx)/(1+(scaleX-1)*f);
        const sy=cy+(y-cy)/(1+(scaleY-1)*f)+shiftY*f;
        copyBilinear(src,out,w,h,sx,sy,x,y);
      }
    }
  }

  function shapeChin(src,out,w,h,g,amount){
    const p={x:g.chin.x,y:g.chin.y-g.faceHeight*.055};
    const rx=g.faceWidth*.18, ry=g.faceHeight*.14;
    const lower=distance(g.lips,g.chin)/Math.max(1,g.faceHeight);
    const verticalGain = lower < .22 ? .065*amount : lower > .29 ? -.025*amount : .025*amount;
    warpZone(src,out,w,h,p.x,p.y,rx,ry,1.010,1+verticalGain,0);
  }

  function refineJaw(src,out,w,h,g,amount){
    const center=(g.leftJaw.x+g.rightJaw.x)/2;
    const y0=g.leftEye.y+g.faceHeight*.33;
    const y1=g.chin.y;
    const width=g.faceWidth;

    for(let y=Math.max(0,Math.floor(y0));y<Math.min(h,Math.ceil(y1));y++){
      const t=(y-y0)/Math.max(1,y1-y0);
      const vertical=Math.sin(Math.PI*t);
      for(let x=0;x<w;x++){
        const dx=x-center;
        const ad=Math.abs(dx);
        const inner=width*.30, outer=width*.56;
        if(ad<inner||ad>outer) continue;
        const sideW=smoothstep(inner,inner+width*.08,ad)*(1-smoothstep(outer-width*.08,outer,ad));
        const f=vertical*sideW;
        const sx=x+Math.sign(dx)*width*.026*amount*f;
        copyBilinear(src,out,w,h,sx,y,x,y);
      }
    }
  }

  function improveUnderEye(out,blur,w,h,eye,g,amount){
    const rx=g.eyeDistance*.42, ry=g.faceHeight*.060;
    const cx=eye.x, cy=eye.y+ry*.95;

    // More visible transition improvement at 100%, but still localized.
    blendEllipse(out,blur,w,h,cx,cy,rx,ry,.52*amount);
    luminanceLift(out,w,h,cx,cy,rx,ry,12*amount);
  }

  function softenWrinkles(out,blur,w,h,g,amount){
    const foreheadY=g.forehead.y+g.faceHeight*.12;
    blendEllipse(out,blur,w,h,g.forehead.x,foreheadY,g.faceWidth*.31,g.faceHeight*.15,.52*amount);

    // glabella
    blendEllipse(out,blur,w,h,(g.leftEye.x+g.rightEye.x)/2,g.leftEye.y-g.faceHeight*.07,g.eyeDistance*.18,g.faceHeight*.075,.48*amount);

    // crow's feet
    blendEllipse(out,blur,w,h,g.leftEye.x-g.eyeDistance*.48,g.leftEye.y,g.eyeDistance*.19,g.faceHeight*.060,.42*amount);
    blendEllipse(out,blur,w,h,g.rightEye.x+g.eyeDistance*.48,g.rightEye.y,g.eyeDistance*.19,g.faceHeight*.060,.42*amount);
  }

  function blendEllipse(out,blur,w,h,cx,cy,rx,ry,aMax){
    const minX=Math.max(0,Math.floor(cx-rx)),maxX=Math.min(w-1,Math.ceil(cx+rx));
    const minY=Math.max(0,Math.floor(cy-ry)),maxY=Math.min(h-1,Math.ceil(cy+ry));

    for(let y=minY;y<=maxY;y++){
      const ny=(y-cy)/ry;
      for(let x=minX;x<=maxX;x++){
        const nx=(x-cx)/rx,r2=nx*nx+ny*ny;
        if(r2>=1) continue;
        const a=aMax*Math.pow(1-r2,2.3),i=(y*w+x)*4;
        out[i]=out[i]*(1-a)+blur[i]*a;
        out[i+1]=out[i+1]*(1-a)+blur[i+1]*a;
        out[i+2]=out[i+2]*(1-a)+blur[i+2]*a;
      }
    }
  }

  function luminanceLift(out,w,h,cx,cy,rx,ry,maxLift){
    const minX=Math.max(0,Math.floor(cx-rx)),maxX=Math.min(w-1,Math.ceil(cx+rx));
    const minY=Math.max(0,Math.floor(cy-ry)),maxY=Math.min(h-1,Math.ceil(cy+ry));

    for(let y=minY;y<=maxY;y++){
      const ny=(y-cy)/ry;
      for(let x=minX;x<=maxX;x++){
        const nx=(x-cx)/rx,r2=nx*nx+ny*ny;
        if(r2>=1) continue;
        const f=Math.pow(1-r2,2.5),i=(y*w+x)*4, d=maxLift*f;
        out[i]=clamp(out[i]+d,0,255);
        out[i+1]=clamp(out[i+1]+d,0,255);
        out[i+2]=clamp(out[i+2]+d,0,255);
      }
    }
  }

  /* -------------------- GEOMETRY -------------------- */
  function getGeometry(w,h){
    const lm=state.landmarks;
    if(!lm){
      return {
        leftEye:{x:.38*w,y:.405*h},rightEye:{x:.62*w,y:.405*h},
        leftCheek:{x:.36*w,y:.535*h},rightCheek:{x:.64*w,y:.535*h},
        lips:{x:.50*w,y:.695*h},chin:{x:.50*w,y:.835*h},forehead:{x:.50*w,y:.20*h},
        leftJaw:{x:.22*w,y:.70*h},rightJaw:{x:.78*w,y:.70*h},
        faceWidth:.56*w,faceHeight:.64*h,lipWidth:.22*w,eyeDistance:.24*w
      };
    }

    const P=i=>({x:lm[i].x*w,y:lm[i].y*h});
    const avg=(...ps)=>({x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length});

    const leftEye=avg(P(33),P(133),P(159),P(145));
    const rightEye=avg(P(362),P(263),P(386),P(374));
    const lips=avg(P(61),P(291),P(13),P(14));
    const chin=P(152);
    const forehead=avg(P(10),P(109),P(338));
    const leftJaw=P(234),rightJaw=P(454);
    const faceWidth=distance(leftJaw,rightJaw);
    const faceHeight=distance(forehead,chin);
    const lipWidth=distance(P(61),P(291));
    const eyeDistance=distance(leftEye,rightEye);

    return {
      leftEye,rightEye,lips,chin,forehead,leftJaw,rightJaw,faceWidth,faceHeight,lipWidth,eyeDistance,
      leftCheek:{x:leftEye.x-faceWidth*.035,y:leftEye.y+faceHeight*.20},
      rightCheek:{x:rightEye.x+faceWidth*.035,y:rightEye.y+faceHeight*.20}
    };
  }

  /* -------------------- PIXEL METRICS -------------------- */
  function darknessDelta(src,w,h,eye,faceHeight){
    const rx=faceHeight*.12, ry=faceHeight*.045;
    const under=meanLum(src,w,h,eye.x,eye.y+faceHeight*.07,rx,ry);
    const cheek=meanLum(src,w,h,eye.x,eye.y+faceHeight*.16,rx,ry);
    return Math.max(0,cheek-under);
  }

  function meanLum(src,w,h,cx,cy,rx,ry){
    let total=0,count=0;
    const minX=Math.max(0,Math.floor(cx-rx)),maxX=Math.min(w-1,Math.ceil(cx+rx));
    const minY=Math.max(0,Math.floor(cy-ry)),maxY=Math.min(h-1,Math.ceil(cy+ry));
    for(let y=minY;y<=maxY;y+=2){
      for(let x=minX;x<=maxX;x+=2){
        const nx=(x-cx)/rx,ny=(y-cy)/ry;if(nx*nx+ny*ny>1)continue;
        const i=(y*w+x)*4;
        total += .2126*src[i]+.7152*src[i+1]+.0722*src[i+2]; count++;
      }
    }
    return count?total/count:0;
  }

  function localTexture(src,w,h,cx,cy,rx,ry){
    let sum=0,sum2=0,count=0;
    const minX=Math.max(1,Math.floor(cx-rx)),maxX=Math.min(w-2,Math.ceil(cx+rx));
    const minY=Math.max(1,Math.floor(cy-ry)),maxY=Math.min(h-2,Math.ceil(cy+ry));
    for(let y=minY;y<=maxY;y+=2){
      for(let x=minX;x<=maxX;x+=2){
        const nx=(x-cx)/rx,ny=(y-cy)/ry;if(nx*nx+ny*ny>1)continue;
        const i=(y*w+x)*4;
        const lum=.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];
        sum+=lum;sum2+=lum*lum;count++;
      }
    }
    if(!count)return 0;
    const mean=sum/count;
    return Math.sqrt(Math.max(0,sum2/count-mean*mean));
  }

  /* -------------------- HELPERS -------------------- */
  function copyBilinear(src,out,w,h,sx,sy,dx,dy){
    sx=clamp(sx,0,w-1.001);sy=clamp(sy,0,h-1.001);
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
    const fx=sx-x0,fy=sy-y0;
    const i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4,di=(dy*w+dx)*4;
    for(let c=0;c<3;c++){
      const top=src[i00+c]*(1-fx)+src[i10+c]*fx;
      const bot=src[i01+c]*(1-fx)+src[i11+c]*fx;
      out[di+c]=top*(1-fy)+bot*fy;
    }
    out[di+3]=255;
  }

  function smoothstep(a,b,x){const t=clamp((x-a)/Math.max(.0001,b-a),0,1);return t*t*(3-2*t)}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function clamp(v,min,max){return Math.min(max,Math.max(min,Number.isFinite(v)?v:min))}
  function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  function setStatus(s){const n=$("#simStatus");if(n)n.textContent=s}
})();
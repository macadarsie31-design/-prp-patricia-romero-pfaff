(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    img: null,
    landmarks: null,
    landmarker: null,
    zone: "lips",
    strength: 1,
    generated: false,
    proposal: ""
  };

  const choose = $("#fileInput");
  const change = $("#fileInput2");

  [choose, change].filter(Boolean).forEach(input => {
    input.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => startWithImage(img);
      img.src = URL.createObjectURL(file);
    });
  });

  // Zone buttons
  $$("#zoneList button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$("#zoneList button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.zone = btn.dataset.zone || "lips";
      if (state.generated) renderProposal();
    });
  });

  // Strength
  const strength = $("#strength");
  const strengthText = $("#strengthText");
  const strengthLabels = {1:"Sutil", 2:"Moderado", 3:"Marcado"};
  if (strength) {
    strength.addEventListener("input", () => {
      state.strength = Number(strength.value || 1);
      if (strengthText) strengthText.textContent = strengthLabels[state.strength] || "Sutil";
      if (state.generated) renderProposal();
    });
    state.strength = Number(strength.value || 1);
    if (strengthText) strengthText.textContent = strengthLabels[state.strength] || "Sutil";
  }

  // Comparison slider
  const compareSlider = $("#compareSlider");
  if (compareSlider) {
    compareSlider.addEventListener("input", e => {
      const v = Number(e.target.value);
      $("#afterCanvas").style.clipPath = `inset(0 0 0 ${v}%)`;
      $("#divider").style.left = `${v}%`;
    });
  }

  async function startWithImage(img) {
    state.img = img;
    state.landmarks = null;
    state.generated = false;
    state.proposal = "";
    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");
    if ($("#simStatus")) $("#simStatus").textContent = "Foto lista";
    fitCanvases(img);
    drawBase();
    ensureDownloadButton();
    $("#downloadGateBtn")?.classList.add("hidden");
    detectFace().catch(() => {});
  }

  function fitCanvases(img) {
    const max = 1100;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    [$("#beforeCanvas"), $("#afterCanvas")].filter(Boolean).forEach(c => {
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
    });
    if ($("#compare")) $("#compare").style.aspectRatio = `${img.width}/${img.height}`;
  }

  function drawBase() {
    if (!state.img) return;
    [$("#beforeCanvas"), $("#afterCanvas")].filter(Boolean).forEach(c => {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(state.img, 0, 0, c.width, c.height);
    });
  }

  async function loadMediaPipe() {
    if (state.landmarker) return state.landmarker;
    if ($("#simStatus")) $("#simStatus").textContent = "Activando IA…";
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
      const vision = await mod.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );
      state.landmarker = await mod.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      });
      return state.landmarker;
    } catch (err) {
      console.warn("MediaPipe unavailable; using visual fallback.", err);
      return null;
    }
  }

  async function detectFace() {
    const lm = await loadMediaPipe();
    if (!lm || !state.img) {
      if ($("#simStatus")) $("#simStatus").textContent = "Modo visual listo";
      return null;
    }
    try {
      const res = lm.detect(state.img);
      state.landmarks = res.faceLandmarks?.[0] || null;
      if ($("#simStatus")) {
        $("#simStatus").textContent = state.landmarks ? "Rostro analizado" : "Modo visual listo";
      }
      return state.landmarks;
    } catch (err) {
      console.warn(err);
      if ($("#simStatus")) $("#simStatus").textContent = "Modo visual listo";
      return null;
    }
  }

  $("#generateBtn")?.addEventListener("click", async () => {
    if (!state.img) return;
    const btn = $("#generateBtn");
    btn.disabled = true;
    if ($("#simStatus")) $("#simStatus").textContent = "Generando cambio…";
    if (!state.landmarks) await detectFace();
    renderProposal();
    state.generated = true;
    ensureDownloadButton();
    $("#downloadGateBtn")?.classList.remove("hidden");
    if ($("#simStatus")) $("#simStatus").textContent = "Previsualización lista";
    btn.disabled = false;
  });

  function renderProposal() {
    const after = $("#afterCanvas");
    if (!after || !state.img) return;
    const ctx = after.getContext("2d");
    ctx.clearRect(0, 0, after.width, after.height);
    ctx.drawImage(state.img, 0, 0, after.width, after.height);

    const s = Math.max(1, Math.min(3, state.strength));
    const lm = state.landmarks;
    const zoneNames = {
      lips:"Labios", cheeks:"Pómulos", chin:"Mentón",
      jaw:"Mandíbula", undereye:"Ojeras", skin:"Piel"
    };

    if (lm) {
      const pt = i => ({x:lm[i].x*after.width, y:lm[i].y*after.height});
      const faceWidth = Math.abs(pt(454).x - pt(234).x) || after.width * .48;
      const lipL = pt(61), lipR = pt(291), lipTop = pt(13), lipBottom = pt(14);
      const leftCheek = pt(123), rightCheek = pt(352);
      const chin = pt(152);

      switch (state.zone) {
        case "lips": {
          const lipWidth = Math.abs(lipR.x-lipL.x);
          const lipHeight = Math.max(14, Math.abs(lipBottom.y-lipTop.y)*2.4);
          localPatchScale(
            ctx, after,
            (lipL.x+lipR.x)/2, (lipTop.y+lipBottom.y)/2,
            lipWidth*1.18, lipHeight,
            1 + 0.035*s, 1 + 0.065*s
          );
          tintEllipse(ctx, (lipL.x+lipR.x)/2, (lipTop.y+lipBottom.y)/2,
            lipWidth*.56, lipHeight*.30, `rgba(170,75,78,${0.025*s})`);
          break;
        }
        case "cheeks":
          liftPatch(ctx, after, leftCheek.x, leftCheek.y, faceWidth*.18, faceWidth*.17, -faceWidth*.008*s);
          liftPatch(ctx, after, rightCheek.x, rightCheek.y, faceWidth*.18, faceWidth*.17, -faceWidth*.008*s);
          brightenEllipse(ctx,leftCheek.x,leftCheek.y,faceWidth*.12,faceWidth*.09,.025*s);
          brightenEllipse(ctx,rightCheek.x,rightCheek.y,faceWidth*.12,faceWidth*.09,.025*s);
          break;
        case "chin":
          localPatchScale(ctx, after, chin.x, chin.y-faceWidth*.03, faceWidth*.22, faceWidth*.20,
            1 + .012*s, 1 + .035*s);
          break;
        case "jaw":
          subtleJawContour(ctx, after, pt(172), pt(397), chin, faceWidth, s);
          shadeEllipse(ctx, pt(172).x, pt(172).y, faceWidth*.10, faceWidth*.16, .016*s);
          shadeEllipse(ctx, pt(397).x, pt(397).y, faceWidth*.10, faceWidth*.16, .016*s);
          break;
        case "undereye":
          brightenEllipse(ctx,pt(145).x,pt(145).y,faceWidth*.085,faceWidth*.043,.07*s);
          brightenEllipse(ctx,pt(374).x,pt(374).y,faceWidth*.085,faceWidth*.043,.07*s);
          break;
        case "skin":
          softSkin(ctx, after, .055*s);
          brightenEllipse(ctx, after.width*.5, after.height*.42, faceWidth*.36, faceWidth*.46, .018*s);
          break;
      }
    } else {
      fallbackByZone(ctx, after, state.zone, s);
    }

    state.proposal = `${zoneNames[state.zone] || "Armonización"} · ${strengthLabels[s]}`;
  }

  function fallbackByZone(ctx, c, zone, s) {
    const w=c.width, h=c.height;
    if(zone==="skin") softSkin(ctx,c,.055*s);
    if(zone==="undereye"){
      brightenEllipse(ctx,w*.40,h*.42,w*.075,h*.025,.06*s);
      brightenEllipse(ctx,w*.60,h*.42,w*.075,h*.025,.06*s);
    }
    if(zone==="lips"){
      localPatchScale(ctx,c,w*.5,h*.64,w*.25,h*.10,1+.03*s,1+.06*s);
    }
    if(zone==="cheeks"){
      brightenEllipse(ctx,w*.36,h*.54,w*.10,h*.07,.025*s);
      brightenEllipse(ctx,w*.64,h*.54,w*.10,h*.07,.025*s);
    }
    if(zone==="chin") localPatchScale(ctx,c,w*.5,h*.75,w*.22,h*.14,1+.01*s,1+.025*s);
    if(zone==="jaw"){
      shadeEllipse(ctx,w*.34,h*.70,w*.10,h*.16,.015*s);
      shadeEllipse(ctx,w*.66,h*.70,w*.10,h*.16,.015*s);
    }
  }

  function softSkin(ctx,c,a){
    // Lightweight smoothing + luminosity; keeps identity and texture more natural.
    const temp=document.createElement("canvas");
    temp.width=Math.max(1,Math.round(c.width*.45));
    temp.height=Math.max(1,Math.round(c.height*.45));
    temp.getContext("2d").drawImage(c,0,0,temp.width,temp.height);
    ctx.save();
    ctx.globalAlpha=Math.min(.22,a*1.6);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(temp,0,0,temp.width,temp.height,0,0,c.width,c.height);
    ctx.globalCompositeOperation="screen";
    ctx.globalAlpha=Math.min(.13,a);
    ctx.fillStyle="#f5dfd2";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.restore();
  }

  function brightenEllipse(ctx,x,y,rx,ry,a){
    ctx.save();
    const g=ctx.createRadialGradient(x,y,1,x,y,Math.max(rx,ry));
    g.addColorStop(0,`rgba(255,246,236,${Math.min(.30,a)})`);
    g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function shadeEllipse(ctx,x,y,rx,ry,a){
    ctx.save();
    const g=ctx.createRadialGradient(x,y,1,x,y,Math.max(rx,ry));
    g.addColorStop(0,`rgba(80,55,45,${Math.min(.12,a)})`);
    g.addColorStop(1,"rgba(80,55,45,0)");
    ctx.fillStyle=g;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function tintEllipse(ctx,x,y,rx,ry,color){
    ctx.save();ctx.fillStyle=color;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function liftPatch(ctx,c,cx,cy,w,h,dy){
    const x=Math.max(0,cx-w/2), y=Math.max(0,cy-h/2);
    const sw=Math.min(w,c.width-x), sh=Math.min(h,c.height-y);
    if(sw<=2||sh<=2)return;
    const temp=document.createElement("canvas");
    temp.width=Math.ceil(sw);temp.height=Math.ceil(sh);
    temp.getContext("2d").drawImage(c,x,y,sw,sh,0,0,sw,sh);
    ctx.save();
    ctx.beginPath();ctx.ellipse(cx,cy,w*.52,h*.52,0,0,Math.PI*2);ctx.clip();
    ctx.globalAlpha=.92;ctx.drawImage(temp,x,y+dy,sw,sh);ctx.restore();
  }

  function localPatchScale(ctx,c,cx,cy,w,h,sx,sy){
    const x=Math.max(0,cx-w/2), y=Math.max(0,cy-h/2);
    const sw=Math.min(w,c.width-x), sh=Math.min(h,c.height-y);
    if(sw<=2||sh<=2)return;
    const temp=document.createElement("canvas");
    temp.width=Math.ceil(sw);temp.height=Math.ceil(sh);
    temp.getContext("2d").drawImage(c,x,y,sw,sh,0,0,sw,sh);
    ctx.save();
    ctx.beginPath();ctx.ellipse(cx,cy,w*.52,h*.52,0,0,Math.PI*2);ctx.clip();
    ctx.globalAlpha=.94;
    const dw=sw*sx,dh=sh*sy;
    ctx.drawImage(temp,cx-dw/2,cy-dh/2,dw,dh);ctx.restore();
  }

  function subtleJawContour(ctx,c,left,right,chin,fw,s){
    ctx.save();
    ctx.strokeStyle=`rgba(105,78,62,${.035*s})`;
    ctx.lineWidth=Math.max(1,fw*.006);
    ctx.beginPath();ctx.moveTo(left.x,left.y);
    ctx.quadraticCurveTo(chin.x,chin.y,right.x,right.y);
    ctx.stroke();ctx.restore();
  }

  function ensureDownloadButton(){
    if ($("#downloadGateBtn")) return;
    const actions = $(".sim-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.id = "downloadGateBtn";
    btn.type = "button";
    btn.className = "btn btn-dark hidden";
    btn.textContent = "Descargar resultado";
    btn.addEventListener("click", openLeadModal);
    actions.appendChild(btn);
  }

  function openLeadModal(){
    if(!state.generated) return;
    ensureLeadModal();
    $("#leadModalDynamic").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLeadModal(){
    $("#leadModalDynamic")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function ensureLeadModal(){
    if ($("#leadModalDynamic")) return;
    const wrap = document.createElement("div");
    wrap.id = "leadModalDynamic";
    wrap.className = "hidden";
    wrap.innerHTML = `
      <div class="prp-modal-backdrop"></div>
      <div class="prp-modal-card" role="dialog" aria-modal="true" aria-labelledby="prpModalTitle">
        <button type="button" class="prp-modal-x" aria-label="Cerrar">×</button>
        <span class="kicker">TU RESULTADO</span>
        <h3 id="prpModalTitle">Completá tus datos para descargar</h3>
        <p class="prp-modal-copy">Guardaremos únicamente tus datos de contacto y la opción simulada. La selfie no se guarda en la base de datos.</p>
        <form id="leadFormDynamic">
          <label>Nombre y apellido<input id="leadNameDynamic" autocomplete="name" required></label>
          <label>Email<input id="leadEmailDynamic" type="email" autocomplete="email" required></label>
          <label>Teléfono / WhatsApp<input id="leadPhoneDynamic" type="tel" autocomplete="tel" required></label>
          <input id="websiteDynamic" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
          <label class="prp-check"><input id="leadConsentDynamic" type="checkbox" required> <span>Acepto que PRP guarde estos datos para contactarme sobre mi consulta.</span></label>
          <div id="leadErrorDynamic" class="prp-error hidden"></div>
          <button id="leadSubmitDynamic" class="btn btn-dark" type="submit">Guardar y descargar</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const style=document.createElement("style");
    style.textContent=`
      #leadModalDynamic{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
      #leadModalDynamic.hidden{display:none}
      .prp-modal-backdrop{position:absolute;inset:0;background:rgba(25,24,22,.56);backdrop-filter:blur(5px)}
      .prp-modal-card{position:relative;z-index:1;background:#fbf7f2;border-radius:28px;padding:28px;width:min(92vw,520px);max-height:88vh;overflow:auto;box-shadow:0 28px 80px rgba(0,0,0,.22)}
      .prp-modal-card h3{font-family:"Playfair Display",Georgia,serif;font-size:32px;line-height:1.08;margin:10px 0 10px}
      .prp-modal-copy{color:#716a62;line-height:1.45;margin:0 0 18px}
      .prp-modal-x{position:absolute;right:18px;top:14px;border:0;background:transparent;font-size:30px;cursor:pointer}
      #leadFormDynamic{display:grid;gap:13px}
      #leadFormDynamic label{display:grid;gap:6px;font-weight:600}
      #leadFormDynamic input[type=text],#leadFormDynamic input[type=email],#leadFormDynamic input[type=tel],#leadFormDynamic label>input:not([type]){width:100%;box-sizing:border-box;border:1px solid #cfc7bd;border-radius:14px;padding:14px 15px;background:white;font:inherit}
      .prp-check{grid-template-columns:22px 1fr!important;align-items:start;font-weight:400!important;line-height:1.35}
      .prp-error{background:#fff0ef;color:#9d2f26;border-radius:12px;padding:11px 12px}
      .prp-error.hidden{display:none}
    `;
    document.head.appendChild(style);

    wrap.querySelector(".prp-modal-backdrop").addEventListener("click",closeLeadModal);
    wrap.querySelector(".prp-modal-x").addEventListener("click",closeLeadModal);
    $("#leadFormDynamic").addEventListener("submit", saveLeadAndDownload);
  }

  async function saveLeadAndDownload(e){
    e.preventDefault();
    const btn=$("#leadSubmitDynamic");
    const errorBox=$("#leadErrorDynamic");
    btn.disabled=true;btn.textContent="Guardando…";
    errorBox.classList.add("hidden");errorBox.textContent="";

    const payload={
      name:$("#leadNameDynamic").value.trim(),
      email:$("#leadEmailDynamic").value.trim(),
      phone:$("#leadPhoneDynamic").value.trim(),
      consent:$("#leadConsentDynamic").checked,
      website:$("#websiteDynamic").value || "",
      proposal:state.proposal || `${state.zone} · ${strengthLabels[state.strength]}`
    };

    try{
      const r=await fetch("/api/lead",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok || !data.ok) throw new Error(data.error || "No pudimos guardar tus datos.");
      downloadResult();
      closeLeadModal();
    }catch(err){
      errorBox.textContent=err.message || "Hubo un problema. Intentá nuevamente.";
      errorBox.classList.remove("hidden");
    }finally{
      btn.disabled=false;btn.textContent="Guardar y descargar";
    }
  }

  function buildResultCanvas(){
    const b=$("#beforeCanvas"),a=$("#afterCanvas");
    const pad=26,head=95,footer=75;
    const w=b.width*2+pad*3,h=Math.max(b.height,a.height)+head+footer+pad*2;
    const out=document.createElement("canvas");
    out.width=w;out.height=h;
    const ctx=out.getContext("2d");
    ctx.fillStyle="#f7f2ec";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(26,w*.025)}px Georgia`;
    ctx.fillText("PRP · Simulación facial orientativa",pad,55);
    ctx.font=`${Math.max(16,w*.014)}px Arial`;ctx.fillStyle="#716a62";
    ctx.fillText("Dra. Patricia Romero Pfaff · Córdoba, Argentina",pad,82);
    ctx.drawImage(b,pad,head+pad,b.width,b.height);
    ctx.drawImage(a,pad*2+b.width,head+pad,a.width,a.height);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(18,w*.016)}px Arial`;
    ctx.fillText("ANTES",pad,head+15);
    ctx.fillText("SIMULACIÓN",pad*2+b.width,head+15);
    ctx.fillStyle="#716a62";ctx.font=`${Math.max(14,w*.012)}px Arial`;
    ctx.fillText(`${state.proposal || "Simulación estética"} · No garantiza resultados.`,pad,h-28);
    return out;
  }

  function downloadResult(){
    const c=buildResultCanvas();
    const a=document.createElement("a");
    a.href=c.toDataURL("image/jpeg",.92);
    a.download="PRP-simulacion-facial.jpg";
    document.body.appendChild(a);a.click();a.remove();
  }
})();
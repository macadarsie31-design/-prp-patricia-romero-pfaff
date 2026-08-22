(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const state = {
    img: null,
    landmarks: null,
    landmarker: null,
    generated: false,
    unlocked: false,
    proposal: null
  };

  const choose = $("#fileInput");
  const camera = $("#cameraInput");
  $("#choosePhotoBtn").addEventListener("click", () => choose.click());
  $("#takePhotoBtn").addEventListener("click", () => camera.click());
  $("#changePhotoBtn").addEventListener("click", () => choose.click());

  [choose, camera].forEach(input => input.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => startWithImage(img);
    img.src = URL.createObjectURL(file);
  }));

  $("#compareSlider").addEventListener("input", e => {
    const v = Number(e.target.value);
    $("#afterCanvas").style.clipPath = `inset(0 0 0 ${v}%)`;
    $("#divider").style.left = `${v}%`;
  });

  async function startWithImage(img){
    state.img = img;
    state.landmarks = null;
    state.generated = false;
    state.unlocked = false;
    $("#simEmpty").classList.add("hidden");
    $("#simWorkspace").classList.remove("hidden");
    $("#resultLock").classList.add("hidden");
    $("#simStatus").textContent = "Foto lista";
    fitCanvases(img);
    drawBase();
    // Load AI in the background only AFTER the photo UI is already working.
    detectFace().catch(() => {});
  }

  function fitCanvases(img){
    const max = 1100;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    [$("#beforeCanvas"), $("#afterCanvas")].forEach(c => {
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
    });
    $("#compare").style.aspectRatio = `${img.width}/${img.height}`;
  }

  function drawBase(){
    if(!state.img) return;
    [$("#beforeCanvas"),$("#afterCanvas")].forEach(c => {
      const ctx = c.getContext("2d");
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(state.img,0,0,c.width,c.height);
    });
  }

  async function loadMediaPipe(){
    if(state.landmarker) return state.landmarker;
    $("#simStatus").textContent = "Activando IA…";
    try{
      const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
      const vision = await mod.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
      state.landmarker = await mod.FaceLandmarker.createFromOptions(vision,{
        baseOptions:{
          modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode:"IMAGE",
        numFaces:1,
        outputFaceBlendshapes:true,
        outputFacialTransformationMatrixes:true
      });
      return state.landmarker;
    }catch(err){
      console.warn("MediaPipe unavailable; using local visual fallback.", err);
      return null;
    }
  }

  async function detectFace(){
    const lm = await loadMediaPipe();
    if(!lm || !state.img){
      $("#simStatus").textContent = "Modo visual listo";
      return null;
    }
    try{
      const res = lm.detect(state.img);
      state.landmarks = res.faceLandmarks?.[0] || null;
      $("#simStatus").textContent = state.landmarks ? "Rostro analizado" : "Modo visual listo";
      return state.landmarks;
    }catch(err){
      console.warn(err);
      $("#simStatus").textContent = "Modo visual listo";
      return null;
    }
  }

  $("#generateBtn").addEventListener("click", async () => {
    if(!state.img) return;
    $("#generateBtn").disabled = true;
    $("#simStatus").textContent = "Analizando proporciones…";
    if(!state.landmarks) await detectFace();
    renderProposal();
    state.generated = true;
    $("#resultLock").classList.remove("hidden");
    $("#simStatus").textContent = "Resultado listo";
    $("#generateBtn").disabled = false;
  });

  function renderProposal(){
    const before = $("#beforeCanvas");
    const after = $("#afterCanvas");
    const ctx = after.getContext("2d");
    ctx.clearRect(0,0,after.width,after.height);
    ctx.drawImage(state.img,0,0,after.width,after.height);

    const lm = state.landmarks;
    if(!lm){
      fallbackEnhancement(ctx, after);
      state.proposal = "equilibrio";
      $("#proposalTitle").textContent = "Equilibrio natural";
      $("#aiRecommendation").textContent = "La visualización prioriza luminosidad, suavidad y proporciones naturales. La elección de tratamientos debe confirmarse siempre en consulta.";
      return;
    }

    const pt = i => ({x:lm[i].x*after.width, y:lm[i].y*after.height});
    const leftCheek = pt(123), rightCheek = pt(352);
    const chin = pt(152);
    const lipL = pt(61), lipR = pt(291);
    const lipTop = pt(13), lipBottom = pt(14);
    const eyeL = pt(33), eyeR = pt(263);
    const faceWidth = Math.abs(pt(454).x - pt(234).x);
    const lipWidth = Math.abs(lipR.x - lipL.x);
    const eyeWidth = Math.abs(eyeR.x - eyeL.x);

    // Conservative, identity-preserving visual proposal:
    // mild skin luminosity + lips + under-eye + cheek support.
    softSkin(ctx, after, 0.035);
    localPatchScale(ctx, after, lipL.x, lipTop.y, lipWidth, Math.max(18, Math.abs(lipBottom.y-lipTop.y)*2.1), 1.035, 1.08);
    brightenEllipse(ctx, leftCheek.x, leftCheek.y, faceWidth*.10, faceWidth*.075, .035);
    brightenEllipse(ctx, rightCheek.x, rightCheek.y, faceWidth*.10, faceWidth*.075, .035);
    brightenEllipse(ctx, pt(145).x, pt(145).y, faceWidth*.07, faceWidth*.035, .055);
    brightenEllipse(ctx, pt(374).x, pt(374).y, faceWidth*.07, faceWidth*.035, .055);
    subtleJawContour(ctx, after, pt(172), pt(397), chin, faceWidth);

    let rec = "Propuesta visual: mantener tus rasgos y trabajar con cambios sutiles en soporte del tercio medio, mirada y definición suave del contorno.";
    if(lipWidth/eyeWidth < 0.7){
      rec = "Propuesta visual: conservar tus proporciones generales y explorar un realce muy sutil de labios acompañado de soporte suave del tercio medio.";
    }
    $("#proposalTitle").textContent = "Equilibrio natural";
    $("#aiRecommendation").textContent = rec + " Es una simulación estética, no una recomendación clínica.";
    state.proposal = rec;
  }

  function fallbackEnhancement(ctx,c){
    softSkin(ctx,c,.035);
    const w=c.width,h=c.height;
    brightenEllipse(ctx,w*.5,h*.43,w*.24,h*.18,.02);
  }

  function softSkin(ctx,c,a){
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a;
    ctx.fillStyle = "#f3d8c8";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.restore();
  }

  function brightenEllipse(ctx,x,y,rx,ry,a){
    ctx.save();
    const g = ctx.createRadialGradient(x,y,1,x,y,Math.max(rx,ry));
    g.addColorStop(0,`rgba(255,244,232,${a})`);
    g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function localPatchScale(ctx,c,cx,cy,w,h,sx,sy){
    const x=Math.max(0,cx-w/2), y=Math.max(0,cy-h/2);
    const sw=Math.min(w,c.width-x), sh=Math.min(h,c.height-y);
    if(sw<=2||sh<=2) return;
    const temp=document.createElement("canvas");
    temp.width=sw; temp.height=sh;
    temp.getContext("2d").drawImage(c,x,y,sw,sh,0,0,sw,sh);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx,cy,w*.55,h*.60,0,0,Math.PI*2);
    ctx.clip();
    ctx.globalAlpha=.9;
    const dw=sw*sx, dh=sh*sy;
    ctx.drawImage(temp,cx-dw/2,cy-dh/2,dw,dh);
    ctx.restore();
  }

  function subtleJawContour(ctx,c,left,right,chin,fw){
    ctx.save();
    ctx.strokeStyle="rgba(120,92,72,.06)";
    ctx.lineWidth=Math.max(1,fw*.008);
    ctx.beginPath();
    ctx.moveTo(left.x,left.y);
    ctx.quadraticCurveTo(chin.x,chin.y,right.x,right.y);
    ctx.stroke();
    ctx.restore();
  }

  // Gate / lead modal
  const modal=$("#leadModal");
  $("#openLeadBtn").addEventListener("click",()=>modal.classList.remove("hidden"));
  $("#closeLead").addEventListener("click",()=>modal.classList.add("hidden"));
  $("#closeLeadBtn").addEventListener("click",()=>modal.classList.add("hidden"));

  $("#leadForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const form=e.currentTarget;
    const btn=$("#submitLeadBtn");
    const errorBox=$("#formError");
    btn.disabled=true;
    btn.textContent="Enviando…";
    errorBox.classList.add("hidden");
    errorBox.textContent="";

    const payload = {
      name: $("#leadName").value.trim(),
      email: $("#leadEmail").value.trim(),
      phone: $("#leadPhone").value.trim(),
      consent: $("#leadConsent").checked,
      proposal: state.proposal || "Equilibrio natural",
      website: $("#website")?.value || ""
    };

    try{
      const r = await fetch("/api/lead",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });

      if(!r.ok){
        const data = await r.json().catch(()=>({}));
        throw new Error(data.error || "No pudimos guardar tus datos.");
      }

      unlockResult();
      $("#leadForm").classList.add("hidden");
      $("#leadSuccess").classList.remove("hidden");

      // Email is optional. If not configured yet, the lead still stays saved.
      sendResultEmail().catch(()=>{});
    }catch(err){
      errorBox.textContent = err.message || "Hubo un problema. Intentá nuevamente.";
      errorBox.classList.remove("hidden");
    }finally{
      btn.disabled=false;
      btn.textContent="Enviar y ver resultado";
    }
  });

  function unlockResult(){
    state.unlocked=true;
    $("#resultLock").classList.add("hidden");
  }

  function buildResultCanvas(){
    const b=$("#beforeCanvas"), a=$("#afterCanvas");
    const pad=26, head=95, footer=75;
    const w=b.width*2+pad*3, h=Math.max(b.height,a.height)+head+footer+pad*2;
    const out=document.createElement("canvas");
    out.width=w; out.height=h;
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
    ctx.fillText("Visualización estética orientativa. No garantiza resultados.",pad,h-28);
    return out;
  }

  $("#downloadResultBtn").addEventListener("click",()=>{
    const c=buildResultCanvas();
    const a=document.createElement("a");
    a.href=c.toDataURL("image/jpeg",.9);
    a.download="PRP-simulacion-facial.jpg";
    document.body.appendChild(a);a.click();a.remove();
  });

  async function sendResultEmail(){
    const email=$("#leadEmail").value.trim();
    const name=$("#leadName").value.trim();
    const phone=$("#leadPhone").value.trim();
    if(!email) return;
    const image = buildResultCanvas().toDataURL("image/jpeg",.82);
    try{
      await fetch("/api/send-result",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,name,phone,image,proposal:state.proposal || ""})
      });
    }catch(err){ console.warn("Email delivery is not configured yet."); }
  }
})();
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const AREAS = [
    ["temples","Sienes"],
    ["undereye","Ojeras"],
    ["midface","Soporte tercio medio"],
    ["cheeks","Pómulos"],
    ["nose","Nariz"],
    ["nasolabial","Nasolabial / perioral"],
    ["lips","Labios"],
    ["chin","Mentón"],
    ["prejowl","Pre-jowl"],
    ["jawline","Mandíbula"],
    ["wrinkles","Arrugas"]
  ];

  const state = {
    img: null,
    originalFile: null,
    analysis: null,
    generated: false,
    resultImage: null,
    fullFace: true,
    strength: 2,
    overrides: Object.fromEntries(AREAS.map(([id]) => [id, "neutral"])),
    proposal: ""
  };

  const strengthLabels = {1:"Natural",2:"Balanceado",3:"Definido"};

  init();

  function init(){
    bindUploads();
    setupCompare();
    buildControls();
    setupStrength();
    ensureDownloadButton();
  }

  function bindUploads(){
    [$("#fileInput"), $("#fileInput2")].filter(Boolean).forEach(input => {
      input.addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];
        if(!file) return;
        if(!file.type.startsWith("image/")){
          alert("Elegí una imagen.");
          return;
        }
        state.originalFile = file;
        const img = new Image();
        img.onload = () => startWithImage(img);
        img.src = URL.createObjectURL(file);
      });
    });
  }

  function buildControls(){
    const zoneList = $("#zoneList");
    if(!zoneList) return;
    zoneList.innerHTML = "";

    const full = document.createElement("button");
    full.type="button";
    full.id="fullFaceBtn";
    full.className="active";
    full.textContent="Full Face — Best Version ✓";
    zoneList.appendChild(full);

    full.addEventListener("click",()=>{
      state.fullFace=!state.fullFace;
      full.classList.toggle("active",state.fullFace);
      full.textContent=state.fullFace ? "Full Face — Best Version ✓" : "Full Face — Best Version";
      updatePlanText();
    });

    for(const [id,label] of AREAS){
      const b=document.createElement("button");
      b.type="button";
      b.dataset.zone=id;
      b.dataset.choice="neutral";
      b.textContent=label;
      b.addEventListener("click",()=>cycleArea(b,id,label));
      zoneList.appendChild(b);
    }

    const plan=document.createElement("div");
    plan.id="aiPlanText";
    plan.className="prp-ai-plan";
    zoneList.insertAdjacentElement("afterend",plan);

    const analysis=document.createElement("div");
    analysis.id="analysisPanel";
    analysis.className="prp-analysis hidden";
    plan.insertAdjacentElement("afterend",analysis);

    const err=document.createElement("div");
    err.id="aiError";
    err.className="prp-ai-error hidden";
    analysis.insertAdjacentElement("afterend",err);

    const css=document.createElement("style");
    css.textContent=`
      .prp-ai-plan{margin:10px 0 8px;color:#6f685f;font-size:14px;line-height:1.45}
      .prp-ai-error{margin:10px 0;padding:11px 12px;border-radius:12px;background:#fff0ef;color:#8e2d27;font-size:14px}
      .prp-ai-error.hidden,.prp-analysis.hidden{display:none}
      #zoneList button.remove-choice{border-color:#8b5d55!important;color:#8b5d55!important;background:#fff8f6!important}
      #zoneList button.priority-a{box-shadow:inset 0 -3px 0 #304d3f}
      #zoneList button.priority-b{box-shadow:inset 0 -3px 0 #a28b68}
      #zoneList button.priority-c{opacity:.62}
      .prp-analysis{margin:14px 0 8px;padding:14px;border:1px solid #ded6cd;border-radius:18px;background:rgba(255,255,255,.55)}
      .prp-analysis h4{margin:0 0 8px;font-family:"Playfair Display",Georgia,serif;font-size:20px}
      .prp-analysis p{margin:0 0 10px;color:#6f685f;line-height:1.45}
      .prp-priority-list{display:grid;gap:8px}
      .prp-priority-row{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:start;padding:9px 0;border-top:1px solid #e9e2da}
      .prp-priority-row:first-child{border-top:0}
      .prp-badge{min-width:28px;height:28px;border-radius:999px;display:grid;place-items:center;font-weight:700;font-size:13px}
      .prp-badge.a{background:#243d32;color:#fff}
      .prp-badge.b{background:#e8ddca;color:#6b5737}
      .prp-badge.c{background:#eeeae5;color:#777}
      .prp-row-title{font-weight:700}
      .prp-row-copy{font-size:13px;color:#726b63;margin-top:2px;line-height:1.35}
      .prp-modality{display:inline-block;margin:5px 5px 0 0;padding:4px 7px;border-radius:999px;background:#f3eee8;font-size:11px;color:#5e5851}
      #generateBtn[disabled]{opacity:.6;cursor:wait}
    `;
    document.head.appendChild(css);
    updatePlanText();
  }

  function cycleArea(btn,id,label){
    const now=btn.dataset.choice||"neutral";
    const next=now==="neutral"?"add":now==="add"?"remove":"neutral";
    btn.dataset.choice=next;
    state.overrides[id]=next;
    btn.classList.toggle("active",next==="add");
    btn.classList.toggle("remove-choice",next==="remove");
    btn.textContent=next==="add"?`${label} +`:next==="remove"?`${label} −`:label;
    updatePlanText();
  }

  function setupStrength(){
    const strength=$("#strength");
    const strengthText=$("#strengthText");
    if(!strength) return;
    state.strength=Math.max(1,Math.min(3,Number(strength.value||2)));
    if(strengthText) strengthText.textContent=strengthLabels[state.strength];
    strength.addEventListener("input",()=>{
      state.strength=Math.max(1,Math.min(3,Number(strength.value||2)));
      if(strengthText) strengthText.textContent=strengthLabels[state.strength];
    });
  }

  function setupCompare(){
    const slider=$("#compareSlider");
    if(!slider) return;
    slider.addEventListener("input",e=>{
      const v=Number(e.target.value);
      $("#afterCanvas") && ($("#afterCanvas").style.clipPath=`inset(0 0 0 ${v}%)`);
      $("#divider") && ($("#divider").style.left=`${v}%`);
    });
  }

  function startWithImage(img){
    state.img=img;
    state.generated=false;
    state.resultImage=null;
    state.analysis=null;
    state.overrides=Object.fromEntries(AREAS.map(([id])=>[id,"neutral"]));
    resetButtons();

    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");
    fitCanvases(img);
    drawOriginalBoth();
    $("#downloadGateBtn")?.classList.add("hidden");
    if($("#simStatus")) $("#simStatus").textContent="Analizando armonía facial…";
    analyzePhoto();
  }

  function resetButtons(){
    for(const [id,label] of AREAS){
      const b=document.querySelector(`#zoneList button[data-zone="${id}"]`);
      if(!b) continue;
      b.dataset.choice="neutral";
      b.classList.remove("active","remove-choice","priority-a","priority-b","priority-c");
      b.textContent=label;
    }
  }

  function fitCanvases(img){
    const max=1100;
    const scale=Math.min(1,max/Math.max(img.width,img.height));
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{
      c.width=Math.max(1,Math.round(img.width*scale));
      c.height=Math.max(1,Math.round(img.height*scale));
    });
    if($("#compare")) $("#compare").style.aspectRatio=`${img.width}/${img.height}`;
  }

  function drawOriginalBoth(){
    if(!state.img) return;
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{
      const ctx=c.getContext("2d");
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(state.img,0,0,c.width,c.height);
    });
  }

  async function analyzePhoto(){
    const errorBox=$("#aiError");
    errorBox?.classList.add("hidden");
    try{
      const blob=await makeReferenceBlob(state.img,700);
      const form=new FormData();
      form.append("image",blob,"selfie.jpg");

      let r=await fetch("/api/analyze",{method:"POST",body:form});
      let data=await r.json().catch(()=>({}));

      if(r.status===428 && data.needsLicense){
        await fetch("/api/accept-vision-license");
        r=await fetch("/api/analyze",{method:"POST",body:form});
        data=await r.json().catch(()=>({}));
      }

      if(!r.ok || !data.ok) throw new Error(data.error||"No se pudo analizar la foto.");
      state.analysis=data.analysis;
      applyAnalysisToUI();
      if($("#simStatus")) $("#simStatus").textContent="Análisis visual listo · podés agregar o quitar áreas";
    }catch(e){
      console.error(e);
      if(errorBox){
        errorBox.textContent=e.message||"No se pudo completar el análisis visual.";
        errorBox.classList.remove("hidden");
      }
      if($("#simStatus")) $("#simStatus").textContent="Foto lista · podés elegir áreas manualmente";
    }
  }

  function applyAnalysisToUI(){
    const a=state.analysis;
    if(!a) return;

    for(const item of a.areas||[]){
      const b=document.querySelector(`#zoneList button[data-zone="${item.id}"]`);
      if(!b) continue;
      b.classList.remove("priority-a","priority-b","priority-c");
      b.classList.add(`priority-${String(item.priority||"C").toLowerCase()}`);

      if(item.priority==="A"){
        state.overrides[item.id]="add";
        b.dataset.choice="add";
        b.classList.add("active");
        b.classList.remove("remove-choice");
        b.textContent=`${labelFor(item.id)} +`;
      }else if(item.priority==="C"){
        state.overrides[item.id]="remove";
        b.dataset.choice="remove";
        b.classList.add("remove-choice");
        b.classList.remove("active");
        b.textContent=`${labelFor(item.id)} −`;
      }else{
        state.overrides[item.id]="neutral";
        b.dataset.choice="neutral";
        b.classList.remove("active","remove-choice");
        b.textContent=labelFor(item.id);
      }
    }

    renderAnalysisPanel();
    updatePlanText();
  }

  function renderAnalysisPanel(){
    const panel=$("#analysisPanel");
    const a=state.analysis;
    if(!panel||!a) return;
    panel.classList.remove("hidden");

    const rows=(a.areas||[]).map(item=>{
      const cls=String(item.priority||"C").toLowerCase();
      const mods=(item.modalities||[]).map(m=>`<span class="prp-modality">${escapeHTML(m)}</span>`).join("");
      return `<div class="prp-priority-row">
        <span class="prp-badge ${cls}">${escapeHTML(item.priority||"C")}</span>
        <div>
          <div class="prp-row-title">${escapeHTML(labelFor(item.id))}</div>
          <div class="prp-row-copy">${escapeHTML(item.objective||"")}</div>
          ${mods}
        </div>
      </div>`;
    }).join("");

    panel.innerHTML=`
      <h4>Propuesta visual de armonización</h4>
      <p>${escapeHTML(a.summary||"")}</p>
      <div class="prp-priority-list">${rows}</div>
      <p style="margin-top:10px;font-size:12px">A = mayor impacto visual · B = refinamiento opcional · C = no cambiar. Es una simulación orientativa; producto, técnica y cantidad se determinan en consulta clínica.</p>
    `;
  }

  function updatePlanText(){
    const add=Object.entries(state.overrides).filter(([,v])=>v==="add").map(([k])=>labelFor(k));
    const remove=Object.entries(state.overrides).filter(([,v])=>v==="remove").map(([k])=>labelFor(k));
    const parts=[];
    parts.push(state.fullFace?"Full Face inteligente activado":"Plan personalizado por áreas");
    if(add.length) parts.push(`incluir/priorizar: ${add.join(", ")}`);
    if(remove.length) parts.push(`no modificar: ${remove.join(", ")}`);
    $("#aiPlanText") && ($("#aiPlanText").textContent=parts.join(" · ")+".");
  }

  $("#generateBtn")?.addEventListener("click",async()=>{
    if(!state.img) return;
    const btn=$("#generateBtn");
    const err=$("#aiError");
    err?.classList.add("hidden");
    btn.disabled=true;
    const original=btn.textContent;
    btn.textContent="Generando con IA…";
    if($("#simStatus")) $("#simStatus").textContent="Generando simulación conservadora…";

    try{
      const blob=await makeReferenceBlob(state.img,500);
      const form=new FormData();
      form.append("image",blob,"selfie.jpg");
      form.append("fullFace",state.fullFace?"1":"0");
      form.append("strength",String(state.strength));
      form.append("overrides",JSON.stringify(state.overrides));
      form.append("analysis",JSON.stringify(state.analysis||{}));

      const r=await fetch("/api/simulate",{method:"POST",body:form});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.ok||!data.image) throw new Error(data.error||"No se pudo generar la simulación.");

      await drawAIResult(data.image);
      state.generated=true;
      state.resultImage=data.image;
      state.proposal=data.plan||buildPlanLabel();
      ensureDownloadButton();
      $("#downloadGateBtn")?.classList.remove("hidden");
      if($("#simStatus")) $("#simStatus").textContent=data.validated?"Simulación IA validada":"Simulación IA lista";
    }catch(e){
      console.error(e);
      if(err){
        err.textContent=e.message||"Hubo un problema generando la simulación.";
        err.classList.remove("hidden");
      }
      if($("#simStatus")) $("#simStatus").textContent="No se pudo generar";
    }finally{
      btn.disabled=false;
      btn.textContent=original||"Generar previsualización";
    }
  });

  async function makeReferenceBlob(img,maxSide){
    const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
    const scale=Math.min(1,maxSide/Math.max(iw,ih));
    const w=Math.max(1,Math.round(iw*scale)), h=Math.max(1,Math.round(ih*scale));
    const c=document.createElement("canvas"); c.width=w;c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    return await new Promise((resolve,reject)=>{
      c.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la foto.")),"image/jpeg",.92);
    });
  }

  function drawAIResult(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        const c=$("#afterCanvas");
        if(!c) return reject(new Error("No se encontró el canvas de resultado."));
        const ctx=c.getContext("2d");
        ctx.clearRect(0,0,c.width,c.height);
        const s=Math.max(c.width/img.width,c.height/img.height);
        const sw=c.width/s, sh=c.height/s;
        const sx=(img.width-sw)/2, sy=(img.height-sh)/2;
        ctx.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
        resolve();
      };
      img.onerror=()=>reject(new Error("La IA devolvió una imagen inválida."));
      img.src=src;
    });
  }

  function buildPlanLabel(){
    const add=Object.entries(state.overrides).filter(([,v])=>v==="add").map(([k])=>labelFor(k));
    const remove=Object.entries(state.overrides).filter(([,v])=>v==="remove").map(([k])=>labelFor(k));
    let s=state.fullFace?"Full Face — Best Version":"Plan por áreas";
    if(add.length) s+=` + ${add.join(", ")}`;
    if(remove.length) s+=` · excluir ${remove.join(", ")}`;
    s+=` · ${strengthLabels[state.strength]}`;
    return s;
  }

  function labelFor(id){
    return (AREAS.find(([x])=>x===id)||[id,id])[1];
  }

  function escapeHTML(s){
    return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  }

  // Download lead-gate. Existing /api/lead is reused.
  function ensureDownloadButton(){
    if($("#downloadGateBtn")) return;
    const actions=$(".sim-actions");
    if(!actions) return;
    const btn=document.createElement("button");
    btn.id="downloadGateBtn";
    btn.type="button";
    btn.className="btn btn-dark hidden";
    btn.textContent="Descargar resultado";
    btn.addEventListener("click",openLeadModal);
    actions.appendChild(btn);
  }

  function openLeadModal(){
    if(!state.generated) return;
    ensureLeadModal();
    $("#leadModalDynamic").classList.remove("hidden");
    document.body.style.overflow="hidden";
  }

  function closeLeadModal(){
    $("#leadModalDynamic")?.classList.add("hidden");
    document.body.style.overflow="";
  }

  function ensureLeadModal(){
    if($("#leadModalDynamic")) return;
    const wrap=document.createElement("div");
    wrap.id="leadModalDynamic";wrap.className="hidden";
    wrap.innerHTML=`
      <div class="prp-modal-backdrop"></div>
      <div class="prp-modal-card">
        <button type="button" class="prp-modal-x">×</button>
        <span class="kicker">TU RESULTADO</span>
        <h3>Completá tus datos para descargar</h3>
        <p class="prp-modal-copy">La simulación es orientativa y no reemplaza la valoración profesional. La selfie no se guarda en la base de datos.</p>
        <form id="leadFormDynamic">
          <label>Nombre y apellido<input id="leadNameDynamic" autocomplete="name" required></label>
          <label>Email<input id="leadEmailDynamic" type="email" autocomplete="email" required></label>
          <label>Teléfono / WhatsApp<input id="leadPhoneDynamic" type="tel" autocomplete="tel" required></label>
          <input id="websiteDynamic" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
          <label class="prp-check"><input id="leadConsentDynamic" type="checkbox" required><span>Acepto que PRP guarde estos datos para contactarme sobre mi consulta.</span></label>
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
      .prp-modal-card{position:relative;z-index:1;background:#fbf7f2;border-radius:28px;padding:28px;width:min(92vw,520px);max-height:88vh;overflow:auto}
      .prp-modal-card h3{font-family:"Playfair Display",Georgia,serif;font-size:30px;line-height:1.08;margin:10px 0}
      .prp-modal-copy{color:#716a62;line-height:1.45}
      .prp-modal-x{position:absolute;right:18px;top:14px;border:0;background:transparent;font-size:30px}
      #leadFormDynamic{display:grid;gap:13px}
      #leadFormDynamic label{display:grid;gap:6px;font-weight:600}
      #leadFormDynamic input[type=email],#leadFormDynamic input[type=tel],#leadFormDynamic label>input:not([type]){width:100%;box-sizing:border-box;border:1px solid #cfc7bd;border-radius:14px;padding:14px;background:white;font:inherit}
      .prp-check{grid-template-columns:22px 1fr!important;align-items:start;font-weight:400!important}
      .prp-error{background:#fff0ef;color:#9d2f26;border-radius:12px;padding:11px 12px}.prp-error.hidden{display:none}
    `;
    document.head.appendChild(style);
    wrap.querySelector(".prp-modal-backdrop").addEventListener("click",closeLeadModal);
    wrap.querySelector(".prp-modal-x").addEventListener("click",closeLeadModal);
    $("#leadFormDynamic").addEventListener("submit",saveLeadAndDownload);
  }

  async function saveLeadAndDownload(e){
    e.preventDefault();
    const btn=$("#leadSubmitDynamic"), errorBox=$("#leadErrorDynamic");
    btn.disabled=true;btn.textContent="Guardando…";
    errorBox.classList.add("hidden");errorBox.textContent="";
    const payload={
      name:$("#leadNameDynamic").value.trim(),
      email:$("#leadEmailDynamic").value.trim(),
      phone:$("#leadPhoneDynamic").value.trim(),
      consent:$("#leadConsentDynamic").checked,
      website:$("#websiteDynamic").value||"",
      proposal:state.proposal||buildPlanLabel()
    };
    try{
      const r=await fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.ok) throw new Error(data.error||"No pudimos guardar tus datos.");
      downloadResult();closeLeadModal();
    }catch(err){
      errorBox.textContent=err.message||"Hubo un problema.";
      errorBox.classList.remove("hidden");
    }finally{
      btn.disabled=false;btn.textContent="Guardar y descargar";
    }
  }

  function downloadResult(){
    const b=$("#beforeCanvas"),a=$("#afterCanvas");
    const pad=26,head=95,footer=78;
    const w=b.width*2+pad*3,h=Math.max(b.height,a.height)+head+footer+pad*2;
    const out=document.createElement("canvas");out.width=w;out.height=h;
    const ctx=out.getContext("2d");
    ctx.fillStyle="#f7f2ec";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(26,w*.025)}px Georgia`;ctx.fillText("PRP · Simulación de armonización facial",pad,55);
    ctx.font=`${Math.max(16,w*.014)}px Arial`;ctx.fillStyle="#716a62";ctx.fillText("Dra. Patricia Romero Pfaff · Córdoba, Argentina",pad,82);
    ctx.drawImage(b,pad,head+pad,b.width,b.height);ctx.drawImage(a,pad*2+b.width,head+pad,a.width,a.height);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(18,w*.016)}px Arial`;ctx.fillText("ANTES",pad,head+15);ctx.fillText("SIMULACIÓN IA",pad*2+b.width,head+15);
    ctx.fillStyle="#716a62";ctx.font=`${Math.max(14,w*.012)}px Arial`;ctx.fillText(`${state.proposal||"Full Face"} · Simulación orientativa; no garantiza resultados.`,pad,h-28);
    const link=document.createElement("a");link.href=out.toDataURL("image/jpeg",.92);link.download="PRP-simulacion-armonizacion-facial.jpg";document.body.appendChild(link);link.click();link.remove();
  }
})();
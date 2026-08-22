(() => {
  const $ = (s) => document.querySelector(s);

  const AREAS = [
    ["undereye","Ojeras"],
    ["midface","Soporte tercio medio"],
    ["cheeks","Pómulos"],
    ["lips","Labios"],
    ["chin","Mentón"],
    ["jawline","Mandíbula"],
    ["wrinkles","Arrugas"]
  ];

  const state = {
    img:null,
    fullFace:true,
    strength:1,
    areas:new Set(["undereye","midface","chin","wrinkles"]),
    timer:null,
    requestId:0,
    generated:false,
    result:null
  };

  init();

  function init(){
    bindUploads();
    rebuildControls();
    setupStrength();
    setupCompare();
    ensureStyles();
    ensureDownloadButton();
  }

  function bindUploads(){
    [$("#fileInput"),$("#fileInput2")].filter(Boolean).forEach(input=>{
      input.addEventListener("change",e=>{
        const file=e.target.files?.[0];
        if(!file) return;
        if(!file.type.startsWith("image/")) return alert("Elegí una imagen.");
        const img=new Image();
        img.onload=()=>startImage(img);
        img.src=URL.createObjectURL(file);
      });
    });
  }

  function rebuildControls(){
    const list=$("#zoneList");
    if(!list) return;
    list.innerHTML="";

    const full=document.createElement("button");
    full.type="button";
    full.id="fullFaceBtn";
    full.className="active";
    full.textContent="Full Face Armónico ✓";
    list.appendChild(full);

    full.addEventListener("click",()=>{
      state.fullFace=!state.fullFace;
      full.classList.toggle("active",state.fullFace);
      full.textContent=state.fullFace?"Full Face Armónico ✓":"Full Face Armónico";
      scheduleRender();
    });

    for(const [id,label] of AREAS){
      const b=document.createElement("button");
      b.type="button";
      b.dataset.zone=id;
      b.textContent=label+(state.areas.has(id)?" ✓":"");
      b.classList.toggle("active",state.areas.has(id));
      b.addEventListener("click",()=>{
        if(state.areas.has(id)) state.areas.delete(id); else state.areas.add(id);
        b.classList.toggle("active",state.areas.has(id));
        b.textContent=label+(state.areas.has(id)?" ✓":"");
        scheduleRender();
      });
      list.appendChild(b);
    }

    let note=$("#v6Note");
    if(!note){
      note=document.createElement("div");
      note.id="v6Note";
      note.className="v6-note";
      list.insertAdjacentElement("afterend",note);
    }
    note.textContent="Edición localizada: solo se modifica la zona seleccionada. El resto de la foto se conserva.";
  }

  function setupStrength(){
    const slider=$("#strength"),text=$("#strengthText");
    if(!slider) return;
    slider.min="1";slider.max="3";slider.step="1";slider.value="1";
    state.strength=1;
    if(text) text.textContent="Natural";
    slider.addEventListener("input",()=>{
      state.strength=Number(slider.value);
      if(text) text.textContent=state.strength===1?"Natural":state.strength===2?"Balanceado":"Definido";
      scheduleRender();
    });
  }

  function setupCompare(){
    const s=$("#compareSlider");
    if(!s) return;
    s.addEventListener("input",()=>{
      const v=Number(s.value);
      if($("#afterCanvas")) $("#afterCanvas").style.clipPath=`inset(0 0 0 ${v}%)`;
      if($("#divider")) $("#divider").style.left=`${v}%`;
    });
  }

  function ensureStyles(){
    const st=document.createElement("style");
    st.textContent=`
      .v6-note{margin:10px 0 4px;color:#6f685f;font-size:14px;line-height:1.45}
      .v6-error{margin:10px 0;padding:11px 13px;border-radius:13px;background:#fff0ef;color:#8f3028;font-size:14px}
      .v6-error.hidden{display:none}
      #generateBtn{display:none!important}
    `;
    document.head.appendChild(st);
    if(!$("#v6Error")){
      const e=document.createElement("div");
      e.id="v6Error";e.className="v6-error hidden";
      $("#v6Note")?.insertAdjacentElement("afterend",e);
    }
  }

  function startImage(img){
    state.img=img;
    state.generated=false;
    state.result=null;
    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");
    fit(img);
    drawOriginal();
    $("#downloadGateBtn")?.classList.add("hidden");
    status("Foto lista · generando vista localizada…");
    scheduleRender(150);
  }

  function fit(img){
    const max=900;
    const scale=Math.min(1,max/Math.max(img.width,img.height));
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{
      c.width=Math.max(1,Math.round(img.width*scale));
      c.height=Math.max(1,Math.round(img.height*scale));
    });
    if($("#compare")) $("#compare").style.aspectRatio=`${img.width}/${img.height}`;
  }

  function drawOriginal(){
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{
      const x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.drawImage(state.img,0,0,c.width,c.height);
    });
  }

  function scheduleRender(delay=900){
    if(!state.img) return;
    clearTimeout(state.timer);
    status("Preparando cambio…");
    state.timer=setTimeout(()=>renderAI(),delay);
  }

  async function renderAI(){
    if(!state.img) return;
    const rid=++state.requestId;
    const err=$("#v6Error"); if(err){err.classList.add("hidden");err.textContent="";}
    status("Actualizando simulación…");

    try{
      const {imageBlob,maskBlob}=await prepareImageAndMask();
      const fd=new FormData();
      fd.append("image",imageBlob,"face.png");
      fd.append("mask",maskBlob,"mask.png");
      fd.append("fullFace",state.fullFace?"1":"0");
      fd.append("strength",String(state.strength));
      fd.append("areas",JSON.stringify([...state.areas]));

      const r=await fetch("/api/simulate",{method:"POST",body:fd});
      const data=await r.json().catch(()=>({}));
      if(rid!==state.requestId) return;
      if(!r.ok||!data.ok||!data.image) throw new Error(data.error||"No se pudo generar la simulación.");

      await drawResult(data.image);
      if(rid!==state.requestId) return;
      state.generated=true;
      state.result=data.image;
      $("#downloadGateBtn")?.classList.remove("hidden");
      status("Vista actualizada");
    }catch(e){
      console.error(e);
      if(err){err.textContent=e.message||"No se pudo actualizar.";err.classList.remove("hidden");}
      status("No se pudo actualizar");
    }
  }

  async function prepareImageAndMask(){
    const before=$("#beforeCanvas");
    const w=before.width,h=before.height;

    const imgCanvas=document.createElement("canvas");
    imgCanvas.width=w;imgCanvas.height=h;
    imgCanvas.getContext("2d").drawImage(state.img,0,0,w,h);

    const mask=document.createElement("canvas");
    mask.width=w;mask.height=h;
    const m=mask.getContext("2d");
    m.fillStyle="#000";m.fillRect(0,0,w,h);
    m.fillStyle="#fff";

    const areaSet=state.areas;
    const ellipse=(cx,cy,rx,ry)=>{
      m.beginPath();m.ellipse(cx*w,cy*h,rx*w,ry*h,0,0,Math.PI*2);m.fill();
    };
    const roundRect=(x,y,ww,hh,r)=>{
      const X=x*w,Y=y*h,W=ww*w,H=hh*h,R=r*Math.min(w,h);
      m.beginPath();m.roundRect(X,Y,W,H,R);m.fill();
    };

    // Conservative normalized masks for frontal selfies.
    if(areaSet.has("undereye")){
      ellipse(.39,.39,.13,.055); ellipse(.61,.39,.13,.055);
    }
    if(areaSet.has("midface")){
      ellipse(.38,.51,.16,.12); ellipse(.62,.51,.16,.12);
    }
    if(areaSet.has("cheeks")){
      ellipse(.33,.52,.13,.11); ellipse(.67,.52,.13,.11);
    }
    if(areaSet.has("lips")){
      ellipse(.50,.69,.18,.075);
    }
    if(areaSet.has("chin")){
      ellipse(.50,.79,.16,.10);
    }
    if(areaSet.has("jawline")){
      roundRect(.19,.66,.62,.22,.06);
    }
    if(areaSet.has("wrinkles")){
      // forehead + glabella + crow's feet; preserve central eyes.
      roundRect(.25,.18,.50,.15,.04);
      ellipse(.24,.38,.055,.05); ellipse(.76,.38,.055,.05);
    }

    // Full Face never means whole-face repaint. It only broadens selected structural masks slightly.
    if(state.fullFace && areaSet.size===0){
      ellipse(.39,.39,.12,.05); ellipse(.61,.39,.12,.05);
      ellipse(.38,.51,.14,.10); ellipse(.62,.51,.14,.10);
      ellipse(.50,.79,.14,.09);
    }

    const imageBlob=await canvasBlob(imgCanvas,"image/png");
    const maskBlob=await canvasBlob(mask,"image/png");
    return {imageBlob,maskBlob};
  }

  function canvasBlob(c,type){
    return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la imagen.")),type));
  }

  function drawResult(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        const c=$("#afterCanvas"),x=c.getContext("2d");
        x.clearRect(0,0,c.width,c.height);
        x.drawImage(img,0,0,c.width,c.height);
        resolve();
      };
      img.onerror=()=>reject(new Error("La IA devolvió una imagen inválida."));
      img.src=src;
    });
  }

  function status(t){ if($("#simStatus")) $("#simStatus").textContent=t; }

  function ensureDownloadButton(){
    if($("#downloadGateBtn")) return;
    const actions=$(".sim-actions");if(!actions)return;
    const b=document.createElement("button");
    b.id="downloadGateBtn";b.type="button";b.className="btn btn-dark hidden";b.textContent="Descargar resultado";
    b.addEventListener("click",()=>{
      if(!state.generated)return;
      const c=$("#afterCanvas");
      const a=document.createElement("a");
      a.href=c.toDataURL("image/jpeg",.94);
      a.download="PRP-simulacion.jpg";
      a.click();
    });
    actions.appendChild(b);
  }
})();
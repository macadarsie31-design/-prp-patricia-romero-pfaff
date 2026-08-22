(() => {
  const $ = (s) => document.querySelector(s);
  const AREAS = [
    ["undereye","Ojeras"],["midface","Soporte tercio medio"],["cheeks","Pómulos"],
    ["lips","Labios"],["chin","Mentón"],["jawline","Mandíbula"],["wrinkles","Arrugas"]
  ];
  const state = {img:null,fullFace:true,strength:1,areas:new Set(["undereye","midface","chin","wrinkles"]),timer:null,requestId:0};

  init();

  function init(){bindUploads();rebuildControls();setupStrength();setupCompare();ensureStyles();}

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
    const list=$("#zoneList"); if(!list) return; list.innerHTML="";
    const full=document.createElement("button");
    full.type="button";full.className="active";full.textContent="Full Face Armónico ✓";
    full.onclick=()=>{state.fullFace=!state.fullFace;full.classList.toggle("active",state.fullFace);full.textContent=state.fullFace?"Full Face Armónico ✓":"Full Face Armónico";scheduleRender();};
    list.appendChild(full);

    for(const [id,label] of AREAS){
      const b=document.createElement("button");
      b.type="button"; b.dataset.zone=id; b.classList.toggle("active",state.areas.has(id));
      b.textContent=label+(state.areas.has(id)?" ✓":"");
      b.onclick=()=>{state.areas.has(id)?state.areas.delete(id):state.areas.add(id);b.classList.toggle("active",state.areas.has(id));b.textContent=label+(state.areas.has(id)?" ✓":"");scheduleRender();};
      list.appendChild(b);
    }

    const note=document.createElement("div");
    note.id="v61Note";note.className="v61-note";note.textContent="Edición localizada automática. El resto de la foto se conserva.";
    list.insertAdjacentElement("afterend",note);
    const err=document.createElement("div");
    err.id="v61Error";err.className="v61-error hidden";note.insertAdjacentElement("afterend",err);
  }

  function setupStrength(){
    const s=$("#strength"),t=$("#strengthText"); if(!s) return;
    s.min="1";s.max="3";s.step="1";s.value="1"; state.strength=1;
    if(t)t.textContent="Natural";
    s.addEventListener("input",()=>{state.strength=Number(s.value);if(t)t.textContent=state.strength===1?"Natural":state.strength===2?"Balanceado":"Definido";scheduleRender();});
  }

  function setupCompare(){
    const s=$("#compareSlider"); if(!s) return;
    s.addEventListener("input",()=>{const v=Number(s.value);if($("#afterCanvas"))$("#afterCanvas").style.clipPath=`inset(0 0 0 ${v}%)`;if($("#divider"))$("#divider").style.left=`${v}%`;});
  }

  function ensureStyles(){
    const st=document.createElement("style");
    st.textContent=`.v61-note{margin:10px 0 4px;color:#6f685f;font-size:14px;line-height:1.45}.v61-error{margin:10px 0;padding:11px 13px;border-radius:13px;background:#fff0ef;color:#8f3028;font-size:14px;white-space:pre-wrap}.v61-error.hidden{display:none}#generateBtn{display:none!important}`;
    document.head.appendChild(st);
  }

  function startImage(img){
    state.img=img;
    $("#simEmpty")?.classList.add("hidden");$("#simWorkspace")?.classList.remove("hidden");
    fitDisplay(img);drawOriginal();status("Foto lista · generando…");scheduleRender(200);
  }

  function fitDisplay(img){
    const max=900,scale=Math.min(1,max/Math.max(img.width,img.height));
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));});
    if($("#compare"))$("#compare").style.aspectRatio=`${img.width}/${img.height}`;
  }

  function drawOriginal(){
    [$("#beforeCanvas"),$("#afterCanvas")].filter(Boolean).forEach(c=>{const x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.drawImage(state.img,0,0,c.width,c.height);});
  }

  function scheduleRender(delay=900){if(!state.img)return;clearTimeout(state.timer);state.timer=setTimeout(renderAI,delay);}

  async function renderAI(){
    const rid=++state.requestId,err=$("#v61Error");
    if(err){err.classList.add("hidden");err.textContent="";}
    status("Actualizando simulación…");
    try{
      const p=await prepareFixedInput();
      const fd=new FormData();
      fd.append("image",p.imageBlob,"face.png");fd.append("mask",p.maskBlob,"mask.png");
      fd.append("width",String(p.width));fd.append("height",String(p.height));
      fd.append("strength",String(state.strength));fd.append("areas",JSON.stringify([...state.areas]));
      const r=await fetch("/api/simulate",{method:"POST",body:fd});
      const data=await r.json().catch(()=>({}));
      if(rid!==state.requestId)return;
      if(!r.ok||!data.ok||!data.image)throw new Error(data.error||`Error HTTP ${r.status}`);
      await drawResult(data.image);
      if(rid!==state.requestId)return;
      status("Vista actualizada");
    }catch(e){
      if(err){err.textContent=e.message||"No se pudo actualizar.";err.classList.remove("hidden");}
      status("No se pudo actualizar");
    }
  }

  async function prepareFixedInput(){
    const W=512,H=768;
    const source=document.createElement("canvas");source.width=W;source.height=H;
    const ctx=source.getContext("2d");
    const iw=state.img.naturalWidth||state.img.width,ih=state.img.naturalHeight||state.img.height;
    const scale=Math.max(W/iw,H/ih),sw=W/scale,sh=H/scale,cx=(iw-sw)/2,cy=(ih-sh)/2;
    ctx.drawImage(state.img,cx,cy,sw,sh,0,0,W,H);

    const mask=document.createElement("canvas");mask.width=W;mask.height=H;
    const m=mask.getContext("2d");m.fillStyle="#000";m.fillRect(0,0,W,H);m.fillStyle="#fff";
    const ellipse=(cx,cy,rx,ry)=>{m.beginPath();m.ellipse(cx*W,cy*H,rx*W,ry*H,0,0,Math.PI*2);m.fill();};
    const box=(x,y,w,h,r=.025)=>{m.beginPath();m.roundRect(x*W,y*H,w*W,h*H,r*Math.min(W,H));m.fill();};

    if(state.areas.has("undereye")){ellipse(.39,.39,.12,.05);ellipse(.61,.39,.12,.05);}
    if(state.areas.has("midface")){ellipse(.39,.50,.14,.105);ellipse(.61,.50,.14,.105);}
    if(state.areas.has("cheeks")){ellipse(.32,.51,.12,.10);ellipse(.68,.51,.12,.10);}
    if(state.areas.has("lips"))ellipse(.50,.69,.17,.065);
    if(state.areas.has("chin"))ellipse(.50,.79,.15,.085);
    if(state.areas.has("jawline"))box(.20,.67,.60,.18,.05);
    if(state.areas.has("wrinkles")){box(.27,.20,.46,.12,.03);ellipse(.24,.38,.05,.045);ellipse(.76,.38,.05,.045);}

    return {width:W,height:H,imageBlob:await blob(source),maskBlob:await blob(mask)};
  }

  function blob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la imagen.")),"image/png"))}

  function drawResult(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{const c=$("#afterCanvas"),x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);const s=Math.max(c.width/img.width,c.height/img.height),sw=c.width/s,sh=c.height/s,sx=(img.width-sw)/2,sy=(img.height-sh)/2;x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);resolve();};
      img.onerror=()=>reject(new Error("La IA devolvió una imagen inválida."));
      img.src=src;
    });
  }

  function status(t){if($("#simStatus"))$("#simStatus").textContent=t;}
})();
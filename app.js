(() => {
"use strict";

const $ = s => document.querySelector(s);

const AREA_LABELS = {
  undereye:"Ojeras",
  temples:"Sienes",
  midface:"Soporte tercio medio",
  cheeks:"Pómulos",
  nose:"Nariz",
  perioral:"Nasolabial / Perioral",
  lips:"Labios",
  chin:"Mentón",
  prejowl:"Pre-jowl",
  jawline:"Mandíbula",
  wrinkles:"Arrugas"
};
const AREA_ORDER = ["undereye","temples","midface","cheeks","nose","perioral","lips","chin","prejowl","jawline","wrinkles"];

const state = {
  source:null,
  landmarks:null,
  triangles:null,
  detector:null,
  detectorReady:false,
  Delaunator:null,
  intensity:55,
  fullFace:true,
  areas:new Set(),
  analysis:null,
  raf:0,
  maxDisplacement:0
};

init();

async function init(){
  removeEntityMed();
  observeEntityMed();
  injectStyles();
  buildControls();
  bindUpload();
  setupStrength();
  setupCompare();
  hideLegacyGenerate();
  setStatus("Cargando escáner facial…");
  await Promise.all([loadFaceDetector(), loadDelaunator()]);
  setStatus(state.detectorReady && state.Delaunator ? "Escáner listo · subí una selfie." : "No se pudo cargar el motor facial.");
}

function removeEntityMed(root=document.body){
  if(!root) return;
  const rx=/No\s+se\s+env[ií]a\s+a\s+EntityMed\.?/gi;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  for(const n of nodes){
    const t=n.nodeValue||""; rx.lastIndex=0;
    if(!rx.test(t)) continue;
    rx.lastIndex=0; n.nodeValue=t.replace(rx,"").replace(/\s{2,}/g," ").trim();
  }
}
function observeEntityMed(){
  if(!document.body||!window.MutationObserver) return;
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
    if(n.nodeType===1) removeEntityMed(n);
    else if(n.nodeType===3 && /EntityMed/i.test(n.nodeValue||"")) removeEntityMed(n.parentElement||document.body);
  }))).observe(document.body,{subtree:true,childList:true});
}

async function loadFaceDetector(){
  try{
    const vision=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
    const fileset=await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
    state.detector=await vision.FaceLandmarker.createFromOptions(fileset,{
      baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"},
      runningMode:"IMAGE",numFaces:1,
      outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
    });
    state.detectorReady=true;
  }catch(e){ console.error(e); state.detectorReady=false; }
}
async function loadDelaunator(){
  try{
    const mod=await import("https://cdn.jsdelivr.net/npm/delaunator@5.0.1/+esm");
    state.Delaunator=mod.default;
  }catch(e){ console.error(e); }
}

function injectStyles(){
  if($("#prpV11Style")) return;
  const s=document.createElement("style"); s.id="prpV11Style";
  s.textContent=`
    #generateBtn{display:none!important}
    .v11-live{display:inline-flex;gap:7px;align-items:center;padding:7px 11px;border-radius:999px;background:#edf4ef;color:#294b3d;font-size:13px;font-weight:700;margin:8px 0}
    .v11-live:before{content:"";width:8px;height:8px;border-radius:50%;background:#418267}
    .v11-plan{margin:12px 0;padding:14px;border:1px solid #e5ddd3;border-radius:18px;background:#fffdfa}
    .v11-plan.hidden{display:none}.v11-plan h4{font-family:Georgia,serif;font-size:20px;margin:0 0 8px}
    .v11-plan p{font-size:12px;color:#756e67;line-height:1.45;margin:6px 0}
    #zoneList button.active::after{content:" ✓"}
    .v11-metric{font-variant-numeric:tabular-nums;color:#315746;font-weight:700}
  `;
  document.head.appendChild(s);
}
function hideLegacyGenerate(){ const b=$("#generateBtn"); if(b)b.style.display="none"; }

function buildControls(){
  const list=$("#zoneList"); if(!list)return;
  list.innerHTML="";
  const full=document.createElement("button");
  full.id="fullFaceBtn"; full.type="button"; full.className="active"; full.textContent="Full Face Armónico";
  full.onclick=()=>{
    state.fullFace=!state.fullFace; full.classList.toggle("active",state.fullFace);
    if(state.fullFace && state.analysis) activateRecommended();
    syncButtons(); scheduleRender();
  };
  list.appendChild(full);
  for(const id of AREA_ORDER){
    const b=document.createElement("button"); b.type="button"; b.dataset.zone=id; b.textContent=AREA_LABELS[id];
    b.onclick=()=>{
      state.fullFace=false; full.classList.remove("active");
      state.areas.has(id)?state.areas.delete(id):state.areas.add(id);
      syncButtons(); scheduleRender();
    };
    list.appendChild(b);
  }
  const live=document.createElement("div");live.className="v11-live";live.id="v11Live";live.textContent="Simulación local en vivo · sin costo por movimiento";
  list.insertAdjacentElement("afterend",live);
  const plan=document.createElement("div");plan.className="v11-plan hidden";plan.id="v11Plan";live.insertAdjacentElement("afterend",plan);
}
function syncButtons(){
  AREA_ORDER.forEach(id=>{const b=document.querySelector(`#zoneList button[data-zone="${id}"]`);if(b)b.classList.toggle("active",state.areas.has(id));});
}

function bindUpload(){
  [$("#fileInput"),$("#fileInput2")].filter(Boolean).forEach(input=>input.addEventListener("change",e=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/"))return alert("Elegí una foto.");
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=async()=>{try{await startImage(img)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);alert("No pudimos abrir esa foto.")};
    img.src=url;
  }));
}
function setupStrength(){
  const s=$("#strength"),t=$("#strengthText");if(!s)return;
  s.min="0";s.max="100";s.step="1";s.value=String(state.intensity);
  const label=()=>{if(t){const n=state.intensity,w=n<25?"Natural":n<60?"Balanceado":n<85?"Visible":"Definido";t.textContent=`${n}% · ${w}`}};
  label();
  s.addEventListener("input",()=>{state.intensity=clamp(+s.value,0,100);label();scheduleRender()});
}
function setupCompare(){
  const s=$("#compareSlider");if(!s)return;
  s.addEventListener("input",()=>{const v=clamp(+s.value,0,100);$("#afterCanvas").style.clipPath=`inset(0 0 0 ${v}%)`;$("#divider").style.left=`${v}%`});
}

async function startImage(img){
  if(!state.detectorReady||!state.Delaunator){alert("El escáner todavía está cargando. Esperá unos segundos y probá otra vez.");return;}
  $("#simEmpty")?.classList.add("hidden"); $("#simWorkspace")?.classList.remove("hidden");
  const before=$("#beforeCanvas"),after=$("#afterCanvas");
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,1000/Math.max(iw,ih));
  const w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale));
  before.width=after.width=w;before.height=after.height=h;if($("#compare"))$("#compare").style.aspectRatio=`${w}/${h}`;
  const source=document.createElement("canvas");source.width=w;source.height=h;source.getContext("2d").drawImage(img,0,0,w,h);state.source=source;
  before.getContext("2d").drawImage(source,0,0);after.getContext("2d").drawImage(source,0,0);

  setStatus("Escaneando 478 puntos faciales…");
  let res;
  try{res=state.detector.detect(source)}catch(e){console.error(e);alert("No se pudo analizar esta foto.");return;}
  const lm=res?.faceLandmarks?.[0];
  if(!lm||lm.length<468){alert("No pude detectar el rostro con suficiente precisión. Usá una foto frontal o 3/4, con la cara completa y buena luz.");return;}
  state.landmarks=lm.map(p=>({x:p.x*w,y:p.y*h,z:p.z||0}));
  state.triangles=Array.from(state.Delaunator.from(state.landmarks.map(p=>[p.x,p.y])).triangles);
  state.analysis=analyzeFace();activateRecommended();syncButtons();renderPlan();
  setStatus("Escaneo completo · mové la intensidad.");scheduleRender();
}

function scheduleRender(){
  if(!state.landmarks||!state.source)return;
  if(state.raf)cancelAnimationFrame(state.raf);
  state.raf=requestAnimationFrame(render);
}

function render(){
  state.raf=0;
  const after=$("#afterCanvas"),ctx=after.getContext("2d");
  const amount=state.intensity/100;
  const target=buildTarget(amount);
  state.maxDisplacement=maxDisplacement(state.landmarks,target);

  // Always redraw from ORIGINAL. No cumulative degradation.
  ctx.clearRect(0,0,after.width,after.height);
  ctx.drawImage(state.source,0,0);

  // Robust Safari-friendly 2D piecewise affine warp.
  if(amount>0.001 && state.areas.size){
    for(let k=0;k<state.triangles.length;k+=3){
      const i0=state.triangles[k],i1=state.triangles[k+1],i2=state.triangles[k+2];
      drawTriangle(ctx,state.source,state.landmarks[i0],state.landmarks[i1],state.landmarks[i2],target[i0],target[i1],target[i2]);
    }
    applyRetouch(ctx,amount);
  }
  setStatus(`Vista en vivo · ${state.intensity}% · cambio máximo ${state.maxDisplacement.toFixed(1)} px`);
}

function buildTarget(amount){
  const target=state.landmarks.map(p=>({...p}));
  if(amount<=0)return target;
  const g=geometry();
  for(let i=0;i<target.length;i++){
    const o=state.landmarks[i],p=target[i];
    const zone=(cx,cy,rx,ry,dx,dy,radial=0)=>{
      const nx=(o.x-cx)/rx,ny=(o.y-cy)/ry,r2=nx*nx+ny*ny;if(r2>=1)return;
      const f=Math.pow(1-r2,2.0)*amount;
      p.x+=dx*f;p.y+=dy*f;p.x+=(o.x-cx)*radial*f;p.y+=(o.y-cy)*radial*f;
    };

    // These strengths are intentionally visible at 100%, while still bounded.
    if(state.areas.has("undereye")){
      zone(g.le.x,g.le.y+g.fh*.065,g.ed*.45,g.fh*.095,0,-g.fh*.026,0);
      zone(g.re.x,g.re.y+g.fh*.065,g.ed*.45,g.fh*.095,0,-g.fh*.026,0);
    }
    if(state.areas.has("temples")){
      zone(g.c.x-g.fw*.40,g.le.y-g.fh*.04,g.fw*.17,g.fh*.18,-g.fw*.014,0,.045);
      zone(g.c.x+g.fw*.40,g.re.y-g.fh*.04,g.fw*.17,g.fh*.18,g.fw*.014,0,.045);
    }
    if(state.areas.has("midface")){
      zone(g.lc.x,g.lc.y,g.fw*.24,g.fh*.19,-g.fw*.006,-g.fh*.032,.070);
      zone(g.rc.x,g.rc.y,g.fw*.24,g.fh*.19,g.fw*.006,-g.fh*.032,.070);
    }
    if(state.areas.has("cheeks")){
      zone(g.lc.x,g.lc.y,g.fw*.21,g.fh*.17,-g.fw*.017,-g.fh*.022,.105);
      zone(g.rc.x,g.rc.y,g.fw*.21,g.fh*.17,g.fw*.017,-g.fh*.022,.105);
    }
    if(state.areas.has("nose")) zone(g.nose.x,g.nose.y,g.fw*.13,g.fh*.18,0,0,-.055);
    if(state.areas.has("perioral")) zone(g.lips.x,g.lips.y-g.fh*.06,g.fw*.27,g.fh*.15,0,-g.fh*.010,.035);
    if(state.areas.has("lips")) zone(g.lips.x,g.lips.y,g.lw*.78,g.fh*.082,0,0,.185);
    if(state.areas.has("chin")) zone(g.chin.x,g.chin.y-g.fh*.05,g.fw*.21,g.fh*.16,0,g.fh*.035,.065);
    if(state.areas.has("prejowl")){
      zone(g.c.x-g.fw*.29,g.chin.y-g.fh*.12,g.fw*.17,g.fh*.13,g.fw*.015,-g.fh*.013,.035);
      zone(g.c.x+g.fw*.29,g.chin.y-g.fh*.12,g.fw*.17,g.fh*.13,-g.fw*.015,-g.fh*.013,.035);
    }
    if(state.areas.has("jawline")){
      const y0=g.le.y+g.fh*.27,y1=g.chin.y,t=(o.y-y0)/(y1-y0);
      if(t>0&&t<1){const side=Math.sign(o.x-g.c.x),ad=Math.abs(o.x-g.c.x)/g.fw;if(ad>.27&&ad<.60){const f=Math.sin(Math.PI*t)*smoothstep(.27,.36,ad)*(1-smoothstep(.51,.60,ad))*amount;p.x-=side*g.fw*.055*f;}}
    }
  }
  return target;
}

function drawTriangle(ctx,img,s0,s1,s2,d0,d1,d2){
  const denom=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);
  if(Math.abs(denom)<1e-4)return;
  const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/denom;
  const c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/denom;
  const e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/denom;
  const b=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/denom;
  const d=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/denom;
  const f=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/denom;
  ctx.save();ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();
  ctx.setTransform(a,b,c,d,e,f);ctx.drawImage(img,0,0);ctx.restore();
}

function applyRetouch(ctx,amount){
  if(!state.areas.has("undereye")&&!state.areas.has("wrinkles"))return;
  const blur=document.createElement("canvas");blur.width=ctx.canvas.width;blur.height=ctx.canvas.height;
  const bc=blur.getContext("2d");bc.filter="blur(1.8px)";bc.drawImage(ctx.canvas,0,0);
  const g=geometry();
  if(state.areas.has("undereye")){
    retouchEllipse(ctx,blur,g.le.x,g.le.y+g.fh*.072,g.ed*.45,g.fh*.075,.34*amount);
    retouchEllipse(ctx,blur,g.re.x,g.re.y+g.fh*.072,g.ed*.45,g.fh*.075,.34*amount);
  }
  if(state.areas.has("wrinkles")){
    retouchEllipse(ctx,blur,g.c.x,g.fore.y+g.fh*.12,g.fw*.34,g.fh*.15,.30*amount);
    retouchEllipse(ctx,blur,g.c.x,g.le.y-g.fh*.055,g.ed*.22,g.fh*.075,.28*amount);
  }
}
function retouchEllipse(ctx,blur,cx,cy,rx,ry,alpha){ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();ctx.globalAlpha=alpha;ctx.drawImage(blur,0,0);ctx.restore();}

function geometry(){
  const P=i=>state.landmarks[i],avg=(...ps)=>({x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length});
  const le=avg(P(33),P(133),P(159),P(145)),re=avg(P(362),P(263),P(386),P(374));
  const lips=avg(P(61),P(291),P(13),P(14)),chin=P(152),fore=avg(P(10),P(109),P(338)),lj=P(234),rj=P(454),nose=P(1);
  const fw=dist(lj,rj),fh=dist(fore,chin),ed=dist(le,re),lw=dist(P(61),P(291)),c={x:(lj.x+rj.x)/2,y:(fore.y+chin.y)/2};
  return {le,re,lips,chin,fore,lj,rj,nose,fw,fh,ed,lw,c,lc:{x:le.x-fw*.04,y:le.y+fh*.20},rc:{x:re.x+fw*.04,y:re.y+fh*.20}};
}

function analyzeFace(){
  const g=geometry(),lipRatio=g.lw/g.fw,lower=dist(g.lips,g.chin)/g.fh,faceRatio=g.fh/g.fw;
  const areas={
    undereye:item("A","Mejorar transición párpado–mejilla sin borrar anatomía."),
    temples:item("C","Conservar sienes salvo déficit evidente."),
    midface:item("A","Dar soporte visual al tercio medio."),
    cheeks:faceRatio>1.22?item("B","Refinar curva Ogee y soporte malar."):item("C","Conservar proyección de pómulos."),
    nose:item("C","Conservar identidad nasal."),
    perioral:item("B","Refinar soporte perioral sin borrar pliegues."),
    lips:lipRatio<.25?item("B","Optimizar proporción labial conservando identidad."):item("C","Conservar proporción labial."),
    chin:(lower<.20||lower>.31)?item("B","Equilibrar tercio inferior."):item("C","Conservar mentón."),
    prejowl:item("B","Mejorar continuidad pre-jowl."),
    jawline:item("B","Refinar continuidad mandibular sin V-line artificial."),
    wrinkles:item("B","Suavizar líneas manteniendo textura real.")
  };
  return {areas,summary:"Full Face aplica solo zonas A/B. Las zonas C se mantienen iguales al original."};
}
function item(priority,objective){return{priority,objective}}
function activateRecommended(){state.areas.clear();if(!state.analysis)return;AREA_ORDER.forEach(id=>{const p=state.analysis.areas[id]?.priority;if(p==="A"||p==="B")state.areas.add(id)});}
function renderPlan(){
  const p=$("#v11Plan");if(!p||!state.analysis)return;p.classList.remove("hidden");
  const active=AREA_ORDER.filter(id=>state.analysis.areas[id].priority!=="C").map(id=>AREA_LABELS[id]).join(", ");
  p.innerHTML=`<h4>Full Face — Best Version</h4><p>${esc(state.analysis.summary)}</p><p><b>Zonas sugeridas:</b> ${esc(active)}</p><p>El slider modifica la misma foto en tiempo real. 0% = original; 100% = transformación completa.</p>`;
}

function maxDisplacement(a,b){let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,dist(a[i],b[i]));return m;}
function setStatus(t){const n=$("#simStatus");if(n)n.textContent=t}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function clamp(v,a,b){return Math.min(b,Math.max(a,Number.isFinite(v)?v:a))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
})();

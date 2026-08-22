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

const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

const state = {
  img:null,
  source:null,
  landmarks:null,
  target:null,
  detector:null,
  detectorReady:false,
  delaunator:null,
  triangles:null,
  gl:null,
  glCanvas:null,
  glProgram:null,
  posBuffer:null,
  uvBuffer:null,
  indexBuffer:null,
  texture:null,
  intensity:55,
  fullFace:true,
  areas:new Set(),
  analysis:null,
  raf:0
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
  setStatus(state.detectorReady && state.delaunator ? "Escáner listo · subí una selfie." : "No se pudo cargar el motor facial.");
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
    const p=n.parentElement;
    if(p && !p.textContent.trim() && !p.querySelector("img,svg,button,input,a")) p.style.display="none";
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
  }catch(e){ console.error("FaceLandmarker load failed",e); state.detectorReady=false; }
}
async function loadDelaunator(){
  try{
    const mod=await import("https://cdn.jsdelivr.net/npm/delaunator@5.0.1/+esm");
    state.delaunator=mod.default;
  }catch(e){ console.error("Delaunator load failed",e); }
}

function injectStyles(){
  const s=document.createElement("style");
  s.textContent=`
    #generateBtn{display:none!important}
    .v10-live{display:inline-flex;gap:7px;align-items:center;padding:7px 11px;border-radius:999px;background:#edf4ef;color:#294b3d;font-size:13px;font-weight:700;margin:8px 0}
    .v10-live:before{content:"";width:8px;height:8px;border-radius:50%;background:#418267}
    .v10-plan{margin:12px 0;padding:14px;border:1px solid #e5ddd3;border-radius:18px;background:#fffdfa}
    .v10-plan.hidden{display:none}
    .v10-plan h4{font-family:Georgia,serif;font-size:20px;margin:0 0 8px}
    .v10-row{display:grid;grid-template-columns:32px 1fr;gap:8px;padding:7px 0;border-top:1px solid #eee7df}
    .v10-row:first-of-type{border-top:0}
    .v10-badge{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px}
    .v10-badge.a{background:#223a30;color:#fff}.v10-badge.b{background:#eadfca;color:#654f2f}.v10-badge.c{background:#eeeae5;color:#777}
    .v10-title{font-weight:700}.v10-copy{font-size:12px;color:#756e67;line-height:1.35;margin-top:2px}
    #zoneList button.active::after{content:"✓";margin-left:6px}
  `;
  document.head.appendChild(s);
}
function hideLegacyGenerate(){ const b=$("#generateBtn"); if(b) b.style.display="none"; }

function buildControls(){
  const list=$("#zoneList"); if(!list) return;
  list.innerHTML="";
  const full=document.createElement("button");
  full.id="fullFaceBtn"; full.type="button"; full.className="active"; full.textContent="Full Face — Best Version";
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
  const live=document.createElement("div"); live.className="v10-live"; live.id="v10Live";
  live.textContent="Escaneo anatómico + morph WebGL en vivo";
  list.insertAdjacentElement("afterend",live);
  const plan=document.createElement("div"); plan.className="v10-plan hidden"; plan.id="v10Plan";
  live.insertAdjacentElement("afterend",plan);
}
function syncButtons(){
  AREA_ORDER.forEach(id=>{
    const b=document.querySelector(`#zoneList button[data-zone="${id}"]`);
    if(b) b.classList.toggle("active",state.areas.has(id));
  });
}

function bindUpload(){
  [$("#fileInput"),$("#fileInput2")].filter(Boolean).forEach(input=>{
    input.addEventListener("change",e=>{
      const file=e.target.files?.[0]; if(!file) return;
      if(!file.type.startsWith("image/")) return alert("Elegí una foto.");
      const img=new Image(), url=URL.createObjectURL(file);
      img.onload=async()=>{ try{await startImage(img)}finally{URL.revokeObjectURL(url)} };
      img.onerror=()=>{URL.revokeObjectURL(url);alert("No pudimos abrir esa foto.")};
      img.src=url;
    });
  });
}
function setupStrength(){
  const s=$("#strength"),t=$("#strengthText"); if(!s) return;
  s.min="0";s.max="100";s.step="1";s.value=String(state.intensity);
  const label=()=>{ if(t){const n=state.intensity,w=n<25?"Sutil":n<60?"Balanceado":n<85?"Visible":"Definido";t.textContent=`${n}%  ${w}`;} };
  label();
  s.addEventListener("input",()=>{state.intensity=clamp(+s.value,0,100);label();scheduleRender();});
}
function setupCompare(){
  const s=$("#compareSlider"); if(!s) return;
  s.addEventListener("input",()=>{const v=clamp(+s.value,0,100);if($("#afterCanvas"))$("#afterCanvas").style.clipPath=`inset(0 0 0 ${v}%)`;if($("#divider"))$("#divider").style.left=`${v}%`;});
}

async function startImage(img){
  if(!state.detectorReady||!state.delaunator){ alert("El motor facial todavía no terminó de cargar. Esperá unos segundos y probá de nuevo."); return; }
  state.img=img;
  $("#simEmpty")?.classList.add("hidden"); $("#simWorkspace")?.classList.remove("hidden");
  const before=$("#beforeCanvas"),after=$("#afterCanvas"); if(!before||!after) return alert("No encontramos el visor.");

  const max=900,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,max/Math.max(iw,ih));
  const w=Math.max(1,Math.round(iw*scale)),h=Math.max(1,Math.round(ih*scale));
  before.width=after.width=w; before.height=after.height=h;
  if($("#compare")) $("#compare").style.aspectRatio=`${w}/${h}`;

  const source=document.createElement("canvas"); source.width=w; source.height=h;
  source.getContext("2d").drawImage(img,0,0,w,h);
  state.source=source;
  before.getContext("2d").drawImage(source,0,0);
  after.getContext("2d").drawImage(source,0,0);

  setStatus("Escaneando 478 puntos faciales…");
  const res=state.detector.detect(source);
  const lm=res?.faceLandmarks?.[0];
  if(!lm||lm.length<468){ alert("No pude detectar el rostro con suficiente precisión. Usá una selfie con el rostro completo y buena luz."); return; }
  state.landmarks=lm.map(p=>({x:p.x*w,y:p.y*h,z:p.z||0}));

  const pts=state.landmarks.map(p=>[p.x,p.y]);
  state.triangles=Array.from(state.delaunator.from(pts).triangles);

  initGL(w,h);
  state.analysis=analyzeFace(w,h);
  activateRecommended(); syncButtons(); renderPlan();
  setStatus("Escaneo completo · Full Face listo.");
  scheduleRender();
}

function initGL(w,h){
  const glc=document.createElement("canvas"); glc.width=w; glc.height=h;
  const gl=glc.getContext("webgl2",{alpha:true,premultipliedAlpha:true});
  if(!gl) throw new Error("Este navegador no soporta WebGL2.");
  const vs=`#version 300 es
  in vec2 a_position; in vec2 a_uv; out vec2 v_uv;
  uniform vec2 u_resolution;
  void main(){vec2 zero=a_position/u_resolution;vec2 clip=zero*2.0-1.0;gl_Position=vec4(clip.x,-clip.y,0,1);v_uv=a_uv;}`;
  const fs=`#version 300 es
  precision mediump float; in vec2 v_uv; uniform sampler2D u_image; out vec4 outColor;
  void main(){outColor=texture(u_image,v_uv);}`;
  const prog=createProgram(gl,vs,fs);
  const pos=gl.createBuffer(),uv=gl.createBuffer(),idx=gl.createBuffer();
  const uvs=new Float32Array(state.landmarks.flatMap(p=>[p.x/w,p.y/h]));
  gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(state.triangles),gl.STATIC_DRAW);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,state.source);
  gl.useProgram(prog);
  const pa=gl.getAttribLocation(prog,"a_position"),ua=gl.getAttribLocation(prog,"a_uv");
  gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.enableVertexAttribArray(ua);gl.vertexAttribPointer(ua,2,gl.FLOAT,false,0,0);
  gl.uniform2f(gl.getUniformLocation(prog,"u_resolution"),w,h);
  gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);
  state.gl=gl;state.glCanvas=glc;state.glProgram=prog;state.posBuffer=pos;state.uvBuffer=uv;state.indexBuffer=idx;state.texture=tex;
}
function createProgram(gl,vsSrc,fsSrc){
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vsSrc));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fsSrc));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
}

function scheduleRender(){ if(!state.landmarks||!state.gl) return; if(state.raf)cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(render); }
function render(){
  state.raf=0;
  const amount=state.intensity/100, target=state.landmarks.map(p=>({...p}));
  if(amount>0){
    const g=geometry();
    for(let i=0;i<target.length;i++){
      let p=target[i],o=state.landmarks[i];
      const apply=(cx,cy,rx,ry,dx,dy,radial=0)=>{
        const nx=(o.x-cx)/rx,ny=(o.y-cy)/ry,r2=nx*nx+ny*ny;if(r2>=1)return;
        const f=Math.pow(1-r2,2.25)*amount;
        p.x+=dx*f;p.y+=dy*f;
        if(radial){p.x+=(o.x-cx)*radial*f;p.y+=(o.y-cy)*radial*f;}
      };
      if(state.areas.has("undereye")){
        apply(g.le.x,g.le.y+g.fh*.07,g.ed*.42,g.fh*.09,0,-g.fh*.018,0);
        apply(g.re.x,g.re.y+g.fh*.07,g.ed*.42,g.fh*.09,0,-g.fh*.018,0);
      }
      if(state.areas.has("temples")){
        apply(g.c.x-g.fw*.39,g.le.y-g.fh*.03,g.fw*.16,g.fh*.18,-g.fw*.012,0,.025);
        apply(g.c.x+g.fw*.39,g.re.y-g.fh*.03,g.fw*.16,g.fh*.18,g.fw*.012,0,.025);
      }
      if(state.areas.has("midface")){
        apply(g.lc.x,g.lc.y,g.fw*.22,g.fh*.18,-g.fw*.002,-g.fh*.025,.032);
        apply(g.rc.x,g.rc.y,g.fw*.22,g.fh*.18,g.fw*.002,-g.fh*.025,.032);
      }
      if(state.areas.has("cheeks")){
        apply(g.lc.x,g.lc.y,g.fw*.20,g.fh*.16,-g.fw*.012,-g.fh*.018,.055);
        apply(g.rc.x,g.rc.y,g.fw*.20,g.fh*.16,g.fw*.012,-g.fh*.018,.055);
      }
      if(state.areas.has("nose")){
        apply(g.nose.x,g.nose.y,g.fw*.12,g.fh*.19,0,0,-.035);
      }
      if(state.areas.has("perioral")){
        apply(g.lips.x,g.lips.y-g.fh*.055,g.fw*.25,g.fh*.14,0,-g.fh*.008,.018);
      }
      if(state.areas.has("lips")){
        apply(g.lips.x,g.lips.y,g.lw*.70,g.fh*.075,0,0,.095);
      }
      if(state.areas.has("chin")){
        apply(g.chin.x,g.chin.y-g.fh*.04,g.fw*.20,g.fh*.15,0,g.fh*.022,.025);
      }
      if(state.areas.has("prejowl")){
        apply(g.c.x-g.fw*.28,g.chin.y-g.fh*.12,g.fw*.15,g.fh*.12,g.fw*.010,-g.fh*.010,.02);
        apply(g.c.x+g.fw*.28,g.chin.y-g.fh*.12,g.fw*.15,g.fh*.12,-g.fw*.010,-g.fh*.010,.02);
      }
      if(state.areas.has("jawline")){
        const yy=(o.y-(g.le.y+g.fh*.26))/(g.chin.y-(g.le.y+g.fh*.26));
        if(yy>0&&yy<1){
          const side=Math.sign(o.x-g.c.x),ad=Math.abs(o.x-g.c.x)/g.fw;
          if(ad>.27&&ad<.58){const f=Math.sin(Math.PI*yy)*smoothstep(.27,.36,ad)*(1-smoothstep(.50,.59,ad))*amount;p.x-=side*g.fw*.035*f;}
        }
      }
    }
  }
  state.target=target;
  drawGL();
  compositeAndRetouch(amount);
  setStatus(`Vista en vivo · ${state.intensity}%`);
}
function drawGL(){
  const gl=state.gl,w=state.glCanvas.width,h=state.glCanvas.height;
  gl.clear(gl.COLOR_BUFFER_BIT);
  const positions=new Float32Array(state.target.flatMap(p=>[p.x,p.y]));
  gl.bindBuffer(gl.ARRAY_BUFFER,state.posBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,state.indexBuffer);
  gl.drawElements(gl.TRIANGLES,state.triangles.length,gl.UNSIGNED_INT,0);
}
function compositeAndRetouch(amount){
  const after=$("#afterCanvas"),ctx=after.getContext("2d");
  ctx.clearRect(0,0,after.width,after.height);ctx.drawImage(state.source,0,0);
  const overlay=document.createElement("canvas");overlay.width=after.width;overlay.height=after.height;
  const oc=overlay.getContext("2d");oc.drawImage(state.glCanvas,0,0);
  // feathered face mask
  const mask=document.createElement("canvas");mask.width=after.width;mask.height=after.height;
  const mc=mask.getContext("2d");mc.fillStyle="#fff";mc.beginPath();
  FACE_OVAL.forEach((idx,k)=>{const p=state.target[idx];k?mc.lineTo(p.x,p.y):mc.moveTo(p.x,p.y)});mc.closePath();mc.fill();
  const soft=document.createElement("canvas");soft.width=after.width;soft.height=after.height;
  const sc=soft.getContext("2d");sc.filter="blur(3px)";sc.drawImage(mask,0,0);
  oc.globalCompositeOperation="destination-in";oc.drawImage(soft,0,0);oc.globalCompositeOperation="source-over";
  ctx.drawImage(overlay,0,0);

  if(amount>0 && (state.areas.has("undereye")||state.areas.has("wrinkles"))){
    const blur=document.createElement("canvas");blur.width=after.width;blur.height=after.height;
    const bc=blur.getContext("2d");bc.filter="blur(2.2px)";bc.drawImage(after,0,0);
    const g=geometry();
    if(state.areas.has("undereye")){
      retouchEllipse(ctx,blur,g.le.x,g.le.y+g.fh*.07,g.ed*.44,g.fh*.075,.34*amount);
      retouchEllipse(ctx,blur,g.re.x,g.re.y+g.fh*.07,g.ed*.44,g.fh*.075,.34*amount);
    }
    if(state.areas.has("wrinkles")){
      retouchEllipse(ctx,blur,g.c.x,g.fore.y+g.fh*.12,g.fw*.33,g.fh*.15,.32*amount);
      retouchEllipse(ctx,blur,g.c.x,g.le.y-g.fh*.06,g.ed*.22,g.fh*.08,.28*amount);
    }
  }
}
function retouchEllipse(ctx,blur,cx,cy,rx,ry,alpha){
  ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();ctx.globalAlpha=alpha;ctx.drawImage(blur,0,0);ctx.restore();
}

function geometry(){
  const P=i=>state.landmarks[i],avg=(...ps)=>({x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length});
  const le=avg(P(33),P(133),P(159),P(145)),re=avg(P(362),P(263),P(386),P(374));
  const lips=avg(P(61),P(291),P(13),P(14)),chin=P(152),fore=avg(P(10),P(109),P(338)),lj=P(234),rj=P(454),nose=P(1);
  const fw=dist(lj,rj),fh=dist(fore,chin),ed=dist(le,re),lw=dist(P(61),P(291)),c={x:(lj.x+rj.x)/2,y:(fore.y+chin.y)/2};
  return {le,re,lips,chin,fore,lj,rj,nose,fw,fh,ed,lw,c,lc:{x:le.x-fw*.035,y:le.y+fh*.20},rc:{x:re.x+fw*.035,y:re.y+fh*.20}};
}

function analyzeFace(w,h){
  const g=geometry();
  const lipRatio=g.lw/g.fw,lower=dist(g.lips,g.chin)/g.fh,faceRatio=g.fh/g.fw;
  const a={
    undereye:item("A","Mejorar transición párpado–mejilla de forma conservadora."),
    temples:item("C","Conservar volumen temporal salvo déficit evidente en evaluación clínica."),
    midface:item("A","Aportar soporte visual al tercio medio para mejorar continuidad y descanso."),
    cheeks:faceRatio>1.25?item("B","Refinar curva Ogee con proyección sutil."):item("C","Conservar proyección actual."),
    nose:item("C","Conservar identidad nasal; no modificar salvo beneficio claro."),
    perioral:item("B","Refinar soporte perioral sin borrar pliegues naturales."),
    lips:lipRatio<.23?item("B","Optimizar proporción labial preservando anatomía y color."):item("C","Conservar proporción labial."),
    chin:(lower<.20||lower>.31)?item("B","Refinar balance del tercio inferior."):item("C","Conservar mentón."),
    prejowl:item("B","Mejorar continuidad pre-jowl de forma sutil."),
    jawline:item("B","Definir continuidad mandibular sin crear V-line artificial."),
    wrinkles:item("B","Suavizar líneas visibles sin borrar textura.")
  };
  return {areas:a,summary:"Full Face selecciona solo las zonas A/B. C permanece idéntica al original."};
}
function item(priority,objective){return{priority,objective}}
function activateRecommended(){
  state.areas.clear(); if(!state.analysis)return;
  AREA_ORDER.forEach(id=>{const p=state.analysis.areas[id]?.priority;if(p==="A"||p==="B")state.areas.add(id)});
}
function renderPlan(){
  const p=$("#v10Plan");if(!p||!state.analysis)return;p.classList.remove("hidden");
  p.innerHTML=`<h4>Plan Full Face — Best Version</h4><div style="color:#6f685f;font-size:13px;margin-bottom:8px">${esc(state.analysis.summary)}</div>`+
  AREA_ORDER.map(id=>{const a=state.analysis.areas[id],c=a.priority.toLowerCase();return `<div class="v10-row"><span class="v10-badge ${c}">${a.priority}</span><div><div class="v10-title">${esc(AREA_LABELS[id])}</div><div class="v10-copy">${esc(a.objective)}</div></div></div>`}).join("")+
  `<div style="font-size:11px;color:#81786f;margin-top:8px">Simulación visual orientativa. No prescribe producto, dosis, técnica ni puntos de inyección.</div>`;
}

function setStatus(t){const n=$("#simStatus");if(n)n.textContent=t}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function clamp(v,a,b){return Math.min(b,Math.max(a,Number.isFinite(v)?v:a))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
})();
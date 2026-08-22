export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.AI) return json({ok:false,error:"Workers AI no está conectado."},503);

    const fd=await request.formData();
    const image=fd.get("image");
    const fullFace=fd.get("fullFace")==="1";
    const strength=clampInt(fd.get("strength"),1,3,2);

    let overrides={},analysis={};
    try{overrides=JSON.parse(String(fd.get("overrides")||"{}"))}catch{}
    try{analysis=JSON.parse(String(fd.get("analysis")||"{}"))}catch{}

    if(!(image instanceof File)||!image.type.startsWith("image/")) return json({ok:false,error:"No recibimos una selfie válida."},400);

    const allowed=["temples","undereye","midface","cheeks","nose","nasolabial","lips","chin","prejowl","jawline","wrinkles"];
    const add=allowed.filter(k=>overrides[k]==="add");
    const remove=allowed.filter(k=>overrides[k]==="remove");
    if(!fullFace && add.length===0) return json({ok:false,error:"Elegí Full Face o agregá al menos un área."},400);

    const priorityMap={};
    for(const x of (analysis.areas||[])) priorityMap[x.id]=x.priority;

    const intensity={
      1:"extremely subtle and natural; minimal visible correction",
      2:"balanced and refined; visible but conservative",
      3:"defined but still anatomically plausible; never overfilled or overtreated"
    }[strength];

    const prompt=`
EDIT THE PROVIDED REFERENCE PHOTO ONLY.

PURPOSE
Create a highly realistic, conservative facial-harmonization consultation simulation for the SAME PERSON.
This is an illustrative preview, not a diagnosis, injection plan, dosage recommendation, or prediction of outcome.

ABSOLUTE IDENTITY LOCK
Preserve exact identity, apparent age, ethnicity, facial width/length, skull proportions, eyes, iris color, eyebrows, nose identity, lip identity, hairline, hair, expression, skin tone, pores, freckles, pigmentation, natural asymmetries, background, lighting, camera angle, crop and lens perspective.

ZERO MAKEUP / ZERO BEAUTY FILTER
NO lipstick or lip recoloring.
NO eyeliner, mascara, false lashes, blush, contour, foundation, highlighter or eyebrow redesign.
NO skin smoothing, porcelain skin, artificial glow, whitening, airbrushing or glam retouching.
Do not make the person younger or older.
Do not enlarge the eyes, shrink the nose, feminize or masculinize globally.

FULL FACE LOGIC
${fullFace ? `Use a conservative Full Face "Best Version" strategy. Modify only areas where visible harmony improves. Do NOT change every region.` : `Only modify user-selected areas.`}
Priority A areas from the visual analysis may receive the most conservative attention.
Priority B areas are optional refinements.
Priority C areas should remain unchanged unless the user explicitly added them.

VISUAL PRIORITIES FROM ANALYSIS
${JSON.stringify(priorityMap)}

USER OVERRIDES
INCLUDE / PRIORITIZE: ${add.join(", ") || "none"}
DO NOT MODIFY: ${remove.join(", ") || "none"}

AREA RULES
- temples: restore continuity only if visibly hollow; do not widen the upper face.
- undereye: improve visible lid-cheek hollow transition only. Never create concealer, whitening or blur.
- midface: subtle structural support, not generalized puffiness.
- cheeks: conservative anterior/lateral projection preserving Ogee curve; never "filler cheeks."
- nose: preserve recognizable nose; only minimal balance refinement if selected.
- nasolabial: improve support only; never erase natural folds completely.
- lips: preserve original lip anatomy and Cupid's bow. Structural volume/projection only. NO COLOR CHANGE, NO LIPSTICK, NO DUCK LIPS, NO RUSSIAN LIPS.
- chin: conservative projection/height/width adjustment only if it improves lower-third balance; never make a pointed artificial chin.
- prejowl: improve continuity only where selected.
- jawline: subtle structural continuity; no painted contour/shadow and no excessively sharp jaw.
- wrinkles: if selected, softly reduce the appearance of visible dynamic lines while preserving natural expression and skin texture. Never erase all wrinkles and never create a frozen face.

MD-CODES-INSPIRED PRINCIPLE
Use an anatomical-zoning mindset only as a high-level visual organization concept: support, proportion, transition and continuity.
DO NOT output or imply injection points, code labels, product volumes, technique, depth or dosage.

INTENSITY
${intensity}.

FINAL QUALITY CONTROL
The AFTER must look like the same untouched photograph with only selected structural harmonization changes.
If any makeup, lipstick, eye makeup, beauty-filter effect, age change, extra wrinkles, skin smoothing, artificial hollowing, excessive filling or identity drift appears, REDUCE or REMOVE that change.
Identity preservation > facial perfection.
Natural anatomy > beauty-filter aesthetics.
Harmony > volume.
Subtle improvement > obvious treatment.
`.trim();

    let generated = await runFlux(env,image,prompt);

    // Validate obvious makeup/retouch artifacts once. If it fails, regenerate with an even stricter correction prompt.
    let validation = await validateGenerated(env, generated);
    let regenerated = false;
    if(validation && validation.pass===false){
      const correction = `${prompt}

SECOND ATTEMPT CORRECTION:
The prior attempt was rejected because of these visible artifacts: ${(validation.issues||[]).join(", ")}.
Regenerate from the ORIGINAL reference image. Remove those artifacts completely.
Absolutely no makeup, no lipstick, no eye makeup, no age change, no skin retouching, no identity drift.`;
      generated = await runFlux(env,image,correction);
      regenerated = true;
      validation = await validateGenerated(env,generated).catch(()=>null);
    }

    return json({
      ok:true,
      image:`data:image/png;base64,${generated}`,
      plan:buildPlan(fullFace,add,remove,strength),
      validated:validation?.pass===true,
      regenerated
    });
  } catch(e){
    console.error("simulate error",e);
    return json({ok:false,error:"No pudimos generar la simulación en este momento. Intentá nuevamente."},500);
  }
}

async function runFlux(env,image,prompt){
  const form=new FormData();
  form.append("prompt",prompt);
  form.append("input_image_0",image,"reference.jpg");
  form.append("width","768");
  form.append("height","1024");
  form.append("guidance","2.2");
  const serialized=new Response(form);
  const result=await env.AI.run("@cf/black-forest-labs/flux-2-klein-9b",{
    multipart:{body:serialized.body,contentType:serialized.headers.get("content-type")}
  });
  if(!result?.image) throw new Error("La IA no devolvió una imagen.");
  return result.image;
}

async function validateGenerated(env,base64){
  try{
    const schema={
      type:"object",
      properties:{
        pass:{type:"boolean"},
        issues:{type:"array",items:{type:"string"}}
      },
      required:["pass","issues"]
    };
    const result=await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct",{
      messages:[
        {role:"system",content:"You are a strict visual QA checker for a cosmetic consultation preview. Do not diagnose. Judge only visible editing artifacts."},
        {role:"user",content:"Inspect this generated portrait. FAIL if you see obvious lipstick/lip recoloring, eyeliner, mascara, blush, contour makeup, foundation-like smoothing, beauty filter, porcelain skin, artificial eye enlargement, obvious age transformation, exaggerated filler appearance, or implausible facial distortion. PASS only if it looks like a natural photograph with conservative structural changes."}
      ],
      image:`data:image/png;base64,${base64}`,
      max_tokens:300,
      temperature:0,
      response_format:{type:"json_schema",json_schema:schema}
    });
    return typeof result?.response==="string" ? JSON.parse(result.response) : result?.response;
  }catch(e){
    console.warn("validation skipped",e);
    return null;
  }
}

function clampInt(v,min,max,fallback){const n=parseInt(String(v??""),10);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function buildPlan(fullFace,add,remove,strength){
  const labels={1:"Natural",2:"Balanceado",3:"Definido"};
  let s=fullFace?"Full Face — Best Version":"Plan por áreas";
  if(add.length)s+=" + "+add.join(", ");
  if(remove.length)s+=" · excluir "+remove.join(", ");
  s+=" · "+(labels[strength]||"Balanceado");
  return s;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.AI) return json({ok:false,error:"Workers AI no está conectado."},503);

    const fd = await request.formData();
    const image = fd.get("image");
    if (!(image instanceof File) || !image.type.startsWith("image/")) {
      return json({ok:false,error:"No recibimos una imagen válida."},400);
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i=0;i<bytes.length;i+=chunk) {
      binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
    }
    const dataUrl = `data:${image.type};base64,${btoa(binary)}`;

    const areas = ["temples","undereye","midface","cheeks","nose","nasolabial","lips","chin","prejowl","jawline","wrinkles"];

    const schema = {
      type:"object",
      properties:{
        summary:{type:"string"},
        areas:{
          type:"array",
          items:{
            type:"object",
            properties:{
              id:{type:"string",enum:areas},
              priority:{type:"string",enum:["A","B","C"]},
              objective:{type:"string"},
              modalities:{
                type:"array",
                items:{type:"string",enum:[
                  "structural filler — discuss with clinician",
                  "neuromodulator — discuss with clinician",
                  "PN/PDRN-type skin quality — discuss with clinician",
                  "biostimulation — discuss with clinician",
                  "threads/lifting procedure — discuss with clinician",
                  "no treatment suggested"
                ]}
              }
            },
            required:["id","priority","objective","modalities"]
          }
        }
      },
      required:["summary","areas"]
    };

    const system = `You are producing a NON-DIAGNOSTIC visual harmony analysis for a cosmetic consultation website.
Do not diagnose disease. Do not prescribe. Do not estimate mL, units, injection points, product brands, needle/cannula technique, depth, or treatment frequency.
Use the photograph only to describe visible facial balance and classify regions by potential VISUAL IMPACT:
A = a conservative change could have high visual impact on overall harmony.
B = optional refinement.
C = do not change / preserve.
The smallest number of changes is preferred. Preserve identity, age appearance, ethnicity, asymmetries, skin texture and individuality.
Wrinkles: only comment on visibly apparent expression-line appearance and whether softening them could be an optional visual refinement; do not diagnose skin aging.
Modalities are discussion categories only, never prescriptions.`;

    const prompt = `Analyze this frontal portrait for a conservative Full Face "Best Version" visual simulation.
Evaluate every one of these ids exactly once: ${areas.join(", ")}.
Return a concise summary and an entry for each area.
For each area give:
- priority A/B/C
- one short visual objective
- one or more discussion modalities from the allowed list
If treatment is not visually justified, use priority C and "no treatment suggested".
Do not infer exact quantities or medical necessity.`;

    let result;
    try {
      result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        messages:[
          {role:"system",content:system},
          {role:"user",content:prompt}
        ],
        image:dataUrl,
        max_tokens:1500,
        temperature:0.1,
        response_format:{
          type:"json_schema",
          json_schema:schema
        }
      });
    } catch (e) {
      const msg = String(e?.message || e);
      if (/agree|license|acceptable use/i.test(msg)) {
        return json({ok:false,needsLicense:true,error:"Hay que aceptar una vez la licencia del modelo visual."},428);
      }
      throw e;
    }

    const response = result?.response;
    const parsed = typeof response === "string" ? safeParse(response) : response;
    if (!parsed || !Array.isArray(parsed.areas)) {
      return json({ok:false,error:"El análisis visual no devolvió un formato válido."},502);
    }

    // Ensure all expected areas exist once.
    const map = new Map(parsed.areas.map(x=>[x.id,x]));
    const normalized = areas.map(id => map.get(id) || {
      id, priority:"C", objective:"Preservar anatomía actual.", modalities:["no treatment suggested"]
    });

    return json({ok:true,analysis:{summary:parsed.summary||"Propuesta visual conservadora.",areas:normalized}});
  } catch (e) {
    console.error("analyze error", e);
    return json({ok:false,error:"No pudimos completar el análisis visual en este momento."},500);
  }
}

function safeParse(s){
  try{return JSON.parse(s)}catch{
    const m=String(s).match(/\{[\s\S]*\}/);
    if(!m) return null;
    try{return JSON.parse(m[0])}catch{return null}
  }
}
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}
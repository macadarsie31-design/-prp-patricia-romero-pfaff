export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.AI) return json({ok:false,error:"Workers AI no está conectado."},503);

    const fd = await request.formData();
    const image = fd.get("image");
    const mask = fd.get("mask");
    const strengthLevel = Math.max(1,Math.min(3,parseInt(fd.get("strength")||"1",10)));

    let areas=[];
    try{areas=JSON.parse(String(fd.get("areas")||"[]"))}catch{}

    if(!(image instanceof File) || !(mask instanceof File)){
      return json({ok:false,error:"Falta la imagen o la máscara de edición."},400);
    }

    const imgBytes = new Uint8Array(await image.arrayBuffer());
    const maskBytes = new Uint8Array(await mask.arrayBuffer());

    const intensity = strengthLevel===1 ? "very subtle" : strengthLevel===2 ? "balanced but conservative" : "defined but still natural";

    const areaText = areas.length ? areas.join(", ") : "selected facial harmony regions";

    const prompt = `
Photorealistic localized cosmetic facial-harmonization edit of the SAME reference person.

EDIT ONLY THE WHITE MASKED PIXELS. Everything outside the mask must remain unchanged.

Selected areas: ${areaText}.
Requested intensity: ${intensity}.

STRICT GOAL:
Improve facial harmony and refreshed appearance conservatively.
Never make the person look older, more tired, more hollow, more wrinkled, heavier, more sagging, or more artificial.

ABSOLUTE PROHIBITIONS:
no makeup
no lipstick or lip recoloring
no eyeliner
no mascara
no false lashes
no blush
no contour makeup
no foundation
no eyebrow redesign
no hairstyle changes
no eye enlargement
no nose shrinking
no age transformation
no beauty filter
no porcelain skin
no global skin smoothing
no artificial pores or texture
no new wrinkles
no deeper wrinkles
no new folds
no new nasolabial creases
no new marionette lines
no new under-eye lines
no extra shadows suggesting aging
no facial drooping
no identity drift

WRINKLE RULE:
If the wrinkle region is masked, existing visible expression lines may be SOFTENED conservatively.
Never add a wrinkle, fold, line or crease.
Preserve pores and natural skin texture.

STRUCTURAL RULE:
Where filler-like harmonization is selected, use the minimum effective structural correction.
Harmony > volume.
Preserve identity, age appearance, eye shape, nose identity, lip identity and facial width.
The result should look like the SAME photograph after a subtle, realistic cosmetic treatment preview.

If uncertain, preserve the original appearance rather than inventing anatomy.
`.trim();

    const negative = `
makeup, lipstick, eyeliner, mascara, lashes, blush, contour, foundation, beauty filter,
older, aging, aged face, wrinkles, extra wrinkles, deep folds, nasolabial folds, marionette lines,
sagging, hollowing, eye bags, tired face, gray skin, harsh shadows, skin smoothing, plastic skin,
different person, face swap, altered eyes, altered eyebrows, altered nose, exaggerated filler,
duck lips, overfilled cheeks, sharp artificial jaw
`.trim();

    const result = await env.AI.run("@cf/runwayml/stable-diffusion-v1-5-inpainting", {
      prompt,
      negative_prompt: negative,
      image: Array.from(imgBytes),
      mask: Array.from(maskBytes),
      num_steps: 20,
      strength: strengthLevel===1 ? 0.22 : strengthLevel===2 ? 0.32 : 0.42,
      guidance: 6.5
    });

    const response = new Response(result);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if(!bytes.length) return json({ok:false,error:"La IA no devolvió una imagen."},502);

    let binary="";
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    const b64=btoa(binary);

    return json({ok:true,image:`data:image/png;base64,${b64}`});
  } catch(e){
    console.error("localized inpaint error",e);
    return json({ok:false,error:"No pudimos actualizar la simulación. Intentá nuevamente."},500);
  }
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}

export async function onRequestPost(context) {
  try {
    const {request,env}=context;
    if(!env.AI)return json({ok:false,error:"Binding AI no disponible."},503);

    const fd=await request.formData();
    const image=fd.get("image"),mask=fd.get("mask");
    const width=Number(fd.get("width")||512),height=Number(fd.get("height")||768);
    const level=Math.max(1,Math.min(3,Number(fd.get("strength")||1)));
    let areas=[];try{areas=JSON.parse(String(fd.get("areas")||"[]"))}catch{}

    if(!(image instanceof File)||!(mask instanceof File))return json({ok:false,error:"Falta imagen o máscara."},400);
    if(width%8!==0||height%8!==0||width<256||height<256)return json({ok:false,error:`Dimensiones inválidas: ${width}x${height}`},400);

    const imageBytes=new Uint8Array(await image.arrayBuffer());
    const maskBytes=new Uint8Array(await mask.arrayBuffer());

    const prompt=`Localized photorealistic facial-harmonization edit of the SAME person.
ONLY EDIT THE WHITE MASKED AREA. Preserve all black masked pixels exactly in appearance.
Selected regions: ${areas.join(", ")||"none"}.
Goal: a fresher, more harmonious appearance through the minimum effective cosmetic change.
Never make the person look older, more tired, more wrinkled, more hollow, heavier, sagging, artificial, made-up or less like themselves.
NO makeup, lipstick, lip recoloring, eyeliner, mascara, blush, contour, foundation, eyebrow redesign, beauty filter, age transformation, new wrinkles, deeper wrinkles, new folds, marionette lines, nasolabial creases, under-eye lines, extra aging shadows, plastic skin, face swap, identity drift.
If wrinkles are selected: only soften existing visible lines conservatively. Never create a new line.
If under-eye is selected: improve hollow transition without whitening or concealer effect.
If lips are selected: subtle anatomical volume/projection only; preserve color and Cupid's bow.
If cheeks/midface are selected: subtle structural support, never inflated filler cheeks.
If chin/jaw are selected: conservative structural balance only.
Preserve skin texture, pores, freckles, natural pigmentation, eyes, nose identity, expression and apparent age.
When uncertain, keep the original appearance.`;

    const result=await env.AI.run("@cf/runwayml/stable-diffusion-v1-5-inpainting",{
      prompt,
      negative_prompt:"older, aging, wrinkles, deep folds, sagging, hollow face, tired face, lipstick, makeup, eyeliner, mascara, blush, contour, beauty filter, plastic skin, different person, face swap, exaggerated filler, duck lips",
      image_b64:bytesToBase64(imageBytes),
      mask:Array.from(maskBytes),
      width,height,num_steps:20,
      strength:level===1?0.18:level===2?0.26:0.34,
      guidance:5.5,
      seed:42
    });

    const response=new Response(result);
    const out=new Uint8Array(await response.arrayBuffer());
    if(!out.length)return json({ok:false,error:"El modelo devolvió una respuesta vacía."},502);

    return json({ok:true,image:`data:image/png;base64,${bytesToBase64(out)}`});
  } catch(e) {
    console.error("simulate V6.1 error",e);
    return json({ok:false,error:`Cloudflare AI: ${String(e?.message||e).slice(0,500)}`},500);
  }
}

function bytesToBase64(bytes){
  let binary="",chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}
export async function onRequestGet(context) {
  try {
    if (!context.env.AI) {
      return Response.json({ok:false,error:"Workers AI no está conectado."},{status:503});
    }
    await context.env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct",{prompt:"agree"});
    return Response.json({ok:true,message:"Vision model license accepted."});
  } catch (e) {
    console.error(e);
    return Response.json({ok:false,error:"No se pudo aceptar la licencia automáticamente."},{status:500});
  }
}
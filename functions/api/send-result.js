export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
      return json({ ok:false, emailConfigured:false }, 503);
    }

    const body = await request.json();
    const name = clean(body.name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const proposal = clean(body.proposal);
    const image = String(body.image || "");

    if (!email || !image.startsWith("data:image/jpeg;base64,")) {
      return json({ ok:false, error:"Datos incompletos." }, 400);
    }

    const base64 = image.split(",")[1];

    const r = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${env.RESEND_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        from:env.RESEND_FROM,
        to:[email],
        subject:"Tu simulación PRP · Dra. Patricia Romero Pfaff",
        html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#222">
          <h1 style="font-family:Georgia,serif;font-weight:500">Hola ${esc(name)}</h1>
          <p>Gracias por probar el simulador facial de PRP.</p>
          <p>Adjuntamos tu visualización estética orientativa.</p>
          <p><strong>Propuesta visual:</strong> ${esc(proposal || "Equilibrio natural")}</p>
          <p>La simulación no es un diagnóstico ni garantiza un resultado. La evaluación profesional es la que permite definir las opciones adecuadas para cada persona.</p>
          <p>Consultas y turnos: <a href="https://wa.me/5493512641380">WhatsApp +54 9 3512 64-1380</a></p>
          <p>PRP · Bernardo O'Higgins 5435 · Córdoba, Argentina</p>
        </div>`,
        attachments:[{
          filename:"PRP-simulacion-facial.jpg",
          content:base64
        }]
      })
    });

    const txt = await r.text();
    return new Response(txt,{status:r.status,headers:{"Content-Type":"application/json"}});
  } catch (e) {
    return json({ ok:false, error:"No se pudo enviar el email." }, 500);
  }
}
function clean(v){ return String(v ?? "").trim().slice(0,1000); }
function esc(s){ return clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function json(data,status=200){ return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}); }

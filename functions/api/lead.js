export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Important: do not unlock/download unless the database is actually connected.
    if (!env.DB) {
      return json({
        ok: false,
        error: "La base de datos todavía no está conectada. Configurá el binding DB en Cloudflare."
      }, 503);
    }

    const body = await request.json();
    const name = clean(body.name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const proposal = clean(body.proposal);
    const consent = body.consent === true;
    const website = clean(body.website);

    // Honeypot
    if (website) return json({ ok: true });

    if (!name || !email || !phone || !consent) {
      return json({ ok:false, error:"Completá nombre, email, teléfono y consentimiento." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok:false, error:"Ingresá un email válido." }, 400);
    }

    const createdAt = new Date().toISOString();
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ua = request.headers.get("User-Agent") || "";

    await env.DB.prepare(`
      INSERT INTO leads (name, email, phone, proposal, consent, created_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(name, email, phone, proposal, 1, createdAt, ip, ua).run();

    return json({ ok:true });
  } catch (e) {
    console.error("lead save error", e);
    return json({ ok:false, error:"No pudimos guardar los datos. Intentá nuevamente." }, 500);
  }
}

function clean(v){ return String(v ?? "").trim().slice(0, 1000); }
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
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
      return json({ ok:false, error:"Faltan datos requeridos." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok:false, error:"Email inválido." }, 400);
    }

    const createdAt = new Date().toISOString();
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ua = request.headers.get("User-Agent") || "";

    // Save lead in D1 when binding exists.
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO leads (name, email, phone, proposal, consent, created_at, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(name, email, phone, proposal, consent ? 1 : 0, createdAt, ip, ua).run();
    }

    // Optional notification to clinic via Resend.
    if (env.RESEND_API_KEY && env.LEAD_NOTIFICATION_EMAIL && env.RESEND_FROM) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [env.LEAD_NOTIFICATION_EMAIL],
          subject: "Nueva consulta desde el simulador PRP",
          html: `
            <div style="font-family:Arial,sans-serif;color:#222">
              <h2>Nueva consulta PRP</h2>
              <p><strong>Nombre:</strong> ${esc(name)}</p>
              <p><strong>Email:</strong> ${esc(email)}</p>
              <p><strong>Teléfono:</strong> ${esc(phone)}</p>
              <p><strong>Propuesta visual:</strong> ${esc(proposal || "Equilibrio natural")}</p>
              <p><strong>Fecha:</strong> ${esc(createdAt)}</p>
            </div>`
        })
      });
    }

    return json({ ok:true });
  } catch (e) {
    return json({ ok:false, error:"No pudimos guardar la consulta." }, 500);
  }
}

function clean(v){ return String(v ?? "").trim().slice(0, 1000); }
function esc(s){ return clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function json(data,status=200){ return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}); }

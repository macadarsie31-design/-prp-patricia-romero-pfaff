// Cloudflare Pages Function
// POST /api/analyze-face
// Uses Kimi API (OpenAI-compatible) to create a structured facial harmonization plan.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private"
    }
  });
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === "string") return part;
      if (part?.text) return part.text;
      return "";
    }).join("\n");
  }
  return String(content || "");
}

function parseJsonMaybe(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/\{[\s\S]*\}$/);
  if (!match) return null;
  try { return JSON.parse(match[1] || match[0]); } catch { return null; }
}

function normalizeProcedureList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(item => ({
      area: item?.area || item?.name || "Área",
      rationale: item?.rationale || item?.reason || "",
      volume_note: item?.volume_note || item?.ml || item?.note || "Evaluación clínica presencial"
    }))
    .filter(item => item.area);
}

function normalizePlan(raw) {
  const plan = raw && typeof raw === "object" ? raw : {};
  return {
    provider: "Kimi K2.6 + MediaPipe",
    priority_1: Array.isArray(plan.priority_1) ? plan.priority_1 : [],
    priority_2: Array.isArray(plan.priority_2) ? plan.priority_2 : [],
    no_treatment: Array.isArray(plan.no_treatment) ? plan.no_treatment : [],
    procedures: {
      filler: normalizeProcedureList(plan?.procedures?.filler),
      botox: normalizeProcedureList(plan?.procedures?.botox),
      threads: normalizeProcedureList(plan?.procedures?.threads)
    },
    full_face_summary: String(plan.full_face_summary || "Best version conservadora y armónica, preservando identidad."),
    generation_guidance: String(plan.generation_guidance || "Preservar identidad exacta, mejorar solo con cambios conservadores y anatómicamente plausibles."),
    safeguards: Array.isArray(plan.safeguards) ? plan.safeguards : [
      "No maquillaje",
      "No sobrellenado",
      "No más arrugas que en el original",
      "No cambio de identidad"
    ]
  };
}

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.KIMI_API_KEY;
    const model = context.env.KIMI_MODEL || "kimi-k2.6";
    const baseUrl = (context.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");

    if (!apiKey) {
      return json({ ok: false, error: "Missing KIMI_API_KEY secret." }, 501);
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const imageDataUrl = body?.imageDataUrl;
    const analysis = body?.analysis || {};
    const zones = Array.isArray(body?.zones) && body.zones.length ? body.zones : ["full"];

    if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return json({ ok: false, error: "Missing imageDataUrl." }, 400);
    }

    const systemPrompt = `You are an expert facial harmonization planning assistant for a cosmetic dentistry / orofacial harmonization simulator.
Return JSON only. No markdown.
Your task is NOT to prescribe treatment. Your task is to produce a conservative, identity-preserving plan that improves harmony for this face.
Use this planning logic strictly:
1. Foundation first.
2. Contour second.
3. Refinement last.
Preserve identity. Do not recommend all areas. Keep the smallest set of changes that creates the biggest improvement.
Do not suggest surgery, makeup, skin filters, hairstyle change, age change, or facial redesign.
Never make the patient look older, overfilled, frozen, or artificial.
For procedure lists, use these keys only: area, rationale, volume_note.
volume_note must be cautious and non-prescriptive, like \"volumen conservador a definir clínicamente\" or \"si está indicado\".
JSON schema:
{
  "priority_1":[{"area":"...","reason":"...","md_code_family":["..."]}],
  "priority_2":[{"area":"...","reason":"...","md_code_family":["..."]}],
  "no_treatment":["..."],
  "procedures":{
    "filler":[{"area":"...","rationale":"...","volume_note":"..."}],
    "botox":[{"area":"...","rationale":"...","volume_note":"si está indicado"}],
    "threads":[{"area":"...","rationale":"...","volume_note":"solo si filler/Botox no alcanza"}]
  },
  "full_face_summary":"...",
  "generation_guidance":"...",
  "safeguards":["...","..."]
}`;

    const userText = `Analyze this single frontal selfie together with these geometric metrics from MediaPipe.
Return Spanish text values inside the JSON.
Selected zones: ${JSON.stringify(zones)}
Metrics: ${JSON.stringify(analysis, null, 2)}
Important rules:
- Preserve exact identity.
- Prefer conservative orofacial harmonization.
- No makeup.
- No surgery.
- No skin beautification.
- Never add wrinkles.
- If an area is already harmonious, include it in no_treatment.
- If tear trough/perioral changes depend on midface support, say that clearly.
- Include MD Code families only at a broad family level.
- Keep the plan suitable for a patient-facing simulator.`;

    const payload = {
      model,
      temperature: 0.2,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ]
    };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return json({ ok: false, error: data?.error?.message || `Kimi error ${resp.status}`, details: data }, resp.status);
    }

    const content = extractMessageContent(data);
    const rawPlan = parseJsonMaybe(content);
    if (!rawPlan) {
      return json({ ok: false, error: "Kimi did not return valid JSON.", raw: content }, 502);
    }

    const plan = normalizePlan(rawPlan);
    return json({ ok: true, provider: "kimi-api", model, plan, usage: data?.usage || null });
  } catch (err) {
    return json({ ok: false, error: err?.message || "Unexpected error in analyze-face." }, 500);
  }
}

export async function onRequestGet(context) {
  return json({
    ok: true,
    endpoint: "/api/analyze-face",
    provider: "kimi-api",
    model: context.env.KIMI_MODEL || "kimi-k2.6"
  });
}

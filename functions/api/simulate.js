export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.AI) {
      return json({ ok:false, error:"Workers AI no está conectado al proyecto." }, 503);
    }

    const incoming = await request.formData();
    const image = incoming.get("image");
    const fullFace = incoming.get("fullFace") === "1";
    const strength = clampInt(incoming.get("strength"), 1, 3, 2);

    let overrides = {};
    try { overrides = JSON.parse(String(incoming.get("overrides") || "{}")); }
    catch { overrides = {}; }

    if (!(image instanceof File) || !image.type.startsWith("image/")) {
      return json({ ok:false, error:"No recibimos una selfie válida." }, 400);
    }

    const allowed = ["lips","cheeks","chin","jaw","undereye","botox"];
    const add = allowed.filter(k => overrides[k] === "add");
    const remove = allowed.filter(k => overrides[k] === "remove");

    if (!fullFace && add.length === 0) {
      return json({
        ok:false,
        error:"Elegí Full Face Armónico o agregá al menos una zona."
      }, 400);
    }

    const intensity = {
      1: "very subtle, natural, nearly imperceptible",
      2: "balanced, refined and clearly visible but conservative",
      3: "defined and polished while still anatomically plausible and natural"
    }[strength];

    const zoneNames = {
      lips:"lips",
      cheeks:"cheekbones / midface",
      chin:"chin",
      jaw:"jawline",
      undereye:"tear trough / under-eye hollow",
      botox:"upper-face expression lines consistent with a subtle Botox-like cosmetic preview"
    };

    const addText = add.length ? add.map(k => zoneNames[k]).join(", ") : "none";
    const removeText = remove.length ? remove.map(k => zoneNames[k]).join(", ") : "none";

    const prompt = `
Edit the supplied reference portrait. This is a cosmetic facial-harmonization visualization for consultation, not a diagnosis and not a prediction of treatment outcome.

IDENTITY PRESERVATION IS THE HIGHEST PRIORITY:
Keep the exact same person, identity, age appearance, expression, gaze, eyes, eyebrows, nose, ears, hair, hairline, skin tone, skin texture, pores, moles/freckles, lighting, background, camera position, lens perspective and framing. Do not beautify globally. Do not make the person younger. Do not change makeup. Do not recolor lips. Do not whiten skin or eyes. Do not change hairstyle, teeth or nose.

MODE:
${fullFace
  ? "Create a harmonious FULL FACE result based only on visible facial proportions. Make only conservative changes that improve balance; do NOT modify every area automatically if it is already balanced."
  : "Only modify the explicitly requested cosmetic areas."}

User-requested areas to PRIORITIZE / ADD: ${addText}.
Areas the user explicitly says NOT TO MODIFY: ${removeText}.

COSMETIC SIMULATION RULES:
- Lips: anatomical volume/projection only when appropriate; preserve Cupid's bow and natural upper/lower lip relationship; absolutely no lipstick/color effect and no duck lips.
- Cheekbones/midface: subtle structural projection/lift, not blush, highlighting, or skin brightening.
- Chin: conservative projection/length adjustment only if it improves visible lower-face balance.
- Jawline: subtle structural definition and transition to chin; no painted contour or artificial shadow.
- Tear trough/under-eye: reduce visible hollow transition only; do not bleach, brighten, blur, or erase natural skin texture.
- Botox-like preview: only soften relevant upper-face expression-line appearance very subtly; do not freeze expression, change eye shape, or add volume.

Overall requested strength: ${intensity}.

The final image must look like an authentic photograph taken one second later with the same camera, not an AI portrait, filter, makeup edit, retouching app, or face swap. Preserve asymmetries unless a very small structural correction is necessary for the selected harmonization.
`.trim();

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("input_image_0", image, "reference.jpg");

    // Keep a portrait-friendly output. The browser will crop it back into the exact comparison frame.
    form.append("width", "768");
    form.append("height", "1024");
    form.append("guidance", "3.5");

    const serialized = new Response(form);
    const contentType = serialized.headers.get("content-type");

    const result = await env.AI.run("@cf/black-forest-labs/flux-2-klein-9b", {
      multipart: {
        body: serialized.body,
        contentType
      }
    });

    if (!result || !result.image) {
      console.error("Unexpected AI result", result);
      return json({ ok:false, error:"La IA no devolvió una imagen." }, 502);
    }

    const plan = buildPlan(fullFace, add, remove, strength);

    return json({
      ok:true,
      image:`data:image/png;base64,${result.image}`,
      plan
    });
  } catch (error) {
    console.error("simulate error", error);
    return json({
      ok:false,
      error:"No pudimos generar la simulación en este momento. Intentá nuevamente."
    }, 500);
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function buildPlan(fullFace, add, remove, strength) {
  const labels = {1:"Natural",2:"Balanceado",3:"Definido"};
  let s = fullFace ? "Full Face Armónico" : "Plan por áreas";
  if (add.length) s += ` + ${add.join(", ")}`;
  if (remove.length) s += ` · excluir ${remove.join(", ")}`;
  s += ` · ${labels[strength] || "Balanceado"}`;
  return s;
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{
      "Content-Type":"application/json",
      "Cache-Control":"no-store"
    }
  });
}
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.AI) {
      return json({ ok: false, error: "Workers AI no está conectado al proyecto." }, 503);
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const fullFace = formData.get("fullFace") === "1";
    const strength = clampInt(formData.get("strength"), 1, 3, 2);

    let overrides = {};
    try {
      overrides = JSON.parse(String(formData.get("overrides") || "{}"));
    } catch {
      overrides = {};
    }

    if (!(image instanceof File) || !image.type.startsWith("image/")) {
      return json({ ok: false, error: "No recibimos una selfie válida." }, 400);
    }

    const allowed = ["lips", "cheeks", "chin", "jaw", "undereye", "botox"];
    const add = allowed.filter((k) => overrides[k] === "add");
    const remove = allowed.filter((k) => overrides[k] === "remove");

    if (!fullFace && add.length === 0) {
      return json({
        ok: false,
        error: "Elegí Full Face Armónico o agregá al menos una zona."
      }, 400);
    }

    const intensity = {
      1: "VERY NATURAL: extremely subtle, minimal visible change",
      2: "BALANCED: refined and visible, still conservative",
      3: "DEFINED: more noticeable structure, but never exaggerated"
    }[strength];

    const zoneNames = {
      lips: "lips",
      cheeks: "cheekbones and lateral midface",
      chin: "chin",
      jaw: "jawline",
      undereye: "tear trough / infraorbital hollow",
      botox: "upper-face dynamic expression lines"
    };

    const addText = add.length ? add.map((k) => zoneNames[k]).join(", ") : "none";
    const removeText = remove.length ? remove.map((k) => zoneNames[k]).join(", ") : "none";

    const prompt = `
EDIT THE PROVIDED REFERENCE PHOTO ONLY.

GOAL:
Create a realistic cosmetic consultation preview for orofacial harmonization.
The result must look like the SAME PERSON, SAME AGE, SAME PHOTO, with only conservative structural changes.

CRITICAL — DO NOT BEAUTIFY:
- NO makeup
- NO lipstick
- NO eyeliner
- NO mascara
- NO blush
- NO foundation
- NO skin smoothing
- NO skin whitening
- NO teeth whitening
- NO eye whitening
- NO eyebrow redesign
- NO hairstyle changes
- NO face swap
- NO glamour retouching
- NO beauty filter
- DO NOT make the person younger
- DO NOT make the person older
- DO NOT change skin color, texture, pores, freckles, moles or natural asymmetries unless directly required by the requested structural simulation

IDENTITY LOCK:
Preserve exact identity, face shape, eye shape, nose, nostrils, ears, hairline, expression, gaze, lighting, background, camera angle, lens perspective and framing.

FACIAL-HARMONIZATION LOGIC:
Use an MD Codes-inspired anatomical zoning mindset ONLY as a visual organization reference.
This is NOT a medical diagnosis, NOT an injection map, and NOT a recommendation of product amounts.

For FULL FACE:
- Evaluate visible facial balance across upper, middle and lower thirds.
- Do NOT modify every region.
- Only make conservative changes where they visibly improve proportion and harmony.
- Prioritize structural balance over volume.
- Preserve individuality.
- Avoid overprojection and overfilling.

AREA RULES:
- Lips: modify SHAPE / PROJECTION / VOLUME only when appropriate. Preserve Cupid's bow and natural upper/lower relationship. NO lipstick or color change. NO duck lips.
- Cheekbones: subtle lateral/structural support, never blush, highlight, contour makeup or rounded "apple cheek" inflation.
- Chin: subtle projection/length adjustment only if it improves lower-face proportion. Do not change jaw width unless selected.
- Jawline: subtle structural definition only. NO painted contour, NO shadow makeup, NO masculine exaggeration.
- Tear trough: reduce visible hollow/depression transition only. NO brightening, whitening, concealer effect or skin blur.
- Botox: only a very subtle softening of dynamic-expression appearance in upper face when appropriate. Do not freeze expression, lift brows unnaturally, enlarge eyes or change eyelid shape.

USER MODE:
Full Face Armónico: ${fullFace ? "ON" : "OFF"}
Priority / add areas: ${addText}
Explicitly do not modify: ${removeText}
Overall level: ${intensity}

FINAL CHECK BEFORE OUTPUT:
The edited half must look like a believable treatment preview, not a retouched portrait.
If a requested change would make the person look artificial, older, younger, made-up, overfilled, or less like themselves, reduce that change.
`.trim();

    const aiForm = new FormData();
    aiForm.append("prompt", prompt);
    aiForm.append("input_image_0", image, "reference.jpg");
    aiForm.append("width", "768");
    aiForm.append("height", "1024");
    aiForm.append("guidance", "2.6");

    const serialized = new Response(aiForm);
    const contentType = serialized.headers.get("content-type");

    const result = await env.AI.run("@cf/black-forest-labs/flux-2-klein-9b", {
      multipart: {
        body: serialized.body,
        contentType
      }
    });

    if (!result || !result.image) {
      console.error("Unexpected AI result", result);
      return json({ ok: false, error: "La IA no devolvió una imagen." }, 502);
    }

    return json({
      ok: true,
      image: `data:image/png;base64,${result.image}`,
      plan: buildPlan(fullFace, add, remove, strength)
    });

  } catch (error) {
    console.error("simulate error", error);
    return json({
      ok: false,
      error: "No pudimos generar la simulación. Intentá nuevamente."
    }, 500);
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function buildPlan(fullFace, add, remove, strength) {
  const strengthLabels = { 1: "Natural", 2: "Balanceado", 3: "Definido" };
  const pretty = {
    lips: "Labios",
    cheeks: "Pómulos",
    chin: "Mentón",
    jaw: "Mandíbula",
    undereye: "Ojeras",
    botox: "Botox"
  };

  let label = fullFace ? "Full Face Armónico" : "Plan por áreas";
  if (add.length) label += " + " + add.map((k) => pretty[k]).join(", ");
  if (remove.length) label += " · excluir " + remove.map((k) => pretty[k]).join(", ");
  label += " · " + (strengthLabels[strength] || "Balanceado");
  return label;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

// Cloudflare Pages Function
// POST /api/harmonize
// Primary engine: Cloudflare Workers AI (free allocation first).
// Model: FLUX.2 [klein] 4B — Apache 2.0, commercial-use friendly.
// No patient image is cached or stored by this function.

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

const AREA_TEXT = {
  full: "full-face conservative harmonization, selecting only changes that genuinely improve overall balance",
  undereye: "under-eye / tear-trough transition",
  temples: "temporal contour",
  midface: "midface structural support and lid-cheek transition",
  cheeks: "cheek projection and Ogee curve",
  nose: "subtle nose refinement only if it materially improves harmony",
  perioral: "nasolabial and perioral support",
  lips: "natural lip proportion, symmetry and subtle projection",
  chin: "chin projection, width and lower-third balance",
  prejowl: "pre-jowl continuity",
  jaw: "jawline continuity without an artificial V-line",
  wrinkles: "soften visible expression lines conservatively while preserving real skin texture"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private"
    }
  });
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function buildPrompt(zones = []) {
  const selected = Array.isArray(zones) && zones.length
    ? zones.map(z => AREA_TEXT[z]).filter(Boolean)
    : [AREA_TEXT.full];

  const areas = selected.length ? selected.join("; ") : AREA_TEXT.full;

  return `
Use input image 0 as the exact source photograph.
Edit ONLY the patient's face in this existing image to create a highly realistic, conservative facial-harmonization simulation.

ABSOLUTE IDENTITY LOCK:
Preserve the exact same person, skull shape, facial width and length, eye shape/size/spacing/tilt, iris color, nose identity, fundamental lip anatomy, hairline, skin tone, ethnicity, expression, apparent age, camera angle, crop, focal perspective, lighting, background, clothing and jewelry.

THIS IS OROFACIAL HARMONIZATION ONLY.
It is NOT makeup, NOT a beauty filter, NOT FaceTune and NOT a new portrait.

DO NOT add lipstick, eyeliner, mascara, eyelashes, brow makeup, foundation, contour, blush, artificial glow or beauty-filter skin.
DO NOT change hair or hairstyle.
DO NOT enlarge the eyes.
DO NOT make a tiny "Instagram nose".
DO NOT overfill lips or cheeks.
DO NOT create a pointed chin, V-line or exaggerated jaw.
DO NOT dramatically lift eyebrows.
DO NOT make the patient look older or decades younger.
DO NOT introduce wrinkles, sagging, hollowing, heavier folds or artificial texture.

OBJECTIVE:
Create this exact patient's best balanced version using the minimum effective visual correction.
The result should look refreshed, rested, proportionate, structurally harmonious, conservative and anatomically plausible.
If a selected area already looks harmonious, leave it unchanged.

SELECTED AREAS:
${areas}

UNDER-EYE / MIDFACE:
Improve lid-cheek transition and structural support only if needed. Preserve realistic under-eye anatomy and coloration.

CHEEKS:
Improve anterior/lateral balance and Ogee curve only if it improves this patient's proportions. Avoid filler-cheek appearance.

LIPS:
Preserve natural lip identity. Only subtle proportion, symmetry or projection if appropriate. No Russian lips, duck lips or migration.

CHIN / JAW:
Improve lower-third balance and continuity only if needed. No artificial pointed chin, V-line or overly sharp jaw.

WRINKLES:
Soften only appropriate visible expression lines. Preserve pores, freckles, pigmentation, natural texture and realistic shadows.

PHOTOGRAPHIC CONTROL:
The AFTER must keep the same pose, head position, expression, crop, lighting, background, skin color and focal perspective.
Do not regenerate the scene. Edit the existing photograph.

FINAL QUALITY CONTROL:
Same person; same eyes; same nose identity; same facial width; same apparent age; no makeup; no artificial skin; no overfilling; no new wrinkles; no sagging; no identity drift.

Return ONE edited photorealistic image only.
`.trim();
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid imageDataUrl.");
  }

  if (dataUrl.length > 8_000_000) {
    throw new Error("Uploaded image is too large.");
  }

  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Malformed imageDataUrl.");

  const meta = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const contentType = meta.split(";")[0] || "image/jpeg";
  const isBase64 = /;base64/i.test(meta);

  let bytes;

  if (isBase64) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }

  return new Blob([bytes], { type: contentType });
}

function resultImageToDataUrl(result) {
  if (!result) throw new Error("Workers AI returned no result.");

  if (typeof result === "string") {
    if (result.startsWith("data:image/")) return result;
    return `data:image/jpeg;base64,${result}`;
  }

  if (typeof result.image === "string") {
    if (result.image.startsWith("data:image/")) return result.image;
    return `data:image/jpeg;base64,${result.image}`;
  }

  if (result.result && typeof result.result.image === "string") {
    const image = result.result.image;
    if (image.startsWith("data:image/")) return image;
    return `data:image/jpeg;base64,${image}`;
  }

  throw new Error("Workers AI returned an unexpected image payload.");
}

export async function onRequestPost(context) {
  try {
    if (!context.env.AI || typeof context.env.AI.run !== "function") {
      return json({
        ok: false,
        error: "Workers AI binding AI is not configured."
      }, 500);
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const imageBlob = dataUrlToBlob(body?.imageDataUrl || body?.image);
    const zones = Array.isArray(body?.zones) ? body.zones : ["full"];

    // Reference images for FLUX.2 editing must remain below 512x512.
    // Frontend sends max 500px. Output keeps the same compact dimensions
    // for the live simulator and minimizes Neuron usage.
    const width = clampInt(body?.width, 256, 500, 500);
    const height = clampInt(body?.height, 256, 500, 500);

    const form = new FormData();
    form.append("input_image_0", imageBlob, "patient.jpg");
    form.append("prompt", buildPrompt(zones));
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("guidance", "3.5");

    // Cloudflare requires the multipart boundary generated by Request/Response.
    const serialized = new Response(form);
    const formStream = serialized.body;
    const contentType = serialized.headers.get("content-type");

    const result = await context.env.AI.run(MODEL, {
      multipart: {
        body: formStream,
        contentType
      }
    });

    const imageDataUrl = resultImageToDataUrl(result);

    return json({
      ok: true,
      provider: "cloudflare-workers-ai",
      model: MODEL,
      zones,
      imageDataUrl
    });
  } catch (err) {
    console.error("harmonize error", err);

    const message = String(err?.message || "Unknown harmonization error.");
    const isQuota = /neuron|quota|limit|exceed|daily|capacity|3040/i.test(message);

    return json({
      ok: false,
      code: isQuota ? "DAILY_FREE_LIMIT" : "GENERATION_FAILED",
      error: message
    }, isQuota ? 429 : 502);
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "/api/harmonize",
    method: "POST",
    provider: "cloudflare-workers-ai",
    model: MODEL,
    storage: "none",
    strategy: "one AI generation per confirmed selection; intensity is local"
  });
}

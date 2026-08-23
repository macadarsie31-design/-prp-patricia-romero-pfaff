import { InferenceClient } from "@huggingface/inference";

const PRIMARY_MODEL = "Qwen/Qwen-Image-Edit-2511";
const FALLBACK_MODEL = "Qwen/Qwen-Image-Edit";

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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function buildPrompt(zones = []) {
  const selected = Array.isArray(zones) && zones.length
    ? zones.map(z => AREA_TEXT[z]).filter(Boolean)
    : [AREA_TEXT.full];

  const areas = selected.length ? selected.join("; ") : AREA_TEXT.full;

  return `
Analyze the uploaded patient's face and edit ONLY this existing photograph to create a highly realistic, conservative facial-harmonization simulation.

ABSOLUTE IDENTITY LOCK:
Keep the exact same person and preserve:
- skull and facial architecture
- facial width and length
- eye shape, size, spacing and tilt
- iris color
- nose identity
- fundamental lip anatomy
- hairline
- skin tone
- ethnicity and individual characteristics
- natural expression
- apparent age
- camera angle
- focal perspective
- crop
- lighting
- background
- clothing and jewelry

THIS IS FACIAL HARMONIZATION ONLY.
This is NOT makeup, NOT a beauty filter, NOT FaceTune and NOT cosmetic surgery.

DO NOT:
- add lipstick, eyeliner, mascara, lashes, brow makeup, foundation, contour, blush or glow
- smooth or airbrush the skin
- create porcelain skin
- change hair or hairstyle
- enlarge eyes
- make a tiny "Instagram nose"
- overfill lips
- exaggerate cheekbones
- create an artificial V-shaped jaw
- create a pointed chin
- dramatically lift eyebrows
- make the patient look older
- make the patient decades younger
- add wrinkles, hollowing, sagging or heavier folds

FACIAL HARMONIZATION GOAL:
Create the same patient's best balanced version using the minimum effective correction.
The result should look refreshed, rested, proportionate, structurally harmonious and natural.
It must look plausible in real life and difficult to detect as "work done".

SELECTED AREAS:
${areas}

For each selected area:
- modify it only if the visible anatomy would genuinely benefit
- if it is already harmonious, leave it unchanged
- do not force treatment into every selected zone
- avoid unintentionally altering neighboring unselected areas

UNDER-EYE / MIDFACE:
Improve lid-cheek transition and support only if needed.
Do not flatten normal anatomy and do not erase all under-eye coloration.

CHEEKS:
Improve anterior/lateral balance and Ogee curve only if it improves the patient's proportions.
Avoid a "filler cheek" appearance.

LIPS:
Preserve the patient's natural lip identity.
Only subtle proportion, symmetry, hydration appearance or projection when appropriate.
No Russian lips, duck lips, migration or exaggerated vermilion.

CHIN / JAW:
Improve lower-third balance and continuity only if needed.
Do not create an artificial pointed chin, V-line or overly masculine jaw.

WRINKLES:
Soften only appropriate visible expression lines.
Preserve pores, freckles, pigmentation, natural texture and realistic shadows.
Never introduce deeper lines or make the person look older.

PHOTOGRAPHIC CONTROL:
The AFTER must keep exactly the same:
- pose
- head position
- expression
- crop
- lighting
- background
- skin color
- focal perspective

Do not redesign or regenerate the scene.
Edit the existing portrait.

FINAL QUALITY CONTROL BEFORE OUTPUT:
1. Same person?
2. Same eyes?
3. Same nose identity?
4. Same fundamental lip anatomy?
5. Same facial width?
6. Same apparent age?
7. No makeup?
8. No artificial skin?
9. No overfilling?
10. No new wrinkles, hollowing or sagging?
11. Natural and anatomically coherent?
12. Would reducing any correction improve realism? If yes, reduce it.

Return ONE edited photorealistic image only.
`.trim();
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid imageDataUrl.");
  }

  if (dataUrl.length > 12_000_000) {
    throw new Error("The uploaded image is too large.");
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
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }

  return new Blob([bytes], { type: contentType });
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

function isProviderCompatibilityError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("not supported") ||
    msg.includes("unsupported") ||
    msg.includes("provider") ||
    msg.includes("model not found") ||
    msg.includes("404")
  );
}

async function runImageEdit(client, model, imageBlob, prompt) {
  return client.imageToImage({
    provider: "auto",
    model,
    inputs: imageBlob,
    parameters: {
      prompt,
      num_inference_steps: 28,
      guidance_scale: 4
    }
  });
}

export async function onRequestPost(context) {
  try {
    const token = context.env.HF_TOKEN;

    if (!token) {
      return jsonResponse({
        ok: false,
        error: "HF_TOKEN is not configured in Cloudflare."
      }, 500);
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({
        ok: false,
        error: "Invalid JSON body."
      }, 400);
    }

    const imageDataUrl = body?.imageDataUrl || body?.image;
    const zones = Array.isArray(body?.zones) ? body.zones : ["full"];

    const prompt = buildPrompt(zones);
    const imageBlob = dataUrlToBlob(imageDataUrl);
    const client = new InferenceClient(token);

    let resultBlob;
    let modelUsed = PRIMARY_MODEL;

    try {
      resultBlob = await runImageEdit(client, PRIMARY_MODEL, imageBlob, prompt);
    } catch (primaryError) {
      if (!isProviderCompatibilityError(primaryError)) throw primaryError;

      console.warn("Primary image edit model unavailable, trying fallback:", primaryError);
      modelUsed = FALLBACK_MODEL;
      resultBlob = await runImageEdit(client, FALLBACK_MODEL, imageBlob, prompt);
    }

    if (!(resultBlob instanceof Blob)) {
      throw new Error("Hugging Face returned an unexpected image response.");
    }

    if (!resultBlob.size) {
      throw new Error("Hugging Face returned an empty image.");
    }

    const imageResultDataUrl = await blobToDataUrl(resultBlob);

    return jsonResponse({
      ok: true,
      model: modelUsed,
      provider: "auto",
      zones,
      imageDataUrl: imageResultDataUrl
    });
  } catch (err) {
    console.error("harmonize error", err);

    return jsonResponse({
      ok: false,
      error: err?.message || "Unknown harmonization error."
    }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    endpoint: "/api/harmonize",
    method: "POST",
    sdk: "@huggingface/inference",
    provider: "auto",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    expects: {
      imageDataUrl: "data:image/jpeg;base64,...",
      zones: ["full", "undereye", "temples", "midface", "cheeks", "nose", "perioral", "lips", "chin", "prejowl", "jaw", "wrinkles"]
    }
  });
}

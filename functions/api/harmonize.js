// Cloudflare Pages Function
// POST /api/harmonize
// Uses the private HF_TOKEN secret configured in Cloudflare.
// No token is exposed to the browser.

const MODEL_ID = "black-forest-labs/FLUX.2-klein-9B";
const FAL_MODEL = "fal-ai/flux-2/klein/9b/edit";

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
      "cache-control": "no-store"
    }
  });
}

function normalizeDataUrl(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  // basic size guard: Cloudflare request limits are much larger, but this prevents accidental huge selfies.
  if (value.length > 12_000_000) return null;
  return value;
}

function buildPrompt(zones = []) {
  const selected = Array.isArray(zones) && zones.length
    ? zones.map(z => AREA_TEXT[z]).filter(Boolean)
    : [AREA_TEXT.full];

  const areas = selected.length ? selected.join("; ") : AREA_TEXT.full;

  return `
Edit ONLY the uploaded patient's face to create a highly realistic, conservative facial-harmonization simulation.

ABSOLUTE IDENTITY LOCK:
Keep the exact same person and preserve skull shape, facial width and length, eye shape/size/spacing/tilt, iris color, nose identity, fundamental lip anatomy, hairline, skin tone, ethnicity, expression, camera angle, focal perspective, crop, lighting, background, clothing and jewelry.

THIS IS NOT MAKEUP AND NOT A BEAUTY FILTER.
Do not add lipstick, eyeliner, mascara, lashes, brow makeup, foundation, contour, blush, glow, airbrushing or porcelain skin.
Do not change hair or hairstyle.
Do not enlarge the eyes.
Do not create an Instagram nose.
Do not overfill lips or cheeks.
Do not create a pointed chin or exaggerated jaw.
Do not make the patient look older or decades younger.

FACIAL HARMONIZATION GOAL:
Make this exact person look subtly more balanced, refreshed, rested and structurally harmonious, as if after exceptionally refined and conservative orofacial harmonization.
Changes must be anatomically coherent, realistic and difficult to detect as "work done".
Use the minimum effective correction.

SELECTED AREAS:
${areas}

If a selected area is already harmonious, leave it unchanged.
Do not alter neighboring unselected regions unnecessarily.
Preserve pores, freckles, pigmentation, realistic shadows and normal skin texture.
Under-eye improvement must preserve realistic anatomy and coloration.
Wrinkle improvement must soften only what is appropriate and must NOT erase natural texture.

PHOTOGRAPHIC CONTROL:
The AFTER must maintain exactly the same pose, head position, expression, camera angle, crop, lighting, background and skin color as the source.
Do not regenerate the scene. Edit the existing portrait.

FINAL QUALITY CHECK BEFORE OUTPUT:
same person; same eyes; same nose identity; same facial width; same age; no makeup; no artificial skin; no overfilling; no extra wrinkles; no sagging; no facial hollowing; no identity drift.

Return ONE edited photorealistic image only.
`.trim();
}

function routedUrl(path) {
  const hasQuery = path.includes("?");
  return `https://router.huggingface.co/fal-ai/${path}${hasQuery ? "&" : "?"}_subdomain=queue`;
}

async function hfFetch(url, token, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(url, { ...init, headers });
}

async function submitFal({ token, falModel, imageDataUrl, prompt }) {
  const url = routedUrl(falModel);

  const body = {
    prompt,
    image_urls: [imageDataUrl],
    num_images: 1,
    num_inference_steps: 28,
    guidance_scale: 4.0,
    output_format: "jpeg",
    acceleration: "regular",
    enable_safety_checker: true
  };

  const r = await hfFetch(url, token, {
    method: "POST",
    body: JSON.stringify(body)
  });

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!r.ok) {
    throw new Error(`Hugging Face submit ${r.status}: ${data?.detail || data?.error || text.slice(0, 500)}`);
  }
  return data;
}

function extractPath(urlString) {
  try {
    const u = new URL(urlString);
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

async function waitForFalResult({ token, falModel, submitted }) {
  const requestId = submitted?.request_id || submitted?.requestId;
  if (!requestId) {
    // Some routed calls can return the completed payload directly.
    if (submitted?.images?.[0]?.url) return submitted;
    throw new Error("Hugging Face did not return a request_id.");
  }

  const base = `${falModel}/requests/${requestId}`;
  const statusUrl = routedUrl(`${base}/status`);
  const resultUrl = routedUrl(base);

  const deadline = Date.now() + 115_000;

  while (Date.now() < deadline) {
    const sr = await hfFetch(statusUrl, token);
    const stText = await sr.text();
    let st;
    try { st = JSON.parse(stText); } catch { st = { raw: stText }; }

    if (!sr.ok) {
      throw new Error(`Hugging Face status ${sr.status}: ${st?.detail || st?.error || stText.slice(0, 300)}`);
    }

    const status = String(st?.status || "").toUpperCase();

    if (status === "COMPLETED") {
      const rr = await hfFetch(resultUrl, token);
      const resultText = await rr.text();
      let result;
      try { result = JSON.parse(resultText); } catch { result = { raw: resultText }; }
      if (!rr.ok) {
        throw new Error(`Hugging Face result ${rr.status}: ${result?.detail || result?.error || resultText.slice(0, 300)}`);
      }
      return result;
    }

    if (["FAILED", "CANCELLED", "ERROR"].includes(status)) {
      throw new Error(st?.error || st?.detail || `Generation ${status.toLowerCase()}.`);
    }

    await new Promise(r => setTimeout(r, 900));
  }

  throw new Error("The image generation timed out.");
}

async function fetchFinalImage(result) {
  const url =
    result?.images?.[0]?.url ||
    result?.data?.images?.[0]?.url ||
    result?.image?.url ||
    null;

  if (!url) throw new Error("The provider completed but returned no image URL.");

  if (url.startsWith("data:image/")) {
    return { dataUrl: url, sourceUrl: null };
  }

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Could not download generated image (${img.status}).`);

  const bytes = new Uint8Array(await img.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const type = img.headers.get("content-type") || "image/jpeg";

  return {
    dataUrl: `data:${type};base64,${b64}`,
    sourceUrl: url
  };
}

export async function onRequestPost(context) {
  try {
    const token = context.env.HF_TOKEN;
    if (!token) return json({ ok: false, error: "HF_TOKEN is not configured in Cloudflare." }, 500);

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const imageDataUrl = normalizeDataUrl(body?.imageDataUrl || body?.image);
    if (!imageDataUrl) {
      return json({
        ok: false,
        error: "Send the uploaded photo as imageDataUrl (data:image/...;base64,...)."
      }, 400);
    }

    const zones = Array.isArray(body?.zones) ? body.zones : ["full"];
    const prompt = buildPrompt(zones);
    const falModel = FAL_MODEL;

    const submitted = await submitFal({
      token,
      falModel,
      imageDataUrl,
      prompt
    });

    const result = await waitForFalResult({
      token,
      falModel,
      submitted
    });

    const finalImage = await fetchFinalImage(result);

    return json({
      ok: true,
      model: MODEL_ID,
      provider: "fal-ai via Hugging Face Inference Providers",
      providerModel: FAL_MODEL,
      zones,
      imageDataUrl: finalImage.dataUrl
    });
  } catch (err) {
    console.error("harmonize error", err);
    return json({
      ok: false,
      error: err?.message || "Unknown harmonization error.",
      hint: "If the provider reports credits exhausted, the Hugging Face free inference credit has been used up."
    }, 502);
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "/api/harmonize",
    method: "POST",
    expects: {
      imageDataUrl: "data:image/jpeg;base64,...",
      zones: ["full", "undereye", "midface", "cheeks", "lips", "chin", "jaw", "wrinkles"]
    }
  });
}

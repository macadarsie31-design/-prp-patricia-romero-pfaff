// Cloudflare Pages Function
// POST /api/harmonize
// Full Face simulator with two visual styles: Natural / Mejor versión.

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

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

function getProfileRules(profile) {
  switch (profile) {
    case "natural":
      return {
        label: "Natural",
        guidance: "3.5",
        styleBlock: `
SIMULATION STYLE — NATURAL
Create a conservative improvement.
Changes should be subtle, soft and believable.
The patient must look like the exact same person, only more rested, fresher, more harmonious and slightly younger.
Reduce the visual impression of fatigue and soften expression lines gently, but keep the result delicate.`
      };
    case "best":
    default:
      return {
        label: "Mejor versión",
        guidance: "4.0",
        styleBlock: `
SIMULATION STYLE — BEST VERSION
Create a clearly improved but tasteful version of the same patient.
The result must be noticeably better in direct comparison.
Show a more harmonious, more youthful and more polished face while remaining realistic and non-surgical.
Visibly reduce tiredness, soften wrinkles and folds, improve lip hydration/volume conservatively, and create a subtly more open, lifted and elegant eye area while preserving identity.`
      };
  }
}

function buildPrompt(analysis = null, profile = "best") {
  const metrics = analysis?.metrics || {};
  const profileRules = getProfileRules(profile);
  const structuralAnalysis = [
    `Landmarks detected: ${analysis?.landmarkCount || "not available"}`,
    `Lower-third / face-height ratio: ${Number(metrics.lowerThirdToFaceHeight || 0).toFixed(3)}`,
    `Jaw / face-width ratio: ${Number(metrics.jawToFaceWidth || 0).toFixed(3)}`,
    `Transverse asymmetry index: ${Number(metrics.transverseAsymmetry || 0).toFixed(3)}`,
    `Nasal midline deviation index: ${Number(metrics.noseMidDeviation || 0).toFixed(3)}`,
    `Mouth midline deviation index: ${Number(metrics.mouthMidDeviation || 0).toFixed(3)}`
  ].join("\n- ");

  return `
MASTER PROMPT — OROFACIAL HARMONIZATION / FRONT VIEW

Analyze the uploaded FRONTAL facial photograph and create a photorealistic FULL FACE simulation of the patient's ${profileRules.label} using non-surgical orofacial harmonization only.

ALLOWED TREATMENTS TO SIMULATE
- Hyaluronic-acid fillers
- Biostimulatory / structural filler effects when relevant
- Botulinum toxin visible effects
- Thread-lift effects only if they genuinely help

DO NOT SIMULATE
- Surgery of any kind
- Rhinoplasty
- Blepharoplasty
- Facelift surgery
- Makeup
- Hairstyle changes
- Hair-color changes
- Cosmetic contact lenses
- Skin resurfacing
- Lasers
- Peels
- Weight loss
- Dental changes
- Clothing or styling changes

ABSOLUTE IDENTITY LOCK
The AFTER must unquestionably be the SAME PERSON.

Preserve exactly:
- Eye shape and size
- Eye spacing
- Iris color
- Nose identity
- Natural lip anatomy
- Facial width
- Face length
- Forehead dimensions
- Natural bone structure
- Hairline
- Skin tone
- Natural skin characteristics
- Apparent age
- Background
- Lighting
- Pose
- Camera angle
- Crop

Do NOT beautify by replacing features.
Do NOT generate a generic social-media face.
Do NOT enlarge the eyes unnaturally.
Do NOT dramatically shrink the nose.
Do NOT create duck lips.
Do NOT create oversized cheekbones.
Do NOT create an artificial V-line jaw.
Do NOT over-tighten the lower face.
Do NOT make the person look like a different patient.

FULL FACE MODE ONLY
This simulator is Full Face only.
Analyze the whole face and choose only the areas that genuinely improve global harmony.
Prioritize support and balance before isolated refinements.

STRUCTURAL ANALYSIS INPUT
Use these metrics as constraints, not as a substitute for visual judgment:
- ${structuralAnalysis}

MD CODES PLANNING LOGIC
Internally follow this sequence:
1. FOUNDATION — support the midface first when needed.
2. CONTOUR — only if contour improvement clearly helps harmony.
3. REFINEMENT — tear trough, lips, perioral, lower-face transitions only after foundation.

${profileRules.styleBlock}

IMPORTANT VISUAL GOALS
- If there is midface deficiency, subtly improve support.
- If there is a tired under-eye transition, improve it conservatively.
- If the lower face would benefit, improve chin or mandibular continuity without exaggeration.
- If lips benefit from refinement, create subtly fuller, better hydrated and better defined lips while preserving natural anatomy.
- If botulinum toxin effects help, show a softer and more rested expression, never frozen.
- If appropriate, create a subtle lateral brow-tail elevation and a gently more open, almond-shaped eye impression (soft fox-eye effect), but never exaggerated.
- If threads are unnecessary, do not simulate them.

FOR BEST VERSION MODE
The changes should be noticeable on direct comparison, especially in one or more of these aspects when visually appropriate:
- softer forehead, glabellar and crow's-feet lines
- better under-eye transition with less tired appearance
- stronger midface support and smoother cheek transitions
- softer nasolabial / marionette appearance through structural support
- subtly fuller and more hydrated lips
- subtly lifted brow tail / fresher eye area
- improved lower-face contour continuity
- overall more harmonious and slightly younger appearance

STRICT SKIN & AGE LOCK
The AFTER must never contain more wrinkles, deeper folds, more sagging, more facial hollowing, or more texture than the source image.
The AFTER must look more rested and smoother than the source image, not older.
Preserve real skin texture.
Do not airbrush.
Do not blur heavily.
Do not add makeup.
Do not remove all texture.
Do not invent artifacts, white patches, shiny blobs, filler marks, strange highlights, asymmetrical smears, or warped facial features.

FINAL STANDARD
The AFTER should look like the same patient, only more balanced, more harmonious, more refreshed, smoother and more refined.
The face may look slightly younger and more attractive, but still unmistakably the same real person.
Noticeable improvement is allowed, but identity must remain intact.
The result must look realistic, elegant, non-surgical and clinically plausible.

Return ONE photorealistic edited image only.
`.trim();
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid imageDataUrl.");
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
  if (typeof result === "string") return result.startsWith("data:image/") ? result : `data:image/jpeg;base64,${result}`;
  if (typeof result.image === "string") return result.image.startsWith("data:image/") ? result.image : `data:image/jpeg;base64,${result.image}`;
  if (result.result && typeof result.result.image === "string") return result.result.image.startsWith("data:image/") ? result.result.image : `data:image/jpeg;base64,${result.result.image}`;
  throw new Error("Workers AI returned an unexpected image payload.");
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function readCfError(err) {
  const text = [err?.message, err?.cause?.message, err?.stack, err?.code, err?.status, err?.cause?.code, err?.cause?.status].filter(Boolean).join(" | ");
  const codeMatch = text.match(/\b(3036|3040|5035|5007|5004|3003|3006|3007|3008|5018|5016|3023|3041|3042)\b/);
  const statusMatch = text.match(/\b(400|403|404|405|408|413|429|500|502|503)\b/);
  return { internalCode: codeMatch ? codeMatch[1] : null, httpStatus: statusMatch ? Number(statusMatch[1]) : null, message: String(err?.message || "Workers AI error") };
}

async function runWorkersAiWithRetry(ai, model, payload) {
  const maxAttempts = 4;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.run(model, payload);
    } catch (err) {
      lastError = err;
      const info = readCfError(err);
      if (info.internalCode === "3040" && attempt < maxAttempts) {
        await sleep(600 * (2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function onRequestPost(context) {
  try {
    if (!context.env.AI || typeof context.env.AI.run !== "function") {
      return json({ ok: false, error: "Workers AI binding AI is not configured." }, 500);
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const imageBlob = dataUrlToBlob(body?.imageDataUrl || body?.image);
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const profile = typeof body?.profile === "string" ? body.profile : "best";
    const profileRules = getProfileRules(profile);
    const width = clampInt(body?.width, 256, 500, 500);
    const height = clampInt(body?.height, 256, 500, 500);

    const form = new FormData();
    form.append("input_image_0", imageBlob, "patient.jpg");
    form.append("prompt", buildPrompt(analysis, profile));
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("guidance", profileRules.guidance);

    const serialized = new Response(form);
    const result = await runWorkersAiWithRetry(context.env.AI, MODEL, {
      multipart: {
        body: serialized.body,
        contentType: serialized.headers.get("content-type")
      }
    });

    return json({
      ok: true,
      provider: "cloudflare-workers-ai",
      model: MODEL,
      profile,
      imageDataUrl: resultImageToDataUrl(result)
    });
  } catch (err) {
    console.error("harmonize error", err);
    const info = readCfError(err);
    let code = "GENERATION_FAILED";
    let status = info.httpStatus || 502;
    if (info.internalCode === "3040") { code = "OUT_OF_CAPACITY"; status = 429; }
    else if (info.internalCode === "3036") { code = "ACCOUNT_LIMITED"; status = 429; }
    else if (info.internalCode === "5035") { code = "PAID_PLAN_REQUIRED"; status = 403; }
    else if (info.internalCode === "3007") { code = "TIMEOUT"; status = 408; }
    return json({ ok: false, code, cloudflareCode: info.internalCode, cloudflareStatus: info.httpStatus, error: info.message }, status);
  }
}

export async function onRequestGet() {
  return json({ ok: true, endpoint: "/api/harmonize", method: "POST", provider: "cloudflare-workers-ai", model: MODEL, storage: "none" });
}

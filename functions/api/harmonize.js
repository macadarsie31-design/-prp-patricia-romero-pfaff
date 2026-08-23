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

function buildPrompt(zones = [], analysis = null) {
  const selected = Array.isArray(zones) && zones.length
    ? zones
    : ["full"];

  const selectedAreasText = selected.join(", ");

  const metrics = analysis?.metrics || {};
  const observations = Array.isArray(analysis?.observations)
    ? analysis.observations
    : [];

  const structuralAnalysis = [
    `Landmarks detected: ${analysis?.landmarkCount || "not available"}`,
    `Lower-third / face-height ratio: ${Number(metrics.lowerThirdToFaceHeight || 0).toFixed(3)}`,
    `Jaw / face-width ratio: ${Number(metrics.jawToFaceWidth || 0).toFixed(3)}`,
    `Transverse asymmetry index: ${Number(metrics.transverseAsymmetry || 0).toFixed(3)}`,
    `Nasal midline deviation index: ${Number(metrics.noseMidDeviation || 0).toFixed(3)}`,
    ...observations
  ].join("\n- ");

  return `
MASTER PROMPT — OROFACIAL HARMONIZATION / FRONT VIEW

Analyze the uploaded FRONTAL facial photograph and create a photorealistic simulation of the patient’s BEST VERSION through conservative orofacial harmonization only.

ALLOWED PROCEDURES
The simulation may consider ONLY:
- Hyaluronic-acid dermal fillers
- Biostimulatory/structural filler effects when relevant
- Botulinum toxin
- Thread-lift effects

DO NOT simulate:
- Surgery
- Rhinoplasty
- Blepharoplasty
- Facelift surgery
- Makeup
- Hairstyle or hair-color changes
- Eyelash extensions
- Cosmetic contact lenses
- Skin resurfacing
- Lasers
- Peels
- Skin filters
- Weight loss
- Dental changes
- Clothing or styling

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
- Ears if visible
- Skin tone
- Natural skin characteristics
- Individual facial characteristics
- Apparent age

Do NOT beautify by replacing features.
Do NOT generate a generic “Instagram face.”

Do NOT automatically:
- enlarge the eyes
- reduce the nose
- enlarge the lips
- create extremely high cheekbones
- narrow the face
- create a V-shaped jaw
- dramatically raise the eyebrows
- excessively sharpen the jaw
- erase natural asymmetry
- make the patient younger by changing identity

The objective is harmonization, not facial redesign.

ANALYZE THE ORIGINAL FACE FIRST
Before modifying the photograph, perform a frontal facial analysis.

Evaluate:
- Facial thirds
- Facial fifths
- Vertical midline
- Right/left symmetry
- Upper/middle/lower-third balance
- Temporal contour
- Eyebrow position
- Periorbital support
- Tear-trough appearance
- Midface volume and support
- Cheek projection
- Nasolabial relationship
- Nose-to-lip relationship
- Lip proportions
- Upper/lower lip relationship
- Perioral support
- Marionette region
- Chin width
- Chin length
- Chin projection as far as can reasonably be assessed frontally
- Pre-jowl region
- Mandibular contour
- Masseter/lower-face width
- Overall facial shape

TREATMENT PRIORITY
Classify potential changes internally as:
- PRIORITY 1 — HIGH IMPACT
- PRIORITY 2 — REFINEMENT
- NO TREATMENT

Never recommend or simulate a procedure merely because it is technically possible.
Maximum harmony with minimum intervention.

OBJECTIVE STRUCTURAL SCAN
The frontend performed a 478-point MediaPipe Face Landmarker scan and derived local structural metrics. No external reasoning model is used.
Use these metrics only as proportional constraints; do NOT replace your visual assessment:
- ${structuralAnalysis}

CLINICAL PLANNING LOGIC
Follow the MD Codes planning principle:
1. FOUNDATION — structural midface support first.
2. CONTOUR — temples and/or lower-face contour only when required.
3. REFINEMENT — tear trough, nasolabial, lips or marionette only after foundation/contour.

Do not treat isolated tear trough or folds first if structural support would plausibly improve them.
More severity should not automatically mean more volume in one point.
Prefer the smallest set of changes that creates the greatest global improvement.

FULL FACE MODE
This patient-facing simulator is Full Face only.
Analyze the entire face and choose only the minimum set of areas that genuinely improve global harmony.
Do not visibly modify an area merely because it exists in the treatment menu.

SELECTED AREAS
${selectedAreasText}

FILLER SIMULATION
Evaluate whether subtle filler-related structural correction could improve:
- Temples
- Tear trough / lid-cheek transition
- Midface
- Cheeks
- Nasolabial / perioral support
- Lips
- Marionette / pre-jowl
- Chin
- Jawline

Rules:
- keep lips subtle and natural
- no duck lips
- no exaggerated projection
- no migration appearance
- no oversized cheekbones
- no overfilled under-eyes
- no artificial V-line
- no unnaturally sharp jaw
- preserve the patient’s natural anatomy

BOTULINUM TOXIN — VISUAL EFFECTS ONLY
If appropriate, simulate conservative visible improvement in:
- Glabella
- Forehead
- Lateral orbital region
- subtle brow-tail support
- DAO-related downward mouth corners
- mentalis/chin tension
- masseter-related lower-face width

Rules:
- no frozen forehead
- no Spock brow
- no artificial expression
- no excessive lower-face narrowing

THREAD-LIFT EFFECT
Only if truly beneficial:
- subtle midface repositioning
- subtle lower-face support
- mild jowl contour improvement
- improved mandibular continuity

Rules:
- no fox eyes
- no obvious facelift effect
- no lateral overpull
- no mouth distortion
- if filler and/or botulinum toxin would look more natural, do not simulate threads

STRICT SKIN-AGE LOCK
The generated AFTER must never contain MORE wrinkles, deeper folds, more creases, more under-eye texture, more pore visibility, more sagging or more facial hollowing than the source image.
Do not invent eyebrow lines, eyelid creases, forehead lines, crow's-feet, nasolabial folds, marionette lines or neck folds.
Do not create white strokes, paint-like marks, duplicated eyebrows, eyebrow scars, floating highlights, warped eyelashes, altered pupils, mismatched eyelids, or asymmetric artifacts.
If a wrinkle is not intentionally being improved by the selected treatment simulation, reproduce it at the same apparent depth and position as the source.
Preserve the patient's apparent age. Never age the face.

SKIN MUST REMAIN REAL
Preserve:
- pores
- freckles
- pigmentation
- normal texture
- small blemishes
- natural under-eye coloration
- natural shadows

DO NOT:
- airbrush
- blur skin
- smooth excessively
- add artificial glow
- apply virtual makeup
- erase pigmentation

BEFORE IMAGE — NEVER MODIFY
The BEFORE must be the exact uploaded photograph.

AFTER IMAGE — CHANGE ONLY THE FACE
Maintain EXACTLY:
- Camera
- Perspective
- Head position
- Facial expression
- Eye direction
- Lighting
- Background
- Hair
- Clothing
- Jewelry
- Skin tone
- Image crop

Only simulate the subtle anatomical changes associated with the selected orofacial harmonization procedures.

PREVENT OVER-TREATMENT
After creating the proposed result, mentally reassess:
Could any treatment be reduced while maintaining essentially the same improvement?
If yes, reduce it.

Check specifically for:
- overfilled cheeks
- overfilled lips
- excessive under-eye correction
- excessive facial width
- excessive jaw definition
- unnatural chin
- excessive brow elevation
- overly smooth forehead
- pulled thread-lift appearance
- loss of individual character

FINAL STANDARD
The AFTER should look like:
THE SAME PATIENT — only more balanced, rested, harmonious and refined.

Not younger by identity replacement.
Not filtered.
Not surgically altered.
Not overfilled.
Not generic.
Not perfect.

Preserve identity first. Improve harmony second. Use the minimum intervention necessary.

Return ONE photorealistic edited image only.
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


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readCfError(err) {
  const text = [
    err?.message,
    err?.cause?.message,
    err?.stack,
    err?.code,
    err?.status,
    err?.cause?.code,
    err?.cause?.status
  ].filter(Boolean).join(" | ");

  const codeMatch = text.match(/\b(3036|3040|5035|5007|5004|3003|3006|3007|3008|5018|5016|3023|3041|3042)\b/);
  const statusMatch = text.match(/\b(400|403|404|405|408|413|429|500|502|503)\b/);

  return {
    internalCode: codeMatch ? codeMatch[1] : null,
    httpStatus: statusMatch ? Number(statusMatch[1]) : null,
    message: String(err?.message || "Workers AI error")
  };
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

      // 3040 = temporary Out of Capacity. Retry with short exponential backoff.
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
    const analysis = body?.analysis && typeof body.analysis === "object"
      ? body.analysis
      : null;

    // Reference images for FLUX.2 editing must remain below 512x512.
    // Frontend sends max 500px. Output keeps the same compact dimensions
    // for the live simulator and minimizes Neuron usage.
    const width = clampInt(body?.width, 256, 500, 500);
    const height = clampInt(body?.height, 256, 500, 500);

    const form = new FormData();
    form.append("input_image_0", imageBlob, "patient.jpg");
    form.append("prompt", buildPrompt(zones, analysis));
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("guidance", "3.6");

    // Cloudflare requires the multipart boundary generated by Request/Response.
    const serialized = new Response(form);
    const formStream = serialized.body;
    const contentType = serialized.headers.get("content-type");

    const result = await runWorkersAiWithRetry(context.env.AI, MODEL, {
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

    const info = readCfError(err);

    let code = "GENERATION_FAILED";
    let status = info.httpStatus || 502;

    if (info.internalCode === "3040") {
      code = "OUT_OF_CAPACITY";
      status = 429;
    } else if (info.internalCode === "3036") {
      code = "ACCOUNT_LIMITED";
      status = 429;
    } else if (info.internalCode === "5035") {
      code = "PAID_PLAN_REQUIRED";
      status = 403;
    } else if (info.internalCode === "3007") {
      code = "TIMEOUT";
      status = 408;
    }

    return json({
      ok: false,
      code,
      cloudflareCode: info.internalCode,
      cloudflareStatus: info.httpStatus,
      error: info.message
    }, status);
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

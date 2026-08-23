// Cloudflare Pages Function
// POST /api/harmonize
// Full Face simulator — Mejor versión only.

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

function getProfileRules() {
  return {
    label: "Mejor versión",
    guidance: "4.0"
  };
}

function buildPrompt(analysis = null) {
  const metrics = analysis?.metrics || {};
  const structuralAnalysis = [
    `Landmarks detected: ${analysis?.landmarkCount || "not available"}`,
    `Lower-third / face-height ratio: ${Number(metrics.lowerThirdToFaceHeight || 0).toFixed(3)}`,
    `Jaw / face-width ratio: ${Number(metrics.jawToFaceWidth || 0).toFixed(3)}`,
    `Transverse asymmetry index: ${Number(metrics.transverseAsymmetry || 0).toFixed(3)}`,
    `Nasal midline deviation index: ${Number(metrics.noseMidDeviation || 0).toFixed(3)}`,
    `Mouth midline deviation index: ${Number(metrics.mouthMidDeviation || 0).toFixed(3)}`
  ].join("\n- ");

  return `
Use the uploaded frontal facial photograph as the ONLY identity and anatomical reference.

Create a photorealistic simulation of the best, most attractive, youthful, refined and harmonious version of this EXACT SAME PERSON, as if they had received an exceptionally well-planned, high-end non-surgical facial harmonization treatment performed by an expert aesthetic injector.

ABSOLUTE PRIORITY — PRESERVE IDENTITY
The final person MUST remain unmistakably the same person.
Preserve exactly:
- Core facial identity
- Skull and bone structure
- Natural facial proportions
- Eye color, eye identity and eye spacing
- Nose identity
- Mouth identity
- Natural asymmetries that define the person
- Hairline, hair and ears
- Skin tone and ethnicity
- Camera angle, perspective and focal length
- Head position and facial expression
- Background and lighting

Do NOT generate a different person.
Do NOT replace the face with a generic beauty-model face.
Objective: SAME PERSON → professionally rejuvenated, lifted, balanced and facially harmonized.

STEP 1 — ANALYZE THE INDIVIDUAL FACE
Before modifying the image, visually evaluate:
- Facial thirds and fifths
- Symmetry
- Forehead and brow position
- Temporal volume
- Upper/lower eyelid region and tear troughs
- Midface projection and cheekbones
- Nasolabial folds
- Nose proportions
- Lips and perioral region
- Marionette area
- Chin projection
- Jawline, jowls and lower-face width
- Neck-to-jaw transition
- Overall facial shape
- Visible volume loss
- Skin laxity
- Fine lines and wrinkles

Use these geometric metrics only as secondary constraints; visual identity preservation comes first:
- ${structuralAnalysis}

Do NOT apply every treatment at maximum intensity. Determine what would aesthetically benefit THIS PARTICULAR FACE and create a customized full-face harmonization.

STEP 2 — REJUVENATION
Make the face look noticeably fresher and younger while remaining completely realistic.
Where appropriate reduce:
- Forehead lines
- Glabellar/frown lines
- Crow's feet
- Fine periocular wrinkles
- Under-eye tiredness
- Tear-trough shadowing
- Nasolabial folds
- Marionette shadows
- Downturned mouth appearance
- Fine perioral lines
- Chin creasing
- Early jowling
- Facial volume loss
- Mild skin laxity

Simulate the visible aesthetic effect of expertly planned Botox/neuromodulators where appropriate. Forehead smoother and relaxed, never frozen.

STEP 3 — EYE & BROW LIFT / FOXY-EYE EFFECT
Where suitable:
- Slightly elevate the lateral brow
- Open and refresh the eye area
- Reduce heaviness around the outer eye
- Create a subtle elegant almond/foxy-eye impression
- Improve upper-face balance
Do NOT dramatically change natural eye shape. This must look like successful non-surgical aesthetic treatment, not eye surgery.

STEP 4 — MIDFACE & CHEEKBONE SUPPORT
Use conservative structural filler effect to:
- Restore lost midface volume
- Improve cheek projection
- Define cheekbones
- Provide subtle lateral lift
- Improve lower eyelid-to-cheek transition
- Reduce tired/hollow appearance
- Indirectly soften nasolabial folds
Favor structural support and lifting, not excessive volume. No round or swollen cheeks.

STEP 5 — LOWER-FACE LIFT & V-SHAPE
Where anatomically appropriate:
- Improve jawline definition
- Reduce appearance of jowls
- Restore prejowl support
- Improve mandibular contour
- Refine jaw-to-neck transition
- Improve chin projection/proportion
- Create a subtle elegant V-shaped contour
Use simulated filler and/or thread-lift effect only where needed. Do NOT dramatically narrow the skull or digitally reshape the whole face.

STEP 6 — CHIN
If beneficial, subtly improve chin width/height/projection for facial balance, lower-face proportion, V-shape support and jawline continuity. No excessively long, sharp or artificial chin.

STEP 7 — LIPS & PERIORAL AREA
Preserve the person's original lip identity and natural shape.
Where beneficial simulate:
- Conservative lip filler
- Improved hydration and smoothness
- Slightly improved vermilion definition
- Better upper/lower lip proportion
- Gentle correction of volume loss
- Subtle Cupid's bow definition
- Very subtle Botox lip-flip effect when appropriate
Lips should appear youthful, elegant and naturally fuller, never inflated. No duck lips.

STEP 8 — NOSE HARMONIZATION
Only if proportions genuinely benefit, simulate extremely subtle non-surgical liquid-rhinoplasty style refinement:
- Improve apparent symmetry
- Cleaner bridge
- Very subtle lifted/upturned tip effect
- Better nose-lips-chin harmony
Preserve the recognizable nose. Do NOT make a tiny generic perfect nose.

STEP 9 — SKIN QUALITY
Improve skin quality while maintaining REAL HUMAN SKIN TEXTURE:
- More even complexion
- Healthy hydration
- Slightly improved firmness
- Reduced fine lines
- Reduced visible sun damage or uneven pigmentation
- Refined but visible pores
- Healthy natural luminosity
Do NOT create beauty-filter skin. No waxy, plastic, blurred, airbrushed or porcelain skin.

DESIRED FINAL RESULT
The person should look exceptionally refreshed, lifted, youthful and attractive, while remaining immediately recognizable.
The transformation must be clearly visible in before/after comparison while anatomically plausible.
Desired qualities:
- Younger appearance
- Fresher eyes
- Subtle brow lift
- Smoother forehead
- Better midface support
- Higher-looking cheekbones
- Softer facial folds
- Refined hydrated lips
- Better facial balance
- Cleaner jawline
- Reduced appearance of jowls
- Harmonized chin
- Elegant V-shaped lower face
- Subtle nasal refinement only if beneficial
- Natural skin
- Sophisticated high-end aesthetic result

PHOTOREALISM
The output must look like a real photograph of the same person after treatment, NOT an AI beauty filter.
Maintain realistic:
- Skin texture
- Pores
- Fine hairs
- Natural shadows
- Subsurface skin detail
- Facial anatomy
- Eye moisture/reflections
- Lip texture
- Lighting direction
- Camera perspective
Do not add dramatic makeup. Improvement must come from simulated facial harmonization.

NEGATIVE INSTRUCTIONS — CRITICAL
DO NOT:
- Change identity
- Generate a different face
- Make the person look older
- Add more wrinkles, folds, sagging or hollowing than the source
- Masculinize/feminize beyond original characteristics
- Excessively enlarge cheeks
- Overfill lips
- Create pillow face
- Create frozen Botox appearance
- Make eyes unnaturally slanted
- Dramatically alter eye shape
- Make nose unrealistically tiny
- Create excessively pointed chin
- Make jaw unnaturally narrow
- Remove all skin texture
- Blur the skin
- Create plastic skin
- Apply excessive makeup
- Change hairstyle/hair color/eye color/expression/camera angle/background/lighting/clothing
- Add accessories
- Apply surgical transformations
- Create white patches, bright filler-like blobs, duplicated brows, warped lashes, smeared skin, mismatched pupils, asymmetric artifacts, or synthetic highlights

IDENTITY PRESERVATION > BEAUTIFICATION.
When a proposed modification would compromise identity, reduce that modification.

Final target: THE EXACT SAME PERSON — rejuvenated, subtly lifted, structurally balanced, naturally contoured and facially harmonized into their most refined and attractive realistic version.

Return ONE photorealistic edited image only. No text, labels, diagrams or annotations in the generated image.
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
    const profile = "best";
    const profileRules = getProfileRules();
    const width = clampInt(body?.width, 256, 500, 500);
    const height = clampInt(body?.height, 256, 500, 500);

    const form = new FormData();
    form.append("input_image_0", imageBlob, "patient.jpg");
    form.append("prompt", buildPrompt(analysis));
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
      profile: "best",
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

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

function buildPrompt() {
  return `Use the uploaded frontal facial photograph as the ONLY identity and anatomical reference.

Create a photorealistic simulation of the best, most attractive, youthful, refined and harmonious version of this EXACT SAME PERSON, as if they had received an exceptionally well-planned, high-end non-surgical facial harmonization treatment performed by an expert aesthetic injector.

ABSOLUTE PRIORITY — PRESERVE IDENTITY

The final person MUST remain unmistakably the same person.

Preserve exactly:

* Core facial identity
* Skull and bone structure
* Natural facial proportions
* Eye color, eye identity and eye spacing
* Nose identity
* Mouth identity
* Natural asymmetries that define the person
* Hairline, hair and ears
* Skin tone and ethnicity
* Camera angle, perspective and focal length
* Head position and facial expression
* Background and lighting

Do NOT generate a different person.

Do NOT replace the face with a generic beauty-model face.

The objective is:

SAME PERSON → professionally rejuvenated, lifted, balanced and facially harmonized.

⸻

STEP 1 — ANALYZE THE INDIVIDUAL FACE

Before modifying the image, visually evaluate the person’s:

* Facial thirds
* Facial fifths
* Symmetry
* Forehead
* Brow position
* Temporal volume
* Upper and lower eyelid region
* Tear troughs
* Midface projection
* Cheekbones
* Nasolabial folds
* Nose proportions
* Lips
* Perioral region
* Marionette area
* Chin projection
* Jawline
* Jowls
* Lower-face width
* Neck-to-jaw transition
* Overall facial shape
* Visible volume loss
* Skin laxity
* Fine lines and wrinkles

Do NOT apply every treatment at maximum intensity.

Determine what would aesthetically benefit THIS PARTICULAR FACE and create a customized full-face harmonization.

⸻

STEP 2 — REJUVENATION

Make the face look noticeably fresher and younger while remaining completely realistic.

Reduce visible signs of aging including, where appropriate:

* Forehead lines
* Glabellar/frown lines
* Crow’s feet
* Fine periocular wrinkles
* Under-eye tiredness
* Tear-trough shadowing
* Nasolabial folds
* Marionette shadows
* Downturned appearance around the mouth
* Fine perioral lines
* Chin creasing
* Early jowling
* Facial volume loss
* Mild skin laxity

Simulate the aesthetic effect of expertly placed Botox / neuromodulators where anatomically appropriate.

The forehead should appear smoother and more relaxed without looking frozen.

Maintain believable facial anatomy.

⸻

STEP 3 — EYE & BROW LIFT / FOXY-EYE EFFECT

Where suitable for the person’s anatomy, create a subtle non-surgical brow and lateral-eye lift.

Simulate the aesthetic effect achievable through carefully planned Botox and/or minimally invasive lifting techniques:

* Slightly elevate the lateral brow
* Open and refresh the eye area
* Reduce heaviness around the outer eye
* Create a subtle elegant almond/foxy-eye impression
* Improve upper-face balance

IMPORTANT:

Do NOT dramatically change the person’s natural eye shape.

The result should look like a successful aesthetic treatment, not eye surgery or a different person’s eyes.

⸻

STEP 4 — MIDFACE & CHEEKBONE SUPPORT

Restore youthful midface structure where needed.

Use the visual effect of conservative, strategically placed dermal filler to:

* Restore lost midface volume
* Improve cheek projection
* Define the cheekbones
* Provide subtle lateral lift
* Improve the transition between the lower eyelid and cheek
* Reduce tired or hollow appearance
* Indirectly soften nasolabial folds

Favor structural support and lifting rather than excessive volume.

Avoid round, swollen or overfilled cheeks.

⸻

STEP 5 — LOWER-FACE LIFT & V-SHAPE

Create a cleaner, more elegant and youthful lower face.

Where anatomically appropriate:

* Improve jawline definition
* Reduce the visual appearance of jowls
* Restore prejowl support
* Improve mandibular contour
* Refine the transition from jaw to neck
* Improve chin projection and proportion
* Create a subtle, elegant V-shaped facial contour

Use the simulated effect of strategically placed filler and/or lifting threads only where needed.

The V-shape must remain believable for the person’s original anatomy.

Do NOT dramatically narrow the skull or digitally reshape the entire face.

⸻

STEP 6 — CHIN

Analyze chin width, height and projection.

If aesthetically beneficial, simulate subtle chin filler to:

* Improve facial balance
* Refine projection
* Improve lower-face proportions
* Support the V-shaped contour
* Improve jawline continuity

Avoid an excessively long, sharp or artificial chin.

⸻

STEP 7 — LIPS & PERIORAL AREA

Enhance the lips while preserving their original identity and natural shape.

Where beneficial, simulate:

* Conservative lip filler
* Improved hydration and smoothness
* Slightly improved vermilion definition
* Better upper/lower lip proportion
* Gentle correction of volume loss
* Subtle Cupid’s bow definition
* A very subtle Botox lip-flip effect when appropriate

The lips should appear youthful, elegant and naturally fuller, never inflated.

Do NOT create duck lips.

Do NOT erase the person’s natural lip anatomy.

⸻

STEP 8 — NOSE HARMONIZATION

Only if the facial proportions would genuinely benefit from it, make extremely subtle visual refinements consistent with a conservative non-surgical liquid rhinoplasty.

Possible improvements:

* Slightly refine the nasal profile
* Improve apparent symmetry
* Create a cleaner bridge
* Provide a very subtle lifted/upturned tip effect
* Improve harmony between nose, lips and chin

Preserve the person’s recognizable nose.

Do NOT replace it with a tiny generic “perfect” nose.

⸻

STEP 9 — SKIN QUALITY

Improve skin quality while maintaining REAL HUMAN SKIN TEXTURE.

Create:

* More even complexion
* Healthy hydration
* Slightly improved firmness
* Reduced fine lines
* Reduced visible sun damage or uneven pigmentation
* Refined but still visible pores
* Healthy natural luminosity

CRITICAL:

Do NOT use beauty-filter skin.

Do NOT create waxy, plastic, blurred, airbrushed or porcelain skin.

Keep pores, microtexture and realistic imperfections.

⸻

DESIRED FINAL RESULT

The final image should communicate:

“This person looks exceptionally refreshed, lifted, youthful and attractive — but I can still immediately recognize them.”

Aim for the visual result of an excellent full-face aesthetic treatment rather than obvious cosmetic work.

The transformation should include enough improvement to be clearly visible in a before/after comparison while remaining anatomically plausible.

Desired qualities:

* Younger appearance
* Fresher eyes
* Subtle brow lift
* Smoother forehead
* Better midface support
* Higher-looking cheekbones
* Softer facial folds
* Refined lips
* Better facial balance
* Cleaner jawline
* Reduced appearance of jowls
* Harmonized chin
* Elegant V-shaped lower face
* Subtle nasal refinement only if beneficial
* Natural skin
* Sophisticated, high-end aesthetic result

⸻

PHOTOREALISM

The output must look like a real photograph taken of the same person after treatment, NOT an AI beauty filter.

Maintain realistic:

* Skin texture
* Pores
* Fine hairs
* Natural shadows
* Subsurface skin detail
* Facial anatomy
* Eye moisture and reflections
* Lip texture
* Lighting direction
* Camera perspective

Do not change makeup unless absolutely necessary for realism.

Do not add dramatic makeup to create the illusion of improvement.

The improvement must come primarily from the simulated facial harmonization.

⸻

NEGATIVE INSTRUCTIONS — CRITICAL

DO NOT:

* Change identity
* Generate a different face
* Make the person look older
* Masculinize or feminize the face beyond its original characteristics
* Excessively enlarge cheeks
* Overfill lips
* Create pillow face
* Create frozen Botox appearance
* Make eyes unnaturally slanted
* Dramatically alter eye shape
* Make the nose unrealistically tiny
* Create an excessively pointed chin
* Make the jaw unnaturally narrow
* Remove all skin texture
* Blur the skin
* Create plastic skin
* Apply excessive makeup
* Change hairstyle
* Change hair color
* Change eye color
* Change expression
* Change camera angle
* Change background
* Change lighting
* Change clothing
* Add accessories
* Apply surgical transformations

IDENTITY PRESERVATION > BEAUTIFICATION.

When a proposed modification would compromise the person’s identity, reduce the intensity of that modification.

Final target:

THE EXACT SAME PERSON — rejuvenated, subtly lifted, structurally balanced, naturally contoured and facially harmonized into their most refined and attractive realistic version.`.trim();
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

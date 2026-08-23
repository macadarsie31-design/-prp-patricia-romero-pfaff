// Cloudflare Pages Function
// POST /api/harmonize
// Full Face simulator — Mejor versión only. JSON master configuration embedded exactly as provided.

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

const MASTER_HARMONIZATION_CONFIG = {
  "task": "photorealistic_non_surgical_facial_harmonization",
  "input_reference": {
    "instruction": "Use the uploaded frontal facial photograph as the ONLY identity and anatomical reference.",
    "reference_priority": "absolute",
    "preserve_original_image_context": true
  },
  "main_objective": {
    "goal": "Create the best, most attractive, youthful, refined and harmonious realistic version of this EXACT SAME PERSON.",
    "treatment_simulation": "High-end non-surgical full-face facial harmonization performed by an expert aesthetic injector.",
    "core_rule": "SAME PERSON -> rejuvenated, lifted, balanced, refined and naturally facially harmonized.",
    "identity_priority": "IDENTITY PRESERVATION > BEAUTIFICATION"
  },
  "identity_preservation": {
    "strength": "maximum",
    "must_preserve": [
      "core facial identity",
      "recognizable facial anatomy",
      "skull structure",
      "bone structure",
      "natural facial proportions",
      "facial width and length",
      "eye identity",
      "eye color",
      "eye spacing",
      "natural eye size",
      "nose identity",
      "mouth identity",
      "lip anatomy",
      "natural asymmetries that define the person",
      "hairline",
      "hair",
      "ears",
      "skin tone",
      "ethnicity",
      "head position",
      "facial expression",
      "camera angle",
      "perspective",
      "focal length",
      "background",
      "lighting",
      "clothing"
    ],
    "never_do": [
      "generate a different person",
      "replace the face with a generic beauty model",
      "change ethnicity",
      "change age category dramatically",
      "change bone structure unnecessarily",
      "change the person's recognizable eye identity",
      "change the person's recognizable nose identity",
      "change the person's recognizable mouth identity"
    ]
  },
  "analysis_before_editing": {
    "required": true,
    "instruction": "Analyze the individual facial anatomy before applying any aesthetic modification.",
    "evaluate": [
      "facial thirds",
      "facial fifths",
      "overall facial shape",
      "facial symmetry",
      "forehead proportions",
      "brow position",
      "temporal volume",
      "upper eyelid region",
      "lower eyelid region",
      "tear troughs",
      "under-eye shadows",
      "midface projection",
      "malar volume",
      "cheekbone definition",
      "nasolabial folds",
      "nose proportions",
      "lip proportions",
      "perioral region",
      "marionette region",
      "chin width",
      "chin height",
      "chin projection",
      "jawline",
      "prejowl area",
      "jowls",
      "lower-face width",
      "neck-to-jaw transition",
      "visible volume loss",
      "skin laxity",
      "fine lines",
      "dynamic wrinkles",
      "skin quality"
    ],
    "decision_rule": "Only apply treatments that aesthetically benefit this particular face. Do not apply every treatment automatically or at maximum intensity."
  },
  "treatment_philosophy": {
    "approach": "customized_full_face_harmonization",
    "priority_order": [
      "preserve identity",
      "improve facial balance",
      "restore youthful support",
      "create subtle lifting",
      "refine proportions",
      "improve skin quality",
      "avoid overcorrection"
    ],
    "result_style": [
      "elegant",
      "high-end",
      "youthful",
      "refined",
      "natural",
      "anatomically plausible",
      "noticeably improved",
      "not overdone"
    ]
  },
  "botox_neuromodulator_simulation": {
    "enabled": true,
    "apply_only_if_beneficial": true,
    "possible_targets": [
      "forehead lines",
      "glabellar lines",
      "frown lines",
      "crow's feet",
      "subtle lateral brow lift",
      "subtle brow balancing",
      "subtle lip flip",
      "downturned mouth corners when appropriate",
      "chin dimpling when appropriate"
    ],
    "desired_effect": [
      "smoother forehead",
      "more relaxed expression",
      "fresher eye area",
      "slightly elevated lateral brow",
      "natural movement appearance"
    ],
    "avoid": [
      "frozen forehead",
      "unnaturally high eyebrows",
      "Spock brow",
      "expressionless face"
    ]
  },
  "eye_and_brow_rejuvenation": {
    "enabled": true,
    "apply_only_if_suitable": true,
    "goals": [
      "open and refresh the eye area",
      "reduce tired appearance",
      "reduce visual heaviness",
      "slightly elevate the lateral brow",
      "create a subtle elegant almond-eye impression",
      "create a very subtle foxy-eye effect when anatomically suitable"
    ],
    "limits": [
      "do not dramatically change eye shape",
      "do not change eye spacing",
      "do not enlarge eyes unnaturally",
      "do not create surgical-looking canthal changes"
    ]
  },
  "under_eye_rejuvenation": {
    "enabled": true,
    "apply_only_if_needed": true,
    "goals": [
      "reduce tear trough shadowing",
      "soften hollow appearance",
      "improve lower-eyelid to cheek transition",
      "reduce tired appearance"
    ],
    "method_visualization": [
      "midface support",
      "conservative tear-trough correction when appropriate"
    ],
    "avoid": [
      "puffy under eyes",
      "overfilled tear troughs",
      "loss of natural anatomy"
    ]
  },
  "midface_and_cheek_harmonization": {
    "enabled": true,
    "apply_only_if_needed": true,
    "possible_simulation": "strategic dermal filler",
    "goals": [
      "restore youthful midface volume",
      "improve cheek projection",
      "define cheekbones",
      "create subtle lateral lift",
      "improve under-eye to cheek transition",
      "soften nasolabial folds indirectly",
      "restore structural support"
    ],
    "design_principle": "Favor structural support and lift rather than excessive volume.",
    "avoid": [
      "pillow face",
      "round swollen cheeks",
      "overfilled malar region",
      "unnatural cheek projection"
    ]
  },
  "nasolabial_and_marionette_region": {
    "enabled": true,
    "apply_only_if_needed": true,
    "goals": [
      "soften excessive shadowing",
      "restore youthful transition",
      "reduce lower-face heaviness"
    ],
    "priority": "Correct structural causes first through midface and lower-face support rather than aggressively filling folds directly."
  },
  "jawline_harmonization": {
    "enabled": true,
    "apply_only_if_needed": true,
    "goals": [
      "improve mandibular definition",
      "refine jawline continuity",
      "reduce visual appearance of jowls",
      "restore prejowl support",
      "improve jaw-to-neck transition",
      "create a cleaner youthful lower face"
    ],
    "possible_simulation": [
      "strategic dermal filler",
      "subtle lifting effect",
      "thread-lift effect only when beneficial"
    ],
    "avoid": [
      "overly square jaw",
      "unnaturally narrow jaw",
      "extreme jawline definition",
      "dramatic skull reshaping"
    ]
  },
  "v_shape_refinement": {
    "enabled": true,
    "apply_only_if_compatible_with_original_anatomy": true,
    "goal": "Create a subtle elegant V-shaped lower-face contour while preserving the person's natural face shape.",
    "avoid": [
      "extreme tapering",
      "tiny lower face",
      "overly pointed chin",
      "digital slimming unrelated to plausible treatment"
    ]
  },
  "chin_harmonization": {
    "enabled": true,
    "apply_only_if_beneficial": true,
    "analyze": [
      "chin width",
      "chin height",
      "chin projection",
      "relationship with nose",
      "relationship with lips",
      "relationship with jawline"
    ],
    "goals": [
      "improve facial balance",
      "improve lower-face proportions",
      "improve projection if deficient",
      "support jawline continuity",
      "support subtle V-shape"
    ],
    "avoid": [
      "witch chin",
      "excessively long chin",
      "excessively narrow chin",
      "unnaturally sharp chin"
    ]
  },
  "lip_harmonization": {
    "enabled": true,
    "apply_only_if_beneficial": true,
    "preserve_original_lip_identity": true,
    "possible_simulation": [
      "conservative lip filler",
      "subtle hydration effect",
      "subtle lip flip"
    ],
    "goals": [
      "restore youthful lip volume",
      "improve hydration",
      "improve vermilion definition",
      "improve upper-to-lower lip balance",
      "preserve Cupid's bow",
      "gently correct age-related volume loss",
      "create elegant natural fullness"
    ],
    "avoid": [
      "duck lips",
      "sausage lips",
      "excessive projection",
      "overfilled vermilion",
      "generic influencer lips",
      "erasing original lip anatomy"
    ]
  },
  "nose_harmonization": {
    "enabled": true,
    "apply_only_if_clearly_beneficial": true,
    "maximum_intensity": "very subtle",
    "possible_simulation": "conservative non-surgical liquid rhinoplasty",
    "goals": [
      "improve apparent symmetry",
      "refine bridge continuity",
      "create a cleaner profile impression",
      "provide a very subtle lifted tip effect when appropriate",
      "improve harmony between nose, lips and chin"
    ],
    "preserve": [
      "recognizable nose identity",
      "natural nasal dimensions",
      "ethnic characteristics"
    ],
    "avoid": [
      "tiny generic nose",
      "surgical rhinoplasty transformation",
      "dramatically narrower nose",
      "Barbie nose",
      "overly upturned tip"
    ]
  },
  "thread_lift_simulation": {
    "enabled": true,
    "apply_only_if_beneficial": true,
    "intensity": "subtle",
    "possible_effects": [
      "subtle lateral cheek lift",
      "subtle lower-face lift",
      "improved jowl appearance",
      "slightly cleaner mandibular contour",
      "subtle lateral brow lift"
    ],
    "avoid": [
      "pulled appearance",
      "unnatural skin tension",
      "surgical facelift effect",
      "distorted eye shape"
    ]
  },
  "skin_rejuvenation": {
    "enabled": true,
    "goals": [
      "more even complexion",
      "healthy hydration",
      "slightly improved firmness",
      "reduced fine lines",
      "reduced uneven pigmentation",
      "reduced visible sun damage",
      "healthier luminosity",
      "refined but visible pores"
    ],
    "must_preserve": [
      "real skin texture",
      "pores",
      "microtexture",
      "fine facial hairs",
      "natural tonal variation",
      "small realistic imperfections"
    ],
    "avoid": [
      "beauty filter",
      "plastic skin",
      "waxy skin",
      "porcelain skin",
      "airbrushed skin",
      "over-blurred skin",
      "CGI skin"
    ]
  },
  "rejuvenation_targets": {
    "reduce_when_present": [
      "forehead lines",
      "glabellar lines",
      "crow's feet",
      "fine periocular lines",
      "under-eye tiredness",
      "tear-trough shadowing",
      "nasolabial folds",
      "marionette shadows",
      "downturned mouth appearance",
      "fine perioral lines",
      "chin creasing",
      "early jowling",
      "visible facial volume loss",
      "mild skin laxity"
    ],
    "rule": "Reduce signs of aging without erasing natural anatomy or making the face look artificial."
  },
  "beautification_without_makeup": {
    "rule": "The aesthetic improvement must come primarily from facial harmonization, not from makeup.",
    "preserve_existing_makeup": true,
    "do_not_add": [
      "heavy foundation",
      "contouring makeup",
      "dramatic eyeliner",
      "false lashes",
      "heavy eyebrow makeup",
      "dramatic lipstick",
      "glamour makeup"
    ]
  },
  "photorealism": {
    "priority": "maximum",
    "target": "A real photograph of the same person after excellent aesthetic treatment, not an AI-generated beauty face.",
    "maintain": [
      "realistic skin texture",
      "visible pores",
      "fine hairs",
      "natural shadows",
      "subsurface skin detail",
      "realistic facial anatomy",
      "eye moisture",
      "natural eye reflections",
      "realistic lip texture",
      "original lighting direction",
      "original camera perspective",
      "original depth of field",
      "natural facial asymmetry"
    ]
  },
  "transformation_strength": {
    "overall": "moderate_to_noticeable",
    "instruction": "The improvement should be clearly visible in a before-and-after comparison while still looking anatomically plausible and unmistakably like the same person.",
    "do_not": [
      "under-correct so much that no improvement is visible",
      "over-correct until identity changes"
    ]
  },
  "desired_final_result": {
    "appearance": [
      "younger",
      "fresher",
      "more rested",
      "subtly lifted",
      "more balanced",
      "more refined",
      "more attractive",
      "naturally contoured",
      "high-end aesthetic result"
    ],
    "possible_visible_improvements": [
      "fresher eye area",
      "subtle brow lift",
      "smoother forehead",
      "better midface support",
      "more defined cheekbones",
      "softer facial folds",
      "refined natural lips",
      "improved facial balance",
      "cleaner jawline",
      "reduced appearance of jowls",
      "harmonized chin",
      "subtle V-shaped lower face",
      "subtle nasal refinement only if beneficial",
      "healthy natural skin"
    ],
    "final_impression": "This person looks exceptionally refreshed, lifted, youthful and attractive, but is immediately recognizable as exactly the same person."
  },
  "negative_prompt": [
    "different person",
    "identity change",
    "face swap",
    "generic beauty face",
    "AI influencer face",
    "different skull",
    "different bone structure",
    "different ethnicity",
    "different eye color",
    "different eye spacing",
    "different nose identity",
    "different mouth identity",
    "dramatic eye reshaping",
    "extreme foxy eyes",
    "unnatural slanted eyes",
    "pillow face",
    "overfilled cheeks",
    "overfilled lips",
    "duck lips",
    "frozen Botox face",
    "extreme brow lift",
    "tiny generic nose",
    "Barbie nose",
    "extremely pointed chin",
    "excessively narrow jaw",
    "extreme V-line",
    "surgical facelift appearance",
    "plastic skin",
    "waxy skin",
    "airbrushed skin",
    "blurred skin",
    "porcelain skin",
    "beauty filter",
    "heavy makeup",
    "dramatic makeup",
    "changed hairstyle",
    "changed hair color",
    "changed clothing",
    "changed background",
    "changed camera angle",
    "changed perspective",
    "changed lighting",
    "changed expression",
    "unrealistic anatomy",
    "over-retouched portrait",
    "CGI face"
  ],
  "final_execution_rule": {
    "instruction": "If any proposed aesthetic modification begins to compromise identity, anatomical plausibility or realism, reduce the intensity of that modification.",
    "ultimate_target": "THE EXACT SAME PERSON — rejuvenated, subtly lifted, structurally supported, naturally contoured, proportionally balanced and facially harmonized into their most refined realistic version."
  }
};

function getProfileRules() {
  return {
    label: "Mejor versión",
    guidance: "4.0"
  };
}

// IMPORTANT: flux-2-klein-4b is a small, distilled, FIXED 4-step model.
// It reads "prompt" as plain natural language through a text encoder — it
// does not parse JSON syntax. Sending JSON.stringify(MASTER_HARMONIZATION_CONFIG)
// (12.5k characters of braces/keys/quotes) wastes almost all of its limited
// attention on punctuation instead of the actual instructions, which is why
// identity (hair color, lighting, skin tone) was drifting instead of being
// preserved. MASTER_HARMONIZATION_CONFIG is kept below as the single source
// of truth / documentation, but buildPrompt() now compiles it into a short,
// natural-language instruction.
//
// v4: comparing the user's own reference before/after pair, most of the
// "after" look comes from a) fixing tear trough / nasolabial fold shadows,
// b) very light natural makeup (groomed brows, concealer, a little blush,
// a little lip color) rather than pure filler simulation. v3 explicitly told
// the model NOT to add makeup, which fought against this. Now it's allowed,
// but capped hard at "barely noticeable."
function buildPrompt() {
  return [
    "Apply these specific visible corrections to this face: 1) Fill and soften the nasolabial folds (the creases running from the nose to the corners of the mouth) so they are much less visible. 2) Fully correct the dark circles and hollow tear-trough shadow under the eyes — brighten and even out that area with a soft concealer-like effect so it blends smoothly into the cheek, no dark shadow left. 3) Add clearly visible volume, hydration and a soft natural color to the lips, fuller than the original but keeping the same lip shape and Cupid's bow. 4) Lift and add volume to the cheeks/cheekbones (malar area) for a more contoured, lifted midface, with a very subtle natural blush tone.",
    "Also add very light, natural, barely-noticeable everyday makeup: neatly groomed and slightly filled-in eyebrows, a soft concealer under the eyes, a touch of natural blush or bronzer on the cheeks for a healthy glow, and a subtle tinted lip color — this should look like someone with great skin who did their makeup in 2 minutes, NOT a glam or dramatic makeup look. No visible foundation texture, no heavy contouring, no dramatic eyeliner, no false lashes.",
    "Also apply, where it benefits this face: relaxed and smoother forehead and glabella lines; a fresh, rested eye area with a subtle elegant lateral brow/canthal lift (foxy-eye effect); a very subtle lift and refinement of the nasal tip, keeping the person's recognizable nose; a more defined jawline with reduced jowls; healthier, more even skin with visible real pores and texture underneath the light makeup.",
    "All of this must be a photorealistic edit of the EXACT SAME PERSON, sharp and highly detailed, not blurry, not textured with fake wrinkles or grain/noise anywhere on the skin. Keep the same face shape, bone structure, eye color, ethnicity, hairline, hair color, hairstyle, ears, underlying skin tone, head position, facial expression, camera angle, perspective, background, lighting and clothing exactly as in the original photo.",
    "The corrections above should be clearly visible in a before-and-after comparison — a confident, well-defined harmonization result — while still looking anatomically plausible and unmistakably like the same person.",
    "Do not: swap identity, change bone structure, change eye color, create an unnatural or surgical-looking canthal change, create duck lips or overfilled cheeks, freeze the expression, create a tiny generic 'Barbie' nose, add plastic or waxy skin, add fake grain/texture/wrinkles anywhere on the skin, apply heavy or dramatic makeup, change hair color or hairstyle, change the background, change the lighting, or change the camera angle."
  ].join(" ");
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
    // The 512x512 ceiling only applies to the REFERENCE image (input_image_0,
    // enforced client-side before this point). The output width/height are a
    // separate parameter and Cloudflare's own examples request up to
    // 1024-2048px outputs, so raising this ceiling fixes soft/blurry results
    // without affecting the reference-image constraint.
    const width = clampInt(body?.width, 256, 1024, 720);
    const height = clampInt(body?.height, 256, 1024, 720);

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

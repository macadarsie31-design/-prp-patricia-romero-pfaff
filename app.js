(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    img: null,
    landmarks: null,
    landmarker: null,
    zone: "lips",
    strength: 1
  };

  const fileInput = $("#fileInput");
  const fileInput2 = $("#fileInput2");
  const simEmpty = $("#simEmpty");
  const simWorkspace = $("#simWorkspace");
  const beforeCanvas = $("#beforeCanvas");
  const afterCanvas = $("#afterCanvas");
  const compare = $("#compare");
  const compareSlider = $("#compareSlider");
  const divider = $("#divider");
  const generateBtn = $("#generateBtn");
  const simStatus = $("#simStatus");
  const strength = $("#strength");
  const strengthText = $("#strengthText");

  function setStatus(text) {
    if (simStatus) simStatus.textContent = text;
  }

  function handleFile(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Elegí una imagen válida");
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.width < 10 || img.height < 10) {
        setStatus("No pudimos leer esa imagen");
        return;
      }
      startWithImage(img);
    };
    img.onerror = () => setStatus("No pudimos abrir esa imagen");
    img.src = URL.createObjectURL(file);
  }

  fileInput?.addEventListener("change", () => handleFile(fileInput));
  fileInput2?.addEventListener("change", () => handleFile(fileInput2));

  compareSlider?.addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if (afterCanvas) afterCanvas.style.clipPath = `inset(0 0 0 ${v}%)`;
    if (divider) divider.style.left = `${v}%`;
  });

  $$("#zoneList button").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#zoneList button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.zone = btn.dataset.zone || "lips";
      if (state.img) renderProposal();
    });
  });

  strength?.addEventListener("input", () => {
    state.strength = Number(strength.value) || 1;
    if (strengthText) {
      strengthText.textContent =
        state.strength === 1 ? "Sutil" :
        state.strength === 2 ? "Medio" : "Marcado";
    }
    if (state.img) renderProposal();
  });

  async function startWithImage(img) {
    state.img = img;
    state.landmarks = null;
    simEmpty?.classList.add("hidden");
    simWorkspace?.classList.remove("hidden");
    fitCanvases(img);
    drawBase();
    setStatus("Foto lista · analizando rostro…");
    try {
      await detectFace();
    } catch (_) {
      setStatus("Foto lista");
    }
  }

  function fitCanvases(img) {
    if (!beforeCanvas || !afterCanvas) return;
    const max = 1100;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    [beforeCanvas, afterCanvas].forEach((c) => {
      c.width = w;
      c.height = h;
    });
    if (compare) compare.style.aspectRatio = `${img.width}/${img.height}`;
  }

  function drawBase() {
    if (!state.img) return;
    [beforeCanvas, afterCanvas].forEach((c) => {
      if (!c) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(state.img, 0, 0, c.width, c.height);
    });
  }

  async function loadMediaPipe() {
    if (state.landmarker) return state.landmarker;
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
      const vision = await mod.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );
      state.landmarker = await mod.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      });
      return state.landmarker;
    } catch (err) {
      console.warn("MediaPipe unavailable", err);
      return null;
    }
  }

  async function detectFace() {
    const lm = await loadMediaPipe();
    if (!lm || !state.img) {
      setStatus("Foto lista · modo visual");
      return null;
    }
    try {
      const res = lm.detect(state.img);
      state.landmarks = res.faceLandmarks?.[0] || null;
      setStatus(state.landmarks ? "Rostro detectado ✓" : "Foto lista · modo visual");
      return state.landmarks;
    } catch (err) {
      console.warn(err);
      setStatus("Foto lista · modo visual");
      return null;
    }
  }

  generateBtn?.addEventListener("click", async () => {
    if (!state.img) {
      setStatus("Primero subí una selfie");
      return;
    }
    generateBtn.disabled = true;
    setStatus("Generando previsualización…");
    if (!state.landmarks) await detectFace();
    renderProposal();
    setStatus("Previsualización lista");
    generateBtn.disabled = false;
  });

  function renderProposal() {
    if (!state.img || !afterCanvas) return;
    const ctx = afterCanvas.getContext("2d");
    ctx.clearRect(0, 0, afterCanvas.width, afterCanvas.height);
    ctx.drawImage(state.img, 0, 0, afterCanvas.width, afterCanvas.height);

    const level = state.strength || 1;
    const lm = state.landmarks;

    if (!lm) {
      softSkin(ctx, afterCanvas, 0.02 * level);
      return;
    }

    const pt = (i) => ({
      x: lm[i].x * afterCanvas.width,
      y: lm[i].y * afterCanvas.height
    });

    const faceWidth = Math.max(40, Math.abs(pt(454).x - pt(234).x));
    const leftCheek = pt(123);
    const rightCheek = pt(352);
    const chin = pt(152);
    const lipL = pt(61), lipR = pt(291);
    const lipTop = pt(13), lipBottom = pt(14);

    switch (state.zone) {
      case "lips": {
        const lipWidth = Math.abs(lipR.x - lipL.x);
        localPatchScale(
          ctx, afterCanvas,
          (lipL.x + lipR.x) / 2,
          (lipTop.y + lipBottom.y) / 2,
          Math.max(30, lipWidth * 1.15),
          Math.max(18, Math.abs(lipBottom.y - lipTop.y) * 2.4),
          1 + 0.018 * level,
          1 + 0.045 * level
        );
        break;
      }
      case "cheeks":
        brightenEllipse(ctx, leftCheek.x, leftCheek.y, faceWidth * .11, faceWidth * .08, .025 * level);
        brightenEllipse(ctx, rightCheek.x, rightCheek.y, faceWidth * .11, faceWidth * .08, .025 * level);
        break;
      case "chin":
        brightenEllipse(ctx, chin.x, chin.y - faceWidth * .03, faceWidth * .08, faceWidth * .07, .02 * level);
        break;
      case "jaw":
        subtleJawContour(ctx, pt(172), pt(397), chin, faceWidth, level);
        break;
      case "undereye":
        brightenEllipse(ctx, pt(145).x, pt(145).y, faceWidth * .075, faceWidth * .035, .035 * level);
        brightenEllipse(ctx, pt(374).x, pt(374).y, faceWidth * .075, faceWidth * .035, .035 * level);
        break;
      case "skin":
        softSkin(ctx, afterCanvas, 0.025 * level);
        break;
      default:
        softSkin(ctx, afterCanvas, 0.02 * level);
    }
  }

  function softSkin(ctx, c, a) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a;
    ctx.fillStyle = "#f3d8c8";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }

  function brightenEllipse(ctx, x, y, rx, ry, a) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(255,244,232,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function localPatchScale(ctx, c, cx, cy, w, h, sx, sy) {
    const x = Math.max(0, cx - w / 2), y = Math.max(0, cy - h / 2);
    const sw = Math.min(w, c.width - x), sh = Math.min(h, c.height - y);
    if (sw <= 2 || sh <= 2) return;
    const temp = document.createElement("canvas");
    temp.width = sw; temp.height = sh;
    temp.getContext("2d").drawImage(c, x, y, sw, sh, 0, 0, sw, sh);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * .55, h * .60, 0, 0, Math.PI * 2);
    ctx.clip();
    const dw = sw * sx, dh = sh * sy;
    ctx.drawImage(temp, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  function subtleJawContour(ctx, left, right, chin, fw, level) {
    ctx.save();
    ctx.strokeStyle = `rgba(90,70,58,${0.035 * level})`;
    ctx.lineWidth = Math.max(1, fw * .008);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.quadraticCurveTo(chin.x, chin.y, right.x, right.y);
    ctx.stroke();
    ctx.restore();
  }
})();
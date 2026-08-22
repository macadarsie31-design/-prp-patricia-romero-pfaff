(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    img: null,
    originalFile: null,
    generated: false,
    resultImage: null,
    fullFace: true,
    strength: 2,
    overrides: {
      lips: "neutral",
      cheeks: "neutral",
      chin: "neutral",
      jaw: "neutral",
      undereye: "neutral",
      botox: "neutral"
    },
    proposal: ""
  };

  const labels = {
    lips: "Labios",
    cheeks: "Pómulos",
    chin: "Mentón",
    jaw: "Mandíbula",
    undereye: "Ojeras",
    botox: "Botox"
  };
  const strengthLabels = {1:"Natural", 2:"Balanceado", 3:"Definido"};

  const choose = $("#fileInput");
  const change = $("#fileInput2");

  [choose, change].filter(Boolean).forEach(input => {
    input.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Elegí una imagen.");
        return;
      }
      state.originalFile = file;
      const img = new Image();
      img.onload = () => startWithImage(img);
      img.src = URL.createObjectURL(file);
    });
  });

  setupTreatmentControls();
  setupStrength();
  setupCompare();
  ensureDownloadButton();

  function setupTreatmentControls() {
    const zoneList = $("#zoneList");
    if (!zoneList) return;

    // "Piel" is not part of the facial harmonization plan.
    zoneList.querySelectorAll('button[data-zone="skin"]').forEach(b => b.remove());

    const full = document.createElement("button");
    full.type = "button";
    full.id = "fullFaceBtn";
    full.className = "active";
    full.textContent = "Full Face Armónico";
    full.style.fontWeight = "700";
    zoneList.prepend(full);

    // Add Botox if it is not already in the HTML.
    if (!zoneList.querySelector('button[data-zone="botox"]')) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.zone = "botox";
      b.textContent = "Botox";
      zoneList.appendChild(b);
    }

    full.addEventListener("click", () => {
      state.fullFace = !state.fullFace;
      full.classList.toggle("active", state.fullFace);
      if (state.fullFace) full.textContent = "Full Face Armónico ✓";
      else full.textContent = "Full Face Armónico";
      updatePlanText();
    });

    full.textContent = "Full Face Armónico ✓";

    zoneList.querySelectorAll("button[data-zone]").forEach(btn => {
      const zone = btn.dataset.zone;
      if (!(zone in state.overrides)) return;

      btn.dataset.choice = "neutral";
      btn.textContent = labels[zone];

      btn.addEventListener("click", () => {
        const now = btn.dataset.choice || "neutral";
        const next = now === "neutral" ? "add" : now === "add" ? "remove" : "neutral";
        btn.dataset.choice = next;
        state.overrides[zone] = next;

        btn.classList.toggle("active", next === "add");
        btn.classList.toggle("remove-choice", next === "remove");

        btn.textContent =
          next === "add" ? `${labels[zone]} +` :
          next === "remove" ? `${labels[zone]} −` :
          labels[zone];

        updatePlanText();
      });
    });

    const css = document.createElement("style");
    css.textContent = `
      #zoneList button.remove-choice{
        border-color:#8b5d55!important;
        color:#8b5d55!important;
        background:#fff8f6!important;
      }
      .prp-ai-plan{
        margin:10px 0 4px;
        color:#6f685f;
        font-size:14px;
        line-height:1.4;
      }
      .prp-ai-error{
        margin:10px 0 0;
        padding:10px 12px;
        border-radius:12px;
        background:#fff0ef;
        color:#8e2d27;
        font-size:14px;
      }
      .prp-ai-error.hidden{display:none}
      #generateBtn[disabled]{opacity:.6;cursor:wait}
    `;
    document.head.appendChild(css);

    if (!$("#aiPlanText")) {
      const p = document.createElement("div");
      p.id = "aiPlanText";
      p.className = "prp-ai-plan";
      zoneList.insertAdjacentElement("afterend", p);
    }
    if (!$("#aiError")) {
      const e = document.createElement("div");
      e.id = "aiError";
      e.className = "prp-ai-error hidden";
      $("#aiPlanText").insertAdjacentElement("afterend", e);
    }
    updatePlanText();
  }

  function updatePlanText() {
    const add = Object.entries(state.overrides).filter(([,v]) => v === "add").map(([k]) => labels[k]);
    const remove = Object.entries(state.overrides).filter(([,v]) => v === "remove").map(([k]) => labels[k]);
    const parts = [];
    if (state.fullFace) parts.push("La IA armoniza el rostro completo según sus proporciones visibles");
    else parts.push("Simulación personalizada por zonas");
    if (add.length) parts.push(`priorizar: ${add.join(", ")}`);
    if (remove.length) parts.push(`no modificar: ${remove.join(", ")}`);
    $("#aiPlanText").textContent = parts.join(" · ") + ".";
  }

  function setupStrength() {
    const strength = $("#strength");
    const strengthText = $("#strengthText");
    if (!strength) return;
    // Keep the existing 1–3 range, but rename the levels.
    state.strength = Number(strength.value || 2);
    if (strengthText) strengthText.textContent = strengthLabels[state.strength] || "Balanceado";
    strength.addEventListener("input", () => {
      state.strength = Math.max(1, Math.min(3, Number(strength.value || 2)));
      if (strengthText) strengthText.textContent = strengthLabels[state.strength];
    });
  }

  function setupCompare() {
    const slider = $("#compareSlider");
    if (!slider) return;
    slider.addEventListener("input", e => {
      const v = Number(e.target.value);
      const after = $("#afterCanvas");
      const divider = $("#divider");
      if (after) after.style.clipPath = `inset(0 0 0 ${v}%)`;
      if (divider) divider.style.left = `${v}%`;
    });
  }

  function startWithImage(img) {
    state.img = img;
    state.generated = false;
    state.resultImage = null;
    $("#simEmpty")?.classList.add("hidden");
    $("#simWorkspace")?.classList.remove("hidden");
    fitCanvases(img);
    drawOriginalBoth();
    $("#downloadGateBtn")?.classList.add("hidden");
    if ($("#simStatus")) $("#simStatus").textContent = "Foto lista · elegí tu plan y generá";
  }

  function fitCanvases(img) {
    const max = 1100;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    [$("#beforeCanvas"), $("#afterCanvas")].filter(Boolean).forEach(c => {
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
    });
    if ($("#compare")) $("#compare").style.aspectRatio = `${img.width}/${img.height}`;
  }

  function drawOriginalBoth() {
    if (!state.img) return;
    [$("#beforeCanvas"), $("#afterCanvas")].filter(Boolean).forEach(c => {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(state.img, 0, 0, c.width, c.height);
    });
  }

  $("#generateBtn")?.addEventListener("click", async () => {
    if (!state.img) return;
    const btn = $("#generateBtn");
    const err = $("#aiError");
    err?.classList.add("hidden");
    if (err) err.textContent = "";

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "Generando con IA…";
    if ($("#simStatus")) $("#simStatus").textContent = "Analizando proporciones y generando simulación…";

    try {
      const blob = await makeReferenceBlob(state.img);
      const form = new FormData();
      form.append("image", blob, "selfie.jpg");
      form.append("fullFace", state.fullFace ? "1" : "0");
      form.append("strength", String(state.strength));
      form.append("overrides", JSON.stringify(state.overrides));

      const response = await fetch("/api/simulate", { method:"POST", body:form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok || !data.image) {
        throw new Error(data.error || "No se pudo generar la simulación.");
      }

      await drawAIResult(data.image);
      state.generated = true;
      state.resultImage = data.image;
      state.proposal = data.plan || buildPlanLabel();

      ensureDownloadButton();
      $("#downloadGateBtn")?.classList.remove("hidden");
      if ($("#simStatus")) $("#simStatus").textContent = "Simulación IA lista";
    } catch (e) {
      console.error(e);
      if (err) {
        err.textContent = e.message || "Hubo un problema generando la simulación.";
        err.classList.remove("hidden");
      }
      if ($("#simStatus")) $("#simStatus").textContent = "No se pudo generar";
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel || "Generar previsualización";
    }
  });

  async function makeReferenceBlob(img) {
    const maxSide = 500; // Cloudflare FLUX.2 reference images must be <512x512.
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      c.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo preparar la foto.")), "image/jpeg", .92);
    });
  }

  function drawAIResult(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = $("#afterCanvas");
        if (!c) return reject(new Error("No se encontró el canvas de resultado."));
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
        // "cover" crop into the exact original canvas to preserve the comparison layout.
        const s = Math.max(c.width / img.width, c.height / img.height);
        const sw = c.width / s, sh = c.height / s;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        c.dataset.previewReady = "true";
        resolve();
      };
      img.onerror = () => reject(new Error("Cloudflare devolvió una imagen inválida."));
      img.src = src;
    });
  }

  function buildPlanLabel() {
    const add = Object.entries(state.overrides).filter(([,v]) => v === "add").map(([k]) => labels[k]);
    const remove = Object.entries(state.overrides).filter(([,v]) => v === "remove").map(([k]) => labels[k]);
    let s = state.fullFace ? "Full Face Armónico" : "Plan personalizado";
    if (add.length) s += ` + ${add.join(", ")}`;
    if (remove.length) s += ` · excluir ${remove.join(", ")}`;
    s += ` · ${strengthLabels[state.strength]}`;
    return s;
  }

  // ----- Lead gate / download -----
  function ensureDownloadButton(){
    if ($("#downloadGateBtn")) return;
    const actions = $(".sim-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.id = "downloadGateBtn";
    btn.type = "button";
    btn.className = "btn btn-dark hidden";
    btn.textContent = "Descargar resultado";
    btn.addEventListener("click", openLeadModal);
    actions.appendChild(btn);
  }

  function openLeadModal(){
    if(!state.generated) return;
    ensureLeadModal();
    $("#leadModalDynamic").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLeadModal(){
    $("#leadModalDynamic")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function ensureLeadModal(){
    if ($("#leadModalDynamic")) return;
    const wrap = document.createElement("div");
    wrap.id = "leadModalDynamic";
    wrap.className = "hidden";
    wrap.innerHTML = `
      <div class="prp-modal-backdrop"></div>
      <div class="prp-modal-card" role="dialog" aria-modal="true" aria-labelledby="prpModalTitle">
        <button type="button" class="prp-modal-x" aria-label="Cerrar">×</button>
        <span class="kicker">TU RESULTADO</span>
        <h3 id="prpModalTitle">Completá tus datos para descargar</h3>
        <p class="prp-modal-copy">La simulación es orientativa y no reemplaza la valoración profesional. La selfie no se guarda en la base de datos.</p>
        <form id="leadFormDynamic">
          <label>Nombre y apellido<input id="leadNameDynamic" autocomplete="name" required></label>
          <label>Email<input id="leadEmailDynamic" type="email" autocomplete="email" required></label>
          <label>Teléfono / WhatsApp<input id="leadPhoneDynamic" type="tel" autocomplete="tel" required></label>
          <input id="websiteDynamic" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
          <label class="prp-check"><input id="leadConsentDynamic" type="checkbox" required> <span>Acepto que PRP guarde estos datos para contactarme sobre mi consulta.</span></label>
          <div id="leadErrorDynamic" class="prp-error hidden"></div>
          <button id="leadSubmitDynamic" class="btn btn-dark" type="submit">Guardar y descargar</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const style=document.createElement("style");
    style.textContent=`
      #leadModalDynamic{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
      #leadModalDynamic.hidden{display:none}
      .prp-modal-backdrop{position:absolute;inset:0;background:rgba(25,24,22,.56);backdrop-filter:blur(5px)}
      .prp-modal-card{position:relative;z-index:1;background:#fbf7f2;border-radius:28px;padding:28px;width:min(92vw,520px);max-height:88vh;overflow:auto;box-shadow:0 28px 80px rgba(0,0,0,.22)}
      .prp-modal-card h3{font-family:"Playfair Display",Georgia,serif;font-size:32px;line-height:1.08;margin:10px 0}
      .prp-modal-copy{color:#716a62;line-height:1.45;margin:0 0 18px}
      .prp-modal-x{position:absolute;right:18px;top:14px;border:0;background:transparent;font-size:30px;cursor:pointer}
      #leadFormDynamic{display:grid;gap:13px}
      #leadFormDynamic label{display:grid;gap:6px;font-weight:600}
      #leadFormDynamic input[type=email],#leadFormDynamic input[type=tel],#leadFormDynamic label>input:not([type]){width:100%;box-sizing:border-box;border:1px solid #cfc7bd;border-radius:14px;padding:14px 15px;background:white;font:inherit}
      .prp-check{grid-template-columns:22px 1fr!important;align-items:start;font-weight:400!important;line-height:1.35}
      .prp-error{background:#fff0ef;color:#9d2f26;border-radius:12px;padding:11px 12px}
      .prp-error.hidden{display:none}
    `;
    document.head.appendChild(style);

    wrap.querySelector(".prp-modal-backdrop").addEventListener("click",closeLeadModal);
    wrap.querySelector(".prp-modal-x").addEventListener("click",closeLeadModal);
    $("#leadFormDynamic").addEventListener("submit", saveLeadAndDownload);
  }

  async function saveLeadAndDownload(e){
    e.preventDefault();
    const btn=$("#leadSubmitDynamic");
    const errorBox=$("#leadErrorDynamic");
    btn.disabled=true;btn.textContent="Guardando…";
    errorBox.classList.add("hidden");errorBox.textContent="";

    const payload={
      name:$("#leadNameDynamic").value.trim(),
      email:$("#leadEmailDynamic").value.trim(),
      phone:$("#leadPhoneDynamic").value.trim(),
      consent:$("#leadConsentDynamic").checked,
      website:$("#websiteDynamic").value || "",
      proposal:state.proposal || buildPlanLabel()
    };

    try{
      const r=await fetch("/api/lead",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok || !data.ok) throw new Error(data.error || "No pudimos guardar tus datos.");
      downloadResult();
      closeLeadModal();
    }catch(err){
      errorBox.textContent=err.message || "Hubo un problema. Intentá nuevamente.";
      errorBox.classList.remove("hidden");
    }finally{
      btn.disabled=false;btn.textContent="Guardar y descargar";
    }
  }

  function buildResultCanvas(){
    const b=$("#beforeCanvas"),a=$("#afterCanvas");
    const pad=26,head=95,footer=78;
    const w=b.width*2+pad*3,h=Math.max(b.height,a.height)+head+footer+pad*2;
    const out=document.createElement("canvas");
    out.width=w;out.height=h;
    const ctx=out.getContext("2d");
    ctx.fillStyle="#f7f2ec";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(26,w*.025)}px Georgia`;
    ctx.fillText("PRP · Simulación de armonización facial",pad,55);
    ctx.font=`${Math.max(16,w*.014)}px Arial`;ctx.fillStyle="#716a62";
    ctx.fillText("Dra. Patricia Romero Pfaff · Córdoba, Argentina",pad,82);
    ctx.drawImage(b,pad,head+pad,b.width,b.height);
    ctx.drawImage(a,pad*2+b.width,head+pad,a.width,a.height);
    ctx.fillStyle="#171715";ctx.font=`600 ${Math.max(18,w*.016)}px Arial`;
    ctx.fillText("ANTES",pad,head+15);
    ctx.fillText("SIMULACIÓN IA",pad*2+b.width,head+15);
    ctx.fillStyle="#716a62";ctx.font=`${Math.max(14,w*.012)}px Arial`;
    ctx.fillText(`${state.proposal || "Full Face Armónico"} · Simulación orientativa; no garantiza resultados.`,pad,h-28);
    return out;
  }

  function downloadResult(){
    const c=buildResultCanvas();
    const a=document.createElement("a");
    a.href=c.toDataURL("image/jpeg",.92);
    a.download="PRP-simulacion-armonizacion-facial.jpg";
    document.body.appendChild(a);a.click();a.remove();
  }
})();
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  root.dataset.braceRuntime = "v8";
  const filmAct = document.querySelector(".film-act");
  const filmStage = document.querySelector(".film-stage");
  const filmFrost = document.querySelector("[data-film-frost]");
  const filmCopies = [document.querySelector(".film-copy--first"), document.querySelector(".film-copy--second")];
  const filmPlates = [document.querySelector('[data-film-plate="first"]'), document.querySelector('[data-film-plate="second"]')];
  if (window.ScrollCraft) window.ScrollCraft.mount(document.body);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let frostTicking = false;
  const syncFilmPlates = () => {
    const stageRect = filmStage?.getBoundingClientRect();
    if (!stageRect) return;
    filmCopies.forEach((copy, index) => {
      const plate = filmPlates[index];
      if (!copy || !plate) return;
      const rect = copy.getBoundingClientRect();
      plate.style.left = `${(rect.left - stageRect.left).toFixed(2)}px`;
      plate.style.top = `${(rect.top - stageRect.top).toFixed(2)}px`;
      plate.style.width = `${rect.width.toFixed(2)}px`;
      plate.style.height = `${rect.height.toFixed(2)}px`;
      plate.style.opacity = getComputedStyle(copy).opacity;
    });
  };
  const updateFrost = () => {
    const progress = clamp(Number.parseFloat(filmAct?.style.getPropertyValue("--sc-p")) || 0, 0, 1);
    const opacity = reduce ? 0.2 : 0.88 - progress * 0.62;
    const lensSize = reduce ? 0 : 150 + progress * 430;
    root.style.setProperty("--frost-opacity", opacity.toFixed(3));
    root.style.setProperty("--lens-size", `${Math.round(lensSize)}px`);
    filmStage?.setAttribute("data-sc-verify-state", `frost:${Math.round(opacity * 100)}:lens:${Math.round(lensSize)}`);
    requestAnimationFrame(syncFilmPlates);
    frostTicking = false;
  };
  addEventListener("scroll", () => { if (!frostTicking) { frostTicking = true; requestAnimationFrame(updateFrost); } }, {passive: true});
  addEventListener("resize", updateFrost, {passive: true});
  updateFrost();
  requestAnimationFrame(() => requestAnimationFrame(syncFilmPlates));
  if (fine && !reduce && filmStage && filmFrost) {
    filmStage.addEventListener("pointermove", (event) => {
      const rect = filmStage.getBoundingClientRect();
      root.style.setProperty("--lens-x", `${clamp(event.clientX - rect.left, 0, rect.width).toFixed(1)}px`);
      root.style.setProperty("--lens-y", `${clamp(event.clientY - rect.top, 0, rect.height).toFixed(1)}px`);
    }, {passive: true});
    filmStage.addEventListener("pointerleave", () => {
      root.style.setProperty("--lens-x", "50%");
      root.style.setProperty("--lens-y", "45%");
    });
  }
  const canvas = document.querySelector("[data-rain-field]");
  const context = canvas?.getContext("2d");
  const drops = Array.from({length: innerWidth < 700 ? 18 : 30}, (_, index) => ({
    x: ((index * 73) % 97) / 97, y: ((index * 47) % 101) / 101,
    speed: 0.00012 + (index % 7) * 0.000018, length: 18 + (index % 8) * 5, alpha: 0.08 + (index % 5) * 0.025,
  }));
  let rainWidth = 0, rainHeight = 0, rainFrame = 0;
  const resizeRain = () => {
    if (!canvas || !context) return;
    const density = Math.min(devicePixelRatio || 1, 1.5);
    rainWidth = innerWidth; rainHeight = innerHeight;
    canvas.width = Math.round(rainWidth * density); canvas.height = Math.round(rainHeight * density);
    canvas.style.width = `${rainWidth}px`; canvas.style.height = `${rainHeight}px`;
    context.setTransform(density, 0, 0, density, 0, 0);
  };
  const paintRain = (time = 0) => {
    if (!canvas || !context) return;
    context.clearRect(0, 0, rainWidth, rainHeight);
    drops.forEach((drop, index) => {
      const travel = reduce ? drop.y : (drop.y + time * drop.speed) % 1.2 - 0.1;
      const x = drop.x * rainWidth, y = travel * rainHeight;
      const gradient = context.createLinearGradient(x, y, x - 3, y + drop.length);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.65, `rgba(255,255,255,${drop.alpha})`);
      gradient.addColorStop(1, "rgba(217,239,255,0)");
      context.strokeStyle = gradient; context.lineWidth = index % 9 === 0 ? 1.6 : 0.8;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - 3, y + drop.length); context.stroke();
    });
    if (!reduce) rainFrame = requestAnimationFrame(paintRain);
  };
  resizeRain(); paintRain();
  addEventListener("resize", resizeRain, {passive: true});
  addEventListener("pagehide", () => cancelAnimationFrame(rainFrame), {once: true});
  const proofAct = document.querySelector(".product-act");
  const proofFrames = Array.from(document.querySelectorAll("[data-proof]"));
  const proofPosition = document.querySelector("#proof-position");
  let activeProof = 0;
  const goToProof = (index) => {
    if (!proofAct || !proofFrames.length) return;
    activeProof = (index + proofFrames.length) % proofFrames.length;
    const ratio = (activeProof + 1) / (proofFrames.length + 1);
    const travel = Math.max(1, proofAct.offsetHeight - innerHeight);
    scrollTo({top: proofAct.offsetTop + travel * ratio, behavior: reduce ? "auto" : "smooth"});
    proofPosition.textContent = proofFrames[activeProof].dataset.proofTitle;
  };
  document.querySelector("[data-proof-prev]")?.addEventListener("click", () => goToProof(activeProof - 1));
  document.querySelector("[data-proof-next]")?.addEventListener("click", () => goToProof(activeProof + 1));
  let galleryTicking = false;
  const updateGallery = () => {
    const progress = clamp(Number.parseFloat(proofAct?.style.getPropertyValue("--sc-p")) || 0, 0, 1);
    const index = clamp(Math.round(progress * (proofFrames.length + 1) - 1), 0, proofFrames.length - 1);
    if (proofFrames[index] && index !== activeProof) { activeProof = index; proofPosition.textContent = proofFrames[index].dataset.proofTitle; }
    galleryTicking = false;
  };
  addEventListener("scroll", () => { if (!galleryTicking) { galleryTicking = true; requestAnimationFrame(updateGallery); } }, {passive: true});
  const dialog = document.querySelector("#proof-dialog");
  const dialogImage = document.querySelector("#proof-dialog-image");
  const dialogTitle = document.querySelector("#proof-dialog-title");
  let returnFocus = null;
  const renderDialog = () => {
    const frame = proofFrames[activeProof];
    if (!frame || !dialogImage || !dialogTitle) return;
    dialogImage.src = frame.dataset.proofImage;
    dialogImage.alt = frame.querySelector("img")?.alt || "Expanded BRACE product screenshot";
    dialogTitle.textContent = frame.dataset.proofTitle;
  };
  proofFrames.forEach((frame, index) => frame.querySelector("[data-proof-expand]")?.addEventListener("click", (event) => {
    activeProof = index; returnFocus = event.currentTarget; renderDialog(); dialog?.showModal();
  }));
  const closeDialog = () => { if (dialog?.open) { dialog.close(); returnFocus?.focus(); } };
  dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => { activeProof = (activeProof - 1 + proofFrames.length) % proofFrames.length; renderDialog(); });
  document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => { activeProof = (activeProof + 1) % proofFrames.length; renderDialog(); });
  const platform = /Windows/i.test(navigator.userAgent) ? "windows" : /Linux/i.test(navigator.userAgent) ? "linux" : "";
  if (platform) document.querySelector(`[data-platform-card="${platform}"]`)?.classList.add("is-device");
})();

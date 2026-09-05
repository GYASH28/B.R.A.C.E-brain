(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  let openingTimeline = null;

  const opening = document.querySelector("[data-opening]");
  const status = document.querySelector("[data-opening-status]");
  const mainSurfaces = [document.querySelector(".site-bar"), document.querySelector("main"), document.querySelector("footer")].filter(Boolean);

  const finishOpening = () => {
    openingTimeline?.pause?.();
    if (opening) opening.hidden = true;
    body.classList.remove("is-opening");
    mainSurfaces.forEach((surface) => surface.removeAttribute("inert"));
    root.dataset.braceRuntime = "ready";
  };

  const playOpening = () => {
    if (!opening || reduce || typeof window.anime !== "function") {
      finishOpening();
      return;
    }
    opening.hidden = false;
    body.classList.add("is-opening");
    mainSurfaces.forEach((surface) => surface.setAttribute("inert", ""));
    if (status) status.textContent = "Recovering context";
    window.anime.set(".opening,.opening-core", {opacity: 1, scale: 1});
    window.anime.set(".opening-orbit", {opacity: 0});
    window.anime.set(".opening-signal i", {opacity: 0, scale: 0});
    window.anime.set(".opening-fragment,.opening-wordmark span,.opening-mark img", {opacity: 0});
    window.anime.set(".opening-meter i", {scaleX: 0});
    openingTimeline = window.anime.timeline({easing: "easeOutExpo"})
      .add({targets: ".opening-signal i", opacity: [0, .9], scale: [0, 1], delay: window.anime.stagger(45, {from: "center"}), duration: 500})
      .add({targets: ".opening-orbit--one", rotate: [0, 34], scale: [.72, 1], opacity: [0, 1], duration: 900}, "-=480")
      .add({targets: ".opening-orbit--two", rotate: [20, -24], scale: [.55, 1], opacity: [0, 1], duration: 850}, "-=850")
      .add({targets: ".opening-fragment", translateX: (_, index) => [-90, 90, -82, 82][index], translateY: (_, index) => [-82, -78, 82, 78][index], rotate: (_, index) => [-80, 110, 95, -115][index], opacity: [0, .9], scale: [.55, 1], delay: window.anime.stagger(55), duration: 650}, "-=610")
      .add({targets: ".opening-fragment", translateX: 0, translateY: 0, rotate: 0, scale: [.9, .12], opacity: [.9, 0], delay: window.anime.stagger(35, {from: "center"}), duration: 520})
      .add({targets: ".opening-mark img", opacity: [0, 1], scale: [.72, 1], rotate: [-10, 0], duration: 620}, "-=430")
      .add({targets: ".opening-wordmark span", opacity: [0, 1], translateY: [24, 0], rotateX: [-80, 0], delay: window.anime.stagger(58), duration: 580}, "-=400")
      .add({targets: ".opening-meter i", scaleX: [0, 1], easing: "easeInOutQuart", duration: 680, begin: () => { if (status) status.textContent = "Source attached · memory ready"; }}, "-=420")
      .add({targets: ".opening-core", scale: [1, 1.04], opacity: [1, 0], duration: 420, easing: "easeInQuart"}, "+=140")
      .add({targets: ".opening", opacity: [1, 0], duration: 520, easing: "easeInOutQuad", complete: finishOpening}, "-=360");
  };

  document.querySelector("[data-opening-skip]")?.addEventListener("click", finishOpening);
  document.querySelector("[data-replay-opening]")?.addEventListener("click", () => {
    if (opening) opening.style.opacity = "1";
    playOpening();
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !opening?.hidden) finishOpening();
  });
  playOpening();

  const filmAct = document.querySelector(".film-act");
  const filmStage = document.querySelector(".film-stage");
  const filmVideo = document.querySelector("[data-sc-scrub]");
  const productAct = document.querySelector(".product-act");
  const productRail = document.querySelector(".product-rail");
  let videoReady = false;

  if (filmVideo && !reduce && !navigator.connection?.saveData) {
    let videoRequested = false;
    const requestFilm = () => {
      if (videoRequested) return;
      videoRequested = true;
      const mobile = matchMedia("(max-width: 700px)").matches;
      filmVideo.src = mobile ? filmVideo.dataset.scSrcMobile : filmVideo.dataset.scSrc;
      filmVideo.load();
      filmVideo.addEventListener("loadedmetadata", () => { videoReady = true; }, { once: true });
    };
    addEventListener("scroll", requestFilm, { once: true, passive: true });
    addEventListener("pointerdown", requestFilm, { once: true, passive: true });
    const scheduleFilm = () => setTimeout(requestFilm, 1_800);
    if ("requestIdleCallback" in window) window.requestIdleCallback(scheduleFilm, { timeout: 2_500 });
    else setTimeout(scheduleFilm, 1_500);
  }

  let scrollTick = false;
  const syncScroll = () => {
    const scrollTop = scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty("--page-progress", String(clamp(scrollTop / maxScroll)));

    if (filmAct && filmStage) {
      const start = filmAct.offsetTop;
      const range = Math.max(1, filmAct.offsetHeight - innerHeight);
      const progress = clamp((scrollTop - start) / range);
      filmStage.style.setProperty("--hero-p", progress.toFixed(3));
      filmStage.style.setProperty("--video-opacity", progress > .08 ? String(clamp((progress - .08) * 2.8)) : "0");
      filmStage.dataset.scVerifyState = `hero:${Math.round(progress * 10)}`;
      if (videoReady && Number.isFinite(filmVideo.duration)) filmVideo.currentTime = filmVideo.duration * progress;
    }

    if (productAct && productRail && !reduce) {
      const start = productAct.offsetTop;
      const range = Math.max(1, productAct.offsetHeight - innerHeight);
      const progress = clamp((scrollTop - start) / range);
      const overflow = Math.max(0, productRail.scrollWidth - innerWidth);
      productRail.style.transform = `translate3d(${-overflow * progress}px,0,0)`;
      productAct.style.setProperty("--rail-p", progress.toFixed(3));
      const frames = Array.from(document.querySelectorAll("[data-proof]"));
      if (frames.length) {
        const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
        setActiveProof(index, false);
      }
    }
    scrollTick = false;
  };
  const requestScrollSync = () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(syncScroll);
  };
  addEventListener("scroll", requestScrollSync, {passive: true});
  addEventListener("resize", requestScrollSync, {passive: true});

  const revealTargets = Array.from(document.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) revealTargets.forEach((item) => item.classList.add("is-visible"));
  else {
    const observer = new IntersectionObserver((entries, current) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      current.unobserve(entry.target);
    }), {rootMargin: "0px 0px -9%", threshold: .08});
    revealTargets.forEach((item) => observer.observe(item));
  }

  const relay = document.querySelector("[data-memory-relay]");
  const relayInput = document.querySelector("[data-relay-input]");
  const relayNodes = Array.from(document.querySelectorAll("[data-relay-step]"));
  const relayOutput = document.querySelector("[data-relay-output]");
  const relayPosition = document.querySelector("[data-relay-position]");
  const relayStates = [
    {position: "Source", message: "Your source remains the canonical record."},
    {position: "BRACE", message: "A local memory keeps the outcome and its provenance together."},
    {position: "AI handoff", message: "Only the context you choose crosses into a compatible AI client."},
  ];
  const setRelay = (next) => {
    const index = clamp(Number(next), 0, 2);
    relay?.style.setProperty("--relay-progress", String(index / 2));
    if (relay) relay.dataset.scVerifyState = `relay:${index}`;
    if (relayInput) relayInput.value = String(index);
    relayNodes.forEach((node, nodeIndex) => {
      const active = nodeIndex === index;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
    });
    if (relayOutput) relayOutput.textContent = relayStates[index].message;
    if (relayPosition) relayPosition.textContent = relayStates[index].position;
  };
  relayInput?.addEventListener("input", (event) => setRelay(event.currentTarget.value));
  relayNodes.forEach((node) => node.addEventListener("click", () => setRelay(node.dataset.relayStep)));

  const demoStates = [
    {
      id: "capture", kicker: "QUICK CAPTURE", title: "Turn an outcome into durable memory.", status: "READY",
      scene: `<div class="scene-card"><div class="scene-card__bar"><span>NEW DURABLE MEMORY</span><b>⌘ ⇧ M</b></div><div class="scene-card__body"><small>Decision · Northstar</small><strong>Keep imported files canonical.</strong><p>BRACE indexes source material but never rewrites the original project.</p><div class="scene-card__action"><span>Remember with evidence</span><b>→</b></div></div></div>`,
      receipt: [["TYPE","Decision","Durable outcome"],["PROJECT","Northstar","Synthetic workspace"],["EVIDENCE","Architecture Decisions.md","Line 18 · attached"]],
    },
    {
      id: "index", kicker: "PROJECT INDEX", title: "Read one focused folder, safely.", status: "INDEXING",
      scene: `<div class="scene-index"><div><span><strong>Supported source files</strong><b>18 / 18</b></span><i style="--w:100%"></i></div><div><span><strong>Content safety scan</strong><b>Complete</b></span><i style="--w:100%"></i></div><div><span><strong>Evidence relationships</strong><b>12 / 14</b></span><i style="--w:86%"></i></div><div><span><strong>Private local index</strong><b>Ready</b></span><i style="--w:100%"></i></div></div>`,
      receipt: [["ROOT","northstar://project","Private path removed"],["IGNORED","7 items","Dependencies and secrets"],["NETWORK","No request","Local index only"]],
    },
    {
      id: "recall", kicker: "SOURCE-BACKED RECALL", title: "Ask the memory. Inspect the receipt.", status: "12 MS",
      scene: `<div class="scene-search"><div class="scene-search__query">⌕ What did we decide about source files?</div><div class="scene-result"><span>DECISION · 98% SIGNAL</span><strong>Keep imported files canonical.</strong><p>Use read-only indexing. Store memory beside the project, never by rewriting it.</p><small>↳ Architecture Decisions.md · line 18 · Open evidence</small></div></div>`,
      receipt: [["RANKING","Lexical + graph","Honest mode label"],["SOURCE","Architecture Decisions.md","Canonical evidence"],["MEMORY","mem_01H9…","Durable record"]],
    },
    {
      id: "graph", kicker: "KNOWLEDGE MAP", title: "See how the decision connects.", status: "FOCUS MODE",
      scene: `<div class="scene-graph"><svg viewBox="0 0 640 330" aria-hidden="true"><path d="M72 170C160 70 235 100 318 164"/><path d="M72 170C172 265 236 228 318 164"/><path d="M318 164C413 84 493 93 566 106"/><path d="M318 164C414 241 495 224 566 106"/><circle cx="72" cy="170" r="24"/><circle cx="318" cy="164" r="34"/><circle cx="566" cy="106" r="24"/></svg><span>SOURCE</span><span>DECISION</span><span>PROJECT</span></div>`,
      receipt: [["FOCUS","Decision","1 selected node"],["RELATIONS","8 visible","Typed edges"],["ALTERNATIVE","List view","Keyboard readable"]],
    },
    {
      id: "handoff", kicker: "AI HANDOFF", title: "Share selected context, not your whole brain.", status: "READ-ONLY",
      scene: `<div class="scene-handoff"><div><i>01</i><span><strong>Select memory</strong><small>Decision + one source receipt</small></span><b>DONE</b></div><div><i>02</i><span><strong>Preview boundary</strong><small>634 characters · no provider key copied</small></span><b>DONE</b></div><div><i>03</i><span><strong>Hand off to compatible client</strong><small>Read-only MCP permission</small></span><b>READY</b></div></div>`,
      receipt: [["CLIENT","Codex CLI","Detected locally"],["PERMISSION","Recall only","No writes"],["PAYLOAD","634 characters","Previewed first"]],
    },
    {
      id: "automation", kicker: "AUTOMATION TRACE", title: "Repeat the routine. Keep the boundary.", status: "DRY RUN",
      scene: `<div class="scene-trace"><div><i>✓</i><span><strong>Trigger matched</strong><small>Project index completed</small></span><b>2 MS</b></div><div><i>✓</i><span><strong>Permission checked</strong><small>Read timeline · write summary</small></span><b>1 MS</b></div><div><i>→</i><span><strong>Weekly project digest</strong><small>Dry run · no write committed</small></span><b>PREVIEW</b></div></div>`,
      receipt: [["RECIPE","Weekly digest","Bundled example"],["SAFETY","Dry run","No data changed"],["TRACE","3 steps","Fully inspectable"]],
    },
  ];
  const demoShell = document.querySelector("[data-demo-shell]");
  const demoScene = document.querySelector("[data-demo-scene]");
  const demoReceipt = document.querySelector("[data-demo-receipt]");
  const demoTabs = Array.from(document.querySelectorAll("[data-demo-tab]"));
  let demoIndex = 0;
  const renderDemo = (next, focus = false) => {
    demoIndex = (next + demoStates.length) % demoStates.length;
    const state = demoStates[demoIndex];
    demoShell.dataset.demoState = state.id;
    document.querySelector("[data-demo-kicker]").textContent = state.kicker;
    document.querySelector("[data-demo-title]").textContent = state.title;
    document.querySelector("[data-demo-status]").textContent = state.status;
    demoScene.innerHTML = state.scene;
    demoReceipt.innerHTML = state.receipt.map(([label, value, note]) => `<div class="receipt-item"><small>${label}</small><strong>${value}</strong><span>${note}</span></div>`).join("");
    demoTabs.forEach((tab, index) => tab.setAttribute("aria-pressed", String(index === demoIndex)));
    demoShell.style.setProperty("--demo-progress", String(demoIndex + 1));
    if (focus) demoTabs[demoIndex]?.focus();
    if (!reduce && typeof window.anime === "function") {
      window.anime({targets: ".demo-scene>*", opacity: [0, 1], translateY: [18, 0], scale: [.985, 1], duration: 520, easing: "easeOutExpo"});
      window.anime({targets: ".receipt-item", opacity: [0, 1], translateX: [12, 0], delay: window.anime.stagger(45), duration: 430, easing: "easeOutCubic"});
    }
  };
  demoTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => renderDemo(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? demoStates.length - 1 : index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1);
      renderDemo((next + demoStates.length) % demoStates.length, true);
    });
  });
  document.querySelector("[data-demo-prev]")?.addEventListener("click", () => renderDemo(demoIndex - 1));
  document.querySelector("[data-demo-next]")?.addEventListener("click", () => renderDemo(demoIndex + 1));
  renderDemo(0);

  const proofFrames = Array.from(document.querySelectorAll("[data-proof]"));
  const proofPosition = document.querySelector("#proof-position");
  let activeProof = 0;
  function setActiveProof(next, scroll = true) {
    if (!proofFrames.length) return;
    activeProof = (next + proofFrames.length) % proofFrames.length;
    if (proofPosition) proofPosition.textContent = proofFrames[activeProof].dataset.proofTitle;
    if (scroll && productAct) {
      if (reduce) proofFrames[activeProof].scrollIntoView({behavior: "auto", inline: "center", block: "nearest"});
      else {
        const progress = proofFrames.length === 1 ? 0 : (activeProof + .5) / proofFrames.length;
        const target = productAct.offsetTop + progress * Math.max(1, productAct.offsetHeight - innerHeight);
        scrollTo({top: target, behavior: "smooth"});
      }
    }
  }
  document.querySelector("[data-proof-prev]")?.addEventListener("click", () => setActiveProof(activeProof - 1));
  document.querySelector("[data-proof-next]")?.addEventListener("click", () => setActiveProof(activeProof + 1));
  productRail?.addEventListener("focusin", (event) => {
    if (reduce && event.target instanceof HTMLElement) event.target.scrollIntoView({behavior: "auto", block: "nearest", inline: "center"});
  });

  const dialog = document.querySelector("#proof-dialog");
  const dialogImage = document.querySelector("#proof-dialog-image");
  const dialogTitle = document.querySelector("#proof-dialog-title");
  let returnFocus = null;
  const renderDialog = () => {
    const frame = proofFrames[activeProof];
    dialogImage.src = frame.dataset.proofImage;
    dialogImage.alt = frame.querySelector("img")?.alt || "Expanded BRACE product screenshot";
    dialogTitle.textContent = frame.dataset.proofTitle;
  };
  proofFrames.forEach((frame, index) => frame.querySelector("[data-proof-expand]")?.addEventListener("click", (event) => {
    activeProof = index;
    returnFocus = event.currentTarget;
    renderDialog();
    dialog?.showModal();
  }));
  const closeDialog = () => {
    if (!dialog?.open) return;
    dialog.close();
    returnFocus?.focus();
  };
  dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => { activeProof = (activeProof - 1 + proofFrames.length) % proofFrames.length; renderDialog(); });
  document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => { activeProof = (activeProof + 1) % proofFrames.length; renderDialog(); });

  const platform = /Windows/i.test(navigator.userAgent) ? "windows" : /Linux/i.test(navigator.userAgent) ? "linux" : "";
  if (platform) document.querySelector(`[data-platform-card="${platform}"]`)?.classList.add("is-device");

  const canvas = document.querySelector("[data-signal-field]");
  const context = canvas?.getContext("2d");
  if (canvas && context && !reduce) {
    let width = 0, height = 0, frame = 0, pointerX = -1000, pointerY = -1000;
    const points = Array.from({length: innerWidth < 700 ? 24 : 48}, (_, index) => ({x: ((index * 73) % 997) / 997, y: ((index * 193) % 991) / 991, r: 1 + (index % 3), speed: .00002 + (index % 7) * .000004}));
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.4);
      width = innerWidth; height = innerHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    let lastFrameAt = 0;
    const draw = (frameAt = 0) => {
      frame = requestAnimationFrame(draw);
      if (frameAt - lastFrameAt < 32) return;
      lastFrameAt = frameAt;
      context.clearRect(0, 0, width, height);
      points.forEach((point) => {
        point.y = (point.y + point.speed) % 1.05;
        const x = point.x * width, y = point.y * height;
        const proximity = clamp(1 - Math.hypot(x - pointerX, y - pointerY) / 220);
        context.beginPath(); context.arc(x, y, point.r + proximity * 2, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,255,255,${.18 + proximity * .32})`; context.fill();
      });
    };
    size(); draw();
    addEventListener("resize", size, {passive: true});
    if (finePointer) addEventListener("pointermove", (event) => { pointerX = event.clientX; pointerY = event.clientY; }, {passive: true});
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(frame); else draw(); });
  }

  syncScroll();
})();

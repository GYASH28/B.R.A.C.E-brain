(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const compactViewport = window.matchMedia("(max-width: 900px)");
  const phoneViewport = window.matchMedia("(max-width: 760px)");
  const animeEngine = window.anime;
  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const isMotionCalm = () => reduce.matches || document.documentElement.classList.contains("is-calm");

  /* Compact layouts use normal document flow for the three desktop cinematic
     devices that otherwise create sticky/horizontal geometry on small screens.
     This happens before ScrollCraft mounts, so the engine never allocates those
     desktop devices on compact viewports. */
  function configureResponsiveActs() {
    const compact = compactViewport.matches;
    ["#boundary", "#product", "#download"].forEach((selector) => {
      const act = q(selector);
      if (!act) return;
      if (compact) {
        act.dataset.scAct = "flow";
        act.removeAttribute("data-sc-span");
        q("[data-sc-stage]", act)?.removeAttribute("data-sc-stage");
      }
    });
    const productRail = q(".product-rail");
    if (compact) productRail?.removeAttribute("data-sc-pan");
    const opening = q("#opening-act");
    if (compact && opening) opening.dataset.scSpan = phoneViewport.matches ? "1.75" : "2.2";
  }
  configureResponsiveActs();

  /* Opening film --------------------------------------------------------- */
  const openingFilm = q("#opening-film");
  const openingVideo = openingFilm?.querySelector("video");
  let openingClosed = false;

  function closeOpeningFilm({ remember = true } = {}) {
    if (!openingFilm || openingClosed) return;
    openingClosed = true;
    openingFilm.classList.add("is-exiting");
    document.body.classList.remove("has-opening-film");
    openingVideo?.pause();
    if (remember) {
      try { sessionStorage.setItem("brace-opening-seen", "1"); } catch {}
    }
    window.setTimeout(() => openingFilm.remove(), reduce.matches ? 0 : 650);
  }

  let openingSeen = false;
  try { openingSeen = sessionStorage.getItem("brace-opening-seen") === "1"; } catch {}
  if (reduce.matches || openingSeen) closeOpeningFilm({ remember: openingSeen });
  else if (openingVideo) {
    openingVideo.addEventListener("ended", () => closeOpeningFilm(), { once: true });
    openingVideo.addEventListener("error", () => closeOpeningFilm({ remember: false }), { once: true });
    openingVideo.play().catch(() => window.setTimeout(() => closeOpeningFilm({ remember: false }), 1000));
    window.setTimeout(() => closeOpeningFilm(), 6800);
  } else closeOpeningFilm({ remember: false });

  q("[data-skip-opening]")?.addEventListener("click", () => closeOpeningFilm());
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !openingClosed) closeOpeningFilm();
  });

  /* Download links / device hint --------------------------------------- */
  const releaseBase = "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.7.0";
  const downloads = {
    windows: `${releaseBase}/BRACE-Setup-0.7.0.exe`,
    linux: `${releaseBase}/BRACE-0.7.0.AppImage`,
    deb: `${releaseBase}/brace-brain_0.7.0_amd64.deb`,
  };
  qa("[data-download]").forEach((link) => {
    const url = downloads[link.dataset.download];
    if (url) link.href = url;
  });
  const detected = /Windows/i.test(navigator.userAgent)
    ? "windows"
    : /Linux/i.test(navigator.userAgent)
      ? "linux"
      : null;
  if (detected) q(`[data-platform-card="${detected}"]`)?.classList.add("is-recommended");

  /* ScrollCraft mounts after compact act conversion. */
  if (window.ScrollCraft) window.ScrollCraft.mount(q("main"), { lerp: compactViewport.matches ? 0.28 : 0.2 });

  /* Navigation state ---------------------------------------------------- */
  const navigationLinks = qa(".glass-rail nav a");
  const navigationSections = navigationLinks
    .filter((link) => link.hash)
    .map((link) => q(link.hash))
    .filter(Boolean);
  const navigationObserver = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!active) return;
    navigationLinks.forEach((link) => {
      if (link.hash === `#${active.target.id}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-34% 0px -55%", threshold: [0, 0.15, 0.55] });
  navigationSections.forEach((section) => navigationObserver.observe(section));

  /* Scroll-driven spatial state --------------------------------------- */
  const openingAct = q("#opening-act");
  const splitStage = q(".split-stage");
  const downloadAct = q("#download");
  const downloadStage = q(".download-stage");
  const boundaryAct = q("#boundary");
  const boundaryStage = q(".boundary-stage");
  const dividerControl = q("[data-memory-divider]");
  let lensInside = false;
  let lensInfluence = 0;
  let manualSplit = null;
  let spatialFrame = 0;

  function progressOf(element) {
    if (!element) return 0;
    return clamp(Number.parseFloat(getComputedStyle(element).getPropertyValue("--sc-p")) || 0);
  }

  function paintSpatialState() {
    spatialFrame = 0;
    if (splitStage) {
      const openingProgress = progressOf(openingAct);
      const split = phoneViewport.matches
        ? 50
        : manualSplit ?? clamp(50 - openingProgress * 36 + lensInfluence, 11, 57);
      splitStage.style.setProperty("--split", `${split.toFixed(2)}%`);
      splitStage.dataset.scVerifyState = `split:${Math.round(split)}:${lensInside ? "lens" : "idle"}`;
      dividerControl?.setAttribute("aria-valuenow", String(Math.round(split)));
    }

    if (downloadStage) {
      const downloadProgress = progressOf(downloadAct);
      const downloadSplit = compactViewport.matches || reduce.matches ? 0 : clamp(52 - downloadProgress * 52, 0, 52);
      downloadStage.style.setProperty("--download-split", `${downloadSplit.toFixed(2)}%`);
      downloadStage.dataset.scVerifyState = `download:${Math.round(downloadSplit)}`;
    }

    if (boundaryStage) {
      const boundaryProgress = progressOf(boundaryAct);
      boundaryStage.dataset.scVerifyState = compactViewport.matches
        ? "vault:flow"
        : `vault:${boundaryProgress > 0.58 ? "open" : boundaryProgress > 0.12 ? "opening" : "closed"}`;
    }
  }

  function scheduleSpatialState() {
    if (spatialFrame) return;
    spatialFrame = requestAnimationFrame(paintSpatialState);
  }
  addEventListener("scroll", scheduleSpatialState, { passive: true });
  addEventListener("resize", scheduleSpatialState, { passive: true });
  paintSpatialState();

  /* Custom pointer: no permanent animation loop. It wakes on pointer movement
     and sleeps once interpolation settles. */
  const cursor = q(".memory-cursor");
  let pointerX = -80;
  let pointerY = -80;
  let cursorX = -80;
  let cursorY = -80;
  let cursorHalf = 24;
  let cursorFrame = 0;
  let cursorEnabled = false;

  function cursorTick() {
    cursorFrame = 0;
    if (!cursorEnabled || !cursor) return;
    cursorX += (pointerX - cursorX) * 0.22;
    cursorY += (pointerY - cursorY) * 0.22;
    cursor.style.transform = `translate3d(${(cursorX - cursorHalf).toFixed(1)}px,${(cursorY - cursorHalf).toFixed(1)}px,0)`;
    if (Math.abs(pointerX - cursorX) > .3 || Math.abs(pointerY - cursorY) > .3) cursorFrame = requestAnimationFrame(cursorTick);
  }
  function wakeCursor() {
    if (!cursorFrame && cursorEnabled) cursorFrame = requestAnimationFrame(cursorTick);
  }
  function configureCursor() {
    cursorEnabled = Boolean(cursor && finePointer.matches && !reduce.matches && innerWidth > 900);
    document.documentElement.classList.toggle("has-memory-cursor", cursorEnabled);
    if (!cursorEnabled && cursorFrame) {
      cancelAnimationFrame(cursorFrame);
      cursorFrame = 0;
    }
  }
  configureCursor();
  finePointer.addEventListener?.("change", configureCursor);
  reduce.addEventListener?.("change", configureCursor);

  addEventListener("pointermove", (event) => {
    if (cursorEnabled) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      const active = Boolean(event.target.closest("a,button,input,[data-memory-lens]"));
      cursor?.classList.toggle("is-active", active);
      cursorHalf = active ? 36 : 24;
      wakeCursor();
    }

    if (!splitStage || phoneViewport.matches) return;
    const rect = splitStage.getBoundingClientRect();
    lensInside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (lensInside && finePointer.matches && !reduce.matches) {
      const normalized = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
      lensInfluence = (normalized - .5) * -8;
      splitStage.style.setProperty("--lens-x", `${(normalized * 100).toFixed(2)}%`);
      splitStage.style.setProperty("--lens-y", `${(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100).toFixed(2)}%`);
      const readout = q(".lens-readout b");
      if (readout) readout.textContent = normalized > .5 ? "Evidence attached" : "Fragment recovered";
    } else {
      lensInfluence *= .65;
    }
    scheduleSpatialState();
  }, { passive: true });

  addEventListener("pointerleave", () => {
    lensInside = false;
    lensInfluence = 0;
    pointerX = cursorX = -80;
    pointerY = cursorY = -80;
    if (cursor) cursor.style.transform = "translate3d(-100px,-100px,0)";
    scheduleSpatialState();
  });

  /* Dialogs ------------------------------------------------------------- */
  const dialogs = qa(".brace-dialog");
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    if (animeEngine && !isMotionCalm()) {
      const surface = q(".dialog-surface", dialog);
      animeEngine.remove(surface);
      animeEngine({
        targets: surface,
        opacity: [0, 1],
        translateY: [22, 0],
        scale: [.98, 1],
        duration: 480,
        easing: "cubicBezier(0.16, 1, 0.3, 1)",
      });
    }
  }
  dialogs.forEach((dialog) => {
    qa("[data-dialog-close]", dialog).forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  });

  /* Command palette ----------------------------------------------------- */
  const commandDialog = q("#command-dialog");
  const commandInput = q("#command-input");
  const commandButtons = qa("[data-command-target]");
  function resetCommandResults() {
    commandButtons.forEach((button, index) => {
      button.hidden = false;
      button.classList.toggle("is-active", index === 0);
    });
    const empty = q(".command-empty");
    if (empty) empty.hidden = true;
  }
  function openCommandPalette() {
    openDialog(commandDialog);
    if (!commandInput) return;
    commandInput.value = "";
    resetCommandResults();
    window.setTimeout(() => { if (commandDialog?.open) commandInput.focus(); }, 30);
  }
  q("[data-command-open]")?.addEventListener("click", openCommandPalette);
  addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }
  });
  commandInput?.addEventListener("input", () => {
    const query = commandInput.value.trim().toLowerCase();
    let visible = 0;
    commandButtons.forEach((button) => {
      const matches = !query || `${button.textContent} ${button.dataset.commandKeywords || ""}`.toLowerCase().includes(query);
      button.hidden = !matches;
      button.classList.remove("is-active");
      if (matches) visible += 1;
    });
    q(".command-empty").hidden = visible > 0;
    commandButtons.find((button) => !button.hidden)?.classList.add("is-active");
  });
  commandInput?.addEventListener("keydown", (event) => {
    const visible = commandButtons.filter((button) => !button.hidden);
    if (event.key === "Enter" && visible.length) {
      event.preventDefault();
      (visible.find((button) => button.classList.contains("is-active")) || visible[0]).click();
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || !visible.length) return;
    event.preventDefault();
    const current = Math.max(0, visible.findIndex((button) => button.classList.contains("is-active")));
    const next = event.key === "ArrowDown" ? (current + 1) % visible.length : (current - 1 + visible.length) % visible.length;
    visible.forEach((button) => button.classList.remove("is-active"));
    visible[next].classList.add("is-active");
  });
  commandButtons.forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.commandTarget;
    commandDialog?.close();
    if (target.startsWith("#")) q(target)?.scrollIntoView({ behavior: isMotionCalm() ? "auto" : "smooth" });
    else location.href = target;
  }));

  /* Motion preference --------------------------------------------------- */
  const motionToggle = q("[data-motion-toggle]");
  function setCalmMotion(enabled) {
    document.documentElement.classList.toggle("is-calm", enabled);
    motionToggle?.setAttribute("aria-pressed", String(enabled));
    motionToggle?.setAttribute("aria-label", enabled ? "Use full motion" : "Use calm motion");
    const label = motionToggle?.querySelector("span");
    if (label) label.textContent = enabled ? "Full motion" : "Calm motion";
    dispatchEvent(new CustomEvent("brace:motion"));
  }
  if (reduce.matches && motionToggle) {
    setCalmMotion(true);
    motionToggle.disabled = true;
    q("span", motionToggle).textContent = "System calm";
  }
  motionToggle?.addEventListener("click", () => {
    if (!reduce.matches) setCalmMotion(!document.documentElement.classList.contains("is-calm"));
  });
  q("[data-memory-pulse]")?.addEventListener("click", () => {
    const targets = qa(".constellation-node:not(.is-filtered),.remember-depth i,.vault-ring");
    if (animeEngine && !isMotionCalm()) {
      animeEngine.remove(targets);
      animeEngine({ targets, opacity: [.35, 1], delay: animeEngine.stagger(40, { from: "center" }), duration: 620, easing: "easeOutQuad" });
    }
  });

  /* Memory divider ------------------------------------------------------ */
  let dividerDragging = false;
  function setManualSplit(clientX) {
    if (!splitStage || phoneViewport.matches) return;
    const rect = splitStage.getBoundingClientRect();
    manualSplit = clamp((clientX - rect.left) / Math.max(1, rect.width) * 100, 11, 78);
    scheduleSpatialState();
  }
  dividerControl?.addEventListener("pointerdown", (event) => {
    if (phoneViewport.matches) return;
    dividerDragging = true;
    dividerControl.setPointerCapture(event.pointerId);
    setManualSplit(event.clientX);
  });
  dividerControl?.addEventListener("pointermove", (event) => { if (dividerDragging) setManualSplit(event.clientX); });
  dividerControl?.addEventListener("pointerup", () => { dividerDragging = false; });
  dividerControl?.addEventListener("pointercancel", () => { dividerDragging = false; });
  dividerControl?.addEventListener("keydown", (event) => {
    const current = manualSplit ?? (Number.parseFloat(getComputedStyle(splitStage).getPropertyValue("--split")) || 50);
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") manualSplit = 11;
    else if (event.key === "End") manualSplit = 78;
    else manualSplit = clamp(current + (event.key === "ArrowRight" ? 3 : -3), 11, 78);
    // Keyboard control is a direct manipulation: paint synchronously so the
    // accessible value and the visible divider can never drift by one frame.
    paintSpatialState();
  });

  /* Recoverable fragments ---------------------------------------------- */
  const fragments = qa("[data-memory-fragment]");
  let recoveredCount = 0;
  function updateRecovery() {
    const count = q("#recovered-count");
    if (count) count.textContent = String(recoveredCount);
    const readout = q(".recovery-console > span");
    if (readout) readout.textContent = recoveredCount === fragments.length ? "CONTEXT RESTORED" : "CONTEXT RECOVERY";
  }
  fragments.forEach((fragment) => fragment.addEventListener("click", () => {
    if (fragment.classList.contains("is-recovered")) return;
    fragment.classList.add("is-recovered");
    recoveredCount += 1;
    updateRecovery();
    if (animeEngine && !isMotionCalm() && !phoneViewport.matches) {
      const target = q(".receipt-memory")?.getBoundingClientRect();
      const origin = fragment.getBoundingClientRect();
      if (target) {
        animeEngine.remove(fragment);
        animeEngine({ targets: fragment, translateX: target.left - origin.left, translateY: target.top - origin.top, scale: .72, opacity: 0, duration: 760, easing: "cubicBezier(0.16, 1, 0.3, 1)" });
      }
    } else fragment.style.opacity = "0";
  }));
  q("[data-recovery-reset]")?.addEventListener("click", () => {
    recoveredCount = 0;
    updateRecovery();
    fragments.forEach((fragment) => {
      fragment.classList.remove("is-recovered");
      if (animeEngine) animeEngine.set(fragment, { translateX: 0, translateY: 0, scale: 1, opacity: 1 });
      else {
        fragment.style.opacity = "";
        fragment.style.transform = "";
      }
    });
  });

  /* Provenance ---------------------------------------------------------- */
  const sourceDialog = q("#source-dialog");
  const sourceDialogEntries = {
    source: {
      kind: "SOURCE EVIDENCE",
      title: "Architecture Decisions.md",
      copy: "Original evidence remains separate from durable memory so you can inspect why a result exists.",
      uri: "examples/demo-workspace/Architecture Decisions.md",
      mode: "Original source · lexical match",
    },
    memory: {
      kind: "DURABLE DECISION",
      title: "Keep source files canonical",
      copy: "This durable decision summarizes the source without pretending to be the source. Its provenance remains attached.",
      uri: "Source: Architecture Decisions.md",
      mode: "Lexical · 96%",
    },
  };
  qa("[data-source-inspect]").forEach((button) => button.addEventListener("click", () => {
    const entry = sourceDialogEntries[button.dataset.sourceInspect];
    if (!entry) return;
    q("#source-dialog-kind").textContent = entry.kind;
    q("#source-dialog-title").textContent = entry.title;
    q("#source-dialog-copy").textContent = entry.copy;
    q("#source-dialog-uri").textContent = entry.uri;
    q("#source-dialog-mode").textContent = entry.mode;
    openDialog(sourceDialog);
  }));

  /* Recall -------------------------------------------------------------- */
  const recallEntries = {
    canonical: {
      source: "Architecture Decisions.md",
      uri: "examples/demo-workspace/Architecture Decisions.md",
      kind: "DURABLE DECISION",
      title: "Keep imported files canonical",
      copy: "BRACE indexes project context without editing or moving the original files.",
      mode: "Lexical",
    },
    embeddings: {
      source: "Research Notes.md",
      uri: "examples/demo-workspace/Research Notes.md",
      kind: "SOURCE EVIDENCE",
      title: "Semantic ranking stays optional",
      copy: "A loopback embedding adapter can add vectors. Lexical recall remains available without it.",
      mode: "Lexical",
    },
    evaluation: {
      source: "Research Notes.md",
      uri: "examples/demo-workspace/Research Notes.md",
      kind: "DURABLE LESSON",
      title: "Evaluate retrieval with named examples",
      copy: "Expected evidence stays beside each evaluation prompt so failures remain inspectable.",
      mode: "Lexical",
    },
  };
  function recallKey(value) {
    const query = value.toLowerCase();
    if (query.includes("embed")) return "embeddings";
    if (query.includes("evaluat")) return "evaluation";
    return "canonical";
  }
  function renderRecall(value) {
    const entry = recallEntries[recallKey(value)];
    const root = q("#recall-result");
    root?.classList.add("is-loading");
    window.setTimeout(() => {
      q("#recall-source").textContent = entry.source;
      q("#recall-uri").textContent = entry.uri;
      q("#recall-kind").textContent = entry.kind;
      q("#recall-title").textContent = entry.title;
      q("#recall-copy").textContent = entry.copy;
      q("#recall-mode").textContent = entry.mode;
      root?.classList.remove("is-loading");
    }, isMotionCalm() ? 0 : 260);
  }
  q("#recall-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderRecall(q("#recall-query")?.value || "");
  });
  qa("[data-query]").forEach((button) => button.addEventListener("click", () => {
    qa("[data-query]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    const input = q("#recall-query");
    if (!input) return;
    input.value = button.dataset.query;
    renderRecall(input.value);
  }));

  const evidenceTargets = {
    source: q(".pipeline-source"),
    memory: q(".pipeline-memory"),
    receipt: q(".retrieval-receipt"),
  };
  qa("[data-evidence-layer]").forEach((button) => button.addEventListener("click", () => {
    const visible = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(visible));
    const target = evidenceTargets[button.dataset.evidenceLayer];
    if (!target) return;
    if (visible) {
      target.hidden = false;
      target.style.opacity = "1";
    } else target.hidden = true;
    const anyVisible = Object.values(evidenceTargets).some((item) => item && !item.hidden);
    q("#recall-result")?.classList.toggle("is-empty", !anyVisible);
  }));
  q("[data-copy-recall]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const text = `${q("#recall-title").textContent}\n${q("#recall-copy").textContent}\nSource: ${q("#recall-source").textContent}`;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    window.setTimeout(() => { button.textContent = "Copy result"; }, 1400);
  });

  /* Constellation ------------------------------------------------------- */
  const constellationBoard = q("[data-constellation-board]");
  const constellationSvg = q("[data-constellation-lines]");
  const constellationNodes = qa(".constellation-node");
  const constellationLinks = [
    ["northstar", "architecture"], ["northstar", "research"], ["northstar", "canonical"], ["northstar", "evaluation"],
    ["northstar", "sqlite"], ["northstar", "boundary"], ["northstar", "mcp"], ["architecture", "canonical"],
    ["architecture", "sqlite"], ["research", "evaluation"], ["boundary", "mcp"], ["sqlite", "canonical"],
  ];
  const graphLines = constellationLinks.map(([from, to]) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.dataset.from = from;
    line.dataset.to = to;
    constellationSvg?.append(line);
    return line;
  });
  let selectedNode = constellationNodes[0] || null;
  let graphFrame = 0;

  function drawConstellationNow() {
    graphFrame = 0;
    if (!constellationBoard || !constellationSvg) return;
    const boardRect = constellationBoard.getBoundingClientRect();
    if (boardRect.width < 1 || boardRect.height < 1) return;
    constellationSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    graphLines.forEach((line) => {
      const from = q(`[data-node="${line.dataset.from}"]`);
      const to = q(`[data-node="${line.dataset.to}"]`);
      if (!from || !to) return;
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();
      line.setAttribute("x1", String(fromRect.left + fromRect.width / 2 - boardRect.left));
      line.setAttribute("y1", String(fromRect.top + fromRect.height / 2 - boardRect.top));
      line.setAttribute("x2", String(toRect.left + toRect.width / 2 - boardRect.left));
      line.setAttribute("y2", String(toRect.top + toRect.height / 2 - boardRect.top));
      const hidden = from.classList.contains("is-filtered") || to.classList.contains("is-filtered");
      line.style.opacity = hidden ? "0" : "1";
      line.classList.toggle("is-active", line.dataset.from === selectedNode?.dataset.node || line.dataset.to === selectedNode?.dataset.node);
    });
  }
  function drawConstellation() {
    if (!graphFrame) graphFrame = requestAnimationFrame(drawConstellationNow);
  }
  function selectConstellationNode(node, focus = false) {
    if (!node || node.classList.contains("is-filtered")) return;
    selectedNode = node;
    constellationNodes.forEach((candidate) => candidate.classList.toggle("is-selected", candidate === node));
    q("#node-kind").textContent = node.dataset.nodeType.toUpperCase();
    q("#node-title").textContent = node.dataset.nodeTitle;
    q("#node-copy").textContent = node.dataset.nodeCopy;
    q("#node-evidence").textContent = node.dataset.nodeEvidence;
    drawConstellation();
    if (focus) node.focus({ preventScroll: true });
  }
  constellationNodes.forEach((node, index) => {
    node.dataset.nodeIndex = String(index);
    node.addEventListener("click", () => selectConstellationNode(node));
    node.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      const candidates = constellationNodes.filter((candidate) => !candidate.classList.contains("is-filtered"));
      const current = candidates.indexOf(node);
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      selectConstellationNode(candidates[(current + direction + candidates.length) % candidates.length], true);
    });
  });
  qa("[data-node-filter]").forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.nodeFilter;
    qa("[data-node-filter]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    constellationNodes.forEach((node) => node.classList.toggle("is-filtered", filter !== "all" && node.dataset.nodeType !== filter));
    if (selectedNode?.classList.contains("is-filtered")) selectConstellationNode(constellationNodes.find((node) => !node.classList.contains("is-filtered")));
    drawConstellation();
  }));
  const constellationPresets = {
    rings: [[50,50],[50,17],[72,30],[78,67],[25,72],[30,30],[50,82],[88,48]],
    living: [[50,48],[19,25],[75,20],[72,68],[84,78],[45,14],[22,72],[91,43]],
    orbit: [[48,48],[18,22],[77,20],[22,69],[74,72],[49,14],[11,47],[89,48]],
    flow: [[10,50],[31,26],[31,72],[72,30],[72,72],[52,27],[52,72],[91,50]],
    chronicle: [[10,18],[29,36],[40,36],[71,68],[84,68],[48,52],[60,52],[92,84]],
  };
  function applyConstellationPreset(name) {
    const positions = constellationPresets[name];
    if (!positions || !constellationBoard) return;
    const before = constellationNodes.map((node) => node.getBoundingClientRect());
    constellationNodes.forEach((node, index) => {
      const [left, top] = positions[index];
      node.style.left = `${left}%`;
      node.style.top = `${top}%`;
    });
    constellationBoard.dataset.preset = name;
    qa("[data-constellation-preset]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.constellationPreset === name));
    });
    if (isMotionCalm()) {
      drawConstellation();
      return;
    }
    constellationNodes.forEach((node, index) => {
      const after = node.getBoundingClientRect();
      node.animate(
        [
          { transform: `translate3d(${before[index].left - after.left}px,${before[index].top - after.top}px,0)` },
          { transform: "translate3d(0,0,0)" },
        ],
        { duration: 680, delay: index * 24, easing: "cubic-bezier(0.16,1,0.3,1)" },
      );
    });
    const started = performance.now();
    const redraw = (now) => {
      drawConstellation();
      if (now - started < 900) requestAnimationFrame(redraw);
    };
    requestAnimationFrame(redraw);
  }
  qa("[data-constellation-preset]").forEach((button) => {
    button.addEventListener("click", () => applyConstellationPreset(button.dataset.constellationPreset));
  });
  applyConstellationPreset("rings");
  q("[data-center-node]")?.addEventListener("click", () => {
    constellationBoard?.scrollIntoView({ behavior: isMotionCalm() ? "auto" : "smooth", block: "center" });
    selectedNode?.focus({ preventScroll: true });
  });
  if (constellationBoard) {
    new ResizeObserver(drawConstellation).observe(constellationBoard);
    requestAnimationFrame(drawConstellation);
  }

  /* Privacy vault ------------------------------------------------------- */
  const vaultEntries = {
    files: { label: "SOURCE BOUNDARY", copy: "Imported files stay where you put them. BRACE reads supported text in place and stores only private-path-free provenance." },
    memory: { label: "MEMORY BOUNDARY", copy: "Structured memory lives in external application data, with backups, exports, forgetting, and deletion under your control." },
    network: { label: "NETWORK BOUNDARY", copy: "Recall is local by default. Optional embedding providers are explicit, visible, and never required for lexical search." },
  };
  qa("[data-vault-select]").forEach((button) => button.addEventListener("click", () => {
    qa("[data-vault-select]").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    const entry = vaultEntries[button.dataset.vaultSelect];
    q("#vault-readout-label").textContent = entry.label;
    q("#vault-readout-copy").textContent = entry.copy;
  }));

  /* Product proof ------------------------------------------------------- */
  const proofPosition = q("#proof-position");
  const proofFrames = qa("[data-proof]");
  let currentProofIndex = 0;
  const proofObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!visible) return;
    if (proofPosition) proofPosition.textContent = q("figcaption strong", visible.target)?.textContent || "Product";
    currentProofIndex = Math.max(0, proofFrames.indexOf(visible.target));
  }, { rootMargin: compactViewport.matches ? "-15% 0px -45%" : "0px -28%", threshold: [0.15, 0.45, 0.7] });
  proofFrames.forEach((frame) => proofObserver.observe(frame));

  function navigateProof(index) {
    if (!proofFrames.length) return;
    currentProofIndex = (index + proofFrames.length) % proofFrames.length;
    if (compactViewport.matches || reduce.matches) {
      proofFrames[currentProofIndex].scrollIntoView({ behavior: isMotionCalm() ? "auto" : "smooth", block: "center" });
      return;
    }
    const product = q("#product");
    const travel = Math.max(1, product.offsetHeight - innerHeight);
    const progress = (currentProofIndex + 1) / (proofFrames.length + 1);
    scrollTo({ top: product.offsetTop + travel * progress, behavior: isMotionCalm() ? "auto" : "smooth" });
  }
  q("[data-proof-prev]")?.addEventListener("click", () => navigateProof(currentProofIndex - 1));
  q("[data-proof-next]")?.addEventListener("click", () => navigateProof(currentProofIndex + 1));

  const proofDialog = q("#proof-dialog");
  let lightboxIndex = 0;
  function renderLightbox(index) {
    if (!proofFrames.length) return;
    lightboxIndex = (index + proofFrames.length) % proofFrames.length;
    const frame = proofFrames[lightboxIndex];
    const image = q("#proof-dialog-image");
    image.src = frame.dataset.proofImage;
    q("#proof-dialog-title").textContent = frame.dataset.proofTitle;
  }
  proofFrames.forEach((frame, index) => q("[data-proof-expand]", frame)?.addEventListener("click", () => {
    renderLightbox(index);
    openDialog(proofDialog);
  }));
  q("[data-lightbox-prev]")?.addEventListener("click", () => renderLightbox(lightboxIndex - 1));
  q("[data-lightbox-next]")?.addEventListener("click", () => renderLightbox(lightboxIndex + 1));

  /* Package advisor ----------------------------------------------------- */
  const packageAdvice = {
    guided: "Choose the Windows installer or Linux .deb for system integration.",
    portable: "Choose the Linux AppImage when you want one portable executable.",
  };
  function setPackageGoal(goal) {
    qa("[data-package-goal]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate.dataset.packageGoal === goal)));
    q("#package-advice").textContent = packageAdvice[goal];
    qa(".platform-download").forEach((card) => card.classList.remove("is-advised"));
    qa(".platform-primary,.platform-secondary").forEach((action) => action.classList.remove("is-advised-action"));
    if (goal === "portable") {
      q('[data-platform-card="linux"]')?.classList.add("is-advised");
      q('[data-download="linux"]')?.classList.add("is-advised-action");
    } else {
      q('[data-platform-card="windows"]')?.classList.add("is-advised");
      q('[data-download="windows"]')?.classList.add("is-advised-action");
      q('[data-download="deb"]')?.classList.add("is-advised-action");
    }
  }
  qa("[data-package-goal]").forEach((button) => button.addEventListener("click", () => setPackageGoal(button.dataset.packageGoal)));
  setPackageGoal("guided");

  /* Pointer micro-interactions: one RAF write per element, no anime object on
     every pointermove. */
  qa("[data-magnetic]").forEach((element) => {
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    const write = () => {
      frame = 0;
      element.style.transform = `translate3d(${targetX.toFixed(1)}px,${targetY.toFixed(1)}px,0)`;
    };
    element.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || isMotionCalm()) return;
      const rect = element.getBoundingClientRect();
      targetX = (event.clientX - rect.left - rect.width / 2) * .07;
      targetY = (event.clientY - rect.top - rect.height / 2) * .08;
      if (!frame) frame = requestAnimationFrame(write);
    });
    element.addEventListener("pointerleave", () => {
      targetX = targetY = 0;
      if (!frame) frame = requestAnimationFrame(write);
    });
  });

  /* Once-only entrances. */
  if (animeEngine && !isMotionCalm()) {
    const cards = qa(".platform-download,.recall-workbench,.constellation-lab,.proof-outro");
    const cardObserver = new IntersectionObserver((entries, observer) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      if (!entering.length) return;
      animeEngine({ targets: entering, opacity: [0, 1], translateY: [20, 0], delay: animeEngine.stagger(55), duration: 520, easing: "cubicBezier(0.16, 1, 0.3, 1)" });
      entering.forEach((target) => observer.unobserve(target));
    }, { threshold: .12 });
    cards.forEach((card) => cardObserver.observe(card));
  }

  /* Canvas fields: 30fps max and only while close to the viewport. */
  function createField(canvas, baseCount) {
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    let width = 0;
    let height = 0;
    let points = [];
    let raf = 0;
    let active = false;
    let lastPaint = 0;

    function buildPoints() {
      const scale = width < 700 ? .48 : width < 1100 ? .72 : 1;
      const count = Math.max(12, Math.round(baseCount * scale));
      points = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .11,
        vy: (Math.random() - .5) * .11,
        radius: index % 13 === 0 ? 1.8 : .65 + Math.random() * .65,
        spectral: index % 11 === 0,
      }));
    }

    function paint(animate = false) {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        if (animate) {
          point.x = (point.x + point.vx + width) % width;
          point.y = (point.y + point.vy + height) % height;
        }
        for (let next = index + 1; next < points.length; next += 1) {
          const target = points[next];
          const dx = point.x - target.x;
          const dy = point.y - target.y;
          const squared = dx * dx + dy * dy;
          if (squared > 19600) continue;
          const distance = Math.sqrt(squared);
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(target.x, target.y);
          context.strokeStyle = `rgba(151,207,242,${(1 - distance / 140) * .075})`;
          context.lineWidth = .6;
          context.stroke();
        }
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = point.spectral ? "rgba(196,181,253,.58)" : "rgba(125,211,252,.42)";
        context.fill();
      });
    }

    function tick(time) {
      raf = 0;
      if (!active || document.hidden || isMotionCalm()) return;
      if (time - lastPaint >= 32) {
        lastPaint = time;
        paint(true);
      }
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (!active || raf || document.hidden || isMotionCalm()) return;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1.35, devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildPoints();
      paint(false);
      start();
    }

    new ResizeObserver(resize).observe(canvas);
    const visibilityObserver = new IntersectionObserver((entries) => {
      active = entries[0]?.isIntersecting || false;
      if (active) start(); else stop();
    }, { rootMargin: "180px 0px", threshold: 0 });
    visibilityObserver.observe(canvas);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });
    addEventListener("brace:motion", () => {
      stop();
      paint(false);
      start();
    });
  }

  createField(q("#memory-field"), 38);
  createField(q("#download-field"), 26);
})();

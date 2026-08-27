(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const animeEngine = window.anime;
  const isMotionCalm = () => reduce.matches || document.documentElement.classList.contains("is-calm");

  const openingFilm = document.querySelector("#opening-film");
  const openingVideo = openingFilm?.querySelector("video");
  let openingClosed = false;

  function closeOpeningFilm({remember = true} = {}) {
    if (!openingFilm || openingClosed) return;
    openingClosed = true;
    openingFilm.classList.add("is-exiting");
    document.body.classList.remove("has-opening-film");
    openingVideo?.pause();
    if (remember) {
      try { sessionStorage.setItem("brace-opening-seen", "1"); } catch {}
    }
    setTimeout(() => openingFilm.remove(), reduce.matches ? 0 : 700);
  }

  let openingSeen = false;
  try { openingSeen = sessionStorage.getItem("brace-opening-seen") === "1"; } catch {}
  if (reduce.matches || openingSeen) closeOpeningFilm({remember: openingSeen});
  else if (openingVideo) {
    openingVideo.addEventListener("ended", () => closeOpeningFilm(), {once: true});
    openingVideo.addEventListener("error", () => closeOpeningFilm({remember: false}), {once: true});
    openingVideo.play().catch(() => setTimeout(() => closeOpeningFilm({remember: false}), 1200));
    setTimeout(() => closeOpeningFilm(), 6800);
  } else closeOpeningFilm({remember: false});
  document.querySelector("[data-skip-opening]")?.addEventListener("click", () => closeOpeningFilm());
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !openingClosed) closeOpeningFilm();
  });

  const releaseBase = "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.4.0";
  const downloads = {
    windows: {
      url: `${releaseBase}/BRACE-Setup-0.4.0.exe`,
      platform: "Windows 10 / 11",
      format: ".exe installer",
    },
    linux: {
      url: `${releaseBase}/BRACE-0.4.0.AppImage`,
      platform: "Linux x86_64",
      format: "AppImage",
    },
    deb: {
      url: `${releaseBase}/brace-brain_0.4.0_amd64.deb`,
      platform: "Debian / Ubuntu",
      format: ".deb package",
    },
  };

  const detected = /Windows/i.test(navigator.userAgent)
    ? "windows"
    : /(?:Ubuntu|Debian)/i.test(navigator.userAgent)
      ? "deb"
      : /Linux/i.test(navigator.userAgent)
        ? "linux"
        : null;

  document.querySelectorAll("[data-download]").forEach((link) => {
    const item = downloads[link.dataset.download];
    if (item) link.href = item.url;
  });

  if (detected) {
    const platform = detected === "windows" ? "windows" : "linux";
    document.querySelector(`[data-platform-card="${platform}"]`)?.classList.add("is-recommended");
  }

  if (window.ScrollCraft) {
    window.ScrollCraft.mount(document.querySelector("main"), { lerp: 0.2 });
  }

  const navigationLinks = Array.from(document.querySelectorAll(".glass-rail nav a"));
  const navigationSections = navigationLinks
    .filter((link) => link.hash)
    .map((link) => document.querySelector(link.hash))
    .filter(Boolean);
  const navigationObserver = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!active) return;
    navigationLinks.forEach((link) => {
      const selected = link.hash === `#${active.target.id}`;
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-34% 0px -55%", threshold: [0, 0.15, 0.55] });
  navigationSections.forEach((section) => navigationObserver.observe(section));

  const openingAct = document.querySelector("#opening-act");
  const splitStage = document.querySelector(".split-stage");
  const downloadAct = document.querySelector("#download");
  const downloadStage = document.querySelector(".download-stage");
  const boundaryAct = document.querySelector("#boundary");
  const boundaryStage = document.querySelector(".boundary-stage");
  const narrowViewport = window.matchMedia("(max-width: 760px)");
  let lensInside = false;
  let lensInfluence = 0;
  let manualSplit = null;
  let frameQueued = false;

  function progressOf(element) {
    return clamp(Number.parseFloat(getComputedStyle(element).getPropertyValue("--sc-p")) || 0);
  }

  function paintSpatialState() {
    frameQueued = false;
    const openingProgress = progressOf(openingAct);
    const split = manualSplit ?? clamp(50 - openingProgress * 36 + lensInfluence, 11, 57);
    splitStage.style.setProperty("--split", `${split.toFixed(2)}%`);
    splitStage.dataset.scVerifyState = `split:${Math.round(split)}:${lensInside ? "lens" : "idle"}`;
    const dividerControl = document.querySelector("[data-memory-divider]");
    dividerControl?.setAttribute("aria-valuenow", String(Math.round(split)));

    const downloadProgress = progressOf(downloadAct);
    const downloadSplit = reduce.matches || narrowViewport.matches ? 0 : clamp(52 - downloadProgress * 52, 0, 52);
    downloadStage.style.setProperty("--download-split", `${downloadSplit.toFixed(2)}%`);
    downloadStage.dataset.scVerifyState = `download:${Math.round(downloadSplit)}`;

    const boundaryProgress = progressOf(boundaryAct);
    boundaryStage.dataset.scVerifyState = `vault:${boundaryProgress > 0.58 ? "open" : boundaryProgress > 0.12 ? "opening" : "closed"}`;
  }

  function scheduleSpatialState() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(paintSpatialState);
  }

  addEventListener("scroll", scheduleSpatialState, { passive: true });
  addEventListener("resize", scheduleSpatialState, { passive: true });
  paintSpatialState();

  const cursor = document.querySelector(".memory-cursor");
  let pointerX = -80;
  let pointerY = -80;
  let cursorX = -80;
  let cursorY = -80;

  function cursorTick() {
    cursorX += (pointerX - cursorX) * 0.17;
    cursorY += (pointerY - cursorY) * 0.17;
    cursor.style.transform = `translate3d(${(cursorX - cursor.offsetWidth / 2).toFixed(2)}px,${(cursorY - cursor.offsetHeight / 2).toFixed(2)}px,0)`;
    requestAnimationFrame(cursorTick);
  }

  function configureCursor() {
    const enabled = finePointer.matches && !reduce.matches;
    document.documentElement.classList.toggle("has-memory-cursor", enabled);
  }

  configureCursor();
  finePointer.addEventListener?.("change", configureCursor);
  reduce.addEventListener?.("change", configureCursor);

  addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    const rect = splitStage.getBoundingClientRect();
    lensInside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (lensInside && finePointer.matches && !reduce.matches) {
      const normalized = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
      lensInfluence = (normalized - 0.5) * -10;
      splitStage.style.setProperty("--lens-x", `${((event.clientX - rect.left) / rect.width * 100).toFixed(2)}%`);
      splitStage.style.setProperty("--lens-y", `${((event.clientY - rect.top) / rect.height * 100).toFixed(2)}%`);
      document.querySelector(".lens-readout b").textContent = normalized > 0.5 ? "Evidence attached" : "Fragment recovered";
    } else {
      lensInfluence *= 0.7;
    }
    cursor.classList.toggle("is-active", Boolean(event.target.closest("a,button,input,[data-memory-lens]")));
    scheduleSpatialState();
  }, { passive: true });

  addEventListener("pointerleave", () => {
    lensInside = false;
    lensInfluence = 0;
    pointerX = -80;
    pointerY = -80;
    scheduleSpatialState();
  });
  requestAnimationFrame(cursorTick);

  const dialogs = Array.from(document.querySelectorAll(".brace-dialog"));
  const animateDialogIn = (dialog) => {
    if (!animeEngine || isMotionCalm()) return;
    animeEngine.remove(dialog.querySelector(".dialog-surface"));
    animeEngine({
      targets: dialog.querySelector(".dialog-surface"),
      opacity: [0, 1],
      translateY: [28, 0],
      scale: [0.97, 1],
      duration: 620,
      easing: "cubicBezier(0.16, 1, 0.3, 1)",
    });
  };
  const openDialog = (dialog) => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    animateDialogIn(dialog);
  };
  dialogs.forEach((dialog) => {
    dialog.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const commandDialog = document.querySelector("#command-dialog");
  const commandInput = document.querySelector("#command-input");
  const commandButtons = Array.from(document.querySelectorAll("[data-command-target]"));
  function openCommandPalette() {
    openDialog(commandDialog);
    commandInput.value = "";
    commandButtons.forEach((button) => {
      button.hidden = false;
      button.classList.remove("is-active");
    });
    commandButtons[0]?.classList.add("is-active");
    document.querySelector(".command-empty").hidden = true;
    setTimeout(() => {
      if (commandDialog.open) commandInput.focus();
    }, 30);
  }
  document.querySelector("[data-command-open]")?.addEventListener("click", openCommandPalette);
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
      const matches = !query || `${button.textContent} ${button.dataset.commandKeywords}`.toLowerCase().includes(query);
      button.hidden = !matches;
      button.classList.remove("is-active");
      if (matches) visible += 1;
    });
    document.querySelector(".command-empty").hidden = visible > 0;
    commandButtons.find((button) => !button.hidden)?.classList.add("is-active");
  });
  commandInput?.addEventListener("keydown", (event) => {
    const visible = commandButtons.filter((button) => !button.hidden);
    if (event.key === "Enter" && visible.length) {
      event.preventDefault();
      visible.find((button) => button.classList.contains("is-active"))?.click();
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || !visible.length) return;
    event.preventDefault();
    const current = visible.findIndex((button) => button.classList.contains("is-active"));
    const next = event.key === "ArrowDown" ? (current + 1) % visible.length : (current - 1 + visible.length) % visible.length;
    visible.forEach((button) => button.classList.remove("is-active"));
    visible[next].classList.add("is-active");
  });
  commandButtons.forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.commandTarget;
    commandDialog.close();
    if (target.startsWith("#")) document.querySelector(target)?.scrollIntoView({behavior: isMotionCalm() ? "auto" : "smooth"});
    else location.href = target;
  }));

  const motionToggle = document.querySelector("[data-motion-toggle]");
  function setCalmMotion(enabled) {
    document.documentElement.classList.toggle("is-calm", enabled);
    motionToggle?.setAttribute("aria-pressed", String(enabled));
    motionToggle?.setAttribute("aria-label", enabled ? "Use full motion" : "Use calm motion");
    motionToggle?.querySelector("span").replaceChildren(document.createTextNode(enabled ? "Full motion" : "Calm motion"));
    dispatchEvent(new CustomEvent("brace:motion"));
  }
  if (reduce.matches) {
    setCalmMotion(true);
    motionToggle.disabled = true;
    motionToggle.querySelector("span").textContent = "System calm";
  }
  motionToggle?.addEventListener("click", () => {
    if (!reduce.matches) setCalmMotion(!document.documentElement.classList.contains("is-calm"));
  });
  document.querySelector("[data-memory-pulse]")?.addEventListener("click", () => {
    const targets = document.querySelectorAll(".constellation-node:not(.is-filtered),.remember-depth i,.vault-ring");
    if (animeEngine && !isMotionCalm()) {
      animeEngine.remove(targets);
      animeEngine({targets, opacity: [0.22, 1, 1], delay: animeEngine.stagger(55, {from: "center"}), duration: 920, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
    }
  });

  const dividerControl = document.querySelector("[data-memory-divider]");
  let dividerDragging = false;
  function setManualSplit(clientX) {
    const rect = splitStage.getBoundingClientRect();
    manualSplit = clamp((clientX - rect.left) / Math.max(1, rect.width) * 100, 11, 78);
    scheduleSpatialState();
  }
  dividerControl?.addEventListener("pointerdown", (event) => {
    dividerDragging = true;
    dividerControl.setPointerCapture(event.pointerId);
    setManualSplit(event.clientX);
  });
  dividerControl?.addEventListener("pointermove", (event) => {
    if (dividerDragging) setManualSplit(event.clientX);
  });
  dividerControl?.addEventListener("pointerup", () => { dividerDragging = false; });
  dividerControl?.addEventListener("keydown", (event) => {
    const current = manualSplit ?? (Number.parseFloat(getComputedStyle(splitStage).getPropertyValue("--split")) || 50);
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") manualSplit = 11;
    else if (event.key === "End") manualSplit = 78;
    else manualSplit = clamp(current + (event.key === "ArrowRight" ? 3 : -3), 11, 78);
    scheduleSpatialState();
  });

  const fragments = Array.from(document.querySelectorAll("[data-memory-fragment]"));
  let recoveredCount = 0;
  function updateRecovery() {
    document.querySelector("#recovered-count").textContent = String(recoveredCount);
    const readout = document.querySelector(".recovery-console>span");
    readout.textContent = recoveredCount === fragments.length ? "CONTEXT RESTORED" : "CONTEXT RECOVERY";
  }
  fragments.forEach((fragment, index) => fragment.addEventListener("click", () => {
    if (fragment.classList.contains("is-recovered")) return;
    fragment.classList.add("is-recovered");
    recoveredCount += 1;
    updateRecovery();
    const target = document.querySelector(".receipt-memory").getBoundingClientRect();
    const origin = fragment.getBoundingClientRect();
    if (animeEngine && !isMotionCalm()) animeEngine({targets: fragment, translateX: `+=${target.left - origin.left}px`, translateY: `+=${target.top - origin.top}px`, scale: [1, 0.72], opacity: [1, 0], duration: 900, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
    else fragment.style.opacity = "0";
    if (recoveredCount === fragments.length && animeEngine && !isMotionCalm()) animeEngine({targets: ".receipt-memory", scale: [1, 1.06, 1], boxShadow: ["0 18px 50px rgba(0,3,10,.55)", "0 22px 70px rgba(196,181,253,.32)", "0 18px 50px rgba(0,3,10,.55)"], duration: 800, easing: "easeOutElastic(1, .6)"});
  }));
  document.querySelector("[data-recovery-reset]")?.addEventListener("click", () => {
    recoveredCount = 0;
    updateRecovery();
    fragments.forEach((fragment) => {
      fragment.classList.remove("is-recovered");
      if (animeEngine) animeEngine.set(fragment, {translateX: 0, translateY: 0, scale: 1, opacity: 1});
      else fragment.removeAttribute("style");
    });
  });

  const sourceDialog = document.querySelector("#source-dialog");
  const sourceDialogEntries = {
    source: {kind: "SOURCE EVIDENCE", title: "Architecture Decisions.md", copy: "Original evidence remains separate from durable memory so you can inspect why a result exists.", uri: "examples/demo-workspace/Architecture Decisions.md", mode: "Original source · lexical match"},
    memory: {kind: "DURABLE DECISION", title: "Keep source files canonical", copy: "This durable decision summarizes the source without pretending to be the source. Its provenance remains attached.", uri: "Source: Architecture Decisions.md", mode: "Lexical · 96%"},
  };
  document.querySelectorAll("[data-source-inspect]").forEach((button) => button.addEventListener("click", () => {
    const entry = sourceDialogEntries[button.dataset.sourceInspect];
    document.querySelector("#source-dialog-kind").textContent = entry.kind;
    document.querySelector("#source-dialog-title").textContent = entry.title;
    document.querySelector("#source-dialog-copy").textContent = entry.copy;
    document.querySelector("#source-dialog-uri").textContent = entry.uri;
    document.querySelector("#source-dialog-mode").textContent = entry.mode;
    openDialog(sourceDialog);
  }));

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
    const root = document.querySelector("#recall-result");
    root.classList.add("is-loading");
    setTimeout(() => {
      document.querySelector("#recall-source").textContent = entry.source;
      document.querySelector("#recall-uri").textContent = entry.uri;
      document.querySelector("#recall-kind").textContent = entry.kind;
      document.querySelector("#recall-title").textContent = entry.title;
      document.querySelector("#recall-copy").textContent = entry.copy;
      document.querySelector("#recall-mode").textContent = entry.mode;
      root.classList.remove("is-loading");
    }, reduce.matches ? 0 : 360);
  }

  document.querySelector("#recall-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderRecall(document.querySelector("#recall-query").value);
  });
  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-query]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
      const input = document.querySelector("#recall-query");
      input.value = button.dataset.query;
      renderRecall(input.value);
    });
  });

  const evidenceTargets = {
    source: document.querySelector(".pipeline-source"),
    memory: document.querySelector(".pipeline-memory"),
    receipt: document.querySelector(".retrieval-receipt"),
  };
  document.querySelectorAll("[data-evidence-layer]").forEach((button) => button.addEventListener("click", () => {
    const visible = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(visible));
    const target = evidenceTargets[button.dataset.evidenceLayer];
    if (visible) {
      target.hidden = false;
      if (animeEngine && !isMotionCalm()) animeEngine({targets: target, opacity: [0, 1], translateY: [12, 0], duration: 480, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
      else target.style.opacity = "1";
    } else if (animeEngine && !isMotionCalm()) {
      animeEngine({targets: target, opacity: 0, translateY: -8, duration: 240, easing: "easeOutQuad", complete: () => { target.hidden = true; }});
    } else target.hidden = true;
    const anyVisible = Object.values(evidenceTargets).some((item) => !item.hidden);
    document.querySelector("#recall-result").classList.toggle("is-empty", !anyVisible);
  }));
  document.querySelector("[data-copy-recall]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const copy = `${document.querySelector("#recall-title").textContent}\n${document.querySelector("#recall-copy").textContent}\nSource: ${document.querySelector("#recall-source").textContent}`;
    try {
      await navigator.clipboard.writeText(copy);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => { button.textContent = "Copy result"; }, 1400);
  });

  const constellationBoard = document.querySelector("[data-constellation-board]");
  const constellationSvg = document.querySelector("[data-constellation-lines]");
  const constellationNodes = Array.from(document.querySelectorAll(".constellation-node"));
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
  let selectedNode = constellationNodes[0];
  function drawConstellation() {
    if (!constellationBoard || !constellationSvg) return;
    const boardRect = constellationBoard.getBoundingClientRect();
    constellationSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    graphLines.forEach((line) => {
      const from = document.querySelector(`[data-node="${line.dataset.from}"]`);
      const to = document.querySelector(`[data-node="${line.dataset.to}"]`);
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
  function selectConstellationNode(node, focus = false) {
    if (!node || node.classList.contains("is-filtered")) return;
    selectedNode = node;
    constellationNodes.forEach((candidate) => candidate.classList.toggle("is-selected", candidate === node));
    document.querySelector("#node-kind").textContent = node.dataset.nodeType.toUpperCase();
    document.querySelector("#node-title").textContent = node.dataset.nodeTitle;
    document.querySelector("#node-copy").textContent = node.dataset.nodeCopy;
    document.querySelector("#node-evidence").textContent = node.dataset.nodeEvidence;
    drawConstellation();
    if (focus) node.focus();
    if (animeEngine && !isMotionCalm()) animeEngine({targets: ".constellation-inspector>*", opacity: [0, 1], translateX: [12, 0], delay: animeEngine.stagger(45), duration: 420, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
  }
  constellationNodes.forEach((node, index) => {
    node.addEventListener("click", () => selectConstellationNode(node));
    node.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      const candidates = constellationNodes.filter((candidate) => !candidate.classList.contains("is-filtered"));
      const current = candidates.indexOf(node);
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      selectConstellationNode(candidates[(current + direction + candidates.length) % candidates.length], true);
    });
    node.dataset.nodeIndex = String(index);
  });
  document.querySelectorAll("[data-node-filter]").forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.nodeFilter;
    document.querySelectorAll("[data-node-filter]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    constellationNodes.forEach((node) => node.classList.toggle("is-filtered", filter !== "all" && node.dataset.nodeType !== filter));
    if (selectedNode.classList.contains("is-filtered")) selectConstellationNode(constellationNodes.find((node) => !node.classList.contains("is-filtered")));
    drawConstellation();
  }));
  const constellationPresets = [
    [[48,48],[18,22],[77,20],[22,69],[74,72],[49,14],[11,47],[89,48]],
    [[51,51],[12,33],[72,14],[27,80],[88,67],[39,12],[13,65],[84,38]],
    [[46,46],[24,13],[86,31],[12,76],[62,83],[65,10],[11,43],[91,62]],
  ];
  let constellationPreset = 0;
  document.querySelector("[data-constellation-shuffle]")?.addEventListener("click", () => {
    constellationPreset = (constellationPreset + 1) % constellationPresets.length;
    constellationNodes.forEach((node, index) => {
      const [left, top] = constellationPresets[constellationPreset][index];
      if (animeEngine && !isMotionCalm()) animeEngine({targets: node, left: `${left}%`, top: `${top}%`, delay: index * 28, duration: 720, easing: "easeOutElastic(1, .75)", update: drawConstellation, complete: drawConstellation});
      else { node.style.left = `${left}%`; node.style.top = `${top}%`; }
    });
    drawConstellation();
  });
  document.querySelector("[data-center-node]")?.addEventListener("click", () => {
    constellationBoard.scrollIntoView({behavior: isMotionCalm() ? "auto" : "smooth", block: "center"});
    if (animeEngine && !isMotionCalm()) animeEngine({targets: selectedNode.querySelector("i"), scale: [1, 1.8, 1.3], duration: 820, easing: "easeOutElastic(1, .5)"});
    selectedNode.focus({preventScroll: true});
  });
  addEventListener("resize", drawConstellation);
  if (constellationBoard) new ResizeObserver(drawConstellation).observe(constellationBoard);
  requestAnimationFrame(drawConstellation);

  const vaultEntries = {
    files: {label: "SOURCE BOUNDARY", copy: "Imported files stay where you put them. BRACE reads supported text in place and stores only private-path-free provenance."},
    memory: {label: "MEMORY BOUNDARY", copy: "Structured memory lives in external application data, with backups, exports, forgetting, and deletion under your control."},
    network: {label: "NETWORK BOUNDARY", copy: "Recall is local by default. Optional embedding providers are explicit, visible, and never required for lexical search."},
  };
  document.querySelectorAll("[data-vault-select]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-vault-select]").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    const entry = vaultEntries[button.dataset.vaultSelect];
    document.querySelector("#vault-readout-label").textContent = entry.label;
    document.querySelector("#vault-readout-copy").textContent = entry.copy;
    if (animeEngine && !isMotionCalm()) animeEngine({targets: ".vault-core", opacity: [0.72, 1], boxShadow: ["0 35px 90px rgba(0,3,11,.56)", "0 42px 120px rgba(125,211,252,.24)", "0 35px 90px rgba(0,3,11,.56)"], duration: 850, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
  }));

  const proofPosition = document.querySelector("#proof-position");
  const proofFrames = Array.from(document.querySelectorAll("[data-proof]"));
  let currentProofIndex = 0;
  const proofObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!visible) return;
    proofPosition.textContent = visible.target.querySelector("figcaption strong")?.textContent || "Product";
    currentProofIndex = Math.max(0, proofFrames.indexOf(visible.target));
  }, { root: null, rootMargin: "0px -28%", threshold: [0.15, 0.45, 0.7] });
  proofFrames.forEach((frame) => proofObserver.observe(frame));

  function navigateProof(index) {
    currentProofIndex = (index + proofFrames.length) % proofFrames.length;
    if (reduce.matches) {
      proofFrames[currentProofIndex].scrollIntoView({behavior: "auto", inline: "center", block: "nearest"});
      return;
    }
    const travel = Math.max(1, document.querySelector("#product").offsetHeight - innerHeight);
    const progress = (currentProofIndex + 1) / (proofFrames.length + 1);
    scrollTo({top: document.querySelector("#product").offsetTop + travel * progress, behavior: isMotionCalm() ? "auto" : "smooth"});
  }
  document.querySelector("[data-proof-prev]")?.addEventListener("click", () => navigateProof(currentProofIndex - 1));
  document.querySelector("[data-proof-next]")?.addEventListener("click", () => navigateProof(currentProofIndex + 1));

  const proofDialog = document.querySelector("#proof-dialog");
  let lightboxIndex = 0;
  function renderLightbox(index) {
    lightboxIndex = (index + proofFrames.length) % proofFrames.length;
    const frame = proofFrames[lightboxIndex];
    const image = document.querySelector("#proof-dialog-image");
    image.src = frame.dataset.proofImage;
    document.querySelector("#proof-dialog-title").textContent = frame.dataset.proofTitle;
    if (animeEngine && !isMotionCalm()) animeEngine({targets: image, opacity: [0, 1], scale: [0.985, 1], duration: 420, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
  }
  proofFrames.forEach((frame, index) => frame.querySelector("[data-proof-expand]")?.addEventListener("click", () => {
    renderLightbox(index);
    openDialog(proofDialog);
  }));
  document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => renderLightbox(lightboxIndex - 1));
  document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => renderLightbox(lightboxIndex + 1));

  const packageAdvice = {
    guided: "Choose the Windows installer or Linux .deb for system integration.",
    portable: "Choose the Linux AppImage when you want one portable executable.",
  };
  document.querySelectorAll("[data-package-goal]").forEach((button) => button.addEventListener("click", () => {
    const goal = button.dataset.packageGoal;
    document.querySelectorAll("[data-package-goal]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    document.querySelector("#package-advice").textContent = packageAdvice[goal];
    document.querySelectorAll(".platform-download").forEach((card) => card.classList.remove("is-advised"));
    document.querySelectorAll(".platform-primary,.platform-secondary").forEach((action) => action.classList.remove("is-advised-action"));
    if (goal === "portable") {
      document.querySelector('[data-platform-card="linux"]').classList.add("is-advised");
      document.querySelector('[data-download="linux"]').classList.add("is-advised-action");
    } else {
      document.querySelector('[data-platform-card="windows"]').classList.add("is-advised");
      document.querySelector('[data-download="windows"]').classList.add("is-advised-action");
      document.querySelector('[data-download="deb"]').classList.add("is-advised-action");
    }
    if (animeEngine && !isMotionCalm()) animeEngine({targets: ".is-advised-action", scale: [0.98, 1.025, 1], delay: animeEngine.stagger(70), duration: 620, easing: "easeOutElastic(1, .7)"});
  }));
  document.querySelector('[data-package-goal="guided"]')?.click();

  document.querySelectorAll("[data-magnetic]").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || isMotionCalm() || !animeEngine) return;
      const rect = element.getBoundingClientRect();
      animeEngine.remove(element);
      animeEngine({targets: element, translateX: (event.clientX - rect.left - rect.width / 2) * 0.09, translateY: (event.clientY - rect.top - rect.height / 2) * 0.12, duration: 260, easing: "easeOutQuad"});
    });
    element.addEventListener("pointerleave", () => {
      if (!animeEngine) return;
      animeEngine({targets: element, translateX: 0, translateY: 0, duration: 650, easing: "easeOutElastic(1, .55)"});
    });
  });

  document.querySelectorAll(".platform-download,.recall-console,.recall-pipeline,.constellation-lab").forEach((card) => {
    card.classList.add("motion-card");
    card.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || isMotionCalm() || !animeEngine) return;
      const rect = card.getBoundingClientRect();
      const rotateY = (event.clientX - rect.left - rect.width / 2) / rect.width * 2.4;
      const rotateX = -(event.clientY - rect.top - rect.height / 2) / rect.height * 2.1;
      animeEngine.remove(card);
      animeEngine({targets: card, rotateX, rotateY, duration: 380, easing: "easeOutQuad"});
    });
    card.addEventListener("pointerleave", () => {
      if (!animeEngine) return;
      animeEngine({targets: card, rotateX: 0, rotateY: 0, duration: 720, easing: "easeOutElastic(1, .7)"});
    });
  });

  if (animeEngine && !isMotionCalm()) {
    const cardObserver = new IntersectionObserver((entries, observer) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      if (!entering.length) return;
      animeEngine({targets: entering, opacity: [0, 1], translateY: [32, 0], delay: animeEngine.stagger(90), duration: 720, easing: "cubicBezier(0.16, 1, 0.3, 1)"});
      entering.forEach((target) => observer.unobserve(target));
    }, {threshold: 0.18});
    document.querySelectorAll(".motion-card").forEach((card) => cardObserver.observe(card));
  }

  function createField(canvas, count) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let points = [];
    let raf = 0;

    function resize() {
      cancelAnimationFrame(raf);
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1.5, devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const actualCount = width < 700 ? Math.round(count * 0.58) : count;
      points = Array.from({ length: actualCount }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.11,
        vy: (Math.random() - 0.5) * 0.11,
        radius: index % 13 === 0 ? 2 : 0.7 + Math.random() * 0.7,
        spectral: index % 11 === 0,
      }));
      draw();
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        if (!isMotionCalm()) {
          point.x = (point.x + point.vx + width) % width;
          point.y = (point.y + point.vy + height) % height;
        }
        for (let next = index + 1; next < points.length; next += 1) {
          const target = points[next];
          const distance = Math.hypot(point.x - target.x, point.y - target.y);
          if (distance > 145) continue;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(target.x, target.y);
          context.strokeStyle = `rgba(151,207,242,${(1 - distance / 145) * 0.09})`;
          context.lineWidth = 0.65;
          context.stroke();
        }
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = point.spectral ? "rgba(196,181,253,.68)" : "rgba(125,211,252,.48)";
        context.fill();
      });
      if (!isMotionCalm() && !document.hidden) raf = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !isMotionCalm()) draw();
    });
    addEventListener("brace:motion", () => {
      cancelAnimationFrame(raf);
      draw();
    });
  }

  createField(document.querySelector("#memory-field"), 46);
  createField(document.querySelector("#download-field"), 34);
})();

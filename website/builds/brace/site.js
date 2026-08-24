(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const releaseBase = "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.3.0";
  const downloads = {
    windows: {
      url: `${releaseBase}/BRACE-Setup-0.3.0.exe`,
      platform: "Windows 10 / 11",
      format: ".exe installer",
    },
    linux: {
      url: `${releaseBase}/BRACE-0.3.0.AppImage`,
      platform: "Linux x86_64",
      format: "AppImage",
    },
    deb: {
      url: `${releaseBase}/brace-brain_0.3.0_amd64.deb`,
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
    const item = downloads[detected];
    document.querySelector(`[data-download="${detected}"]`)?.classList.add("is-recommended");
    const primary = document.querySelector("[data-primary-download]");
    if (primary) primary.href = item.url;
    document.querySelector("#detected-label").textContent = "RECOMMENDED FOR THIS DEVICE";
    document.querySelector("#primary-platform").textContent = item.platform;
    document.querySelector("#primary-format").textContent = item.format;
  } else {
    document.querySelector("#detected-label").textContent = "CHOOSE YOUR SYSTEM";
  }

  if (window.ScrollCraft) {
    window.ScrollCraft.mount(document.querySelector("main"), { lerp: 0.2 });
  }

  const navigationLinks = Array.from(document.querySelectorAll(".glass-rail nav a"));
  const navigationSections = navigationLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
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
  let lensInside = false;
  let lensInfluence = 0;
  let frameQueued = false;

  function progressOf(element) {
    return clamp(Number.parseFloat(getComputedStyle(element).getPropertyValue("--sc-p")) || 0);
  }

  function paintSpatialState() {
    frameQueued = false;
    const openingProgress = progressOf(openingAct);
    const split = clamp(50 - openingProgress * 36 + lensInfluence, 11, 57);
    splitStage.style.setProperty("--split", `${split.toFixed(2)}%`);
    splitStage.dataset.scVerifyState = `split:${Math.round(split)}:${lensInside ? "lens" : "idle"}`;

    const downloadProgress = progressOf(downloadAct);
    const downloadSplit = reduce.matches ? 0 : clamp(52 - downloadProgress * 52, 0, 52);
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

  const proofPosition = document.querySelector("#proof-position");
  const proofObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!visible) return;
    proofPosition.textContent = visible.target.querySelector("figcaption strong")?.textContent || "Product";
  }, { root: null, rootMargin: "0px -28%", threshold: [0.15, 0.45, 0.7] });
  document.querySelectorAll("[data-proof]").forEach((frame) => proofObserver.observe(frame));

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
        if (!reduce.matches) {
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
      if (!reduce.matches && !document.hidden) raf = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce.matches) draw();
    });
  }

  createField(document.querySelector("#memory-field"), 46);
  createField(document.querySelector("#download-field"), 34);
})();

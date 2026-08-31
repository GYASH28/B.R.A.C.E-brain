(() => {
  "use strict";

  const chapters = [...document.querySelectorAll("[data-ledger-chapter]")];
  const sections = chapters.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const readout = document.querySelector("[data-ledger-readout]");
  const progress = document.querySelector("[data-ledger-progress]");
  const seen = new Set(["opening-act"]);
  let activeId = "opening-act";

  const dismissOpeningOnIntent = () => {
    const opening = document.querySelector("#opening-film");
    if (!opening || !document.body.classList.contains("has-opening-film")) return;
    document.querySelector("[data-skip-opening]")?.click();
  };
  addEventListener("scroll", dismissOpeningOnIntent, { passive: true, once: true });
  addEventListener("wheel", dismissOpeningOnIntent, { passive: true, once: true });
  addEventListener("touchmove", dismissOpeningOnIntent, { passive: true, once: true });

  const renderLedger = () => {
    chapters.forEach((link) => {
      const id = link.getAttribute("href").slice(1);
      const isActive = id === activeId;
      link.toggleAttribute("aria-current", isActive);
      const status = link.querySelector(":scope > b");
      if (status) status.textContent = isActive ? "OPEN" : seen.has(id) ? "STAMPED" : "UNREAD";
    });
    const active = chapters.find((link) => link.getAttribute("href") === `#${activeId}`);
    if (readout && active) {
      const label = active.querySelector("span")?.textContent?.trim().replace(/\s+/g, " ") || "01 Memory";
      readout.textContent = `CHAPTER ${label.toUpperCase()}`;
    }
  };

  const updateProgress = () => {
    const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ratio = Math.min(1, Math.max(0, scrollY / range));
    if (progress) progress.style.transform = `scaleX(${ratio})`;
  };

  const updateChapterFromScroll = () => {
    const readingLine = innerHeight * .42;
    const containing = sections.find((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= readingLine && rect.bottom >= readingLine;
    });
    if (!containing?.id || containing.id === activeId) return;
    activeId = containing.id;
    seen.add(activeId);
    renderLedger();
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting && entry.target.id).forEach((entry) => seen.add(entry.target.id));
      updateChapterFromScroll();
      renderLedger();
    }, { rootMargin: "-24% 0px -48%", threshold: [0.05, 0.2, 0.5] });
    sections.forEach((section) => observer.observe(section));
  }

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateProgress();
      updateChapterFromScroll();
      ticking = false;
    });
  }, { passive: true });
  updateProgress();
  updateChapterFromScroll();
  renderLedger();

  const storageKey = "brace.website.saved-questions";
  const recallInput = document.querySelector("#recall-query");
  const recallForm = document.querySelector("#recall-form");
  const saveButton = document.querySelector("[data-save-query]");
  const savedRegion = document.querySelector("[data-saved-queries]");
  let saved = [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    saved = Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 6) : [];
  } catch {}

  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
  };

  const renderSaved = () => {
    if (!savedRegion) return;
    savedRegion.replaceChildren();
    if (!saved.length) {
      const empty = document.createElement("small");
      empty.textContent = "No pinned questions on this device.";
      savedRegion.append(empty);
      return;
    }
    saved.forEach((query) => {
      const item = document.createElement("span");
      const run = document.createElement("button");
      const remove = document.createElement("button");
      run.type = "button";
      run.textContent = query;
      run.title = `Run saved question: ${query}`;
      run.addEventListener("click", () => {
        if (recallInput) recallInput.value = query;
        recallForm?.requestSubmit();
      });
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove saved question: ${query}`);
      remove.addEventListener("click", () => {
        saved = saved.filter((itemQuery) => itemQuery !== query);
        persist();
        renderSaved();
      });
      item.append(run, remove);
      savedRegion.append(item);
    });
  };

  saveButton?.addEventListener("click", () => {
    const query = String(recallInput?.value || "").trim();
    if (!query) return;
    saved = [query, ...saved.filter((item) => item !== query)].slice(0, 6);
    persist();
    renderSaved();
    saveButton.textContent = "Pinned locally";
    window.setTimeout(() => { saveButton.textContent = "Pin this question"; }, 1400);
  });
  renderSaved();

  const rainCanvas = document.querySelector("[data-rain-glass]");
  const rainContext = rainCanvas?.getContext("2d");
  if (rainCanvas && rainContext) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = matchMedia("(max-width: 760px)").matches;
    let rainFrame = 0;
    let rainWidth = innerWidth;
    let rainHeight = innerHeight;
    let rainPointerX = -1_000;
    let rainPointerY = -1_000;
    let rainSeed = 701;
    const rainRandom = () => {
      rainSeed = (rainSeed * 9301 + 49297) % 233280;
      return rainSeed / 233280;
    };
    const drops = Array.from({ length: compact ? 30 : 72 }, () => ({
      x: rainRandom(), y: rainRandom(), radius: 1.4 + rainRandom() * 5.8,
      speed: .000018 + rainRandom() * .00006,
      drift: (rainRandom() - .5) * .000016,
      tail: 12 + rainRandom() * 58,
    }));
    const sizeRain = () => {
      const dpr = Math.min(devicePixelRatio || 1, compact ? 1 : 1.35);
      rainWidth = innerWidth;
      rainHeight = innerHeight;
      rainCanvas.width = Math.round(rainWidth * dpr);
      rainCanvas.height = Math.round(rainHeight * dpr);
      rainCanvas.style.width = `${rainWidth}px`;
      rainCanvas.style.height = `${rainHeight}px`;
      rainContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const drawRain = () => {
      rainContext.clearRect(0, 0, rainWidth, rainHeight);
      drops.forEach((drop) => {
        if (!reduced) {
          drop.y += drop.speed * 16;
          drop.x += drop.drift * 16;
          if (drop.y > 1.08) drop.y = -.08;
          if (drop.x < -.04) drop.x = 1.04;
          if (drop.x > 1.04) drop.x = -.04;
        }
        const x = drop.x * rainWidth;
        const y = drop.y * rainHeight;
        const proximity = Math.max(0, 1 - Math.hypot(x - rainPointerX, y - rainPointerY) / 250);
        const radius = drop.radius * (1 + proximity * .8);
        const lens = rainContext.createRadialGradient(x - radius * .4, y - radius * .5, .2, x, y, radius * 2.4);
        lens.addColorStop(0, `rgba(255,255,255,${.42 + proximity * .18})`);
        lens.addColorStop(.24, "rgba(255,255,255,.17)");
        lens.addColorStop(.65, "rgba(205,205,205,.05)");
        lens.addColorStop(1, "rgba(0,0,0,0)");
        rainContext.fillStyle = lens;
        rainContext.beginPath();
        rainContext.ellipse(x, y, radius * .8, radius * 1.4, .06, 0, Math.PI * 2);
        rainContext.fill();
        rainContext.strokeStyle = `rgba(255,255,255,${.11 + proximity * .14})`;
        rainContext.lineWidth = .65;
        rainContext.stroke();
        if (drop.radius < 3.1) {
          rainContext.beginPath();
          rainContext.moveTo(x, y - radius);
          rainContext.lineTo(x - .6, y - drop.tail);
          rainContext.strokeStyle = "rgba(255,255,255,.045)";
          rainContext.stroke();
        }
      });
      if (!reduced) rainFrame = requestAnimationFrame(drawRain);
    };
    sizeRain();
    drawRain();
    addEventListener("resize", sizeRain, { passive: true });
    addEventListener("pointermove", (event) => {
      rainPointerX = event.clientX;
      rainPointerY = event.clientY;
      document.documentElement.style.setProperty("--rain-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--rain-y", `${event.clientY}px`);
    }, { passive: true });
    addEventListener("pagehide", () => cancelAnimationFrame(rainFrame), { once: true });
  }

  if (matchMedia("(pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".recall-workbench,.constellation-lab,.vault-assembly,.proof-frame,.platform-download").forEach((surface) => {
      surface.classList.add("liquid-reactive");
      surface.addEventListener("pointermove", (event) => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty("--glass-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        surface.style.setProperty("--glass-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }, { passive: true });
    });
  }

  document.documentElement.dataset.braceFieldLedger = "ready";
})();

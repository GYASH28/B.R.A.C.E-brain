(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const by = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const steps = [
    ["install", "01"],
    ["workspace", "02"],
    ["source", "03"],
    ["first-memory", "04"],
    ["recall", "05"],
    ["connect", "06"],
    ["privacy", "07"],
  ];

  function labelSteps() {
    steps.forEach(([id, label]) => document.getElementById(id)?.setAttribute("data-step-label", label));
    document.getElementById("help")?.setAttribute("data-step-label", "?");
  }

  function installChapterDock() {
    if (by(".guide-chapter-dock")) return;
    const nav = document.createElement("nav");
    nav.className = "guide-chapter-dock";
    nav.setAttribute("aria-label", "Guide steps");
    steps.forEach(([id, label]) => {
      const anchor = document.createElement("a");
      anchor.href = `#${id}`;
      anchor.textContent = label;
      anchor.setAttribute("aria-label", `Step ${Number(label)} of ${steps.length}`);
      nav.append(anchor);
    });
    document.body.append(nav);

    const pill = document.createElement("div");
    pill.className = "guide-step-pill";
    pill.setAttribute("aria-hidden", "true");
    pill.innerHTML = `<b data-current-guide-step>01</b><span>OF 07 · INSTALL BRACE</span>`;
    document.body.append(pill);
  }

  function installSpotlights() {
    const targets = all(".launchpad, .guide-step, .trouble-finder");
    if (!finePointer.matches || reduceMotion.matches) return;
    targets.forEach((target) => {
      target.addEventListener("pointermove", (event) => {
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--spot-x", `${((event.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
        target.style.setProperty("--spot-y", `${((event.clientY - rect.top) / rect.height * 100).toFixed(1)}%`);
      }, { passive: true });
      target.addEventListener("pointerleave", () => {
        target.style.setProperty("--spot-x", "50%");
        target.style.setProperty("--spot-y", "50%");
      }, { passive: true });
    });
  }

  function installMagnets() {
    const targets = all(".bar-action, .guide-hero-actions a, [data-platform-download]");
    targets.forEach((target) => target.dataset.guideMagnet = "");
    if (!finePointer.matches || reduceMotion.matches) return;
    targets.forEach((target) => {
      target.addEventListener("pointermove", (event) => {
        const rect = target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        target.style.setProperty("--mag-x", `${(x * 8).toFixed(1)}px`);
        target.style.setProperty("--mag-y", `${(y * 6).toFixed(1)}px`);
      }, { passive: true });
      target.addEventListener("pointerleave", () => {
        target.style.setProperty("--mag-x", "0px");
        target.style.setProperty("--mag-y", "0px");
      }, { passive: true });
    });
  }

  function setupPointerDepth() {
    if (!finePointer.matches || reduceMotion.matches) return;
    let frame = 0;
    addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--guide-pointer-x", clamp(event.clientX / innerWidth).toFixed(4));
        root.style.setProperty("--guide-pointer-y", clamp(event.clientY / innerHeight).toFixed(4));
      });
    }, { passive: true });
  }

  function syncProgressCompletion() {
    const checked = new Set(all("[data-setup-check]:checked").map((input) => input.dataset.setupCheck));
    const map = {
      install: "install",
      workspace: "workspace",
      source: "source",
      "first-memory": "memory",
      recall: "recall",
      connect: "connect",
      privacy: "privacy",
    };
    all(".guide-toc nav a").forEach((link) => {
      const id = link.hash.replace("#", "");
      link.classList.toggle("is-complete", checked.has(map[id]));
    });
  }

  function setupCopyFeedback() {
    all(".copy-code").forEach((button) => {
      button.addEventListener("click", () => {
        button.dataset.copied = "true";
        const original = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = original;
          delete button.dataset.copied;
        }, 1200);
      });
    });
  }

  function setupScrollChoreography() {
    const hero = by(".guide-hero");
    const guideSteps = all(".guide-step");
    const shots = all(".guide-shot");
    const tocLinks = all(".guide-toc nav a");
    const dockLinks = all(".guide-chapter-dock a");
    const shortcutLinks = all(".guide-bar nav a");
    let ticking = false;

    const update = () => {
      ticking = false;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      root.style.setProperty("--guide-scroll", clamp(scrollY / scrollable).toFixed(4));

      if (hero && !reduceMotion.matches) {
        const rect = hero.getBoundingClientRect();
        const travel = Math.max(innerHeight * .8, hero.offsetHeight * .8);
        root.style.setProperty("--guide-hero-p", clamp(-rect.top / travel).toFixed(4));
      } else {
        root.style.setProperty("--guide-hero-p", "0");
      }

      guideSteps.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const enter = clamp((innerHeight * .88 - rect.top) / (innerHeight * .72));
        const exit = clamp((innerHeight * .18 - rect.top) / Math.max(innerHeight * .8, rect.height));
        section.style.setProperty("--step-progress", Math.max(.06, enter * (1 - exit * .22)).toFixed(4));
      });

      if (!reduceMotion.matches) {
        shots.forEach((shot) => {
          const rect = shot.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const p = clamp(1 - Math.abs(center - innerHeight / 2) / (innerHeight * .85));
          shot.style.setProperty("--shot-p", p.toFixed(4));
        });
      }

      const probe = innerHeight * .46;
      let active = "install";
      guideSteps.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) active = section.id;
        section.classList.toggle("is-active", section.id === active);
      });

      [...tocLinks, ...dockLinks, ...shortcutLinks].forEach((link) => {
        const selected = link.hash === `#${active}`;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      const stepIndex = Math.max(0, steps.findIndex(([id]) => id === active));
      const pill = by(".guide-step-pill");
      if (pill) {
        const label = steps[stepIndex]?.[1] || "01";
        const heading = document.querySelector(`#${active} .step-header p`)?.textContent || active;
        by("[data-current-guide-step]", pill).textContent = label;
        by("span", pill).textContent = `OF 07 · ${heading.trim().toUpperCase()}`;
      }
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestUpdate, { passive: true });
    update();
  }

  function init() {
    labelSteps();
    installChapterDock();
    installSpotlights();
    installMagnets();
    setupPointerDepth();
    setupCopyFeedback();
    setupScrollChoreography();
    syncProgressCompletion();
    all("[data-setup-check]").forEach((input) => input.addEventListener("change", syncProgressCompletion));
    by("[data-reset-progress]")?.addEventListener("click", () => requestAnimationFrame(syncProgressCompletion));
    root.dataset.scrollcraftGuideRuntime = "ready";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

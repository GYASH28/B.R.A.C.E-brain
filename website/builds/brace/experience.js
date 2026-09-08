(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const by = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const scenes = [
    ["story", "01 / THREAD"],
    ["provenance", "02 / RECEIPT"],
    ["atlas", "03 / BRAIN"],
    ["company", "04 / SCOPE"],
    ["product", "05 / PROOF"],
    ["trust", "06 / CUSTODY"],
    ["download", "07 / LOCAL"],
  ];

  function installSceneRail() {
    if (by(".scene-rail")) return;
    const rail = document.createElement("nav");
    rail.className = "scene-rail";
    rail.setAttribute("aria-label", "Experience chapters");
    scenes.forEach(([id, label]) => {
      if (!document.getElementById(id)) return;
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.setAttribute("aria-label", label.replace(" / ", ": "));
      const text = document.createElement("span");
      text.textContent = label;
      link.append(text);
      rail.append(link);
    });
    document.body.append(rail);
  }

  function installHeroOrbit() {
    const hero = by(".hero");
    if (!hero || by(".scroll-orbit", hero)) return;
    const orbit = document.createElement("div");
    orbit.className = "scroll-orbit";
    orbit.setAttribute("aria-hidden", "true");
    orbit.innerHTML = "<i></i><span>SCROLL / TRACE THE MEMORY</span>";
    hero.append(orbit);
  }

  function installVelocityBand() {
    const story = by(".story");
    if (!story || by(".scroll-velocity", story)) return;
    const band = document.createElement("div");
    band.className = "scroll-velocity";
    band.setAttribute("aria-hidden", "true");
    const track = document.createElement("div");
    track.className = "scroll-velocity__track";
    const phrases = [
      "SOURCE-BACKED MEMORY",
      "LOCAL BY DEFAULT",
      "EXPLICIT CONTEXT",
      "INSPECTABLE PROVENANCE",
      "ONE MEMORY / EVERY AI",
      "YOUR WORK REMEMBERS",
      "SOURCE-BACKED MEMORY",
      "LOCAL BY DEFAULT",
    ];
    phrases.forEach((phrase) => {
      const span = document.createElement("span");
      span.textContent = phrase;
      track.append(span);
    });
    band.append(track);
    story.append(band);
  }

  function installSpotlights() {
    const targets = all(".fragment, .company-surface, .proof, .download-platforms article");
    targets.forEach((target) => target.dataset.scSpotlight = "");
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
    const targets = all(".button--primary, .bar-download, .platform-primary, .platform-secondary");
    targets.forEach((target) => target.dataset.scMagnet = "");
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
        root.style.setProperty("--sc-pointer-x", clamp(event.clientX / innerWidth).toFixed(4));
        root.style.setProperty("--sc-pointer-y", clamp(event.clientY / innerHeight).toFixed(4));
      });
    }, { passive: true });
  }

  function setupScrollChoreography() {
    const hero = by(".hero");
    const velocity = by(".scroll-velocity__track");
    const proofs = all(".proof");
    const railLinks = all(".scene-rail a");
    let ticking = false;

    const update = () => {
      ticking = false;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const page = clamp(scrollY / scrollable);
      root.style.setProperty("--sc-progress", page.toFixed(4));

      if (hero && !reduceMotion.matches) {
        const rect = hero.getBoundingClientRect();
        const travel = Math.max(innerHeight * .86, hero.offsetHeight - innerHeight * .1);
        const progress = clamp(-rect.top / travel);
        root.style.setProperty("--sc-hero", progress.toFixed(4));
      } else {
        root.style.setProperty("--sc-hero", "0");
      }

      if (velocity && !reduceMotion.matches) {
        velocity.style.setProperty("--sc-velocity", String((scrollY * .16) % 520));
      }

      if (!reduceMotion.matches && innerWidth > 900) {
        proofs.forEach((proof, index) => {
          const rect = proof.getBoundingClientRect();
          const approach = clamp((innerHeight * .92 - rect.top) / (innerHeight * .9));
          const passed = clamp((innerHeight * .2 - rect.top) / (innerHeight * .55));
          const scale = 1 - passed * (.022 + index * .003);
          const rotate = passed * (-1.2 - index * .12);
          const y = (1 - approach) * 18;
          proof.style.setProperty("--stack-scale", scale.toFixed(4));
          proof.style.setProperty("--stack-rx", `${rotate.toFixed(2)}deg`);
          proof.style.setProperty("--stack-y", `${y.toFixed(1)}px`);
        });
      }

      const probe = innerHeight * .48;
      let active = "";
      scenes.forEach(([id]) => {
        const section = document.getElementById(id);
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) active = id;
      });
      railLinks.forEach((link) => {
        const selected = link.hash === `#${active}`;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
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

  function setupSectionTone() {
    if (!("IntersectionObserver" in window)) return;
    const sections = all("[data-act]");
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) root.dataset.scScene = visible.target.id;
    }, { threshold: [.2, .4, .6] });
    sections.forEach((section) => observer.observe(section));
  }

  function init() {
    installSceneRail();
    installHeroOrbit();
    installVelocityBand();
    installSpotlights();
    installMagnets();
    setupPointerDepth();
    setupScrollChoreography();
    setupSectionTone();
    root.dataset.scrollcraftRuntime = "ready";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

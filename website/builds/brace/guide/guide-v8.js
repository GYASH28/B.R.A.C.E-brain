(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = Array.from(document.querySelectorAll(".guide-step"));
  const heroWrap = document.querySelector(".guide-hero .guide-wrap");
  const route = document.querySelector(".guide-route");
  const coach = document.querySelector("[data-guide-live-coach]");
  const toc = document.querySelector(".guide-toc");

  if (!steps.length || !heroWrap || !route) return;
  root.dataset.braceGuidePremium = "v8";

  const stepNames = steps.map((step) => step.querySelector(".step-header h2")?.textContent?.trim() || step.id);

  const keepCoachInHero = () => {
    if (coach && coach.parentElement !== heroWrap) route.before(coach);
  };
  keepCoachInHero();
  addEventListener("resize", keepCoachInHero, {passive:true});

  /* ScrollCraft owns guide depth too. The document remains perfectly readable
     before this enhancement mounts. */
  heroWrap.setAttribute("data-sc-spotlight", "");
  steps.forEach((step) => {
    step.setAttribute("data-sc-act", "flow");
    const header = step.querySelector(".step-header");
    if (header) header.setAttribute("data-sc-parallax", "-0.018");
  });
  document.querySelectorAll(".guide-shot").forEach((shot) => shot.setAttribute("data-sc-tilt", "1.1"));
  document.querySelectorAll(".platform-grid>section,.feature-walkthrough>article").forEach((card) => card.setAttribute("data-sc-tilt", ".65"));

  if (window.ScrollCraft && root.dataset.braceGuideScrollcraft !== "mounted") {
    root.dataset.braceGuideScrollcraft = "mounted";
    window.ScrollCraft.mount(document.body, {lerp:.22});
  }

  document.querySelectorAll(".guide-shot img,.feature-walkthrough img").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
  });

  const featureWalkthrough = document.querySelector(".feature-walkthrough");
  if (featureWalkthrough) {
    featureWalkthrough.tabIndex = 0;
    featureWalkthrough.setAttribute("role", "region");
    featureWalkthrough.setAttribute("aria-label", "BRACE feature walkthrough. Use left and right arrow keys to browse on small screens.");
    featureWalkthrough.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || featureWalkthrough.scrollWidth <= featureWalkthrough.clientWidth + 2) return;
      event.preventDefault();
      const amount = Math.max(220, featureWalkthrough.clientWidth * .78) * (event.key === "ArrowRight" ? 1 : -1);
      featureWalkthrough.scrollBy({left:amount, behavior:reduce ? "auto" : "smooth"});
    });
  }

  const routeLinks = Array.from(route.querySelectorAll("a[href^='#']"));
  const tocLinks = Array.from(toc?.querySelectorAll("a[href^='#']") || []);

  steps.forEach((step, index) => {
    if (index >= steps.length - 1 || step.querySelector(":scope > .guide-step-next")) return;
    const next = steps[index + 1];
    const nextLabel = stepNames[index + 1];
    const block = document.createElement("div");
    block.className = "guide-step-next";
    block.innerHTML = `<span>Next step</span><a href="#${next.id}">${nextLabel}<b aria-hidden="true">→</b></a>`;
    step.append(block);
  });

  const dock = document.createElement("div");
  dock.className = "guide-mobile-dock";
  dock.setAttribute("aria-label", "Current guide step");
  dock.innerHTML = `<div><span data-guide-dock-title>${stepNames[0]}</span><small data-guide-dock-meta>Step 1 of ${steps.length}</small></div><a data-guide-dock-next href="#${steps[1]?.id || steps[0].id}">Next →</a>`;
  body.append(dock);
  const dockTitle = dock.querySelector("[data-guide-dock-title]");
  const dockMeta = dock.querySelector("[data-guide-dock-meta]");
  const dockNext = dock.querySelector("[data-guide-dock-next]");

  let activeIndex = 0;
  const setActive = (index) => {
    activeIndex = Math.max(0, Math.min(steps.length - 1, index));
    const active = steps[activeIndex];
    const next = steps[Math.min(activeIndex + 1, steps.length - 1)];
    routeLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.id}`)));
    tocLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.id}`)));
    if (dockTitle) dockTitle.textContent = stepNames[activeIndex];
    if (dockMeta) dockMeta.textContent = `Step ${activeIndex + 1} of ${steps.length}`;
    if (dockNext) {
      dockNext.href = `#${next.id}`;
      dockNext.textContent = activeIndex === steps.length - 1 ? "Top ↑" : "Next →";
      if (activeIndex === steps.length - 1) dockNext.href = "#guide-main";
    }
    root.style.setProperty("--guide-v8-active", String(activeIndex / Math.max(1, steps.length - 1)));

    const routeLink = routeLinks.find((link) => link.hash === `#${active.id}`);
    if (routeLink && innerWidth <= 860) {
      const targetLeft = routeLink.offsetLeft - (route.clientWidth - routeLink.offsetWidth) * .5;
      route.scrollTo({left:Math.max(0, targetLeft), behavior:reduce ? "auto" : "smooth"});
    }
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = steps.indexOf(visible.target);
    if (index >= 0 && index !== activeIndex) setActive(index);
  }, {rootMargin:"-18% 0px -63%",threshold:[0,.12,.32,.56]});
  steps.forEach((step) => observer.observe(step));
  setActive(0);

  route.addEventListener("keydown", (event) => {
    if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
    const current = routeLinks.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const nextIndex = (current + (event.key === "ArrowRight" ? 1 : -1) + routeLinks.length) % routeLinks.length;
    routeLinks[nextIndex].focus();
  });

  let ticking = false;
  const paint = () => {
    ticking = false;
    steps.forEach((step) => {
      const rect = step.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight) return;
      const p = Math.min(1, Math.max(0, (innerHeight - rect.top) / Math.max(innerHeight + rect.height, 1)));
      const header = step.querySelector(".step-header");
      if (header) header.style.setProperty("--guide-v8-header-shift", `${reduce ? 0 : ((p - .5) * -12).toFixed(1)}px`);
    });
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(paint);
  };
  addEventListener("scroll", schedule, {passive:true});
  addEventListener("resize", schedule, {passive:true});
  schedule();

  const seen = new Set();
  document.querySelectorAll("a[href]").forEach((link) => {
    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin !== location.origin || seen.has(url.pathname)) return;
    const warm = () => {
      if (seen.has(url.pathname)) return;
      seen.add(url.pathname);
      const prefetch = document.createElement("link");
      prefetch.rel = "prefetch";
      prefetch.href = url.pathname;
      document.head.append(prefetch);
    };
    link.addEventListener("pointerenter", warm, {once:true,passive:true});
    link.addEventListener("focus", warm, {once:true});
  });
})();

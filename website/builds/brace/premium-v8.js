(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  root.dataset.bracePremium = "v8";

  const getSections = () => [
    document.querySelector("#film"),
    document.querySelector("#story"),
    document.querySelector("[data-brace-live]"),
    document.querySelector("#product"),
    document.querySelector("#download"),
  ].filter(Boolean);

  const navLinks = Array.from(document.querySelectorAll(".site-bar nav a[href^='#']"));
  const siteBar = document.querySelector(".site-bar");
  const story = document.querySelector("#story");
  const storyCopy = story?.querySelector(".story-line h2");
  const relay = story?.querySelector(".memory-relay");

  let ticking = false;
  let lastY = scrollY;
  let velocity = 0;

  const sceneTone = (node) => {
    if (!node) return .12;
    if (node.id === "film") return .08;
    if (node.id === "story") return .16;
    if (node.matches?.("[data-brace-live]")) return .34;
    if (node.id === "product") return .44;
    if (node.id === "download") return .2;
    return .12;
  };

  const paint = () => {
    ticking = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty("--brace-v8-page-p", clamp(scrollY / maxScroll).toFixed(4));

    const delta = scrollY - lastY;
    velocity = velocity * .78 + clamp(delta / 54, -1, 1) * .22;
    root.style.setProperty("--brace-v8-velocity", Math.abs(velocity).toFixed(3));
    body.classList.toggle("is-v8-scroll-fast", Math.abs(velocity) > .26);
    lastY = scrollY;

    siteBar?.classList.toggle("is-v8-scrolled", scrollY > 32);

    let active = null;
    let nearest = Infinity;
    getSections().forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight) return;
      const distance = Math.abs((rect.top + rect.height * .5) - innerHeight * .5);
      if (distance < nearest) {
        nearest = distance;
        active = section;
      }
      const edge = clamp(1 - Math.abs(rect.top) / Math.max(innerHeight * .95, 1));
      section.style.setProperty("--brace-v8-edge", edge.toFixed(3));
    });
    root.style.setProperty("--brace-v8-scene-tone", sceneTone(active).toFixed(3));

    navLinks.forEach((link) => {
      const hash = link.hash;
      const current = active?.id && hash === `#${active.id}`;
      link.setAttribute("aria-current", current ? "true" : "false");
    });

    if (story) {
      const rect = story.getBoundingClientRect();
      const p = clamp((innerHeight - rect.top) / Math.max(innerHeight + rect.height, 1));
      const ambientShift = reduce ? 0 : (p - .5) * -52;
      const copyShift = reduce ? 0 : (p - .5) * -20;
      const relayShift = reduce ? 0 : (p - .5) * 26;
      story.style.setProperty("--brace-v8-story-shift", `${ambientShift.toFixed(1)}px`);
      storyCopy?.style.setProperty("--brace-v8-story-copy-shift", `${copyShift.toFixed(1)}px`);
      relay?.style.setProperty("--brace-v8-relay-shift", `${relayShift.toFixed(1)}px`);
    }
  };

  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(paint);
  };

  addEventListener("scroll", schedule, {passive:true});
  addEventListener("resize", schedule, {passive:true});
  schedule();

  if (fine && !reduce) {
    addEventListener("pointermove", (event) => {
      root.style.setProperty("--brace-v8-pointer-x", `${event.clientX}px`);
      root.style.setProperty("--brace-v8-pointer-y", `${event.clientY}px`);
    }, {passive:true});
  }

  const bindPressable = (node) => {
    if (!node || node.dataset.v8PressBound === "true") return;
    node.dataset.v8PressBound = "true";
    node.classList.add("v8-pressable");
    node.addEventListener("pointerdown", (event) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--v8-hit-x", `${clamp((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100}%`);
      node.style.setProperty("--v8-hit-y", `${clamp((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100}%`);
      node.classList.add("is-v8-hit");
    });
    ["pointerup","pointercancel","pointerleave"].forEach((type) => node.addEventListener(type, () => node.classList.remove("is-v8-hit")));
  };
  document.querySelectorAll("a,button").forEach(bindPressable);

  const bindArrowGroup = (nodes) => {
    if (nodes.length < 2) return;
    nodes.forEach((node, index) => {
      if (node.dataset.v8ArrowBound === "true") return;
      node.dataset.v8ArrowBound = "true";
      node.addEventListener("keydown", (event) => {
        if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
        const next = nodes[(index + (forward ? 1 : -1) + nodes.length) % nodes.length];
        next.focus();
        next.click();
      });
    });
  };
  bindArrowGroup(Array.from(document.querySelectorAll("[data-relay-step]")));

  const bindLivingGroup = () => {
    const modes = Array.from(document.querySelectorAll("[data-live-target]"));
    if (!modes.length) return false;
    bindArrowGroup(modes);
    modes.forEach(bindPressable);
    document.querySelectorAll("[data-brace-live] a,[data-brace-live] button").forEach(bindPressable);
    schedule();
    return true;
  };
  if (!bindLivingGroup()) {
    const observer = new MutationObserver(() => {
      if (bindLivingGroup()) observer.disconnect();
    });
    observer.observe(document.body, {childList:true,subtree:true});
  }

  /* The product rail is transformed by ScrollCraft rather than natively scrolled.
     Browser Tab navigation therefore cannot reveal an off-screen frame by itself.
     Synchronize keyboard focus to the same vertical timeline so focused controls
     are always visible, including the final guide handoff. */
  const productAct = document.querySelector("#product");
  const productFrames = Array.from(document.querySelectorAll(".product-rail [data-proof]"));
  const productPosition = document.querySelector("#proof-position");
  const alignProductFocus = (ratio, title) => {
    if (!productAct) return;
    const travel = Math.max(1, productAct.offsetHeight - innerHeight);
    const top = productAct.offsetTop + travel * clamp(ratio, 0, 1);
    scrollTo({top, behavior:"auto"});
    if (productPosition && title) productPosition.textContent = title;
    requestAnimationFrame(() => {
      if (Math.abs(scrollY - top) > 2) scrollTo({top, behavior:"auto"});
      schedule();
    });
  };
  productFrames.forEach((frame, index) => {
    frame.addEventListener("focusin", () => {
      const ratio = (index + 1) / (productFrames.length + 1);
      alignProductFocus(ratio, frame.dataset.proofTitle || "Product view");
    });
  });
  document.querySelector(".gallery-outro")?.addEventListener("focusin", () => alignProductFocus(.985, "Ready to build your own memory?"));

  const seen = new Set();
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
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

  document.querySelectorAll("img[src*='app-']").forEach((image, index) => {
    image.decoding = "async";
    if (index > 0) image.loading = "lazy";
  });

  document.addEventListener("visibilitychange", () => {
    body.classList.toggle("is-v8-hidden", document.hidden);
  });
})();

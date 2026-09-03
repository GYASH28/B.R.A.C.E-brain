(() => {
  "use strict";

  document.documentElement.dataset.braceGuideRefinement = "v10";
  if (!document.querySelector('link[href="refine-v10.css"]')) {
    const refinement = document.createElement("link");
    refinement.rel = "stylesheet";
    refinement.href = "refine-v10.css";
    document.head.append(refinement);
  }

  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.parentElement.querySelector("code")?.textContent || "";
      let copied = false;
      try {
        await navigator.clipboard.writeText(code.trim());
        copied = true;
      } catch {
        const codeNode = button.parentElement.querySelector("code");
        if (!codeNode) return;
        const range = document.createRange();
        range.selectNodeContents(codeNode);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copied = document.execCommand("copy");
        selection.removeAllRanges();
      }
      button.textContent = copied ? "Copied" : "Selected";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1800);
    });
  });

  const tocLinks = Array.from(document.querySelectorAll(".guide-toc a"));
  const stepObserver = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!active) return;
    tocLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.target.id}`)));
  }, { rootMargin: "-20% 0px -66%", threshold: [0, 0.15, 0.45] });
  document.querySelectorAll(".guide-step").forEach((section) => stepObserver.observe(section));

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = Array.from(document.querySelectorAll([
    ".guide-hero .guide-wrap",
    ".guide-toc",
    ".guide-step .step-header",
    ".guide-step > p",
    ".guide-shot",
    ".platform-grid > section",
    ".choice-list > li",
    ".shortcut-deck > p",
    ".instruction-list > li",
    ".feature-walkthrough > article",
    ".do-dont > div",
    ".permission-table",
    ".guide-step details"
  ].join(",")));

  document.documentElement.classList.add("guide-enhanced");
  revealTargets.forEach((target, index) => {
    target.setAttribute("data-soft-reveal", "");
    target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 45}ms`);
  });

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((target) => target.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9%", threshold: 0.08 });
    revealTargets.forEach((target) => revealObserver.observe(target));
  }

  const progress = document.createElement("div");
  progress.className = "guide-reading-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<i></i>";
  document.body.append(progress);

  const guideBar = document.querySelector(".guide-bar");
  let ticking = false;
  const updateScrollState = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    document.documentElement.style.setProperty("--guide-progress", String(Math.min(1, Math.max(0, scrollTop / maxScroll))));
    guideBar?.classList.toggle("is-scrolled", scrollTop > 20);
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollState);
  }, { passive: true });
  window.addEventListener("resize", updateScrollState, { passive: true });
  updateScrollState();

  const mountGuideEnhancements = () => {
    const livingGuide = document.createElement("script");
    livingGuide.src = "guide-v7.js";
    livingGuide.async = false;
    livingGuide.addEventListener("load", () => {
      const premiumGuide = document.createElement("script");
      premiumGuide.src = "guide-v8.js";
      premiumGuide.async = false;
      document.head.append(premiumGuide);
    }, {once:true});
    document.head.append(livingGuide);
  };

  if (window.ScrollCraft) {
    mountGuideEnhancements();
  } else {
    const motionRuntime = document.createElement("script");
    motionRuntime.src = "../motion.js";
    motionRuntime.async = false;
    motionRuntime.addEventListener("load", mountGuideEnhancements, {once:true});
    document.head.append(motionRuntime);
  }
})();
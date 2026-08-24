(() => {
  "use strict";

  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const acts = [];
  const reveals = [];
  const parallax = [];
  let scheduled = false;

  function actProgress(element) {
    const rect = element.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    if (element.dataset.scAct === "pin") {
      const travel = Math.max(1, element.offsetHeight - viewport);
      return clamp(-rect.top / travel);
    }
    return clamp((viewport - rect.top) / Math.max(1, rect.height + viewport));
  }

  function revealShape(direction, amount) {
    const hidden = `${(1 - amount) * 100}%`;
    if (direction === "right") return `inset(0 0 0 ${hidden})`;
    if (direction === "up") return `inset(${hidden} 0 0 0)`;
    if (direction === "down") return `inset(0 0 ${hidden} 0)`;
    if (direction === "iris") return `circle(${amount * 72}% at 50% 50%)`;
    return `inset(0 ${hidden} 0 0)`;
  }

  function paint() {
    scheduled = false;
    const pageTravel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    document.documentElement.style.setProperty("--brace-page-progress", String(clamp(window.scrollY / pageTravel)));

    for (const act of acts) {
      const progress = actProgress(act);
      act.style.setProperty("--sc-p", progress.toFixed(4));
    }

    for (const entry of reveals) {
      if (reduced.matches) {
        entry.element.style.clipPath = "none";
        continue;
      }
      const progress = actProgress(entry.act);
      const amount = clamp((progress - entry.from) / Math.max(0.001, entry.to - entry.from));
      entry.element.style.clipPath = revealShape(entry.direction, amount);
    }

    for (const entry of parallax) {
      if (reduced.matches) {
        entry.element.style.transform = "none";
        continue;
      }
      const progress = actProgress(entry.act);
      const offset = entry.rate * (progress - 0.5) * 100;
      entry.element.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    }
  }

  function requestPaint() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(paint);
  }

  function mount(root = document) {
    root.querySelectorAll("[data-sc-act]").forEach((act) => {
      if (act.dataset.scAct === "pin") {
        const span = Number.parseFloat(act.dataset.scSpan || "2");
        act.style.setProperty("--sc-span", String(Math.max(1.2, Number.isFinite(span) ? span : 2)));
      }
      acts.push(act);
    });

    const inObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("brace-in--visible");
        inObserver.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -9%", threshold: 0.08 });

    root.querySelectorAll("[data-sc-in]").forEach((element) => {
      const stagger = Number.parseFloat(element.dataset.scStagger || "0");
      if (stagger > 0) {
        Array.from(element.children).forEach((child, index) => {
          child.classList.add("brace-in-item");
          child.style.transitionDelay = `${Math.min(360, index * stagger)}ms`;
        });
      }
      inObserver.observe(element);
    });

    root.querySelectorAll("[data-sc-reveal]").forEach((element) => {
      const [rawFrom, rawTo] = String(element.dataset.scRevealAt || "0 1").split(/\s+/).map(Number);
      reveals.push({
        element,
        act: element.closest("[data-sc-act]") || element,
        direction: element.dataset.scReveal || "left",
        from: Number.isFinite(rawFrom) ? rawFrom : 0,
        to: Number.isFinite(rawTo) ? rawTo : 1,
      });
    });

    root.querySelectorAll("[data-sc-parallax]").forEach((element) => {
      const rate = Number.parseFloat(element.dataset.scParallax || "0");
      parallax.push({ element, act: element.closest("[data-sc-act]") || element, rate: Number.isFinite(rate) ? rate : 0 });
    });

    if (!reduced.matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      root.querySelectorAll("[data-sc-tilt]").forEach((element) => {
        const strength = clamp(Number.parseFloat(element.dataset.scTilt || "5"), 2, 9);
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        let active = false;
        const animate = () => {
          currentX += (targetX - currentX) * 0.16;
          currentY += (targetY - currentY) * 0.16;
          element.style.transform = `rotateX(${currentY.toFixed(2)}deg) rotateY(${currentX.toFixed(2)}deg)`;
          if (active || Math.abs(currentX) > 0.02 || Math.abs(currentY) > 0.02) requestAnimationFrame(animate);
        };
        element.addEventListener("pointerenter", () => { active = true; requestAnimationFrame(animate); });
        element.addEventListener("pointermove", (event) => {
          const rect = element.getBoundingClientRect();
          targetX = ((event.clientX - rect.left) / rect.width - 0.5) * strength;
          targetY = ((event.clientY - rect.top) / rect.height - 0.5) * -strength;
        });
        element.addEventListener("pointerleave", () => { active = false; targetX = 0; targetY = 0; });
      });
    }

    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", requestPaint, { passive: true });
    reduced.addEventListener("change", requestPaint);
    paint();
    document.documentElement.classList.add("sc-ready");
  }

  window.BraceMotion = { mount };
})();

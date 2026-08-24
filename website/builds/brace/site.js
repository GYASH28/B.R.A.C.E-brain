(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const releaseBase = "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.2.0";
  const downloads = {
    windows: `${releaseBase}/BRACE-Setup-0.2.0.exe`,
    linux: `${releaseBase}/BRACE-0.2.0.AppImage`,
    deb: `${releaseBase}/brace-brain_0.2.0_amd64.deb`,
  };

  document.querySelectorAll("[data-download]").forEach((link) => {
    link.href = downloads[link.dataset.download];
  });
  const platform = /Windows/i.test(navigator.userAgent) ? "windows" : /Linux/i.test(navigator.userAgent) ? "linux" : null;
  if (platform) {
    document.querySelector(`[data-download="${platform}"]`)?.classList.add("is-recommended");
    const primary = document.querySelector("[data-primary-download]");
    if (primary) primary.href = downloads[platform];
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

  const sections = ["experience", "boundary", "proof", "get-brace"];
  const navLinks = Array.from(document.querySelectorAll(".site-nav nav a[href^='#']"));
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${visible.target.id}`)));
  }, { rootMargin: "-32% 0px -52%", threshold: [0, 0.2, 0.6] });
  sections.forEach((id) => { const section = document.getElementById(id); if (section) sectionObserver.observe(section); });

  let framePending = false;
  function renderScroll() {
    framePending = false;
    const scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    document.documentElement.style.setProperty("--progress", String(clamp(scrollY / scrollRange)));
    document.querySelector(".site-nav")?.classList.toggle("is-scrolled", scrollY > 30);
    const hero = document.querySelector(".hero");
    const heroProduct = document.querySelector(".hero-product");
    if (hero && heroProduct) {
      const rect = hero.getBoundingClientRect();
      heroProduct.style.setProperty("--hero-p", String(clamp(-rect.top / Math.max(1, rect.height - innerHeight))));
    }
    const boundary = document.querySelector(".boundary");
    const device = document.querySelector(".boundary-device");
    if (boundary && device) {
      const rect = boundary.getBoundingClientRect();
      device.style.setProperty("--boundary-p", String(clamp((innerHeight - rect.top) / Math.max(1, innerHeight * 0.9))));
    }
  }
  function scheduleScroll() { if (!framePending) { framePending = true; requestAnimationFrame(renderScroll); } }
  addEventListener("scroll", scheduleScroll, { passive: true });
  addEventListener("resize", scheduleScroll, { passive: true });
  renderScroll();

  const recallEntries = [
    { type: "DURABLE DECISION", title: "Keep imported files canonical", copy: "BRACE indexes project context without editing or moving the original files.", source: "Architecture Decisions.md · lexical retrieval" },
    { type: "SOURCE EVIDENCE", title: "Local embedding policy", copy: "Semantic ranking can use a loopback Ollama endpoint. Lexical recall remains available without it.", source: "local-retrieval.md · lexical retrieval" },
    { type: "DURABLE LESSON", title: "Evaluate retrieval with named examples", copy: "Keep evaluation prompts and expected evidence next to the decision that introduced them.", source: "retrieval-evaluation.md · lexical retrieval" },
  ];
  document.querySelector("#recall-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.querySelector("#recall-query")?.value.toLowerCase() || "";
    const entry = value.includes("embed") ? recallEntries[1] : value.includes("evaluat") ? recallEntries[2] : recallEntries[0];
    const root = document.querySelector("#recall-result");
    root?.classList.add("is-refreshing");
    setTimeout(() => {
      root.querySelector("span").innerHTML = `<i></i> ${entry.type}`;
      root.querySelector("strong").textContent = entry.title;
      root.querySelector("p").textContent = entry.copy;
      root.querySelector("small").textContent = entry.source;
      root.classList.remove("is-refreshing");
    }, reducedMotion.matches ? 0 : 220);
  });

  const proof = {
    overview: ["assets/app-overview.png", "BRACE overview with synthetic Northstar data", "OVERVIEW · SYNTHETIC NORTHSTAR"],
    recall: ["assets/app-recall.png", "BRACE recall separating durable memories from source evidence", "RECALL · PROVENANCE VISIBLE"],
    graph: ["assets/app-graph.png", "BRACE interactive memory constellation", "CONSTELLATION · RELATIONSHIPS"],
    timeline: ["assets/app-timeline.png", "BRACE decision timeline", "TIMELINE · DECISIONS"],
    skills: ["assets/app-skills.png", "BRACE permission-scoped skills", "SKILLS · EXPLICIT PERMISSIONS"],
  };
  document.querySelectorAll("[data-shot]").forEach((button) => {
    button.addEventListener("click", () => {
      const data = proof[button.dataset.shot];
      if (!data) return;
      document.querySelectorAll("[data-shot]").forEach((item) => { item.classList.toggle("is-active", item === button); item.setAttribute("aria-pressed", String(item === button)); });
      const screen = document.querySelector(".proof-screen");
      screen.classList.add("is-changing");
      setTimeout(() => {
        const image = document.querySelector("#proof-image"); image.src = data[0]; image.alt = data[1];
        document.querySelector("#proof-title").textContent = data[2];
        screen.classList.remove("is-changing");
      }, reducedMotion.matches ? 0 : 240);
    });
  });

  const clientPositions = { Codex: "18%", Claude: "39%", Cursor: "61%", "Other MCP client": "82%" };
  document.querySelectorAll("[data-client]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-client]").forEach((item) => { item.classList.toggle("is-active", item === button); item.setAttribute("aria-pressed", String(item === button)); });
      const packet = document.querySelector(".packet"); packet.style.left = "91%"; packet.style.top = clientPositions[button.dataset.client];
      document.querySelector("#receipt-title").textContent = `Delivered to ${button.dataset.client}`;
      setTimeout(() => { packet.style.left = "12%"; packet.style.top = "50%"; }, reducedMotion.matches ? 0 : 1900);
    });
  });

  function createField(canvas, options = {}) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    let width = 0; let height = 0; let points = []; let raf = 0;
    const count = options.count || 42;
    function resize() {
      cancelAnimationFrame(raf);
      const rect = canvas.getBoundingClientRect(); const ratio = Math.min(1.5, devicePixelRatio || 1);
      width = rect.width; height = rect.height; canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio)); context.setTransform(ratio, 0, 0, ratio, 0, 0);
      points = Array.from({ length: width < 650 ? Math.round(count * .55) : count }, (_, index) => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .12, r: index % 11 === 0 ? 2.2 : .8 + Math.random() * .8, warm: index % 9 === 0 }));
      draw();
    }
    function draw() {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        if (!reducedMotion.matches) { point.x = (point.x + point.vx + width) % width; point.y = (point.y + point.vy + height) % height; }
        for (let next = index + 1; next < points.length; next += 1) {
          const other = points[next]; const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance > (options.distance || 145)) continue;
          context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.strokeStyle = `rgba(255,255,255,${(1 - distance / (options.distance || 145)) * .07})`; context.lineWidth = .6; context.stroke();
        }
        context.beginPath(); context.arc(point.x, point.y, point.r, 0, Math.PI * 2); context.fillStyle = point.warm ? "rgba(255,118,70,.68)" : "rgba(220,229,235,.3)"; context.fill();
      });
      if (!reducedMotion.matches) raf = requestAnimationFrame(draw);
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden && !reducedMotion.matches) draw(); });
  }
  createField(document.querySelector("#memory-field"), { count: 55, distance: 155 });
  createField(document.querySelector("#download-field"), { count: 38, distance: 175 });
})();

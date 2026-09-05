(() => {
  "use strict";
  const root = document.documentElement;
  root.dataset.braceGuideRuntime = "ready";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.parentElement.querySelector("code")?.textContent?.trim() || "";
      let copied = false;
      try { await navigator.clipboard.writeText(code); copied = true; }
      catch {
        const node = button.parentElement.querySelector("code");
        if (node) {
          const range = document.createRange(); range.selectNodeContents(node);
          const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
          copied = document.execCommand("copy"); selection.removeAllRanges();
        }
      }
      button.textContent = copied ? "Copied ✓" : "Selected";
      setTimeout(() => { button.textContent = "Copy"; }, 1600);
    });
  });

  const tocLinks = Array.from(document.querySelectorAll(".guide-toc nav a"));
  const sections = Array.from(document.querySelectorAll(".guide-step[id]"));
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      tocLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.target.id}`)));
    }, {rootMargin: "-18% 0px -67%", threshold: [0, .15, .4]});
    sections.forEach((section) => sectionObserver.observe(section));
  }

  const revealTargets = Array.from(document.querySelectorAll(".guide-hero-grid,.guide-route,.guide-step .step-header,.guide-step>p,.guide-shot,.platform-grid,.choice-list,.shortcut-deck,.instruction-list,.feature-walkthrough,.do-dont,.permission-table,.control-list,.location-list,.trouble-finder,.faq-list"));
  root.classList.add("guide-enhanced");
  revealTargets.forEach((target, index) => {
    target.setAttribute("data-soft-reveal", "");
    target.style.setProperty("--reveal-delay", `${(index % 3) * 45}ms`);
  });
  if (reduced || !("IntersectionObserver" in window)) revealTargets.forEach((target) => target.classList.add("is-visible"));
  else {
    const revealObserver = new IntersectionObserver((entries, observer) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible"); observer.unobserve(entry.target);
    }), {rootMargin: "0px 0px -8%", threshold: .07});
    revealTargets.forEach((target) => revealObserver.observe(target));
  }

  const guideBar = document.querySelector(".guide-bar");
  let scrollTick = false;
  const updateScroll = () => {
    const top = scrollY || document.documentElement.scrollTop;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty("--guide-progress", String(Math.min(1, Math.max(0, top / max))));
    guideBar?.classList.toggle("is-scrolled", top > 22);
    scrollTick = false;
  };
  addEventListener("scroll", () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(updateScroll); } }, {passive: true});
  addEventListener("resize", updateScroll, {passive: true});
  updateScroll();

  const platformData = {
    windows: {badge: "WINDOWS DETECTED", label: "WINDOWS 10 / 11 · X64", title: "Download the guided installer", command: "BRACE-Setup-0.7.0.exe", href: "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.7.0/BRACE-Setup-0.7.0.exe"},
    linux: {badge: "LINUX DETECTED", label: "LINUX · X86_64", title: "Choose AppImage or .deb", command: "chmod +x BRACE-0.7.0.AppImage", href: "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.7.0/BRACE-0.7.0.AppImage"},
    source: {badge: "DEVELOPER PATH", label: "NODE.JS 24+ · SOURCE", title: "Clone and verify the project", command: "git clone https://github.com/GYASH28/B.R.A.C.E-brain.git", href: "https://github.com/GYASH28/B.R.A.C.E-brain"},
  };
  const platformButtons = Array.from(document.querySelectorAll("[data-platform-choice]"));
  const renderPlatform = (id) => {
    const data = platformData[id]; if (!data) return;
    document.querySelector("[data-detected-platform]").textContent = data.badge;
    document.querySelector("[data-platform-label]").textContent = data.label;
    document.querySelector("[data-platform-title]").textContent = data.title;
    document.querySelector("[data-platform-command]").textContent = data.command;
    document.querySelector("[data-platform-download]").href = data.href;
    platformButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.platformChoice === id)));
  };
  platformButtons.forEach((button) => button.addEventListener("click", () => renderPlatform(button.dataset.platformChoice)));
  renderPlatform(/Windows/i.test(navigator.userAgent) ? "windows" : /Linux/i.test(navigator.userAgent) ? "linux" : "source");

  const progressKey = "brace-guide-setup-v2";
  const checkboxes = Array.from(document.querySelectorAll("[data-setup-check]"));
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(progressKey) || "{}"); } catch { saved = {}; }
  const renderProgress = () => {
    const complete = checkboxes.filter((checkbox) => checkbox.checked).length;
    document.querySelector("[data-progress-count]").textContent = String(complete);
    document.querySelector("[data-setup-progress]")?.style.setProperty("--setup-progress", String(complete / Math.max(1, checkboxes.length)));
  };
  checkboxes.forEach((checkbox) => {
    checkbox.checked = Boolean(saved[checkbox.dataset.setupCheck]);
    checkbox.addEventListener("change", () => {
      saved[checkbox.dataset.setupCheck] = checkbox.checked;
      try { localStorage.setItem(progressKey, JSON.stringify(saved)); } catch {}
      renderProgress();
    });
  });
  document.querySelector("[data-reset-progress]")?.addEventListener("click", () => {
    saved = {}; checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    try { localStorage.removeItem(progressKey); } catch {}
    renderProgress();
  });
  renderProgress();

  const troubleAnswers = {
    launch: ["Check the package and architecture first.", "Windows: verify the SHA-256 and review the unsigned-preview warning. Linux: make the AppImage executable, or use the amd64 .deb on Debian/Ubuntu."],
    file: ["Check whether the file was intentionally excluded.", "BRACE skips hidden, credential-like, binary, oversized, database, dependency, build, cache, and symlink content. Confirm the file is supported and inside the selected project root."],
    recall: ["Confirm the search mode and scope.", "Expand the time window and project filter. Lexical is the private default; semantic or hybrid ranking appears only when a working embedding adapter produced vectors."],
    connect: ["Start at Connections and verify the detected client.", "Use Recall only first, apply the generated MCP configuration, restart the AI client, then call brace_status. Do not enable write permission until read-only recall works."],
  };
  const troubleButtons = Array.from(document.querySelectorAll("[data-trouble]"));
  troubleButtons.forEach((button) => button.addEventListener("click", () => {
    const [title, detail] = troubleAnswers[button.dataset.trouble];
    troubleButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    const output = document.querySelector("[data-trouble-output]");
    output.querySelector("strong").textContent = title; output.querySelector("span").textContent = detail;
  }));

  const canvas = document.querySelector("[data-guide-signal]");
  const context = canvas?.getContext("2d");
  if (canvas && context && !reduced) {
    let width = 0, height = 0, frame = 0;
    const nodes = Array.from({length: innerWidth < 700 ? 18 : 36}, (_, index) => ({x: ((index * 83) % 991) / 991, y: ((index * 173) % 983) / 983, r: 1 + index % 2, speed: .000014 + index % 5 * .000004}));
    const size = () => { const dpr = Math.min(devicePixelRatio || 1, 1.3); width = innerWidth; height = innerHeight; canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; context.setTransform(dpr, 0, 0, dpr, 0, 0); };
    let lastFrameAt = 0;
    const draw = (frameAt = 0) => { frame=requestAnimationFrame(draw); if(frameAt-lastFrameAt<40)return; lastFrameAt=frameAt; context.clearRect(0,0,width,height); nodes.forEach((node) => { node.y = (node.y + node.speed) % 1.04; context.beginPath(); context.arc(node.x * width,node.y * height,node.r,0,Math.PI*2); context.fillStyle="rgba(255,255,255,.42)"; context.fill(); }); };
    size(); draw(); addEventListener("resize",size,{passive:true}); addEventListener("pagehide",()=>cancelAnimationFrame(frame),{once:true});
  }
})();

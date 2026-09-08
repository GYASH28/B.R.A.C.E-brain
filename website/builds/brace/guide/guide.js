(() => {
  "use strict";

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const by = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const platformData = {
    windows: { badge: "WINDOWS DETECTED", label: "WINDOWS 10 / 11 · X64", title: "Download the guided installer", command: "BRACE-Setup-0.7.0.exe", href: "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.7.0/BRACE-Setup-0.7.0.exe" },
    linux: { badge: "LINUX DETECTED", label: "LINUX · X86_64", title: "Choose AppImage or .deb", command: "chmod +x BRACE-0.7.0.AppImage", href: "https://github.com/GYASH28/B.R.A.C.E-brain/releases/download/v0.7.0/BRACE-0.7.0.AppImage" },
    source: { badge: "DEVELOPER PATH", label: "NODE.JS 24+ · SOURCE", title: "Clone and verify the project", command: "git clone https://github.com/GYASH28/B.R.A.C.E-brain.git", href: "https://github.com/GYASH28/B.R.A.C.E-brain" },
  };

  const troubleAnswers = {
    launch: ["Check the package and architecture first.", "Windows: verify the SHA-256 and review the unsigned-preview warning. Linux: make the AppImage executable, or use the amd64 .deb on Debian or Ubuntu."],
    file: ["Check whether the file was intentionally excluded.", "BRACE skips hidden, credential-like, binary, oversized, database, dependency, build, cache, and symlink content. Confirm the file is supported and inside the selected project root."],
    recall: ["Confirm the search mode and scope.", "Expand the time window and project filter. Lexical is the private default. Semantic or hybrid ranking appears only when a working embedding adapter produced vectors."],
    connect: ["Start at Connections and verify the detected client.", "Use Recall only first, apply the MCP configuration, restart the AI client, then call brace_status. Do not enable write permission until read-only recall works."],
  };

  function setupCopy() {
    all(".copy-code").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = by("code", button.parentElement)?.textContent?.trim() || "";
        let copied = false;
        try {
          await navigator.clipboard.writeText(code);
          copied = true;
        } catch {
          const node = by("code", button.parentElement);
          if (node) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            copied = document.execCommand("copy");
            selection.removeAllRanges();
          }
        }
        button.textContent = copied ? "Copied" : "Selected";
        window.setTimeout(() => { button.textContent = "Copy"; }, 1500);
      });
    });
  }

  function setupPlatform() {
    const buttons = all("[data-platform-choice]");
    const render = (id) => {
      const data = platformData[id];
      if (!data) return;
      by("[data-detected-platform]").textContent = data.badge;
      by("[data-platform-label]").textContent = data.label;
      by("[data-platform-title]").textContent = data.title;
      by("[data-platform-command]").textContent = data.command;
      by("[data-platform-download]").href = data.href;
      buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.platformChoice === id)));
    };
    buttons.forEach((button) => button.addEventListener("click", () => render(button.dataset.platformChoice)));
    render(/Windows/i.test(navigator.userAgent) ? "windows" : /Linux/i.test(navigator.userAgent) ? "linux" : "source");
  }

  function setupProgress() {
    const progressKey = "brace-guide-setup-v3";
    const checkboxes = all("[data-setup-check]");
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(progressKey) || "{}"); } catch { saved = {}; }

    const render = () => {
      const complete = checkboxes.filter((checkbox) => checkbox.checked).length;
      by("[data-progress-count]").textContent = String(complete);
      by("[data-setup-progress]")?.style.setProperty("--setup-progress", String(complete / Math.max(1, checkboxes.length)));
    };
    checkboxes.forEach((checkbox) => {
      checkbox.checked = Boolean(saved[checkbox.dataset.setupCheck]);
      checkbox.addEventListener("change", () => {
        saved[checkbox.dataset.setupCheck] = checkbox.checked;
        try { localStorage.setItem(progressKey, JSON.stringify(saved)); } catch {}
        render();
      });
    });
    by("[data-reset-progress]")?.addEventListener("click", () => {
      saved = {};
      checkboxes.forEach((checkbox) => { checkbox.checked = false; });
      try { localStorage.removeItem(progressKey); } catch {}
      render();
    });
    render();
  }

  function setupTroubleshooter() {
    const buttons = all("[data-trouble]");
    const output = by("[data-trouble-output]");
    const search = by("[data-trouble-search]");
    const details = all("[data-help-text]");

    const showAnswer = (key) => {
      const answer = troubleAnswers[key];
      if (!answer) return;
      by("strong", output).textContent = answer[0];
      by("span", output).textContent = answer[1];
      buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.trouble === key)));
    };

    buttons.forEach((button) => button.addEventListener("click", () => showAnswer(button.dataset.trouble)));
    search?.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      details.forEach((item) => { item.hidden = Boolean(query) && !`${item.dataset.helpText} ${item.textContent}`.toLowerCase().includes(query); });
      if (!query) return;
      const key = /connect|mcp|client|ai/.test(query) ? "connect" : /file|import|missing/.test(query) ? "file" : /recall|search|lexical|semantic/.test(query) ? "recall" : /launch|open|start|install/.test(query) ? "launch" : "";
      if (key) showAnswer(key);
      else {
        by("strong", output).textContent = "No exact quick diagnosis yet.";
        by("span", output).textContent = "Review the matching questions below, or open the full troubleshooting guide from the project repository.";
        buttons.forEach((button) => button.setAttribute("aria-pressed", "false"));
      }
    });
  }

  function setupReading() {
    const tocLinks = all(".guide-toc nav a");
    const sections = all(".guide-step[id]");
    const bar = by("[data-guide-bar]");
    let ticking = false;

    const update = () => {
      ticking = false;
      const top = scrollY || document.documentElement.scrollTop;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      root.style.setProperty("--guide-progress", String(Math.min(1, Math.max(0, top / max))));
      bar?.classList.toggle("is-scrolled", top > 22);
    };
    const requestUpdate = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestUpdate, { passive: true });
    update();

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!active) return;
        tocLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.target.id}`)));
      }, { rootMargin: "-17% 0px -68%", threshold: [0, .15, .4] });
      sections.forEach((section) => observer.observe(section));
    }

    const reveals = all(".guide-hero-grid,.guide-step .step-header,.step-lede,.platform-rows,.choice-lines,.boundary-list,.instruction-list,.shortcut-line,.guide-shot,.permission-table,.control-list,.location-list,.trouble-finder,.faq-list,.glossary");
    if (reduced || !("IntersectionObserver" in window)) return reveals.forEach((target) => target.classList.add("is-visible"));
    root.classList.add("guide-enhanced");
    reveals.forEach((target, index) => {
      target.setAttribute("data-soft-reveal", "");
      target.style.setProperty("--reveal-delay", `${(index % 3) * 35}ms`);
    });
    const revealObserver = new IntersectionObserver((entries, observer) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { rootMargin: "0px 0px -7%", threshold: .06 });
    reveals.forEach((target) => revealObserver.observe(target));
  }

  function init() {
    setupCopy();
    setupPlatform();
    setupProgress();
    setupTroubleshooter();
    setupReading();
    root.dataset.braceGuideRuntime = "ready";
  }

  const boot = () => requestAnimationFrame(() => requestAnimationFrame(init));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();

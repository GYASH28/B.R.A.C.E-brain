(() => {
  "use strict";

  const memories = [
    {
      type: "DURABLE MEMORY",
      mode: "decision",
      title: "Keep imported files canonical",
      summary: "BRACE indexes project context without editing or moving the original files.",
      uri: "brace-project://northstar-docs/architecture-decisions.md",
      terms: ["canonical", "source", "files", "architecture", "decision"],
    },
    {
      type: "SOURCE EVIDENCE",
      mode: "source",
      title: "Architecture Decisions",
      summary: "The project directory remains the source of truth. The local index is disposable and rebuildable.",
      uri: "brace-project://northstar-docs/architecture-decisions.md#source-ownership",
      terms: ["canonical", "source", "files", "architecture", "ownership"],
    },
    {
      type: "DURABLE MEMORY",
      mode: "lesson",
      title: "Evaluate retrieval with named examples",
      summary: "Keep evaluation prompts and expected evidence next to the decision that introduced them.",
      uri: "brace-project://northstar-docs/retrieval-evaluation.md",
      terms: ["retrieval", "evaluation", "examples", "evidence"],
    },
    {
      type: "SOURCE EVIDENCE",
      mode: "source",
      title: "Local embedding policy",
      summary: "Use a loopback Ollama endpoint when semantic ranking is enabled. Lexical recall remains available without it.",
      uri: "brace-project://northstar-docs/local-retrieval.md",
      terms: ["local", "embeddings", "ollama", "semantic", "lexical"],
    },
  ];

  const proofShots = {
    overview: {
      src: "assets/app-overview.png",
      alt: "BRACE Overview screen using synthetic Northstar data",
      title: "Overview",
      copy: "Local memory health, recent durable context, and source coverage in one operational view.",
    },
    recall: {
      src: "assets/app-recall.png",
      alt: "BRACE Recall screen separating memories from source evidence",
      title: "Recall",
      copy: "Durable memory and project evidence stay visibly separate, with the retrieval mode reported.",
    },
    timeline: {
      src: "assets/app-timeline.png",
      alt: "BRACE Timeline screen showing a synthetic decision",
      title: "Timeline",
      copy: "Decisions become first-class events instead of disappearing inside a chat transcript.",
    },
    graph: {
      src: "assets/app-graph.png",
      alt: "BRACE knowledge graph showing synthetic projects, memories, sources, and entities",
      title: "Graph",
      copy: "Projects, sources, memories, decisions, and extracted entities remain distinct and traceable.",
    },
    skills: {
      src: "assets/app-skills.png",
      alt: "BRACE Skills screen showing declarative permissions and integrity controls",
      title: "Skills",
      copy: "Declarative extensions install disabled, declare permissions, and fail closed after tampering.",
    },
  };

  const resultRoot = document.querySelector("#recall-results");
  const queryInput = document.querySelector("#recall-query");
  const statusCopy = document.querySelector("#recall-status-copy");
  const recallStage = document.querySelector(".recall-stage");
  const handoffStage = document.querySelector(".handoff-stage");
  const packet = document.querySelector("#memory-packet");
  let activeClient = "Codex";
  let lastRecallPhase = "";
  let lastHandoffPhase = "";

  function escapeMarkup(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function searchMemories(query) {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return memories.slice(0, 3);
    const ranked = memories
      .map((memory) => ({
        memory,
        score: words.reduce((score, word) => {
          const haystack = `${memory.title} ${memory.summary} ${memory.terms.join(" ")}`.toLowerCase();
          return score + (haystack.includes(word) ? 1 : 0);
        }, 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
    return (ranked.length ? ranked : memories).slice(0, 3).map((entry) => entry.memory || entry);
  }

  function renderResults(query) {
    const results = searchMemories(query);
    resultRoot.innerHTML = results.map((result) => `
      <article class="result-card ${result.mode === "source" ? "result-card--source" : ""}">
        <div class="result-type"><span>${escapeMarkup(result.type)}</span><span>${escapeMarkup(result.mode)}</span></div>
        <h3>${escapeMarkup(result.title)}</h3>
        <p>${escapeMarkup(result.summary)}</p>
        <span class="result-uri">${escapeMarkup(result.uri)}</span>
      </article>
    `).join("");
    statusCopy.textContent = `${results.length} local records considered. Lexical retrieval.`;
  }

  document.querySelector("#recall-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderResults(queryInput.value);
    recallStage.dataset.phase = "verified";
    recallStage.dataset.scVerifyState = `verified:${queryInput.value.trim().toLowerCase() || "all"}`;
  });

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      queryInput.value = button.dataset.query;
      renderResults(button.dataset.query);
      queryInput.focus();
    });
  });

  document.querySelectorAll(".rail-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".rail-item").forEach((item) => item.classList.remove("is-current"));
      button.classList.add("is-current");
      const query = button.textContent.trim().toLowerCase();
      if (query !== "recall") {
        queryInput.value = query;
        renderResults(query);
      }
    });
  });

  document.querySelectorAll(".boundary-row").forEach((row) => {
    row.addEventListener("click", () => {
      row.setAttribute("aria-expanded", row.getAttribute("aria-expanded") === "true" ? "false" : "true");
    });
  });

  function selectClient(button) {
    document.querySelectorAll(".client-button").forEach((client) => {
      const selected = client === button;
      client.classList.toggle("is-active", selected);
      client.setAttribute("aria-pressed", String(selected));
    });
    activeClient = button.dataset.client;
    document.querySelector("#receipt-copy").textContent = `Ready for ${activeClient} over read-only MCP.`;
    updateHandoff(true);
  }

  document.querySelectorAll(".client-button").forEach((button) => {
    button.addEventListener("click", () => selectClient(button));
  });

  function selectProof(button, focus = false) {
    const key = button.dataset.shot;
    const shot = proofShots[key];
    if (!shot) return;
    document.querySelectorAll("[data-shot]").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab === button));
      tab.tabIndex = tab === button ? 0 : -1;
    });
    const image = document.querySelector("#proof-image");
    image.src = shot.src;
    image.alt = shot.alt;
    document.querySelector("#proof-caption-title").textContent = shot.title;
    document.querySelector("#proof-caption-copy").textContent = shot.copy;
    document.querySelector("#proof-panel").setAttribute("aria-labelledby", button.id);
    if (focus) button.focus();
  }

  const proofTabs = Array.from(document.querySelectorAll("[data-shot]"));
  proofTabs.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener("click", () => selectProof(button));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + proofTabs.length) % proofTabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % proofTabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = proofTabs.length - 1;
      selectProof(proofTabs[next], true);
    });
  });

  document.querySelector("#command-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = document.querySelector("#install-command").value;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const input = document.querySelector("#install-command");
      input.select();
      copied = document.execCommand("copy");
    }
    document.querySelector("#copy-command").textContent = copied ? "Copied" : "Select command";
    document.querySelector("#copy-status").textContent = copied
      ? "Clone command copied. The beginner guide covers the next steps."
      : "Copy the selected command, then follow the beginner guide.";
  });

  function progressFor(element) {
    const raw = getComputedStyle(element).getPropertyValue("--sc-p");
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  function updateRecall() {
    if (!recallStage) return;
    const act = recallStage.closest("[data-sc-act]");
    const progress = progressFor(act);
    const phase = progress < 0.2 ? "ready" : progress < 0.48 ? "query" : progress < 0.78 ? "results" : "verified";
    if (phase !== lastRecallPhase) {
      recallStage.dataset.phase = phase;
      recallStage.dataset.scVerifyState = `${phase}:${phase === "verified" ? "provenance-visible" : "surface"}`;
      lastRecallPhase = phase;
    }
  }

  function updateHandoff(force = false) {
    if (!handoffStage) return;
    const act = handoffStage.closest("[data-sc-act]");
    const progress = progressFor(act);
    const phase = progress < 0.2 ? "source" : progress < 0.43 ? "memory" : progress < 0.69 ? "evidence" : "delivered";
    const phaseLabels = {
      source: "SOURCE SELECTED",
      memory: "MEMORY RESOLVED",
      evidence: "EVIDENCE ATTACHED",
      delivered: "HANDOFF COMPLETE",
    };
    const order = ["source", "memory", "evidence"];
    const activeIndex = { source: 0, memory: 1, evidence: 2, delivered: 3 }[phase];
    handoffStage.dataset.phase = phase;
    handoffStage.dataset.scVerifyState = `${phase}:${activeClient.toLowerCase().replaceAll(" ", "-")}`;
    document.querySelector("#handoff-phase").textContent = phaseLabels[phase];
    order.forEach((name, index) => {
      const node = document.querySelector(`[data-handoff-node="${name}"]`);
      node.classList.toggle("is-complete", index < activeIndex);
      node.classList.toggle("is-active", index === activeIndex || (phase === "delivered" && name === "evidence"));
    });

    const pathStart = 10;
    const pathEnd = 90.5;
    const travel = Math.max(0, Math.min(1, (progress - 0.12) / 0.76));
    const targetIndex = Array.from(document.querySelectorAll(".client-button")).findIndex((button) => button.classList.contains("is-active"));
    const targetY = [20.8, 40.3, 59.7, 79.2][Math.max(0, targetIndex)] || 20.8;
    const packetY = travel < 0.78 ? 50 : 50 + (targetY - 50) * ((travel - 0.78) / 0.22);
    packet.style.left = `${pathStart + (pathEnd - pathStart) * travel}%`;
    packet.style.top = `${packetY}%`;
    packet.style.opacity = String(Math.min(1, Math.max(0, (progress - 0.08) * 8)));

    const delivered = phase === "delivered";
    document.querySelector("#receipt-title").textContent = delivered
      ? `Delivered to ${activeClient} with provenance intact`
      : "Waiting for the evidence packet";
    document.querySelector("#receipt-detail").textContent = delivered
      ? "Read-only MCP returned the memory, source URI, and retrieval mode."
      : "The source URI remains attached throughout the handoff.";
    if (force || phase !== lastHandoffPhase) lastHandoffPhase = phase;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    recallStage?.setAttribute("data-sc-verify-hold", "true");
    handoffStage?.setAttribute("data-sc-verify-hold", "true");
    recallStage.dataset.phase = "verified";
    handoffStage.dataset.phase = "delivered";
    document.querySelectorAll("[data-handoff-node]").forEach((node) => node.classList.add("is-complete"));
    document.querySelector("#handoff-phase").textContent = "HANDOFF COMPLETE";
    document.querySelector("#receipt-title").textContent = `Delivered to ${activeClient} with provenance intact`;
    document.querySelector("#receipt-detail").textContent = "Read-only MCP returned the memory, source URI, and retrieval mode.";
  }

  let frameRequested = false;
  function scheduleSurfaceUpdate() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      if (!reducedMotion) {
        updateRecall();
        updateHandoff();
      }
    });
  }

  const navLinks = Array.from(document.querySelectorAll("[data-site-nav]"));
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.setAttribute("aria-current", String(link.getAttribute("href") === `#${visible.target.id}`)));
  }, { rootMargin: "-38% 0px -46%", threshold: [0, 0.2, 0.6] });
  document.querySelectorAll("#recall, #boundary, #handoff, #proof").forEach((section) => sectionObserver.observe(section));

  renderResults(queryInput.value);
  window.addEventListener("scroll", scheduleSurfaceUpdate, { passive: true });
  window.addEventListener("resize", scheduleSurfaceUpdate, { passive: true });
  BraceMotion.mount(document.body);
  scheduleSurfaceUpdate();
})();

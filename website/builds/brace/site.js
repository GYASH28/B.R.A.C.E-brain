(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  const sourceStories = {
    document: {
      title: "Architecture decision recovered",
      source: "Architecture Decisions.md",
      memory: "Keep the source adapter read-only",
      scope: "Private · selected context only",
      summary: "Architecture Decisions.md connects to a local BRACE memory, then to explicitly selected AI context.",
    },
    meeting: {
      title: "Launch decision recovered",
      source: "Launch review · Tuesday",
      memory: "Ship the graph before expanding connectors",
      scope: "Project · selected context only",
      summary: "The Launch review connects to a project decision in local BRACE memory, then to explicitly selected AI context.",
    },
    decision: {
      title: "Provider boundary recovered",
      source: "API boundary decision",
      memory: "Preview context before provider handoff",
      scope: "Private · approved provider",
      summary: "The API boundary decision connects to a provider-scope memory, then to explicitly selected AI context.",
    },
  };

  const brainStories = {
    roadmap: { title: "Product roadmap", kind: "Source", summary: "The working plan for graph scale, local retrieval, connectors, and business governance.", source: "Northstar roadmap.md", owner: "Product team", scope: "Project", updated: "Today, 08:15" },
    architecture: { title: "Architecture Decisions.md", kind: "Source", summary: "Canonical source for local-first storage, adapter boundaries, and explicit provider handoff.", source: "Selected project file", owner: "Maya Chen", scope: "Private workspace", updated: "Today, 09:42" },
    decision: { title: "Graph-first workspace", kind: "Memory", summary: "Make the graph the central workspace and keep evidence visible beside every relationship.", source: "Architecture Decisions.md", owner: "Maya Chen", scope: "Private workspace", updated: "Today, 09:42" },
    launch: { title: "Launch decision", kind: "Decision", summary: "Qualify the graph and website experience before broadening the connector surface.", source: "Launch review", owner: "Maya Chen", scope: "Northstar team", updated: "Yesterday, 16:20" },
    maya: { title: "Maya Chen", kind: "Person", summary: "Owner of the graph-first launch decision and the corresponding verification work.", source: "Project directory", owner: "Northstar", scope: "Organization", updated: "Yesterday, 16:20" },
    boundary: { title: "Provider boundary", kind: "Memory", summary: "Only selected context crosses from local memory into a configured compatible AI client.", source: "Provider data flow.md", owner: "Security team", scope: "Organization policy", updated: "Monday, 11:05" },
    review: { title: "Launch review", kind: "Source", summary: "Meeting record containing the release decision, owners, constraints, and follow-up work.", source: "Meeting note", owner: "Maya Chen", scope: "Northstar team", updated: "Yesterday, 16:20" },
  };

  const roleStories = {
    employee: {
      title: "Your work, decisions, and learning stay connected.",
      copy: "Capture project outcomes, retrieve them with citations, and choose what becomes team knowledge.",
      items: ["Private and assigned work memory", "Permission-aware project recall", "Review before any external action"],
    },
    manager: {
      title: "Decisions, blockers, and ownership share one trace.",
      copy: "See team commitments and stale decisions through declared work context, never covert activity monitoring.",
      items: ["Decision and meeting follow-through", "Evidence-backed blocker context", "Approval gates for automations"],
    },
    executive: {
      title: "Strategy stays connected to the evidence beneath it.",
      copy: "Trace initiatives, risks, assumptions, and decisions back to current sources before acting on a roll-up.",
      items: ["What changed since the last review", "Cited strategic and risk briefs", "Owners, assumptions, and confidence"],
    },
    admin: {
      title: "Govern the boundary without reading private memory.",
      copy: "Manage identity, policy, connectors, retention, recovery, and audit controls with least-privilege defaults.",
      items: ["Workspace and role administration", "Provider and connector boundaries", "Recovery and audit operations"],
    },
  };

  const by = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  let introTimer = 0;
  let introGeneration = 0;

  function finishIntro(generation = introGeneration) {
    if (generation !== introGeneration) return;
    if (introTimer) window.clearTimeout(introTimer);
    introTimer = 0;
    root.dataset.intro = "complete";
  }

  function runIntro() {
    const generation = ++introGeneration;
    if (introTimer) window.clearTimeout(introTimer);
    introTimer = 0;
    root.dataset.intro = reduceMotion.matches ? "complete" : "running";
    if (reduceMotion.matches) return;
    introTimer = window.setTimeout(() => finishIntro(generation), 1450);
  }

  function replayIntro() {
    if (reduceMotion.matches) return finishIntro();
    if (introTimer) window.clearTimeout(introTimer);
    introTimer = 0;
    ++introGeneration;
    root.dataset.intro = "pending";
    requestAnimationFrame(() => requestAnimationFrame(runIntro));
    selectSource(all("[data-source]").find((button) => button.classList.contains("is-active"))?.dataset.source || "document", true);
  }

  function selectSource(key, replay = false) {
    const story = sourceStories[key];
    const atlas = by("[data-hero-atlas]");
    const receipt = by("[data-evidence-receipt]");
    if (!story || !atlas || !receipt) return;

    all("[data-source]").forEach((button) => {
      const active = button.dataset.source === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    receipt.classList.add("is-updating");
    atlas.removeAttribute("data-active");
    requestAnimationFrame(() => {
      atlas.dataset.active = key;
      by("[data-receipt-title]").textContent = story.title;
      by("[data-receipt-source]").textContent = story.source;
      by("[data-receipt-memory]").textContent = story.memory;
      by("[data-receipt-scope]").textContent = story.scope;
      by("[data-route-summary]").textContent = story.summary;
      window.setTimeout(() => receipt.classList.remove("is-updating"), reduceMotion.matches ? 0 : 180);
    });

    if (!replay) atlas.dataset.lastInput = "manual";
  }

  function setupHero() {
    all("[data-source]").forEach((button) => button.addEventListener("click", () => selectSource(button.dataset.source)));
    by("[data-replay-pulse]")?.addEventListener("click", () => {
      const key = by("[data-source].is-active")?.dataset.source || "document";
      selectSource(key, true);
    });
    by("[data-replay-opening]")?.addEventListener("click", replayIntro);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.dataset.intro === "running") finishIntro();
    });
    document.addEventListener("pointerdown", () => {
      if (root.dataset.intro === "running") finishIntro();
    }, { once: true, passive: true });
    document.addEventListener("wheel", () => {
      if (root.dataset.intro === "running") finishIntro();
    }, { once: true, passive: true });

    const atlas = by("[data-hero-atlas]");
    if (atlas && finePointer.matches && !reduceMotion.matches) {
      let frame = 0;
      atlas.addEventListener("pointermove", (event) => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = atlas.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - .5;
          const y = (event.clientY - rect.top) / rect.height - .5;
          const layers = all(".atlas-depth", atlas);
          if (layers[0]) { layers[0].style.setProperty("--px", `${x * 5}px`); layers[0].style.setProperty("--py", `${y * 4}px`); }
          if (layers[1]) { layers[1].style.setProperty("--px", `${x * 11}px`); layers[1].style.setProperty("--py", `${y * 8}px`); }
        });
      });
      atlas.addEventListener("pointerleave", () => all(".atlas-depth", atlas).forEach((layer) => {
        layer.style.setProperty("--px", "0px");
        layer.style.setProperty("--py", "0px");
      }));
    }
  }

  function setupScrollSystems() {
    const bar = by("[data-site-bar]");
    const progress = by("[data-page-progress]");
    const routeLinks = all("[data-route]");
    const sections = all("[data-act]");
    let ticking = false;

    const update = () => {
      ticking = false;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const pageProgress = Math.min(1, Math.max(0, scrollY / scrollable));
      progress?.style.setProperty("--progress", pageProgress.toFixed(4));
      bar?.classList.toggle("is-scrolled", scrollY > 22);

      const probe = innerHeight * .43;
      let active = "";
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) active = section.id;
      }
      routeLinks.forEach((link) => {
        const selected = link.dataset.route === active;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      const brain = by("[data-brain-stage]");
      const brainAct = by("#atlas");
      if (brain && brainAct) {
        const rect = brainAct.getBoundingClientRect();
        const travel = Math.max(1, rect.height - innerHeight);
        const state = Math.min(1, Math.max(0, -rect.top / travel));
        brain.style.setProperty("--brain-p", state.toFixed(3));
        brain.dataset.scVerifyState = `brain:${by('[data-brain-filter][aria-pressed="true"]')?.dataset.brainFilter || "all"}:${by(".brain-node.is-selected")?.dataset.node || "none"}:${Math.round(state * 10)}`;
      }
    };

    const requestUpdate = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestUpdate, { passive: true });
    update();

    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      body.classList.add("motion-ready");
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -9%", threshold: .08 });
      all(".reveal").forEach((node) => observer.observe(node));
    } else {
      all(".reveal").forEach((node) => node.classList.add("is-visible"));
    }
  }

  function setupBrain() {
    const stage = by("[data-brain-stage]");
    const nodes = all("[data-node]");
    const search = by("[data-brain-search]");
    const empty = by("[data-brain-empty]");
    if (!stage || !nodes.length) return;

    let activeFilter = "all";
    let selectedNode = "decision";

    const updateInspector = (key) => {
      const story = brainStories[key];
      if (!story) return;
      selectedNode = key;
      nodes.forEach((node) => node.classList.toggle("is-selected", node.dataset.node === key));
      by("[data-brain-title]").textContent = story.title;
      by("[data-brain-kind]").textContent = story.kind;
      by("[data-brain-summary]").textContent = story.summary;
      by("[data-brain-source]").textContent = story.source;
      by("[data-brain-owner]").textContent = story.owner;
      by("[data-brain-scope]").textContent = story.scope;
      by("[data-brain-updated]").textContent = story.updated;
      by("[data-brain-status]").textContent = `${nodes.filter((node) => !node.classList.contains("is-muted")).length} items · ${story.title} selected`;
      all("[data-link]").forEach((path, index) => {
        path.classList.toggle("is-active", index === nodes.findIndex((node) => node.dataset.node === key) % all("[data-link]").length);
      });
    };

    const applyVisibility = () => {
      const query = (search?.value || "").trim().toLowerCase();
      let visible = 0;
      nodes.forEach((node) => {
        const story = brainStories[node.dataset.node];
        const matchesFilter = activeFilter === "all" || node.dataset.kind === activeFilter;
        const matchesQuery = !query || `${story.title} ${story.kind} ${story.summary} ${story.source} ${story.owner}`.toLowerCase().includes(query);
        const muted = !matchesFilter || !matchesQuery;
        node.classList.toggle("is-muted", muted);
        node.tabIndex = muted ? -1 : 0;
        if (!muted) visible += 1;
      });
      empty.hidden = visible > 0;
      all("[data-link]").forEach((path) => path.classList.toggle("is-muted", visible < nodes.length));
      by("[data-brain-status]").textContent = visible ? `${visible} items · ${brainStories[selectedNode].title} selected` : "No matching items";
      stage.dataset.scVerifyState = `brain:${activeFilter}:${selectedNode}:${query || "none"}`;
    };

    nodes.forEach((node) => node.addEventListener("click", () => updateInspector(node.dataset.node)));
    all("[data-brain-filter]").forEach((button) => button.addEventListener("click", () => {
      activeFilter = button.dataset.brainFilter;
      all("[data-brain-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      applyVisibility();
    }));
    search?.addEventListener("input", applyVisibility);
    by("[data-brain-fit]")?.addEventListener("click", () => {
      all("[data-brain-filter]").find((button) => button.dataset.brainFilter === "all")?.click();
      if (search) search.value = "";
      applyVisibility();
      by("[data-brain-status]").textContent = "7 items · Graph fitted to the visible workspace";
    });
    by("[data-brain-reset]")?.addEventListener("click", () => {
      if (search) search.value = "";
      all("[data-brain-filter]").find((button) => button.dataset.brainFilter === "all")?.click();
      updateInspector("decision");
    });
    by("[data-brain-follow]")?.addEventListener("click", () => {
      const links = all("[data-link]");
      links.forEach((path) => path.classList.remove("is-active"));
      const indexes = selectedNode === "decision" ? [0, 2, 5] : [1, 4, 6];
      indexes.forEach((index) => links[index]?.classList.add("is-active"));
      by("[data-brain-status]").textContent = `Evidence path highlighted for ${brainStories[selectedNode].title}`;
    });

    const fullscreenButton = by("[data-brain-fullscreen]");
    const syncFullscreen = () => {
      const open = document.fullscreenElement === stage || stage.classList.contains("is-fullscreen-fallback");
      fullscreenButton?.setAttribute("aria-pressed", String(open));
      const label = fullscreenButton && by("span", fullscreenButton);
      if (label) label.textContent = open ? "Exit full screen" : "Full screen";
    };
    fullscreenButton?.addEventListener("click", async () => {
      try {
        if (stage.classList.contains("is-fullscreen-fallback")) stage.classList.remove("is-fullscreen-fallback");
        else if (document.fullscreenElement) await document.exitFullscreen();
        else if (stage.requestFullscreen) await stage.requestFullscreen();
        else stage.classList.toggle("is-fullscreen-fallback");
      } catch {
        stage.classList.toggle("is-fullscreen-fallback");
      }
      syncFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && stage.classList.contains("is-fullscreen-fallback")) {
        stage.classList.remove("is-fullscreen-fallback");
        syncFullscreen();
        fullscreenButton?.focus();
      }
    });
  }

  function setupRoles() {
    const surface = by("[data-company-surface]");
    const tabs = all("[data-role]");
    if (!surface || !tabs.length) return;

    const selectRole = (tab, focus = false) => {
      const story = roleStories[tab.dataset.role];
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
      });
      surface.dataset.role = tab.dataset.role;
      by("[data-role-title]").textContent = story.title;
      by("[data-role-copy]").textContent = story.copy;
      const list = by("[data-role-list]");
      list.replaceChildren(...story.items.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }));
      by("#role-panel").setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectRole(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        selectRole(tabs[next], true);
      });
    });
    selectRole(tabs[0]);
  }

  function setupProof() {
    const dialog = by("#proof-dialog");
    const frames = all("[data-proof]");
    if (!dialog || !frames.length) return;
    let active = 0;

    const render = () => {
      const frame = frames[active];
      by("#proof-dialog-title").textContent = frame.dataset.proofTitle;
      const image = by("#proof-dialog-image");
      image.src = frame.dataset.proofImage;
      image.alt = `Expanded ${frame.dataset.proofTitle} screenshot using synthetic Northstar data`;
    };
    const open = (index) => {
      active = index;
      render();
      dialog.showModal();
    };
    frames.forEach((frame, index) => by("[data-proof-expand]", frame)?.addEventListener("click", () => open(index)));
    by("[data-dialog-close]")?.addEventListener("click", () => dialog.close());
    by("[data-lightbox-prev]")?.addEventListener("click", () => { active = (active - 1 + frames.length) % frames.length; render(); });
    by("[data-lightbox-next]")?.addEventListener("click", () => { active = (active + 1) % frames.length; render(); });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  function setupPlatform() {
    const platform = /windows/i.test(navigator.userAgent) ? "windows" : /linux/i.test(navigator.userAgent) ? "linux" : "";
    all("[data-platform-card]").forEach((card) => card.classList.toggle("is-detected", card.dataset.platformCard === platform));
  }

  function init() {
    setupHero();
    setupScrollSystems();
    setupBrain();
    setupRoles();
    setupProof();
    setupPlatform();
    selectSource("document", true);
    runIntro();
    root.dataset.braceRuntime = "ready";
  }

  const boot = () => requestAnimationFrame(() => requestAnimationFrame(init));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();

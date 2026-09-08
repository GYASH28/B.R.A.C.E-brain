(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const by = (s, p = document) => p.querySelector(s);
  const all = (s, p = document) => [...p.querySelectorAll(s)];

  const pageProgress = by('[data-page-progress]');
  const nav = by('[data-site-nav]');
  const hero = by('[data-hero]');
  const opening = by('[data-opening-film]');
  const openingVideo = by('[data-opening-video]');
  const openingStage = by('[data-opening-stage]');
  const side = by('[data-side-scroll]');
  const sideRail = by('[data-side-rail]');
  const sideMeter = by('[data-side-meter]');
  const brainPeak = by('[data-brain-peak]');
  let raf = 0;

  function clamp(n, a = 0, b = 1) { return Math.min(b, Math.max(a, n)); }
  function localProgress(el) {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const travel = Math.max(1, rect.height - innerHeight);
    return clamp(-rect.top / travel);
  }

  function setOpeningCopy(p) {
    all('[data-opening-copy]').forEach((node, index) => {
      const centers = [.15, .5, .84];
      const d = Math.abs(p - centers[index]);
      const o = clamp(1 - d / .18);
      const y = (p - centers[index]) * -80;
      node.style.setProperty('--copy-o', o.toFixed(3));
      node.style.setProperty('--copy-y', `${y.toFixed(1)}px`);
    });
  }

  function updateScroll() {
    raf = 0;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - innerHeight);
    const p = clamp(scrollY / max);
    pageProgress?.style.setProperty('--p', p.toFixed(4));
    nav?.classList.toggle('is-scrolled', scrollY > 20);

    if (opening && openingStage && !reduceMotion.matches) {
      const op = localProgress(opening);
      setOpeningCopy(op);
      if (openingVideo && openingVideo.duration && Number.isFinite(openingVideo.duration)) {
        const target = openingVideo.duration * clamp(op * 1.02);
        if (Math.abs(openingVideo.currentTime - target) > .035) {
          try { openingVideo.currentTime = target; } catch (_) {}
        }
      }
      openingStage.style.setProperty('--video-opacity', String(.75 + op * .2));
    }

    if (hero) {
      const r = hero.getBoundingClientRect();
      const hp = clamp((-r.top) / Math.max(1, r.height - innerHeight * .45));
      hero.style.setProperty('--hero-p', hp.toFixed(4));
    }

    if (side && sideRail && innerWidth > 700) {
      const sp = localProgress(side);
      side.style.setProperty('--side-p', sp.toFixed(4));
      sideMeter?.style.setProperty('--side-p', sp.toFixed(4));
      const viewport = by('.side-viewport', side);
      const available = Math.max(0, sideRail.scrollWidth - (viewport?.clientWidth || innerWidth));
      sideRail.style.setProperty('--side-x', `${(-available * sp).toFixed(1)}px`);
      all('[data-side-panel]', side).forEach((panel, i) => {
        const center = i / Math.max(1, all('[data-side-panel]', side).length - 1);
        const d = Math.abs(sp - center);
        panel.style.setProperty('--panel-y', `${Math.min(26, d * 34).toFixed(1)}px`);
        panel.style.setProperty('--panel-s', `${(1 - Math.min(.035, d * .04)).toFixed(4)}`);
      });
    }

    if (brainPeak) {
      const rect = brainPeak.getBoundingClientRect();
      const bp = clamp((innerHeight - rect.top) / (rect.height + innerHeight));
      brainPeak.style.setProperty('--brain-p', bp.toFixed(4));
    }
  }

  function requestUpdate() {
    if (!raf) raf = requestAnimationFrame(updateScroll);
  }

  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate, { passive: true });

  function configureOpeningVideo() {
    if (!openingVideo) return;
    const source = by('source', openingVideo);
    if (!source) return;
    const next = innerWidth <= 700 ? source.dataset.mobileSrc : source.dataset.desktopSrc;
    if (next && source.getAttribute('src') !== next) {
      source.setAttribute('src', next);
      openingVideo.load();
    }
    openingVideo.muted = true;
    openingVideo.playsInline = true;
    openingVideo.addEventListener('loadedmetadata', requestUpdate, { once: true });
  }

  configureOpeningVideo();
  addEventListener('resize', configureOpeningVideo, { passive: true });

  by('[data-replay-opening]')?.addEventListener('click', () => {
    if (!opening) return;
    const y = scrollY + opening.getBoundingClientRect().top;
    scrollTo({ top: y, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });

  if (hero && finePointer.matches && !reduceMotion.matches) {
    let pointerRaf = 0;
    hero.addEventListener('pointermove', (event) => {
      if (pointerRaf) cancelAnimationFrame(pointerRaf);
      pointerRaf = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / rect.width);
        const y = clamp((event.clientY - rect.top) / rect.height);
        hero.style.setProperty('--mx', x.toFixed(3));
        hero.style.setProperty('--my', y.toFixed(3));
        hero.style.setProperty('--hx', `${((x - .5) * -14).toFixed(1)}px`);
        hero.style.setProperty('--hy', `${((y - .5) * -10).toFixed(1)}px`);
      });
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mx', '.5');
      hero.style.setProperty('--my', '.5');
      hero.style.setProperty('--hx', '0px');
      hero.style.setProperty('--hy', '0px');
    });
  }

  const chat = by('[data-live-chat]');
  const stream = by('[data-chat-stream]');
  const state = by('[data-chat-state]');
  const form = by('[data-chat-form]');
  const input = by('[data-chat-input]');
  const announcer = by('[data-chat-announcer]');

  const scripts = [
    { q: 'What did we decide about provider access?', a: 'Keep provider handoff explicit and preview the context first.', source: 'Architecture Decisions.md' },
    { q: 'Why did we delay broader connectors?', a: 'The launch review says to qualify the graph and memory experience before expanding the connector surface.', source: 'Launch review' },
    { q: 'Can my AI see everything?', a: 'No. Start read-only. BRACE exposes only selected context through the permission boundary you enable.', source: 'Connections' },
    { q: 'What changed in the project this week?', a: 'The graph-first workspace became the primary product direction, with evidence visible beside every relationship.', source: 'Northstar roadmap.md' },
    { q: 'Show me the source for that memory.', a: 'Architecture Decisions.md → “Keep the source adapter read-only.” The memory remains linked to its canonical source.', source: 'Architecture Decisions.md' },
    { q: 'What do I need to remember before release?', a: 'Unsigned preview, verify checksums, and keep backups encrypted. Those release limits remain explicit.', source: 'Release notes 0.7.0' },
  ];

  let chatIndex = 1;
  let chatTimer = 0;
  let chatBusy = false;

  function scrollChat() {
    if (stream) stream.scrollTo({ top: stream.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  function userMessage(text) {
    const el = document.createElement('article');
    el.className = 'message message--user';
    const p = document.createElement('p'); p.textContent = text; el.appendChild(p);
    stream?.appendChild(el); scrollChat();
  }

  function braceMessage(text, source) {
    const el = document.createElement('article');
    el.className = 'message message--brace';
    const p = document.createElement('p'); p.textContent = text;
    const footer = document.createElement('footer');
    const s = document.createElement('span'); s.textContent = source;
    const b = document.createElement('b'); b.textContent = 'verified';
    footer.append(s, b); el.append(p, footer); stream?.appendChild(el); scrollChat();
  }

  function typing(show) {
    by('.typing', stream)?.remove();
    if (!show || !stream) return;
    const el = document.createElement('span');
    el.className = 'typing'; el.innerHTML = '<i></i><i></i><i></i>';
    stream.appendChild(el); scrollChat();
  }

  function trimChat() {
    if (!stream) return;
    const messages = all('.message', stream);
    while (messages.length > 8) messages.shift()?.remove();
  }

  function runScript(item, manual = false) {
    if (!item || chatBusy || !stream) return;
    chatBusy = true;
    state && (state.textContent = 'LISTENING');
    userMessage(item.q);
    setTimeout(() => {
      typing(true); state && (state.textContent = 'RECALLING');
      setTimeout(() => {
        typing(false); braceMessage(item.a, item.source); trimChat();
        state && (state.textContent = 'READY');
        announcer && (announcer.textContent = `BRACE recalled: ${item.a}`);
        chatBusy = false;
        if (!manual) scheduleChat();
      }, reduceMotion.matches ? 120 : 900);
    }, reduceMotion.matches ? 80 : 430);
  }

  function scheduleChat() {
    clearTimeout(chatTimer);
    chatTimer = setTimeout(() => {
      if (!document.hidden && !chatBusy) {
        runScript(scripts[chatIndex % scripts.length]);
        chatIndex += 1;
      } else scheduleChat();
    }, 3600);
  }

  all('[data-chat-prompt]').forEach((button) => button.addEventListener('click', () => {
    const map = { decision: scripts[1], source: scripts[4], scope: scripts[2] };
    clearTimeout(chatTimer); runScript(map[button.dataset.chatPrompt], true); scheduleChat();
  }));

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input?.value.trim();
    if (!text || chatBusy) return;
    input.value = '';
    const lower = text.toLowerCase();
    const item = lower.includes('source') ? { q: text, a: scripts[4].a, source: scripts[4].source }
      : lower.includes('see') || lower.includes('access') || lower.includes('scope') ? { q: text, a: scripts[2].a, source: scripts[2].source }
      : lower.includes('release') ? { q: text, a: scripts[5].a, source: scripts[5].source }
      : { q: text, a: 'I found related local context. In the real app, BRACE would return the matching memory and its evidence instead of inventing an answer.', source: 'Local memory demo' };
    clearTimeout(chatTimer); runScript(item, true); scheduleChat();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(chatTimer); else scheduleChat();
  });
  scheduleChat();

  const brainStories = {
    source: { kind: 'SOURCE', title: 'Architecture Decisions.md', copy: 'Canonical source for the provider boundary and local-first adapter rules.', source: 'Selected project file', scope: 'Private workspace' },
    memory: { kind: 'MEMORY', title: 'Graph-first workspace', copy: 'Make the graph the central workspace and keep evidence visible beside every relationship.', source: 'Architecture Decisions.md', scope: 'Private workspace' },
    evidence: { kind: 'EVIDENCE', title: 'Provider boundary receipt', copy: 'The retained memory still points back to the exact source that justified it.', source: 'Provider data flow.md', scope: 'Selected context' },
  };

  all('[data-brain-hotspot]').forEach((button) => button.addEventListener('click', () => {
    const story = brainStories[button.dataset.brainHotspot];
    if (!story) return;
    all('[data-brain-hotspot]').forEach((node) => node.classList.toggle('is-active', node === button));
    by('[data-brain-kind]') && (by('[data-brain-kind]').textContent = story.kind);
    by('[data-brain-title]') && (by('[data-brain-title]').textContent = story.title);
    by('[data-brain-copy]') && (by('[data-brain-copy]').textContent = story.copy);
    by('[data-brain-source]') && (by('[data-brain-source]').textContent = story.source);
    by('[data-brain-scope]') && (by('[data-brain-scope]').textContent = story.scope);
  }));

  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-in-view');
    }), { threshold: .15 });
    all('.side-panel,.principle-lines article,.download-actions a').forEach((el) => observer.observe(el));
  }

  requestUpdate();
})();
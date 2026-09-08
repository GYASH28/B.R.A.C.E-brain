(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const by = (s, scope=document) => scope.querySelector(s);
  const all = (s, scope=document) => [...scope.querySelectorAll(s)];
  const clamp = (v,min=0,max=1) => Math.max(min,Math.min(max,v));
  let raf = 0;

  const updateScroll = () => {
    raf = 0;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const pageP = clamp(scrollY / scrollable);
    root.style.setProperty('--page-p', pageP.toFixed(4));
    by('[data-site-nav]')?.classList.toggle('is-scrolled', scrollY > 28);

    const hero = by('[data-hero]');
    if (hero) {
      const r = hero.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height));
      root.style.setProperty('--hero-p', p.toFixed(4));
    }

    const side = by('[data-side-scroll]');
    const rail = by('[data-side-rail]');
    if (side && rail && innerWidth > 700) {
      const r = side.getBoundingClientRect();
      const travel = Math.max(1, side.offsetHeight - innerHeight);
      const p = clamp(-r.top / travel);
      const maxX = Math.max(0, rail.scrollWidth - (innerWidth - Math.min(innerWidth * .29, 450)) + innerWidth * .03);
      rail.style.setProperty('--side-x', (maxX * p).toFixed(2));
      rail.style.setProperty('--side-p', p.toFixed(4));
      by('[data-side-meter]')?.style.setProperty('--side-p', p.toFixed(4));
    }

    const brain = by('[data-brain-peak]');
    if (brain) {
      const r = brain.getBoundingClientRect();
      const p = clamp((innerHeight - r.top) / Math.max(1, innerHeight + r.height));
      brain.style.setProperty('--brain-p', p.toFixed(4));
    }
    updateOpening(false);
  };
  const requestScroll = () => { if (!raf) raf = requestAnimationFrame(updateScroll); };

  function setupOpening() {
    const film = by('[data-opening-film]');
    const video = by('[data-opening-video]');
    if (!film || !video) return;
    const source = video.querySelector('source');
    if (source && !reduceMotion.matches) {
      source.src = innerWidth <= 700 ? source.dataset.mobileSrc : source.dataset.desktopSrc;
      video.load();
      video.addEventListener('loadedmetadata', () => {
        video.classList.add('is-ready');
        updateOpening(true);
      }, {once:true});
    }
    by('[data-replay-opening]')?.addEventListener('click', () => {
      film.scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth'});
    });
  }

  function updateOpening(force) {
    const film = by('[data-opening-film]');
    const stage = by('[data-opening-stage]');
    const video = by('[data-opening-video]');
    if (!film || !stage) return;
    if (reduceMotion.matches) {
      document.body.classList.remove('opening-active');
      return;
    }
    const r = film.getBoundingClientRect();
    const travel = Math.max(1, film.offsetHeight - innerHeight);
    const p = clamp(-r.top / travel);
    stage.style.setProperty('--opening-p', p.toFixed(4));
    document.body.classList.toggle('opening-active', r.bottom > 0 && p < .94);
    const scene = p < .31 ? 0 : p < .68 ? 1 : 2;
    all('[data-opening-copy]', stage).forEach((node, i) => node.classList.toggle('is-active', i === scene));
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      const target = Math.min(video.duration - .04, p * video.duration);
      if (force || Math.abs(video.currentTime - target) > .045) {
        try { video.currentTime = target; } catch (_) {}
      }
    }
  }

  const chatScenarios = [
    {key:'decision', user:'What did we decide about provider access?', answer:'Keep provider handoff explicit and preview the context first.', source:'Architecture Decisions.md', badge:'verified'},
    {key:'source', user:'Where did that launch decision come from?', answer:'The launch review says to qualify the graph before expanding connectors.', source:'Launch review · Tuesday', badge:'source linked'},
    {key:'scope', user:'What can my connected AI see?', answer:'Only the context you selected for that connection. Recall starts read-only.', source:'Connection permission', badge:'private'},
    {key:'memory', user:'Remind me what the graph is for.', answer:'The graph is the central workspace: sources, memories, people, and decisions stay inspectable together.', source:'Graph-first workspace', badge:'memory'},
    {key:'backup', user:'Can I take my memory with me?', answer:'Yes. Export portable JSON or create a local SQLite backup whenever you want.', source:'Privacy controls', badge:'recoverable'}
  ];
  let chatTimer = 0;
  let chatGeneration = 0;
  let chatIndex = 0;
  let manualCooldown = 0;

  const sleep = (ms, gen) => new Promise(resolve => {
    chatTimer = setTimeout(() => resolve(gen === chatGeneration), ms);
  });

  async function typeText(node, text, gen, speed=24) {
    node.classList.add('is-typing');
    node.textContent = '';
    for (let i=0;i<text.length;i++) {
      if (gen !== chatGeneration) return false;
      node.textContent += text[i];
      const stream = by('[data-chat-stream]');
      if (stream) stream.scrollTop = stream.scrollHeight;
      const ok = await sleep(speed + Math.random()*20, gen);
      if (!ok) return false;
    }
    node.classList.remove('is-typing');
    return true;
  }

  function trimChat() {
    const stream = by('[data-chat-stream]');
    if (!stream) return;
    const msgs = all('.message', stream);
    while (msgs.length > 7) msgs.shift()?.remove();
  }

  async function playScenario(scenario, manual=false) {
    const stream = by('[data-chat-stream]');
    if (!stream) return;
    const gen = ++chatGeneration;
    if (chatTimer) clearTimeout(chatTimer);
    by('[data-chat-state]').textContent = manual ? 'YOUR PROMPT' : 'RECALLING';

    const user = document.createElement('article');
    user.className = 'message message--user';
    const up = document.createElement('p'); user.append(up); stream.append(user);
    await typeText(up, scenario.user, gen, manual ? 15 : 19);
    if (gen !== chatGeneration) return;
    await sleep(manual ? 280 : 440, gen);

    const brace = document.createElement('article');
    brace.className = 'message message--brace';
    const bp = document.createElement('p');
    const foot = document.createElement('footer');
    const source = document.createElement('span'); source.textContent = scenario.source;
    const badge = document.createElement('b'); badge.textContent = scenario.badge;
    foot.append(source,badge); brace.append(bp,foot); stream.append(brace);
    by('[data-chat-state]').textContent = 'ANSWERING';
    await typeText(bp, scenario.answer, gen, manual ? 17 : 21);
    if (gen !== chatGeneration) return;
    trimChat();
    stream.scrollTop = stream.scrollHeight;
    by('[data-chat-state]').textContent = 'READY';
    if (manual) {
      by('[data-chat-announcer]').textContent = `BRACE: ${scenario.answer}`;
      manualCooldown = Date.now() + 5000;
    }
    if (!reduceMotion.matches) scheduleAutoChat(gen);
  }

  async function scheduleAutoChat(gen) {
    const delay = Math.max(2400, manualCooldown - Date.now() + 1200);
    const ok = await sleep(delay, gen);
    if (!ok || gen !== chatGeneration) return;
    chatIndex = (chatIndex + 1) % chatScenarios.length;
    playScenario(chatScenarios[chatIndex], false);
  }

  function setupChat() {
    if (!reduceMotion.matches) setTimeout(() => playScenario(chatScenarios[1], false), 1500);
    all('[data-chat-prompt]').forEach(btn => btn.addEventListener('click', () => {
      const s = chatScenarios.find(x => x.key === btn.dataset.chatPrompt) || chatScenarios[0];
      playScenario(s, true);
    }));
    by('[data-chat-form]')?.addEventListener('submit', e => {
      e.preventDefault();
      const input = by('[data-chat-input]');
      const value = input?.value.trim();
      if (!value) return;
      input.value = '';
      const low = value.toLowerCase();
      let s = low.includes('source') ? chatScenarios[1] : low.includes('see') || low.includes('permission') ? chatScenarios[2] : low.includes('backup') || low.includes('export') ? chatScenarios[4] : chatScenarios[0];
      s = {...s, user:value};
      playScenario(s, true);
    });
  }

  const brainStories = {
    source:{kind:'SOURCE',title:'Architecture Decisions.md',copy:'The canonical file stays the reference point. BRACE reads it without turning the source itself into generated memory.',source:'Selected project file',scope:'Private workspace'},
    memory:{kind:'MEMORY',title:'Graph-first workspace',copy:'Make the graph the central workspace and keep evidence visible beside every relationship.',source:'Architecture Decisions.md',scope:'Private workspace'},
    evidence:{kind:'EVIDENCE',title:'Provider boundary',copy:'Selected context is previewed before it crosses into a compatible AI client.',source:'Provider data flow',scope:'Explicit connection'}
  };
  function setupBrain() {
    all('[data-brain-hotspot]').forEach(btn => btn.addEventListener('click', () => {
      const story = brainStories[btn.dataset.brainHotspot];
      if (!story) return;
      all('[data-brain-hotspot]').forEach(x => x.classList.toggle('is-active', x===btn));
      by('[data-brain-kind]').textContent = story.kind;
      by('[data-brain-title]').textContent = story.title;
      by('[data-brain-copy]').textContent = story.copy;
      by('[data-brain-source]').textContent = story.source;
      by('[data-brain-scope]').textContent = story.scope;
    }));
  }

  function setupPointer() {
    if (!finePointer.matches || reduceMotion.matches) return;
    addEventListener('pointermove', e => {
      root.style.setProperty('--pointer-x', (e.clientX / innerWidth).toFixed(4));
      root.style.setProperty('--pointer-y', (e.clientY / innerHeight).toFixed(4));
    }, {passive:true});
  }

  addEventListener('scroll', requestScroll, {passive:true});
  addEventListener('resize', requestScroll, {passive:true});
  setupOpening();
  setupChat();
  setupBrain();
  setupPointer();
  updateScroll();
  root.dataset.braceRuntime = 'ready';
})();
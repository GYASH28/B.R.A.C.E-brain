(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const by = (s, scope=document) => scope.querySelector(s);
  const all = (s, scope=document) => [...scope.querySelectorAll(s)];
  const clamp = (v,min=0,max=1) => Math.max(min,Math.min(max,v));
  const lerp = (a,b,t) => a + (b-a)*t;

  let visualScroll = scrollY;
  let lastVisual = visualScroll;
  let flowMaxX = 0;
  let ticking = true;

  const progressFor = (el, scrollValue, extra=0) => {
    if (!el) return 0;
    const start = el.getBoundingClientRect().top + scrollY;
    const travel = Math.max(1, el.offsetHeight - innerHeight + extra);
    return clamp((scrollValue - start) / travel);
  };

  function measure() {
    const rail = by('[data-flow-rail]');
    if (rail) flowMaxX = Math.max(0, rail.scrollWidth - innerWidth);
  }

  function updateOpening(scrollValue, force=false) {
    const film = by('[data-opening-film]');
    const stage = by('[data-opening-stage]');
    const video = by('[data-opening-video]');
    if (!film || !stage) return;
    if (reduceMotion.matches) {
      document.body.classList.remove('opening-active');
      return;
    }
    const p = progressFor(film, scrollValue);
    stage.style.setProperty('--opening-p', p.toFixed(4));
    const filmTop = film.getBoundingClientRect().top + scrollY;
    document.body.classList.toggle('opening-active', scrollValue < filmTop + film.offsetHeight - innerHeight * .08);
    const scene = p < .30 ? 0 : p < .67 ? 1 : 2;
    all('[data-opening-copy]', stage).forEach((node,i) => node.classList.toggle('is-active', i === scene));
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      const target = Math.min(Math.max(0, video.duration - .04), p * video.duration);
      if (force || Math.abs(video.currentTime - target) > .035) {
        try { video.currentTime = target; } catch (_) {}
      }
    }
  }

  function renderScroll() {
    const target = scrollY;
    visualScroll = reduceMotion.matches ? target : lerp(visualScroll, target, .22);
    if (Math.abs(target - visualScroll) < .08) visualScroll = target;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty('--page-p', clamp(visualScroll / scrollable).toFixed(5));
    by('[data-site-nav]')?.classList.toggle('is-scrolled', target > 30);

    const hero = by('[data-hero]');
    const flow = by('[data-side-scroll]');
    const brain = by('[data-brain-peak]');
    const heroP = progressFor(hero, visualScroll);
    const flowP = progressFor(flow, visualScroll);
    const brainP = progressFor(brain, visualScroll);
    root.style.setProperty('--hero-p', heroP.toFixed(5));
    root.style.setProperty('--flow-p', flowP.toFixed(5));
    root.style.setProperty('--brain-p', brainP.toFixed(5));

    if (innerWidth > 700) {
      by('[data-flow-rail]')?.style.setProperty('--flow-x', (flowMaxX * flowP).toFixed(2));
    }
    updateOpening(visualScroll, false);
    lastVisual = visualScroll;
    if (ticking) requestAnimationFrame(renderScroll);
  }

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
        updateOpening(visualScroll, true);
      }, {once:true});
    }
    by('[data-replay-opening]')?.addEventListener('click', () => {
      film.scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block:'start'});
    });
  }

  const chatScenarios = [
    {key:'decision',user:'What did we decide about provider access?',answer:'Keep provider handoff explicit. Preview exactly what leaves BRACE before the AI receives it.',source:'Architecture Decisions.md',badge:'verified'},
    {key:'source',user:'Where did the launch decision come from?',answer:'The launch review says the graph should be qualified before more connectors are added.',source:'Launch review · Tuesday',badge:'source linked'},
    {key:'scope',user:'What can my connected AI see?',answer:'Only the context selected for that connection. Recall begins read-only.',source:'Connection permission',badge:'private'},
    {key:'memory',user:'Why is the graph useful?',answer:'It keeps sources, people, decisions and durable memories inspectable as one connected workspace.',source:'Graph-first workspace',badge:'memory'},
    {key:'backup',user:'Can I take my memory with me?',answer:'Yes. Export portable JSON or create a local SQLite backup whenever you want.',source:'Privacy controls',badge:'recoverable'},
    {key:'handoff',user:'What should the next AI know?',answer:'Only the project decision, its source and the current constraint — not the whole conversation.',source:'Context handoff',badge:'minimal'}
  ];
  let chatTimer = 0;
  let chatGeneration = 0;
  let chatIndex = 0;
  let manualCooldown = 0;

  const sleep = (ms,gen) => new Promise(resolve => {
    chatTimer = setTimeout(() => resolve(gen === chatGeneration), ms);
  });

  async function typeText(node,text,gen,speed=18) {
    node.classList.add('is-typing');
    node.textContent = '';
    for (let i=0;i<text.length;i++) {
      if (gen !== chatGeneration) return false;
      node.textContent += text[i];
      const stream = by('[data-chat-stream]');
      if (stream) stream.scrollTop = stream.scrollHeight;
      const ok = await sleep(speed + Math.random()*14, gen);
      if (!ok) return false;
    }
    node.classList.remove('is-typing');
    return true;
  }

  function cleanInterrupted() {
    all('[data-chat-stream] .is-typing').forEach(node => node.closest('.message')?.remove());
  }

  function trimChat() {
    const stream = by('[data-chat-stream]');
    if (!stream) return;
    const msgs = all('.message', stream);
    while (msgs.length > 7) msgs.shift()?.remove();
  }

  async function playScenario(scenario,manual=false) {
    const stream = by('[data-chat-stream]');
    if (!stream) return;
    cleanInterrupted();
    const gen = ++chatGeneration;
    if (chatTimer) clearTimeout(chatTimer);
    const state = by('[data-chat-state]');
    if (state) state.textContent = manual ? 'YOUR PROMPT' : 'RECALLING';

    const user = document.createElement('article');
    user.className = 'message message--user';
    const userText = document.createElement('p');
    user.append(userText); stream.append(user);
    if (!await typeText(userText, scenario.user, gen, manual ? 12 : 16)) return;
    if (!await sleep(manual ? 220 : 360, gen)) return;

    const brace = document.createElement('article');
    brace.className = 'message message--brace';
    const answer = document.createElement('p');
    const foot = document.createElement('footer');
    const src = document.createElement('span'); src.textContent = scenario.source;
    const badge = document.createElement('b'); badge.textContent = scenario.badge;
    foot.append(src,badge); brace.append(answer,foot); stream.append(brace);
    if (state) state.textContent = 'ANSWERING';
    if (!await typeText(answer, scenario.answer, gen, manual ? 13 : 17)) return;
    trimChat();
    stream.scrollTop = stream.scrollHeight;
    if (state) state.textContent = 'READY';
    if (manual) {
      const announcer = by('[data-chat-announcer]');
      if (announcer) announcer.textContent = `BRACE: ${scenario.answer}`;
      manualCooldown = Date.now() + 5200;
    }
    if (!reduceMotion.matches) scheduleChat(gen);
  }

  async function scheduleChat(gen) {
    const delay = Math.max(2200, manualCooldown - Date.now() + 900);
    const ok = await sleep(delay, gen);
    if (!ok || gen !== chatGeneration) return;
    chatIndex = (chatIndex + 1) % chatScenarios.length;
    playScenario(chatScenarios[chatIndex], false);
  }

  function setupChat() {
    if (!reduceMotion.matches) setTimeout(() => playScenario(chatScenarios[1], false), 1300);
    all('[data-chat-prompt]').forEach(btn => btn.addEventListener('click', () => {
      const s = chatScenarios.find(x => x.key === btn.dataset.chatPrompt) || chatScenarios[0];
      playScenario(s,true);
    }));
    by('[data-chat-form]')?.addEventListener('submit',e => {
      e.preventDefault();
      const input = by('[data-chat-input]');
      const value = input?.value.trim();
      if (!value) return;
      input.value = '';
      const low = value.toLowerCase();
      let s = low.includes('source') ? chatScenarios[1] : low.includes('permission') || low.includes('see') ? chatScenarios[2] : low.includes('backup') || low.includes('export') ? chatScenarios[4] : low.includes('graph') ? chatScenarios[3] : chatScenarios[0];
      playScenario({...s,user:value},true);
    });
  }

  const brainStories = {
    source:{kind:'SOURCE',title:'Architecture Decisions.md',copy:'The canonical file stays the reference point. BRACE reads it without turning the entire source into generated memory.',source:'Selected project file',scope:'Private workspace'},
    memory:{kind:'MEMORY',title:'Graph-first workspace',copy:'The durable outcome stays connected to the evidence and surrounding project context.',source:'Architecture Decisions.md',scope:'Private workspace'},
    evidence:{kind:'EVIDENCE',title:'Provider boundary',copy:'Only selected context is previewed before it crosses into a compatible AI client.',source:'Provider data flow',scope:'Explicit connection'}
  };
  function setupBrain() {
    all('[data-brain-hotspot]').forEach(btn => btn.addEventListener('click', () => {
      const story = brainStories[btn.dataset.brainHotspot];
      if (!story) return;
      all('[data-brain-hotspot]').forEach(x => x.classList.toggle('is-active',x === btn));
      by('[data-brain-kind]').textContent = story.kind;
      by('[data-brain-title]').textContent = story.title;
      by('[data-brain-copy]').textContent = story.copy;
      by('[data-brain-source]').textContent = story.source;
      by('[data-brain-scope]').textContent = story.scope;
    }));
  }

  function setupReveals() {
    const revealNodes = all('[data-reveal],.statement-line');
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      revealNodes.forEach(n => n.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), {rootMargin:'0px 0px -8%',threshold:.08});
    revealNodes.forEach(node => observer.observe(node));
  }

  function setupPointer() {
    if (!finePointer.matches || reduceMotion.matches) return;
    addEventListener('pointermove',e => {
      root.style.setProperty('--mx',(e.clientX/innerWidth).toFixed(4));
      root.style.setProperty('--my',(e.clientY/innerHeight).toFixed(4));
    },{passive:true});
    const consoleEl = by('[data-live-chat]');
    consoleEl?.addEventListener('pointermove',e => {
      const r = consoleEl.getBoundingClientRect();
      consoleEl.style.setProperty('--spot-x',`${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);
      consoleEl.style.setProperty('--spot-y',`${((e.clientY-r.top)/r.height*100).toFixed(1)}%`);
    },{passive:true});
  }

  addEventListener('resize', () => { measure(); visualScroll = scrollY; }, {passive:true});
  addEventListener('pagehide', () => { ticking = false; });
  setupOpening();
  setupChat();
  setupBrain();
  setupReveals();
  setupPointer();
  measure();
  requestAnimationFrame(renderScroll);
  root.dataset.braceRuntime = 'ready';
})();

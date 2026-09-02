(() => {
  "use strict";

  if (document.querySelector("[data-brace-live]")) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  document.documentElement.dataset.braceExperience = "living-v7";

  const style = document.createElement("style");
  style.dataset.braceLivingStyles = "v7";
  style.textContent = String.raw`
    .brace-live-act{--live-p:0;--live-px:0;--live-py:0;position:relative;min-height:285svh;color:#0b3268;background:linear-gradient(180deg,rgba(194,225,253,.86),rgba(122,174,239,.92) 46%,rgba(191,225,253,.9));overflow:clip;border-block:1px solid rgba(255,255,255,.72)}
    .brace-live-act::before,.brace-live-act::after{content:"";position:absolute;pointer-events:none;border-radius:50%;filter:blur(4px);will-change:transform}
    .brace-live-act::before{width:min(62vw,880px);aspect-ratio:1;left:-20vw;top:20%;background:radial-gradient(circle,rgba(255,255,255,.7),rgba(222,241,255,.18) 48%,transparent 72%);transform:translate3d(calc(var(--live-px)*18px),calc((var(--live-p) - .5)*-90px + var(--live-py)*12px),0)}
    .brace-live-act::after{width:min(48vw,680px);aspect-ratio:1;right:-16vw;bottom:10%;background:radial-gradient(circle,rgba(219,239,255,.72),rgba(114,175,244,.13) 52%,transparent 74%);transform:translate3d(calc(var(--live-px)*-26px),calc((var(--live-p) - .5)*120px + var(--live-py)*-16px),0)}
    .brace-live-sticky{position:sticky;top:0;min-height:100svh;display:grid;align-items:center;padding:max(112px,calc(var(--header-h) + 34px)) var(--sc-gutter) 46px;isolation:isolate}
    .brace-live-wrap{width:min(1280px,100%);margin-inline:auto;display:grid;grid-template-columns:minmax(230px,.72fr) minmax(0,2.05fr);gap:clamp(28px,4vw,58px);align-items:center}
    .brace-live-copy{position:relative;z-index:4;align-self:center}
    .brace-live-copy .overline{margin-bottom:14px}.brace-live-copy h2{margin:0;max-width:9ch;color:#0b3269;font-family:var(--sc-font-display);font-size:clamp(3rem,5vw,5.9rem);font-weight:590;line-height:.9;letter-spacing:-.064em;text-wrap:balance}
    .brace-live-copy>p:not(.overline){max-width:34ch;margin:22px 0 0;color:#355f8e;font-size:clamp(.92rem,1.15vw,1.04rem);line-height:1.65}
    .brace-live-trust{margin-top:24px;display:flex;align-items:flex-start;gap:10px;color:#416b98;font-size:.74rem;line-height:1.5}.brace-live-trust i{flex:0 0 auto;width:8px;height:8px;margin-top:4px;border-radius:50%;background:#1766c5;box-shadow:0 0 0 5px rgba(23,102,197,.1)}
    .brace-live-story{margin-top:34px;min-height:154px;padding-top:23px;border-top:1px solid rgba(24,82,155,.16)}.brace-live-story strong{display:block;color:#194d8c;font-size:.7rem;letter-spacing:.16em}.brace-live-story h3{margin:10px 0 8px;color:#0b3268;font-size:clamp(1.35rem,2vw,1.85rem);letter-spacing:-.035em}.brace-live-story p{margin:0;color:#466d98;font-size:.84rem;line-height:1.6}
    .brace-live-actions{margin-top:22px;display:flex;flex-wrap:wrap;gap:9px}.brace-live-actions button,.brace-live-actions a{min-height:44px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.86);border-radius:14px;color:#154c8f;background:rgba(247,252,255,.58);box-shadow:inset 0 1px rgba(255,255,255,.94),0 9px 24px rgba(23,74,143,.11);font:inherit;font-size:.72rem;font-weight:760;text-decoration:none;cursor:pointer;transition:transform 180ms ease,background 180ms ease,box-shadow 180ms ease}.brace-live-actions button:hover,.brace-live-actions a:hover{transform:translateY(-2px);background:rgba(255,255,255,.82);box-shadow:inset 0 1px #fff,0 13px 28px rgba(23,74,143,.16)}
    .brace-live-shell{position:relative;z-index:3;min-width:0;transform:perspective(1800px) translate3d(calc(var(--live-px)*9px),calc((.5 - var(--live-p))*14px + var(--live-py)*7px),0) rotateX(calc(var(--live-py)*-.45deg)) rotateY(calc(var(--live-px)*.7deg));transform-origin:50% 52%;transition:transform 90ms linear}
    .brace-live-window{position:relative;min-height:min(67svh,670px);overflow:hidden;border:1px solid rgba(255,255,255,.92);border-radius:clamp(25px,3vw,42px);background:linear-gradient(145deg,rgba(252,254,255,.78),rgba(229,244,255,.47));box-shadow:inset 0 1px #fff,inset 0 -50px 90px rgba(51,116,205,.08),0 42px 110px rgba(20,72,145,.25);-webkit-backdrop-filter:blur(30px) saturate(1.16);backdrop-filter:blur(30px) saturate(1.16)}
    .brace-live-window::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.46),transparent 22%,transparent 76%,rgba(255,255,255,.17));z-index:6}
    .brace-live-toolbar{position:relative;z-index:8;height:58px;padding:0 18px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid rgba(41,102,176,.13);background:rgba(248,253,255,.45)}
    .brace-live-toolbar>span{display:flex;gap:6px}.brace-live-toolbar>span i{width:8px;height:8px;border-radius:50%;background:rgba(42,101,174,.27)}.brace-live-toolbar>strong{color:#244f82;font-size:.67rem;letter-spacing:.13em}.brace-live-toolbar>small{justify-self:end;color:#2a61a2;font-size:.62rem;font-weight:780;letter-spacing:.12em}
    .brace-live-body{position:relative;z-index:5;min-height:calc(min(67svh,670px) - 58px);display:grid;grid-template-columns:112px minmax(0,1fr)}
    .brace-live-rail{padding:18px 11px;display:flex;flex-direction:column;gap:8px;border-right:1px solid rgba(38,97,169,.12);background:rgba(248,252,255,.24)}
    .brace-live-mode{min-height:64px;padding:8px 8px;display:grid;place-items:center;gap:4px;border:1px solid transparent;border-radius:18px;color:#6280a1;background:transparent;font:inherit;cursor:pointer;transition:transform 200ms ease,color 200ms ease,background 200ms ease,border-color 200ms ease,box-shadow 200ms ease}.brace-live-mode b{font-size:.67rem}.brace-live-mode small{font-size:.56rem;letter-spacing:.08em}.brace-live-mode:hover{color:#174d8d;background:rgba(255,255,255,.4)}.brace-live-mode[aria-pressed="true"]{color:#0f4d98;border-color:rgba(255,255,255,.9);background:rgba(255,255,255,.72);box-shadow:inset 0 1px #fff,0 10px 28px rgba(23,79,151,.13);transform:translateX(3px)}
    .brace-live-workspace{position:relative;min-width:0;overflow:hidden;padding:clamp(20px,2.2vw,30px)}
    .brace-live-halo{position:absolute;width:48%;aspect-ratio:1;left:35%;top:7%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.88),rgba(181,218,252,.25) 48%,transparent 72%);transform:translate3d(calc(var(--live-px)*-9px),calc(var(--live-py)*-7px),0);pointer-events:none}
    .brace-live-statusline{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:16px}.brace-live-statusline span{display:inline-flex;align-items:center;gap:8px;color:#5b7796;font-size:.63rem;font-weight:760;letter-spacing:.08em}.brace-live-statusline i{width:6px;height:6px;border-radius:50%;background:#1a67c9;box-shadow:0 0 0 4px rgba(26,103,201,.1)}.brace-live-statusline b{color:#1a569e;font-size:.63rem;letter-spacing:.08em}
    .brace-orb{position:absolute;z-index:2;width:clamp(84px,10vw,126px);aspect-ratio:1;left:50%;top:22%;display:grid;place-items:center;transform:translate3d(calc(-50% + var(--live-px)*10px),calc(var(--live-py)*8px),0);border:1px solid rgba(255,255,255,.95);border-radius:50%;background:radial-gradient(circle at 34% 26%,#fff 0 7%,rgba(238,249,255,.96) 22%,rgba(105,174,245,.66) 58%,rgba(31,104,192,.78) 100%);box-shadow:inset -14px -16px 32px rgba(17,78,161,.2),inset 9px 10px 24px rgba(255,255,255,.72),0 24px 54px rgba(21,83,162,.24)}
    .brace-orb::before,.brace-orb::after{content:"";position:absolute;border:1px solid rgba(55,120,202,.18);border-radius:50%;inset:-16px}.brace-orb::after{inset:-31px;border-color:rgba(55,120,202,.1)}
    .brace-live-act[data-in-view="true"]:not([data-paused="true"]) .brace-orb::before{animation:braceLiveBreathe 3.6s ease-in-out infinite}.brace-live-act[data-in-view="true"]:not([data-paused="true"]) .brace-orb::after{animation:braceLiveBreathe 3.6s .35s ease-in-out infinite reverse}@keyframes braceLiveBreathe{50%{transform:scale(1.07);opacity:.52}}
    .brace-live-panels{position:absolute;inset:clamp(20px,2.2vw,30px);top:34%;bottom:86px}.brace-live-panel{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.58fr);gap:14px;align-items:end;opacity:0;transform:translateY(18px) scale(.985);pointer-events:none;transition:opacity 360ms ease,transform 460ms cubic-bezier(.2,.8,.2,1)}.brace-live-panel[aria-hidden="false"]{opacity:1;transform:none;pointer-events:auto}
    .brace-live-card{min-width:0;padding:18px;border:1px solid rgba(255,255,255,.88);border-radius:22px;background:rgba(249,253,255,.64);box-shadow:inset 0 1px #fff,0 17px 38px rgba(29,84,155,.12);-webkit-backdrop-filter:blur(17px);backdrop-filter:blur(17px)}.brace-live-card small{display:block;margin-bottom:7px;color:#48719f;font-size:.6rem;font-weight:800;letter-spacing:.11em}.brace-live-card strong{display:block;color:#163f73;font-size:clamp(.9rem,1.12vw,1.02rem);line-height:1.4}.brace-live-card p{margin:8px 0 0;color:#5b789a;font-size:.72rem;line-height:1.55}.brace-live-card--focus{background:rgba(255,255,255,.78)}
    .brace-flow{margin-top:15px;display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:8px}.brace-flow span{min-height:54px;padding:8px;display:grid;place-items:center;text-align:center;border:1px solid rgba(56,119,195,.13);border-radius:13px;color:#285b95;background:rgba(235,247,255,.72);font-size:.62rem;font-weight:760}.brace-flow i{width:18px;height:1px;background:rgba(28,93,173,.3)}
    .brace-receipts{margin-top:12px;display:flex;flex-wrap:wrap;gap:7px}.brace-receipts span{padding:7px 9px;border:1px solid rgba(35,96,172,.12);border-radius:10px;color:#416c9a;background:rgba(236,248,255,.68);font-size:.6rem;font-weight:700}
    .brace-live-graph{position:relative;min-height:154px;margin-top:6px}.brace-live-graph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.brace-live-graph path{fill:none;stroke:rgba(37,102,183,.28);stroke-width:1.6;stroke-dasharray:5 6}.brace-live-graph span{position:absolute;min-width:80px;padding:9px 10px;border:1px solid rgba(255,255,255,.9);border-radius:13px;text-align:center;color:#22558f;background:rgba(247,252,255,.82);box-shadow:0 8px 22px rgba(24,80,150,.1);font-size:.6rem;font-weight:760}.brace-live-graph .n1{left:3%;top:45%}.brace-live-graph .n2{left:38%;top:4%}.brace-live-graph .n3{right:2%;top:43%}.brace-live-graph .n4{left:39%;bottom:0}
    .brace-command{position:absolute;z-index:7;left:clamp(20px,2.2vw,30px);right:clamp(20px,2.2vw,30px);bottom:24px;min-height:54px;padding:11px 15px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.94);border-radius:18px;background:rgba(249,253,255,.76);box-shadow:inset 0 1px #fff,0 14px 34px rgba(22,76,149,.13);-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px)}.brace-command>span{width:28px;height:28px;display:grid;place-items:center;border-radius:10px;color:white;background:linear-gradient(145deg,#2874ce,#1051a8);font-size:.7rem;font-weight:850}.brace-command output{overflow:hidden;color:#345d8b;font-size:.72rem;white-space:nowrap;text-overflow:ellipsis}.brace-command kbd{padding:5px 7px;border:1px solid rgba(39,97,169,.13);border-radius:8px;color:#597694;background:rgba(229,244,255,.74);font:600 .58rem ui-monospace,SFMono-Regular,Menlo,monospace}
    .brace-live-progress{position:absolute;z-index:8;right:20px;top:76px;display:flex;gap:5px}.brace-live-progress i{width:22px;height:3px;border-radius:99px;background:rgba(31,92,169,.13);transition:background 180ms ease,transform 180ms ease}.brace-live-progress i.is-active{background:#1f65b9;transform:scaleX(1.16)}
    .brace-live-act :focus-visible{outline:2px solid #0d57ad;outline-offset:4px}
    @media (max-width:980px){.brace-live-act{min-height:255svh}.brace-live-sticky{padding-inline:22px}.brace-live-wrap{grid-template-columns:1fr;gap:20px}.brace-live-copy{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;align-items:end}.brace-live-copy h2{font-size:clamp(2.7rem,8vw,4.8rem)}.brace-live-copy>p:not(.overline){margin-top:14px}.brace-live-story{grid-column:2;grid-row:1/5;margin-top:0;padding:4px 0 0 24px;border-top:0;border-left:1px solid rgba(24,82,155,.16)}.brace-live-actions{grid-column:1;margin-top:16px}.brace-live-trust{grid-column:1}.brace-live-window{min-height:min(58svh,600px)}.brace-live-body{min-height:calc(min(58svh,600px) - 58px)}}
    @media (max-width:720px){.brace-live-act{min-height:auto}.brace-live-sticky{position:relative;min-height:auto;padding:96px 16px 72px}.brace-live-wrap{gap:30px}.brace-live-copy{display:block}.brace-live-copy h2{max-width:8.5ch;font-size:clamp(2.7rem,13vw,4.5rem)}.brace-live-copy>p:not(.overline){max-width:38ch}.brace-live-story{margin-top:28px;padding:20px 0 0;border-left:0;border-top:1px solid rgba(24,82,155,.16);min-height:135px}.brace-live-actions{margin-top:18px}.brace-live-shell{transform:none!important}.brace-live-window{min-height:610px;border-radius:26px}.brace-live-toolbar{grid-template-columns:1fr 1fr;height:54px}.brace-live-toolbar>strong{display:none}.brace-live-body{min-height:556px;grid-template-columns:1fr}.brace-live-rail{padding:10px;display:grid;grid-template-columns:repeat(3,1fr);border-right:0;border-bottom:1px solid rgba(38,97,169,.12)}.brace-live-mode{min-height:48px;display:flex;align-items:center;justify-content:center;gap:6px}.brace-live-mode[aria-pressed="true"]{transform:none}.brace-live-workspace{padding:16px}.brace-live-statusline{padding-right:56px}.brace-orb{top:19%;width:88px}.brace-live-panels{inset:16px;top:33%;bottom:82px}.brace-live-panel{grid-template-columns:1fr;gap:9px;align-content:end}.brace-live-panel>.brace-live-card:last-child{display:none}.brace-live-card{padding:15px;border-radius:18px}.brace-command{left:16px;right:16px;bottom:16px}.brace-command kbd{display:none}.brace-flow{gap:5px}.brace-flow span{font-size:.56rem;padding:6px}.brace-live-progress{right:16px;top:72px}}
    @media (max-width:390px){.brace-live-sticky{padding-inline:12px}.brace-live-window{min-height:590px}.brace-live-mode{padding:6px 4px}.brace-live-mode small{display:none}.brace-live-card p{font-size:.68rem}.brace-flow span{min-height:48px}.brace-command output{font-size:.67rem}}
    @media (prefers-reduced-motion:reduce){.brace-live-act::before,.brace-live-act::after,.brace-live-shell,.brace-live-panel,.brace-live-mode,.brace-live-actions button,.brace-live-actions a,.brace-orb::before,.brace-orb::after{animation:none!important;transition:none!important;transform:none!important}.brace-live-act{min-height:auto}.brace-live-sticky{position:relative;min-height:auto;padding-block:110px 76px}}
  `;
  document.head.append(style);

  const story = document.querySelector("#story");
  const product = document.querySelector("#product");
  if (!story || !product) return;

  const section = document.createElement("section");
  section.id = "live-preview";
  section.className = "brace-live-act";
  section.dataset.braceLive = "";
  section.dataset.liveState = "0";
  section.dataset.inView = "false";
  section.innerHTML = `
    <div class="brace-live-sticky">
      <div class="brace-live-wrap">
        <header class="brace-live-copy">
          <p class="overline">INTERACTIVE PRODUCT PREVIEW</p>
          <h2>Try the memory loop.</h2>
          <p>Move through the same idea three ways: capture it, recall it with evidence, then connect it back to active work.</p>
          <div class="brace-live-trust"><i></i><span>This is an example workspace. It does not read, edit, or save files on your computer.</span></div>
          <div class="brace-live-story" aria-live="polite">
            <strong data-live-step-label>01 · CAPTURE</strong>
            <h3 data-live-title>Turn a useful decision into durable context.</h3>
            <p data-live-description>The source stays visible while the memory becomes available for later recall.</p>
          </div>
          <div class="brace-live-actions">
            <button type="button" data-live-pause aria-pressed="false">Pause motion</button>
            <button type="button" data-live-reset>Reset preview</button>
            <a href="guide/#recall">See it in the guide</a>
          </div>
        </header>

        <div class="brace-live-shell">
          <div class="brace-live-window" aria-label="BRACE interactive example workspace">
            <div class="brace-live-toolbar"><span aria-hidden="true"><i></i><i></i><i></i></span><strong>BRACE · NORTHSTAR EXAMPLE</strong><small>INTERACTIVE PREVIEW</small></div>
            <div class="brace-live-progress" aria-hidden="true"><i class="is-active"></i><i></i><i></i></div>
            <div class="brace-live-body">
              <nav class="brace-live-rail" aria-label="Preview modes">
                <button class="brace-live-mode" type="button" data-live-target="0" aria-pressed="true"><b>Capture</b><small>01</small></button>
                <button class="brace-live-mode" type="button" data-live-target="1" aria-pressed="false"><b>Recall</b><small>02</small></button>
                <button class="brace-live-mode" type="button" data-live-target="2" aria-pressed="false"><b>Connect</b><small>03</small></button>
              </nav>
              <div class="brace-live-workspace">
                <div class="brace-live-halo" aria-hidden="true"></div>
                <div class="brace-live-statusline"><span><i></i>LOCAL EXAMPLE WORKSPACE</span><b data-live-status>CAPTURE READY</b></div>
                <div class="brace-orb" aria-hidden="true"><img src="assets/brace-logo.svg" width="42" height="42" alt=""></div>
                <div class="brace-live-panels">
                  <section class="brace-live-panel" data-live-panel="0" aria-hidden="false">
                    <div class="brace-live-card brace-live-card--focus">
                      <small>CAPTURE FLOW · EXAMPLE</small>
                      <strong>“Keep imported files canonical; memory should point back to evidence.”</strong>
                      <div class="brace-flow" aria-hidden="true"><span>planning.md</span><i></i><span>Durable memory</span><i></i><span>Ready to recall</span></div>
                      <div class="brace-receipts"><span>Source attached</span><span>Project · Northstar</span><span>Local preview</span></div>
                    </div>
                    <div class="brace-live-card"><small>WHAT CHANGED</small><strong>Useful context is now represented as a durable memory.</strong><p>The original example source remains the evidence boundary.</p></div>
                  </section>
                  <section class="brace-live-panel" data-live-panel="1" aria-hidden="true">
                    <div class="brace-live-card brace-live-card--focus">
                      <small>RECALL · EVIDENCE ATTACHED</small>
                      <strong>Keep local Ollama as the default. Remote embedding endpoints remain an explicit advanced option.</strong>
                      <p>Durable memory and source evidence stay visibly separate instead of being blended into one answer.</p>
                      <div class="brace-receipts"><span>Durable memory</span><span>Source evidence</span><span>Privacy context</span></div>
                    </div>
                    <div class="brace-live-card"><small>WHY IT HELPS</small><strong>You can see the remembered point and the evidence behind it.</strong><p>No fake confidence score is added to the preview.</p></div>
                  </section>
                  <section class="brace-live-panel" data-live-panel="2" aria-hidden="true">
                    <div class="brace-live-card brace-live-card--focus">
                      <small>CONNECT · RELATIONSHIP VIEW</small>
                      <strong>The decision becomes part of the project context instead of an isolated note.</strong>
                      <div class="brace-live-graph" aria-label="Example relationships between a project, source, decision, and AI workspace">
                        <svg viewBox="0 0 420 160" aria-hidden="true"><path d="M70 88 C150 88 145 30 210 30"/><path d="M210 30 C275 30 270 88 350 88"/><path d="M210 30 C210 72 210 105 210 140"/><path d="M70 88 C135 88 155 140 210 140"/></svg>
                        <span class="n1">release-plan.md</span><span class="n2">Decision</span><span class="n3">AI workspace</span><span class="n4">Northstar</span>
                      </div>
                    </div>
                    <div class="brace-live-card"><small>CONTEXT HANDOFF</small><strong>Relationships stay inspectable before context reaches a compatible AI.</strong><p>This diagram is illustrative and changes only the preview.</p></div>
                  </section>
                </div>
                <div class="brace-command"><span aria-hidden="true">›_</span><output data-live-command>Remember the launch decision and keep its source.</output><kbd>CTRL K</kbd></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  product.before(section);

  const primaryNav = document.querySelector(".site-bar nav");
  if (primaryNav && !primaryNav.querySelector('a[href="#live-preview"]')) {
    const productLink = primaryNav.querySelector('a[href="#product"]');
    const link = document.createElement("a");
    link.href = "#live-preview";
    link.textContent = "Live demo";
    primaryNav.insertBefore(link, productLink || null);
  }

  const modes = [
    {
      label: "01 · CAPTURE",
      title: "Turn a useful decision into durable context.",
      description: "The source stays visible while the memory becomes available for later recall.",
      status: "CAPTURE READY",
      command: "Remember the launch decision and keep its source."
    },
    {
      label: "02 · RECALL",
      title: "Ask the memory, then inspect the evidence.",
      description: "Recall separates the durable point from source evidence so the result remains understandable.",
      status: "EVIDENCE FOUND",
      command: "What did we decide about remote embeddings?"
    },
    {
      label: "03 · CONNECT",
      title: "Put the answer back into the work around it.",
      description: "A decision can sit beside its project, source, and compatible AI context instead of becoming another orphaned note.",
      status: "CONTEXT LINKED",
      command: "Connect this decision to the Northstar release plan."
    }
  ];

  const buttons = Array.from(section.querySelectorAll("[data-live-target]"));
  const panels = Array.from(section.querySelectorAll("[data-live-panel]"));
  const meters = Array.from(section.querySelectorAll(".brace-live-progress i"));
  const stepLabel = section.querySelector("[data-live-step-label]");
  const title = section.querySelector("[data-live-title]");
  const description = section.querySelector("[data-live-description]");
  const status = section.querySelector("[data-live-status]");
  const command = section.querySelector("[data-live-command]");
  const pause = section.querySelector("[data-live-pause]");
  const reset = section.querySelector("[data-live-reset]");
  let active = 0;
  let inView = false;
  let scrollTick = false;
  let pointerTick = false;
  let nextPointer = {x: 0, y: 0};

  const setMode = (next, announce = true) => {
    const index = clamp(Number(next) || 0, 0, modes.length - 1);
    if (index === active && section.dataset.liveReady === "true") return;
    active = index;
    section.dataset.liveState = String(index);
    section.dataset.liveReady = "true";
    buttons.forEach((button, buttonIndex) => button.setAttribute("aria-pressed", String(buttonIndex === index)));
    panels.forEach((panel, panelIndex) => panel.setAttribute("aria-hidden", String(panelIndex !== index)));
    meters.forEach((meter, meterIndex) => meter.classList.toggle("is-active", meterIndex === index));
    if (stepLabel) stepLabel.textContent = modes[index].label;
    if (title) title.textContent = modes[index].title;
    if (description) description.textContent = modes[index].description;
    if (status) status.textContent = modes[index].status;
    if (command) command.textContent = modes[index].command;
    section.dataset.scVerifyState = `live:${index}`;
    if (!announce) section.querySelector(".brace-live-story")?.setAttribute("aria-live", "off");
    else section.querySelector(".brace-live-story")?.setAttribute("aria-live", "polite");
  };

  const progressForMode = (index) => [0.08, 0.5, 0.92][index] || 0;
  const scrollToMode = (index) => {
    if (innerWidth <= 720 || reduce) {
      setMode(index);
      return;
    }
    const travel = Math.max(1, section.offsetHeight - innerHeight);
    scrollTo({top: section.offsetTop + travel * progressForMode(index), behavior: "smooth"});
  };
  buttons.forEach((button) => button.addEventListener("click", () => scrollToMode(Number(button.dataset.liveTarget))));

  const syncScroll = () => {
    scrollTick = false;
    if (!inView || innerWidth <= 720 || reduce) return;
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, rect.height - innerHeight);
    const progress = clamp(-rect.top / travel, 0, 1);
    section.style.setProperty("--live-p", progress.toFixed(4));
    const next = progress < .34 ? 0 : progress < .68 ? 1 : 2;
    setMode(next, false);
  };
  addEventListener("scroll", () => {
    if (!scrollTick) {
      scrollTick = true;
      requestAnimationFrame(syncScroll);
    }
  }, {passive: true});
  addEventListener("resize", syncScroll, {passive: true});

  const observer = new IntersectionObserver((entries) => {
    inView = Boolean(entries[0]?.isIntersecting);
    section.dataset.inView = String(inView);
    if (inView) syncScroll();
  }, {rootMargin: "20% 0px", threshold: 0.01});
  observer.observe(section);

  if (finePointer && !reduce) {
    section.addEventListener("pointermove", (event) => {
      const rect = section.getBoundingClientRect();
      nextPointer = {
        x: clamp(((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2, -1, 1),
        y: clamp(((event.clientY - rect.top) / Math.max(1, Math.min(rect.height, innerHeight)) - .5) * 2, -1, 1)
      };
      if (pointerTick) return;
      pointerTick = true;
      requestAnimationFrame(() => {
        pointerTick = false;
        section.style.setProperty("--live-px", nextPointer.x.toFixed(3));
        section.style.setProperty("--live-py", nextPointer.y.toFixed(3));
      });
    }, {passive: true});
    section.addEventListener("pointerleave", () => {
      section.style.setProperty("--live-px", "0");
      section.style.setProperty("--live-py", "0");
    });
  }

  pause?.addEventListener("click", () => {
    const paused = section.dataset.paused === "true";
    section.dataset.paused = String(!paused);
    pause.setAttribute("aria-pressed", String(!paused));
    pause.textContent = paused ? "Pause motion" : "Resume motion";
  });
  reset?.addEventListener("click", () => {
    section.dataset.paused = "false";
    pause?.setAttribute("aria-pressed", "false");
    if (pause) pause.textContent = "Pause motion";
    if (innerWidth > 720 && !reduce) scrollToMode(0); else setMode(0);
  });

  setMode(0, false);
})();

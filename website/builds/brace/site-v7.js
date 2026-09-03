(() => {
  "use strict";

  if (document.querySelector("[data-brace-live]")) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const root = document.documentElement;
  root.dataset.braceExperience = "living-v9";

  const style = document.createElement("style");
  style.dataset.braceLivingStyles = "v9";
  style.textContent = String.raw`
    .brace-live-act{--live-p:0;--live-px:0;--live-py:0;position:relative;min-height:430svh;color:#0b3268;background:linear-gradient(180deg,rgba(202,231,255,.94),rgba(121,174,238,.9) 45%,rgba(205,233,255,.96));overflow:clip;border-block:1px solid rgba(255,255,255,.74)}
    .brace-live-act::before,.brace-live-act::after{content:"";position:absolute;pointer-events:none;border-radius:50%;will-change:transform}
    .brace-live-act::before{width:min(62vw,900px);aspect-ratio:1;left:-20vw;top:12%;background:radial-gradient(circle,rgba(255,255,255,.72),rgba(225,243,255,.17) 48%,transparent 72%);transform:translate3d(calc(var(--live-px)*16px),calc((var(--live-p) - .5)*-82px + var(--live-py)*10px),0)}
    .brace-live-act::after{width:min(48vw,680px);aspect-ratio:1;right:-15vw;bottom:7%;background:radial-gradient(circle,rgba(226,242,255,.76),rgba(100,161,234,.12) 54%,transparent 74%);transform:translate3d(calc(var(--live-px)*-22px),calc((var(--live-p) - .5)*104px + var(--live-py)*-14px),0)}
    .brace-live-sticky{position:sticky;top:0;min-height:100svh;display:grid;align-items:center;padding:max(104px,calc(var(--header-h) + 26px)) var(--sc-gutter) 40px;isolation:isolate}
    .brace-live-wrap{width:min(1320px,100%);margin-inline:auto;display:grid;grid-template-columns:minmax(240px,.76fr) minmax(0,2.1fr);gap:clamp(28px,4vw,62px);align-items:center}
    .brace-live-copy{position:relative;z-index:4;align-self:center}
    .brace-live-copy .overline{margin-bottom:14px}.brace-live-copy h2{margin:0;max-width:8.2ch;color:#0a3067;font-family:var(--sc-font-display);font-size:clamp(3rem,5vw,6rem);font-weight:590;line-height:.9;letter-spacing:-.066em;text-wrap:balance}
    .brace-live-copy>p:not(.overline){max-width:36ch;margin:22px 0 0;color:#315f90;font-size:clamp(.93rem,1.12vw,1.04rem);line-height:1.66}
    .brace-live-trust{margin-top:22px;display:flex;align-items:flex-start;gap:10px;color:#426c99;font-size:.73rem;line-height:1.5}.brace-live-trust i{flex:0 0 auto;width:8px;height:8px;margin-top:4px;border-radius:50%;background:#1766c5;box-shadow:0 0 0 5px rgba(23,102,197,.1)}
    .brace-live-story{margin-top:30px;min-height:150px;padding-top:22px;border-top:1px solid rgba(24,82,155,.16)}.brace-live-story strong{display:block;color:#194d8c;font-size:.66rem;letter-spacing:.16em}.brace-live-story h3{margin:9px 0 8px;color:#0b3268;font-size:clamp(1.35rem,1.85vw,1.82rem);letter-spacing:-.035em}.brace-live-story p{margin:0;color:#466d98;font-size:.82rem;line-height:1.6}
    .brace-live-actions{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px}.brace-live-actions button,.brace-live-actions a{min-height:44px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.88);border-radius:14px;color:#154c8f;background:rgba(247,252,255,.58);box-shadow:inset 0 1px rgba(255,255,255,.94),0 9px 24px rgba(23,74,143,.11);font:inherit;font-size:.71rem;font-weight:760;text-decoration:none;cursor:pointer;transition:transform 180ms ease,background 180ms ease,box-shadow 180ms ease}.brace-live-actions button:hover,.brace-live-actions a:hover{transform:translateY(-2px);background:rgba(255,255,255,.84);box-shadow:inset 0 1px #fff,0 13px 28px rgba(23,74,143,.16)}
    .brace-live-shell{position:relative;z-index:3;min-width:0;transform:perspective(1800px) translate3d(calc(var(--live-px)*8px),calc((.5 - var(--live-p))*12px + var(--live-py)*6px),0) rotateX(calc(var(--live-py)*-.35deg)) rotateY(calc(var(--live-px)*.55deg));transform-origin:50% 52%;transition:transform 90ms linear}
    .brace-live-window{position:relative;min-height:min(72svh,720px);overflow:hidden;border:1px solid rgba(255,255,255,.94);border-radius:clamp(24px,2.8vw,40px);background:linear-gradient(145deg,rgba(253,254,255,.82),rgba(228,243,255,.5));box-shadow:inset 0 1px #fff,inset 0 -50px 90px rgba(51,116,205,.07),0 42px 110px rgba(20,72,145,.24);-webkit-backdrop-filter:blur(28px) saturate(1.15);backdrop-filter:blur(28px) saturate(1.15)}
    .brace-live-window::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.46),transparent 22%,transparent 76%,rgba(255,255,255,.17));z-index:8}
    .brace-live-toolbar{position:relative;z-index:10;height:56px;padding:0 18px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid rgba(41,102,176,.13);background:rgba(248,253,255,.5)}
    .brace-live-toolbar>span{display:flex;gap:6px}.brace-live-toolbar>span i{width:8px;height:8px;border-radius:50%;background:rgba(42,101,174,.27)}.brace-live-toolbar>strong{color:#244f82;font-size:.65rem;letter-spacing:.13em}.brace-live-toolbar>small{justify-self:end;color:#2a61a2;font-size:.6rem;font-weight:780;letter-spacing:.12em}
    .brace-live-body{position:relative;z-index:5;min-height:calc(min(72svh,720px) - 56px);display:grid;grid-template-columns:116px minmax(0,1fr)}
    .brace-live-rail{padding:14px 10px;display:flex;flex-direction:column;gap:7px;border-right:1px solid rgba(38,97,169,.12);background:rgba(248,252,255,.25)}
    .brace-live-mode{min-height:58px;padding:7px;display:grid;place-items:center;gap:3px;border:1px solid transparent;border-radius:17px;color:#6280a1;background:transparent;font:inherit;cursor:pointer;transition:transform 180ms ease,color 180ms ease,background 180ms ease,border-color 180ms ease,box-shadow 180ms ease}.brace-live-mode b{font-size:.64rem}.brace-live-mode small{font-size:.53rem;letter-spacing:.08em}.brace-live-mode:hover{color:#174d8d;background:rgba(255,255,255,.4)}.brace-live-mode[aria-pressed="true"]{color:#0f4d98;border-color:rgba(255,255,255,.92);background:rgba(255,255,255,.74);box-shadow:inset 0 1px #fff,0 10px 28px rgba(23,79,151,.13);transform:translateX(3px)}
    .brace-live-workspace{position:relative;min-width:0;overflow:hidden;padding:clamp(18px,2vw,28px)}
    .brace-live-statusline{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:14px}.brace-live-statusline span{display:inline-flex;align-items:center;gap:8px;color:#5b7796;font-size:.61rem;font-weight:760;letter-spacing:.08em}.brace-live-statusline i{width:6px;height:6px;border-radius:50%;background:#1a67c9;box-shadow:0 0 0 4px rgba(26,103,201,.1)}.brace-live-statusline b{color:#1a569e;font-size:.61rem;letter-spacing:.08em}
    .brace-live-progress{position:absolute;z-index:9;right:18px;top:72px;display:flex;gap:5px}.brace-live-progress i{width:18px;height:3px;border-radius:99px;background:rgba(31,92,169,.13);transition:width 220ms ease,background 220ms ease}.brace-live-progress i.is-active{width:34px;background:#1762bd}
    .brace-live-stage{position:absolute;inset:64px clamp(18px,2vw,28px) 80px;min-height:0}
    .brace-live-panel{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(190px,.65fr);gap:14px;align-items:stretch;opacity:0;transform:translateY(14px) scale(.99);pointer-events:none;transition:opacity 300ms ease,transform 420ms cubic-bezier(.2,.8,.2,1)}.brace-live-panel[aria-hidden="false"]{opacity:1;transform:none;pointer-events:auto}
    .brace-live-stack{display:grid;gap:12px;align-content:start;min-width:0}.brace-live-card{min-width:0;padding:16px;border:1px solid rgba(255,255,255,.9);border-radius:20px;background:rgba(249,253,255,.66);box-shadow:inset 0 1px #fff,0 16px 36px rgba(29,84,155,.11);-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px)}.brace-live-card--focus{background:rgba(255,255,255,.8)}.brace-live-card small{display:block;margin-bottom:7px;color:#48719f;font-size:.57rem;font-weight:800;letter-spacing:.11em}.brace-live-card strong{display:block;color:#163f73;font-size:clamp(.86rem,1.05vw,.98rem);line-height:1.4}.brace-live-card p{margin:7px 0 0;color:#567595;font-size:.69rem;line-height:1.52}
    .brace-capture{display:grid;gap:10px}.brace-capture textarea{width:100%;min-height:98px;resize:none;padding:13px 14px;border:1px solid rgba(35,94,169,.15);border-radius:14px;outline:none;color:#173f73;background:rgba(242,250,255,.78);font:650 .72rem/1.55 var(--sc-font-body);transition:border-color 160ms ease,box-shadow 160ms ease,background 160ms ease}.brace-capture textarea:focus{border-color:rgba(22,91,177,.48);background:#fff;box-shadow:0 0 0 4px rgba(27,98,185,.09)}.brace-capture-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.brace-capture-row small{margin:0;color:#5c7897;font-size:.58rem}.brace-capture button,.brace-suggestion,.brace-memory,.brace-action{border:1px solid rgba(31,92,169,.14);border-radius:12px;color:#15509a;background:rgba(240,249,255,.82);font:750 .62rem var(--sc-font-body);cursor:pointer}.brace-capture button{min-height:38px;padding:0 12px;color:#fff;border-color:#1559ac;background:linear-gradient(145deg,#2674ce,#1252a9)}
    .brace-tags{display:flex;flex-wrap:wrap;gap:6px}.brace-tags span{padding:6px 8px;border:1px solid rgba(37,99,176,.12);border-radius:9px;color:#426c98;background:rgba(238,248,255,.7);font-size:.56rem;font-weight:720}.brace-processing{display:grid;gap:9px}.brace-process-row{display:grid;grid-template-columns:104px 1fr auto;gap:9px;align-items:center;color:#416b97;font-size:.59rem}.brace-process-row i{height:5px;overflow:hidden;border-radius:99px;background:rgba(31,91,166,.09)}.brace-process-row i::after{content:"";display:block;width:var(--fill,72%);height:100%;border-radius:inherit;background:linear-gradient(90deg,#4d91dd,#1761ba)}.brace-process-row b{color:#24588f;font-size:.56rem}
    .brace-memory-list{display:grid;gap:8px}.brace-memory{width:100%;padding:11px 12px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;text-align:left}.brace-memory:hover,.brace-memory[aria-pressed="true"]{background:#fff;box-shadow:0 10px 24px rgba(20,78,149,.09)}.brace-memory>i{width:8px;height:8px;border-radius:50%;background:#2a71c8}.brace-memory span{display:grid;gap:2px}.brace-memory strong{font-size:.64rem}.brace-memory small{margin:0;font-size:.53rem;color:#6883a0}.brace-memory em{font-style:normal;font-size:.53rem;color:#52769c}
    .brace-graph{position:relative;min-height:210px}.brace-graph svg{position:absolute;inset:0;width:100%;height:100%}.brace-graph path{fill:none;stroke:rgba(35,100,180,.28);stroke-width:1.6;stroke-dasharray:5 6}.brace-node{position:absolute;padding:8px 10px;border:1px solid rgba(255,255,255,.92);border-radius:12px;color:#20528f;background:rgba(248,253,255,.88);box-shadow:0 8px 22px rgba(24,80,150,.1);font:760 .57rem var(--sc-font-body);cursor:pointer;transition:transform 160ms ease,box-shadow 160ms ease}.brace-node:hover,.brace-node[aria-pressed="true"]{transform:translateY(-2px);box-shadow:0 12px 28px rgba(24,80,150,.15)}.brace-node.n1{left:2%;top:43%}.brace-node.n2{left:38%;top:4%}.brace-node.n3{right:2%;top:42%}.brace-node.n4{left:39%;bottom:2%}.brace-node.n5{right:13%;bottom:4%}
    .brace-query{display:grid;gap:9px}.brace-query-line{padding:12px 13px;border:1px solid rgba(34,95,170,.13);border-radius:13px;color:#254f82;background:rgba(241,249,255,.78);font-size:.69rem;line-height:1.5}.brace-answer{padding:14px;border:1px solid rgba(255,255,255,.92);border-radius:16px;background:#fff;box-shadow:0 13px 30px rgba(25,81,149,.1)}.brace-answer p{margin:0;color:#345e8c;font-size:.7rem;line-height:1.62}.brace-answer strong{color:#123f77}.brace-receipts{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}.brace-receipts button{padding:6px 8px;border:1px solid rgba(35,96,172,.12);border-radius:9px;color:#416c9a;background:rgba(236,248,255,.72);font:710 .54rem var(--sc-font-body);cursor:pointer}.brace-receipts button:hover{background:#fff}
    .brace-suggestions{display:flex;flex-wrap:wrap;gap:7px}.brace-suggestion{padding:8px 10px;text-align:left}.brace-suggestion:hover{background:#fff}.brace-actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.brace-action{min-height:72px;padding:11px;text-align:left;display:grid;align-content:center;gap:4px}.brace-action strong{font-size:.62rem}.brace-action span{font-size:.54rem;color:#64809d;line-height:1.4}.brace-action:hover,.brace-action.is-done{background:#fff;box-shadow:0 10px 25px rgba(22,78,146,.1)}.brace-action.is-done strong::after{content:"  ✓";color:#1765bc}
    .brace-inspector{display:grid;align-content:start;gap:10px}.brace-inspector-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.brace-inspector-head b{color:#174b87;font-size:.6rem;letter-spacing:.08em}.brace-inspector-head span{padding:5px 7px;border-radius:8px;color:#1a5da9;background:rgba(221,239,255,.8);font-size:.51rem;font-weight:800}.brace-inspector dl{margin:0;display:grid;gap:9px}.brace-inspector dl div{padding-top:9px;border-top:1px solid rgba(34,94,169,.1)}.brace-inspector dt{color:#6b84a0;font-size:.52rem;font-weight:780;letter-spacing:.08em}.brace-inspector dd{margin:3px 0 0;color:#284f7e;font-size:.62rem;line-height:1.45}.brace-inspector blockquote{margin:0;padding:11px 12px;border-left:2px solid #2b70c5;border-radius:0 12px 12px 0;color:#365f8d;background:rgba(237,248,255,.68);font-size:.61rem;line-height:1.5}
    .brace-command{position:absolute;z-index:9;left:clamp(18px,2vw,28px);right:clamp(18px,2vw,28px);bottom:18px;min-height:50px;padding:9px 12px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.95);border-radius:16px;background:rgba(249,253,255,.78);box-shadow:inset 0 1px #fff,0 12px 30px rgba(22,76,149,.12);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}.brace-command>span{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;color:#fff;background:linear-gradient(145deg,#2874ce,#1051a8);font-size:.68rem;font-weight:850}.brace-command output{overflow:hidden;color:#345d8b;font-size:.68rem;white-space:nowrap;text-overflow:ellipsis}.brace-command kbd{padding:5px 7px;border:1px solid rgba(39,97,169,.13);border-radius:8px;color:#597694;background:rgba(229,244,255,.74);font:600 .55rem ui-monospace,SFMono-Regular,Menlo,monospace}
    .brace-demo-toast{position:absolute;z-index:12;right:18px;bottom:78px;max-width:260px;padding:9px 11px;border:1px solid rgba(255,255,255,.95);border-radius:12px;color:#245182;background:rgba(255,255,255,.91);box-shadow:0 16px 36px rgba(21,76,145,.15);font-size:.59rem;line-height:1.45;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 180ms ease,transform 180ms ease}.brace-demo-toast.is-visible{opacity:1;transform:none}
    .brace-live-act[data-in-view="true"]:not([data-paused="true"]) .brace-live-statusline i{animation:bracePulse 2.8s ease-in-out infinite}@keyframes bracePulse{50%{box-shadow:0 0 0 8px rgba(26,103,201,0)}}
    @media(max-width:980px){.brace-live-act{min-height:auto}.brace-live-sticky{position:relative;min-height:auto;padding:108px var(--sc-gutter) 76px}.brace-live-wrap{grid-template-columns:1fr;gap:34px}.brace-live-copy h2{max-width:11ch}.brace-live-copy>p:not(.overline){max-width:52ch}.brace-live-story{min-height:auto}.brace-live-shell{transform:none!important}.brace-live-window{min-height:680px}}
    @media(max-width:720px){.brace-live-sticky{padding:94px 12px 64px}.brace-live-window{min-height:690px;border-radius:26px}.brace-live-toolbar{height:52px;padding:0 12px}.brace-live-toolbar>strong{font-size:.57rem}.brace-live-toolbar>small{font-size:.52rem}.brace-live-body{min-height:638px;grid-template-columns:1fr;grid-template-rows:auto 1fr}.brace-live-rail{padding:8px;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid rgba(38,97,169,.12);scrollbar-width:none}.brace-live-rail::-webkit-scrollbar{display:none}.brace-live-mode{flex:0 0 88px;min-height:48px}.brace-live-mode[aria-pressed="true"]{transform:none}.brace-live-workspace{padding:14px}.brace-live-progress{display:none}.brace-live-stage{inset:54px 14px 76px}.brace-live-panel{grid-template-columns:1fr;overflow:auto;padding-right:2px}.brace-inspector{display:none}.brace-live-card{padding:13px}.brace-graph{min-height:180px}.brace-actions-grid{grid-template-columns:1fr 1fr}.brace-command{left:14px;right:14px;bottom:14px}.brace-command kbd{display:none}.brace-live-copy{padding-inline:4px}.brace-live-actions a{display:none}}
    @media(max-width:420px){.brace-live-window{min-height:675px}.brace-live-body{min-height:623px}.brace-live-stage{bottom:72px}.brace-actions-grid{grid-template-columns:1fr}.brace-node{font-size:.52rem;padding:7px 8px}.brace-node.n5{display:none}.brace-capture textarea{min-height:88px}}
    @media(prefers-reduced-motion:reduce){.brace-live-act::before,.brace-live-act::after,.brace-live-shell{transform:none!important}.brace-live-panel,.brace-live-mode,.brace-live-actions button,.brace-live-actions a,.brace-node,.brace-demo-toast{transition:none!important}.brace-live-statusline i{animation:none!important}}
  `;
  document.head.append(style);

  const product = document.querySelector("#product");
  if (!product) return;

  const section = document.createElement("section");
  section.id = "live-preview";
  section.className = "brace-live-act";
  section.dataset.braceLive = "";
  section.dataset.liveState = "0";
  section.dataset.paused = "false";
  section.innerHTML = `
    <div class="brace-live-sticky">
      <div class="brace-live-wrap">
        <header class="brace-live-copy">
          <p class="overline">TRY THE MEMORY LOOP</p>
          <h2>Use BRACE before you install it.</h2>
          <p>This is a deterministic product simulation using synthetic project data. Nothing is sent to an AI service and nothing you type here leaves this page.</p>
          <p class="brace-live-trust"><i></i><span>Interactive preview · synthetic Northstar workspace · no network request</span></p>
          <div class="brace-live-story" aria-live="polite">
            <strong data-live-step-label>01 · CAPTURE</strong>
            <h3 data-live-title>Save one decision worth remembering.</h3>
            <p data-live-description>Capture a useful point in plain language. BRACE keeps the memory and its source relationship visible.</p>
          </div>
          <div class="brace-live-actions">
            <button type="button" data-live-reset>Replay from Capture</button>
            <button type="button" data-live-pause aria-pressed="false">Pause motion</button>
            <a href="guide/#recall">Learn the real workflow →</a>
          </div>
        </header>

        <div class="brace-live-shell">
          <div class="brace-live-window" aria-label="Interactive BRACE product simulation">
            <header class="brace-live-toolbar"><span aria-hidden="true"><i></i><i></i><i></i></span><strong>BRACE · NORTHSTAR</strong><small>LOCAL PREVIEW</small></header>
            <div class="brace-live-body">
              <nav class="brace-live-rail" aria-label="Live demo stages">
                <button class="brace-live-mode" type="button" data-live-target="0" aria-pressed="true"><b>Capture</b><small>remember</small></button>
                <button class="brace-live-mode" type="button" data-live-target="1" aria-pressed="false"><b>Understand</b><small>index</small></button>
                <button class="brace-live-mode" type="button" data-live-target="2" aria-pressed="false"><b>Connect</b><small>relate</small></button>
                <button class="brace-live-mode" type="button" data-live-target="3" aria-pressed="false"><b>Recall</b><small>answer</small></button>
                <button class="brace-live-mode" type="button" data-live-target="4" aria-pressed="false"><b>Act</b><small>continue</small></button>
              </nav>
              <div class="brace-live-workspace">
                <div class="brace-live-statusline"><span><i></i><span data-live-runtime>LOCAL MEMORY READY</span></span><b data-live-status>CAPTURE READY</b></div>
                <div class="brace-live-progress" aria-hidden="true"><i class="is-active"></i><i></i><i></i><i></i><i></i></div>

                <div class="brace-live-stage">
                  <section class="brace-live-panel" data-live-panel="0" aria-hidden="false">
                    <div class="brace-live-stack">
                      <div class="brace-live-card brace-live-card--focus">
                        <small>QUICK CAPTURE</small>
                        <form class="brace-capture" data-live-capture>
                          <textarea data-live-input aria-label="Memory to capture">Remember that the BRACE Brain launch should prioritize privacy, local storage, and fast recall.</textarea>
                          <div class="brace-capture-row"><small>Project · Northstar launch</small><button type="submit">Save memory</button></div>
                        </form>
                      </div>
                      <div class="brace-live-card"><small>SOURCE BOUNDARY</small><strong>launch-notes.md remains the canonical source.</strong><p>The preview stores only a synthetic durable memory and a source receipt.</p></div>
                    </div>
                    <aside class="brace-live-card brace-inspector">
                      <div class="brace-inspector-head"><b>MEMORY DRAFT</b><span>PROJECT</span></div>
                      <dl><div><dt>Scope</dt><dd>Northstar launch</dd></div><div><dt>Type</dt><dd>Decision</dd></div><div><dt>Source</dt><dd>launch-notes.md · § launch priorities</dd></div></dl>
                    </aside>
                  </section>

                  <section class="brace-live-panel" data-live-panel="1" aria-hidden="true">
                    <div class="brace-live-stack">
                      <div class="brace-live-card brace-live-card--focus"><small>UNDERSTAND · LOCAL PROCESSING</small><strong data-live-memory-title>Launch should prioritize privacy, local storage, and fast recall.</strong><div class="brace-tags" data-live-tags><span>privacy</span><span>local-first</span><span>recall</span><span>launch</span></div></div>
                      <div class="brace-live-card brace-processing" aria-label="Synthetic indexing results">
                        <div class="brace-process-row"><span>Classification</span><i style="--fill:92%"></i><b>Decision</b></div>
                        <div class="brace-process-row"><span>Project match</span><i style="--fill:88%"></i><b>Northstar</b></div>
                        <div class="brace-process-row"><span>Source link</span><i style="--fill:100%"></i><b>Attached</b></div>
                        <div class="brace-process-row"><span>Related context</span><i style="--fill:74%"></i><b>3 found</b></div>
                      </div>
                    </div>
                    <aside class="brace-live-card brace-inspector"><div class="brace-inspector-head"><b>WHY THIS MATTERS</b><span>LOCAL</span></div><p>BRACE turns a raw note into structured context without hiding the original source.</p><blockquote data-live-source-excerpt>“Prioritize privacy, local storage, and fast recall for launch.”</blockquote></aside>
                  </section>

                  <section class="brace-live-panel" data-live-panel="2" aria-hidden="true">
                    <div class="brace-live-stack">
                      <div class="brace-live-card brace-live-card--focus"><small>CONNECT · RELATIONSHIP VIEW</small><strong>One decision joins the context around it.</strong>
                        <div class="brace-graph" aria-label="Inspectable synthetic memory relationships">
                          <svg viewBox="0 0 430 210" aria-hidden="true"><path d="M64 106 C134 106 146 35 205 35"/><path d="M205 35 C278 35 286 105 360 105"/><path d="M205 35 C205 92 205 135 205 184"/><path d="M64 106 C132 106 146 184 205 184"/><path d="M205 184 C275 184 296 165 353 179"/></svg>
                          <button type="button" class="brace-node n1" data-memory-id="source" aria-pressed="false">launch-notes.md</button>
                          <button type="button" class="brace-node n2" data-memory-id="decision" aria-pressed="true">Launch decision</button>
                          <button type="button" class="brace-node n3" data-memory-id="privacy" aria-pressed="false">Privacy architecture</button>
                          <button type="button" class="brace-node n4" data-memory-id="project" aria-pressed="false">Northstar</button>
                          <button type="button" class="brace-node n5" data-memory-id="recall" aria-pressed="false">Recall UX</button>
                        </div>
                      </div>
                    </div>
                    <aside class="brace-live-card brace-inspector" data-live-inspector><div class="brace-inspector-head"><b>LAUNCH DECISION</b><span>DECISION</span></div><dl><div><dt>Connected to</dt><dd>Northstar · Privacy architecture · Recall UX</dd></div><div><dt>Evidence</dt><dd>launch-notes.md</dd></div><div><dt>Why connected</dt><dd>Shared project scope and launch-priority concepts.</dd></div></dl></aside>
                  </section>

                  <section class="brace-live-panel" data-live-panel="3" aria-hidden="true">
                    <div class="brace-live-stack">
                      <div class="brace-live-card brace-live-card--focus"><small>RECALL · ASK THE MEMORY</small><div class="brace-query"><div class="brace-query-line" data-live-query>What decisions have we already made about BRACE storage?</div><div class="brace-suggestions"><button class="brace-suggestion" type="button" data-query="storage">Storage decisions</button><button class="brace-suggestion" type="button" data-query="launch">Launch priorities</button><button class="brace-suggestion" type="button" data-query="privacy">Privacy choices</button></div></div></div>
                      <div class="brace-answer" data-live-answer><p><strong>Two decisions are already established.</strong> BRACE should keep project memory local by default, and the launch experience should make that privacy boundary obvious. Remote embeddings are optional rather than required.</p><div class="brace-receipts"><button type="button" data-receipt="storage">architecture.md · storage</button><button type="button" data-receipt="launch">launch-notes.md · priorities</button></div></div>
                    </div>
                    <aside class="brace-live-card brace-inspector" data-recall-inspector><div class="brace-inspector-head"><b>EVIDENCE</b><span>2 SOURCES</span></div><blockquote>“Files stay canonical; memory is stored locally beside explicit source references.”</blockquote><p>Receipts remain distinct from the generated summary.</p></aside>
                  </section>

                  <section class="brace-live-panel" data-live-panel="4" aria-hidden="true">
                    <div class="brace-live-stack">
                      <div class="brace-live-card brace-live-card--focus"><small>ACT · CONTINUE THE WORK</small><strong>Turn recalled context into the next useful move.</strong><p>No autonomous action is taken in this preview. Pick a deterministic next step.</p></div>
                      <div class="brace-actions-grid">
                        <button type="button" class="brace-action" data-act="checklist"><strong>Create implementation checklist</strong><span>Convert the launch decisions into a bounded next-step list.</span></button>
                        <button type="button" class="brace-action" data-act="summary"><strong>Summarize decisions</strong><span>Produce a concise project handoff from the recalled context.</span></button>
                        <button type="button" class="brace-action" data-act="sources"><strong>Open connected notes</strong><span>Return to the exact synthetic evidence behind the answer.</span></button>
                        <button type="button" class="brace-action" data-act="continue"><strong>Continue project</strong><span>Carry the context into a compatible AI workspace.</span></button>
                      </div>
                    </div>
                    <aside class="brace-live-card brace-inspector" data-act-inspector><div class="brace-inspector-head"><b>NEXT STEP</b><span>YOU CHOOSE</span></div><p>BRACE keeps memory useful by making the transition from context to action explicit.</p><dl><div><dt>Permission</dt><dd>No write action without user intent.</dd></div><div><dt>Context</dt><dd>Northstar + source receipts</dd></div></dl></aside>
                  </section>
                </div>

                <div class="brace-command"><span aria-hidden="true">B</span><output data-live-command>Remember the launch priorities and keep the source attached.</output><kbd>LOCAL</kbd></div>
                <div class="brace-demo-toast" role="status" aria-live="polite" data-live-toast></div>
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
    {label:"01 · CAPTURE",title:"Save one decision worth remembering.",description:"Capture a useful point in plain language. BRACE keeps the memory and its source relationship visible.",status:"CAPTURE READY",runtime:"LOCAL MEMORY READY",command:"Remember the launch priorities and keep the source attached."},
    {label:"02 · UNDERSTAND",title:"Structure the meaning without hiding the source.",description:"Classification, project scope, tags, and related context make the memory useful later—while the original evidence remains inspectable.",status:"INDEXED LOCALLY",runtime:"4 SIGNALS EXTRACTED",command:"Classify the memory, attach project scope, and find related context."},
    {label:"03 · CONNECT",title:"See where this decision belongs.",description:"The memory joins a project, a source, and related decisions instead of becoming another isolated note.",status:"4 RELATIONSHIPS",runtime:"GRAPH UPDATED",command:"Show what this launch decision connects to."},
    {label:"04 · RECALL",title:"Ask a real question. Keep the receipts.",description:"BRACE returns a concise answer and keeps durable memory visibly separate from the source evidence supporting it.",status:"EVIDENCE FOUND",runtime:"HYBRID RECALL",command:"What decisions have we already made about BRACE storage?"},
    {label:"05 · ACT",title:"Turn remembered context into the next useful move.",description:"The point of memory is continuation. Convert what BRACE knows into a checklist, a handoff, connected notes, or a bounded AI context.",status:"READY FOR ACTION",runtime:"USER CONTROLLED",command:"Continue the Northstar launch with the decisions already made."}
  ];

  const buttons = Array.from(section.querySelectorAll("[data-live-target]"));
  const panels = Array.from(section.querySelectorAll("[data-live-panel]"));
  const meters = Array.from(section.querySelectorAll(".brace-live-progress i"));
  const stepLabel = section.querySelector("[data-live-step-label]");
  const title = section.querySelector("[data-live-title]");
  const description = section.querySelector("[data-live-description]");
  const status = section.querySelector("[data-live-status]");
  const runtime = section.querySelector("[data-live-runtime]");
  const command = section.querySelector("[data-live-command]");
  const pause = section.querySelector("[data-live-pause]");
  const reset = section.querySelector("[data-live-reset]");
  const input = section.querySelector("[data-live-input]");
  const captureForm = section.querySelector("[data-live-capture]");
  const memoryTitle = section.querySelector("[data-live-memory-title]");
  const sourceExcerpt = section.querySelector("[data-live-source-excerpt]");
  const toast = section.querySelector("[data-live-toast]");
  let active = 0;
  let inView = false;
  let scrollTick = false;
  let pointerTick = false;
  let toastTimer = 0;
  let nextPointer = {x:0,y:0};

  const announce = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  };

  const setMode = (next, shouldAnnounce = true) => {
    const index = clamp(Number(next) || 0, 0, modes.length - 1);
    active = index;
    section.dataset.liveState = String(index);
    section.dataset.liveReady = "true";
    section.dataset.scVerifyState = `live:${index}`;
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    panels.forEach((panel, i) => panel.setAttribute("aria-hidden", String(i !== index)));
    meters.forEach((meter, i) => meter.classList.toggle("is-active", i === index));
    if (stepLabel) stepLabel.textContent = modes[index].label;
    if (title) title.textContent = modes[index].title;
    if (description) description.textContent = modes[index].description;
    if (status) status.textContent = modes[index].status;
    if (runtime) runtime.textContent = modes[index].runtime;
    if (command) command.textContent = modes[index].command;
    const story = section.querySelector(".brace-live-story");
    story?.setAttribute("aria-live", shouldAnnounce ? "polite" : "off");
    if (innerWidth <= 720) buttons[index]?.scrollIntoView({behavior:reduce?"auto":"smooth",block:"nearest",inline:"center"});
  };

  const progressForMode = (index) => [0.04,.27,.5,.73,.96][index] || 0;
  const scrollToMode = (index) => {
    if (innerWidth <= 980 || reduce) { setMode(index); return; }
    const travel = Math.max(1, section.offsetHeight - innerHeight);
    scrollTo({top:section.offsetTop + travel * progressForMode(index),behavior:"smooth"});
  };
  buttons.forEach((button) => button.addEventListener("click", () => scrollToMode(Number(button.dataset.liveTarget))));

  captureForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (input?.value || "").trim() || "Remember the launch priorities and keep the source attached.";
    const short = value.replace(/^remember\s+(that\s+)?/i, "").replace(/[.!]+$/, "");
    if (memoryTitle) memoryTitle.textContent = short.charAt(0).toUpperCase() + short.slice(1) + ".";
    if (sourceExcerpt) sourceExcerpt.textContent = `“${short.charAt(0).toUpperCase() + short.slice(1)}.”`;
    announce("Memory captured locally in the preview.");
    setMode(1);
  });

  const memoryDetails = {
    source:{title:"SOURCE",type:"EVIDENCE",rows:[["File","launch-notes.md"],["Section","Launch priorities"],["Role","Canonical evidence"]]},
    decision:{title:"LAUNCH DECISION",type:"DECISION",rows:[["Connected to","Northstar · Privacy architecture · Recall UX"],["Evidence","launch-notes.md"],["Why connected","Shared project scope and launch-priority concepts."]]},
    privacy:{title:"PRIVACY ARCHITECTURE",type:"DECISION",rows:[["Scope","Global"],["Decision","Local-first storage"],["Connection","Same launch privacy constraint"]]},
    project:{title:"NORTHSTAR",type:"PROJECT",rows:[["Status","Launch planning"],["Memories","14 synthetic"],["Sources","6 synthetic files"]]},
    recall:{title:"RECALL UX",type:"DESIGN",rows:[["Goal","Evidence-aware retrieval"],["Related","Launch decision"],["Reason","Fast recall is a launch priority"]]}
  };
  const inspector = section.querySelector("[data-live-inspector]");
  const renderInspector = (id) => {
    const data = memoryDetails[id];
    if (!data || !inspector) return;
    inspector.innerHTML = `<div class="brace-inspector-head"><b>${data.title}</b><span>${data.type}</span></div><dl>${data.rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
    section.querySelectorAll("[data-memory-id]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.memoryId === id)));
  };
  section.querySelectorAll("[data-memory-id]").forEach((node) => node.addEventListener("click", () => renderInspector(node.dataset.memoryId)));

  const queries = {
    storage:{q:"What decisions have we already made about BRACE storage?",a:"<strong>Two decisions are already established.</strong> BRACE should keep project memory local by default, and remote embeddings remain optional rather than required.",receipts:["architecture.md · storage","settings.md · embeddings"]},
    launch:{q:"What are the launch priorities for BRACE?",a:"<strong>Three priorities are consistent across the project.</strong> Make privacy obvious, keep memory local by default, and make recall fast enough to feel immediate.",receipts:["launch-notes.md · priorities","architecture.md · privacy"]},
    privacy:{q:"What privacy choices are already decided?",a:"<strong>The privacy boundary is explicit.</strong> Files remain canonical, durable memory stays local, and network access is opt-in for compatible providers.",receipts:["architecture.md · privacy","connections.md · boundaries"]}
  };
  const queryLine = section.querySelector("[data-live-query]");
  const answer = section.querySelector("[data-live-answer]");
  const recallInspector = section.querySelector("[data-recall-inspector]");
  const renderQuery = (key) => {
    const data = queries[key] || queries.storage;
    if (queryLine) queryLine.textContent = data.q;
    if (answer) answer.innerHTML = `<p>${data.a}</p><div class="brace-receipts">${data.receipts.map((r,i)=>`<button type="button" data-receipt="${key}-${i}">${r}</button>`).join("")}</div>`;
    if (command) command.textContent = data.q;
    if (recallInspector) recallInspector.querySelector("span").textContent = `${data.receipts.length} SOURCES`;
  };
  section.querySelectorAll("[data-query]").forEach((node) => node.addEventListener("click", () => {renderQuery(node.dataset.query);announce("Recall refreshed from synthetic local context.");}));
  answer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-receipt]");
    if (!button) return;
    announce(`Opened evidence receipt: ${button.textContent.trim()}`);
  });

  section.querySelectorAll("[data-act]").forEach((node) => node.addEventListener("click", () => {
    section.querySelectorAll("[data-act]").forEach((item) => item.classList.remove("is-done"));
    node.classList.add("is-done");
    const messages = {checklist:"Implementation checklist prepared from the recalled decisions.",summary:"Decision handoff summarized with source receipts.",sources:"Connected synthetic source notes opened in the preview.",continue:"Bounded context capsule prepared for a compatible AI workspace."};
    announce(messages[node.dataset.act] || "Next step prepared.");
  }));

  const syncScroll = () => {
    scrollTick = false;
    if (!inView || innerWidth <= 980 || reduce) return;
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, rect.height - innerHeight);
    const progress = clamp(-rect.top / travel, 0, 1);
    section.style.setProperty("--live-p", progress.toFixed(4));
    const next = Math.min(4, Math.floor(progress * 5));
    setMode(next, false);
  };
  addEventListener("scroll", () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(syncScroll); } }, {passive:true});
  addEventListener("resize", syncScroll, {passive:true});

  const observer = new IntersectionObserver((entries) => {
    inView = Boolean(entries[0]?.isIntersecting);
    section.dataset.inView = String(inView);
    if (inView) syncScroll();
  }, {rootMargin:"18% 0px",threshold:.01});
  observer.observe(section);

  if (finePointer && !reduce) {
    section.addEventListener("pointermove", (event) => {
      const rect = section.getBoundingClientRect();
      nextPointer = {x:clamp(((event.clientX-rect.left)/Math.max(1,rect.width)-.5)*2,-1,1),y:clamp(((event.clientY-rect.top)/Math.max(1,Math.min(rect.height,innerHeight))-.5)*2,-1,1)};
      if (pointerTick) return;
      pointerTick = true;
      requestAnimationFrame(() => {pointerTick=false;section.style.setProperty("--live-px",nextPointer.x.toFixed(3));section.style.setProperty("--live-py",nextPointer.y.toFixed(3));});
    }, {passive:true});
    section.addEventListener("pointerleave", () => {section.style.setProperty("--live-px","0");section.style.setProperty("--live-py","0");});
  }

  pause?.addEventListener("click", () => {
    const paused = section.dataset.paused === "true";
    section.dataset.paused = String(!paused);
    pause.setAttribute("aria-pressed", String(!paused));
    pause.textContent = paused ? "Pause motion" : "Resume motion";
  });
  reset?.addEventListener("click", () => {
    section.dataset.paused = "false";
    pause?.setAttribute("aria-pressed","false");
    if (pause) pause.textContent = "Pause motion";
    if (input) input.value = "Remember that the BRACE Brain launch should prioritize privacy, local storage, and fast recall.";
    renderInspector("decision");
    renderQuery("storage");
    section.querySelectorAll("[data-act]").forEach((item)=>item.classList.remove("is-done"));
    if (innerWidth > 980 && !reduce) scrollToMode(0); else setMode(0);
  });

  setMode(0, false);
})();
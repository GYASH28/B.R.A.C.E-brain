(() => {
  "use strict";

  if (document.querySelector("[data-guide-live-coach]")) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toc = document.querySelector(".guide-toc");
  const route = document.querySelector(".guide-route");
  const steps = Array.from(document.querySelectorAll(".guide-step"));
  if (!toc || !route || !steps.length) return;

  document.documentElement.dataset.braceGuideExperience = "living-v7";

  const style = document.createElement("style");
  style.dataset.braceGuideLivingStyles = "v7";
  style.textContent = String.raw`
    .guide-live-coach{--coach-p:0;position:relative;margin:18px 0 2px;padding:14px;overflow:hidden;border:1px solid rgba(255,255,255,.88);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(229,245,255,.48));box-shadow:inset 0 1px #fff,0 16px 38px rgba(19,72,143,.12);-webkit-backdrop-filter:blur(19px);backdrop-filter:blur(19px)}
    .guide-live-coach::before{content:"";position:absolute;width:130px;aspect-ratio:1;right:-48px;top:-54px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.9),rgba(123,184,246,.1) 58%,transparent 72%);pointer-events:none}
    .guide-live-head{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px}.guide-live-head strong{color:#174e8f;font-size:.61rem;letter-spacing:.12em}.guide-live-head span{display:inline-flex;align-items:center;gap:6px;color:#55789c;font-size:.56rem;font-weight:760}.guide-live-head span i{width:6px;height:6px;border-radius:50%;background:#1764bd;box-shadow:0 0 0 4px rgba(23,100,189,.1)}
    .guide-live-screen{position:relative;z-index:2;margin-top:11px;min-height:145px;padding:12px;overflow:hidden;border:1px solid rgba(255,255,255,.84);border-radius:16px;background:rgba(244,251,255,.6);box-shadow:inset 0 1px #fff,inset 0 -24px 40px rgba(56,121,203,.06)}
    .guide-live-orb{position:absolute;width:54px;height:54px;right:17px;top:17px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.95);border-radius:50%;background:radial-gradient(circle at 33% 25%,#fff,rgba(219,240,255,.96) 32%,rgba(60,135,222,.76));box-shadow:inset -7px -8px 16px rgba(19,82,163,.16),0 12px 24px rgba(21,77,147,.17)}.guide-live-orb img{width:24px;height:24px}.guide-live-coach:not([data-paused="true"]) .guide-live-orb{animation:guideOrb 3.6s ease-in-out infinite}@keyframes guideOrb{50%{transform:translateY(-3px);box-shadow:inset -7px -8px 16px rgba(19,82,163,.16),0 16px 30px rgba(21,77,147,.22)}}
    .guide-live-screen small{display:block;max-width:calc(100% - 76px);color:#5d7d9e;font-size:.55rem;font-weight:800;letter-spacing:.1em}.guide-live-screen h3{max-width:calc(100% - 68px);margin:8px 0 4px!important;color:#123e72!important;font-size:.92rem!important;line-height:1.2;letter-spacing:-.02em}.guide-live-screen p{max-width:calc(100% - 16px);margin:0!important;color:#54779b!important;font-size:.62rem!important;line-height:1.45!important}.guide-live-chips{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:5px;overflow:hidden}.guide-live-chips span{min-width:0;padding:6px 7px;overflow:hidden;border:1px solid rgba(37,96,167,.1);border-radius:8px;color:#3d6795;background:rgba(234,247,255,.75);font-size:.52rem;font-weight:720;white-space:nowrap;text-overflow:ellipsis}
    .guide-live-progress{position:relative;z-index:2;margin:11px 1px 0;height:3px;overflow:hidden;border-radius:99px;background:rgba(33,91,161,.11)}.guide-live-progress i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#2168bd,#79b7f5);transform:scaleX(var(--coach-p));transform-origin:left;transition:transform 280ms cubic-bezier(.2,.8,.2,1)}
    .guide-live-status{position:relative;z-index:2;min-height:56px;margin-top:10px}.guide-live-status strong{display:block;color:#17477f;font-size:.68rem}.guide-live-status p{margin:4px 0 0;color:#5a7b9e;font-size:.58rem;line-height:1.45}
    .guide-live-controls{position:relative;z-index:2;margin-top:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.guide-live-controls button{min-height:38px;padding:0 5px;border:1px solid rgba(255,255,255,.88);border-radius:10px;color:#24578f;background:rgba(247,252,255,.66);font:inherit;font-size:.55rem;font-weight:780;cursor:pointer}.guide-live-controls button:hover{background:#fff}.guide-live-controls button:focus-visible{outline:2px solid #0d57ad;outline-offset:2px}
    .guide-live-coach[data-stage="install"] .guide-live-chips span:nth-child(1),.guide-live-coach[data-stage="import"] .guide-live-chips span:nth-child(1),.guide-live-coach[data-stage="recall"] .guide-live-chips span:nth-child(2),.guide-live-coach[data-stage="structure"] .guide-live-chips span:nth-child(2),.guide-live-coach[data-stage="connect"] .guide-live-chips span:nth-child(3),.guide-live-coach[data-stage="privacy"] .guide-live-chips span:nth-child(3){color:#0f4e99;background:rgba(255,255,255,.95);box-shadow:0 5px 15px rgba(24,76,145,.09)}
    @media(min-width:861px){
      .guide-live-coach{margin-top:15px;padding:10px;border-radius:16px}
      .guide-live-head{align-items:flex-start}.guide-live-head strong{max-width:14ch;font-size:.52rem;line-height:1.35}.guide-live-head span{width:9px;font-size:0;gap:0}.guide-live-head span i{width:7px;height:7px}
      .guide-live-screen{min-height:132px;margin-top:9px;padding:10px;border-radius:13px}
      .guide-live-orb{width:38px;height:38px;right:8px;top:8px}.guide-live-orb img{width:18px;height:18px}
      .guide-live-screen small{max-width:calc(100% - 46px);font-size:.47rem;letter-spacing:.08em}
      .guide-live-screen h3{max-width:calc(100% - 40px);margin-top:6px!important;font-size:.77rem!important;line-height:1.14}
      .guide-live-screen p{display:none}
      .guide-live-chips{left:9px;right:9px;bottom:9px;gap:3px}.guide-live-chips span{padding:5px 4px;border-radius:7px;font-size:.44rem;text-align:center}
      .guide-live-progress{margin-top:9px}
      .guide-live-status{min-height:61px;margin-top:8px}.guide-live-status strong{font-size:.6rem}.guide-live-status p{font-size:.52rem;line-height:1.38}
      .guide-live-controls{grid-template-columns:repeat(2,1fr);gap:4px;margin-top:8px}.guide-live-controls button{min-height:34px;font-size:.5rem;border-radius:8px}
    }
    @media(max-width:860px){.guide-live-coach{width:min(760px,calc(100% - 32px));margin:24px auto 0;padding:16px;border-radius:22px}.guide-live-screen{min-height:154px}.guide-live-controls button{min-height:44px}.guide-live-status{min-height:48px}}
    @media(max-width:520px){.guide-live-coach{width:calc(100% - 20px);padding:12px}.guide-live-controls{grid-template-columns:repeat(2,1fr)}.guide-live-screen h3{max-width:calc(100% - 62px);font-size:.86rem!important}.guide-live-status{min-height:62px}}
    @media(prefers-reduced-motion:reduce){.guide-live-orb,.guide-live-progress i{animation:none!important;transition:none!important}}
  `;
  document.head.append(style);

  const coach = document.createElement("section");
  coach.className = "guide-live-coach";
  coach.dataset.guideLiveCoach = "";
  coach.dataset.stage = "install";
  coach.innerHTML = `
    <header class="guide-live-head"><strong>LIVE GUIDE COMPANION</strong><span><i></i>INTERACTIVE PREVIEW</span></header>
    <div class="guide-live-screen" aria-label="Guide step preview">
      <div class="guide-live-orb" aria-hidden="true"><img src="../assets/brace-logo.svg" alt=""></div>
      <small data-coach-kicker>01 · OPEN BRACE</small>
      <h3 data-coach-title>Start with an empty local workspace.</h3>
      <p data-coach-screen-copy>Choose your package, open BRACE, then decide whether to import your own project or explore the synthetic demo.</p>
      <div class="guide-live-chips" aria-hidden="true"><span>Context</span><span>Memory</span><span>Connection</span></div>
    </div>
    <div class="guide-live-progress" aria-hidden="true"><i></i></div>
    <div class="guide-live-status" aria-live="polite"><strong data-coach-status>Do this in BRACE</strong><p data-coach-description>The guide stays readable without this animation; the companion only mirrors the step you are currently reading.</p></div>
    <div class="guide-live-controls">
      <button type="button" data-coach-prev aria-label="Previous guide step">← Prev</button>
      <button type="button" data-coach-next aria-label="Next guide step">Next →</button>
      <button type="button" data-coach-pause aria-pressed="false">Pause</button>
      <button type="button" data-coach-reset>Reset</button>
    </div>`;

  const tocStatus = toc.querySelector(".toc-status");
  if (tocStatus) tocStatus.before(coach); else toc.append(coach);

  const copyById = {
    install: {stage:"install", kicker:"01 · INSTALL", title:"Put BRACE on this computer.", screen:"Choose the versioned Windows or Linux package, verify it, then open BRACE.", status:"Do this in BRACE", description:"Installation happens on your computer; this preview does not install anything."},
    "first-run": {stage:"install", kicker:"02 · FIRST RUN", title:"Choose empty memory or the synthetic demo.", screen:"A new install starts with no personal memory. You explicitly choose what enters the workspace.", status:"Interactive preview", description:"The fictional Northstar profile is safe to explore because it contains no personal data."},
    import: {stage:"import", kicker:"03 · IMPORT", title:"Bring in one focused project boundary.", screen:"Select a project or notes folder. BRACE indexes supported text while the originals remain canonical.", status:"Do this in BRACE", description:"The website never receives the folder you choose in the desktop app."},
    recall: {stage:"recall", kicker:"04 · RECALL", title:"Search memory with evidence still visible.", screen:"Ask a specific question, then inspect durable memory separately from source evidence.", status:"Interactive preview", description:"The companion demonstrates the flow; it is not running a live AI query."},
    structure: {stage:"structure", kicker:"05 · STRUCTURE", title:"Keep recurring memory work explicit.", screen:"Automation, review, timeline, graph, and skills all operate on the same local memory boundary.", status:"Example workspace", description:"Use Preview and permission surfaces before enabling an automation in the desktop app."},
    connect: {stage:"connect", kicker:"06 · CONNECT", title:"Hand bounded context to a compatible AI.", screen:"Connections expose the local BRACE memory through explicit permissions instead of silently uploading a vault.", status:"Do this in BRACE", description:"Connection setup belongs in BRACE; this website only shows the expected handoff."},
    privacy: {stage:"privacy", kicker:"07 · PROTECT", title:"Back up the memory you own.", screen:"Keep source files, the local database, and external network actions as separate trust boundaries.", status:"Privacy boundary", description:"Read the written instructions for the authoritative backup and privacy details."},
    troubleshooting: {stage:"privacy", kicker:"CHECK · TROUBLESHOOT", title:"Inspect the reported mode before changing anything.", screen:"Fallbacks and rejected files are surfaced deliberately so you can fix the cause without guessing.", status:"Reference", description:"The troubleshooting answers below remain the source of truth."}
  };

  const kicker = coach.querySelector("[data-coach-kicker]");
  const coachTitle = coach.querySelector("[data-coach-title]");
  const screenCopy = coach.querySelector("[data-coach-screen-copy]");
  const status = coach.querySelector("[data-coach-status]");
  const description = coach.querySelector("[data-coach-description]");
  const previous = coach.querySelector("[data-coach-prev]");
  const next = coach.querySelector("[data-coach-next]");
  const pause = coach.querySelector("[data-coach-pause]");
  const reset = coach.querySelector("[data-coach-reset]");
  let activeIndex = 0;

  const update = (index, announce = true) => {
    activeIndex = Math.max(0, Math.min(steps.length - 1, index));
    const step = steps[activeIndex];
    const copy = copyById[step.id] || copyById.install;
    coach.dataset.stage = copy.stage;
    coach.style.setProperty("--coach-p", String((activeIndex + 1) / steps.length));
    if (kicker) kicker.textContent = copy.kicker;
    if (coachTitle) coachTitle.textContent = copy.title;
    if (screenCopy) screenCopy.textContent = copy.screen;
    if (status) status.textContent = copy.status;
    if (description) description.textContent = copy.description;
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === steps.length - 1;
    coach.dataset.scVerifyState = `guide:${step.id}`;
    coach.querySelector(".guide-live-status")?.setAttribute("aria-live", announce ? "polite" : "off");
  };

  const go = (index) => {
    const targetIndex = Math.max(0, Math.min(steps.length - 1, index));
    update(targetIndex);
    steps[targetIndex].scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"});
  };
  previous.addEventListener("click", () => go(activeIndex - 1));
  next.addEventListener("click", () => go(activeIndex + 1));
  reset.addEventListener("click", () => go(0));
  pause.addEventListener("click", () => {
    const paused = coach.dataset.paused === "true";
    coach.dataset.paused = String(!paused);
    pause.setAttribute("aria-pressed", String(!paused));
    pause.textContent = paused ? "Pause" : "Resume";
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = steps.indexOf(visible.target);
    if (index >= 0 && index !== activeIndex) update(index, false);
  }, {rootMargin:"-18% 0px -62%", threshold:[0,.15,.4]});
  steps.forEach((step) => observer.observe(step));

  const placeCoach = () => {
    if (innerWidth <= 860) {
      if (coach.previousElementSibling !== route) route.after(coach);
    } else if (coach.parentElement !== toc) {
      const statusNode = toc.querySelector(".toc-status");
      if (statusNode) statusNode.before(coach); else toc.append(coach);
    }
  };
  addEventListener("resize", placeCoach, {passive:true});
  placeCoach();
  update(0, false);
})();

#!/usr/bin/env node
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BRACE_SITE_URL || 'http://127.0.0.1:4517';
const out = path.resolve(import.meta.dirname, '..', 'lab', 'cinematic');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME || '/usr/bin/google-chrome', headless: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function newPage(viewport, reducedMotion='no-preference', url=base) {
  const page = await browser.newPage({ viewport, reducedMotion });
  const errors = [];
  const failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => {
    const error = r.failure()?.errorText || 'failed';
    const intentionalOpeningSeekAbort = /brace-opening(?:-portrait)?\.mp4/i.test(r.url()) && /ERR_ABORTED/i.test(error);
    if (!intentionalOpeningSeekAbort) failed.push(`${r.url()} :: ${error}`);
  });
  await page.addInitScript(() => {
    window.__braceVitals = { cls:0, longTasks:0 };
    try { new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__braceVitals.cls += e.value; })).observe({type:'layout-shift',buffered:true}); } catch {}
    try { new PerformanceObserver(list => { window.__braceVitals.longTasks += list.getEntries().length; }).observe({type:'longtask',buffered:true}); } catch {}
  });
  await page.goto(url, { waitUntil:'networkidle' });
  if (url === base) await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === 'ready');
  else await page.waitForFunction(() => document.documentElement.dataset.braceGuideRuntime === 'ready');
  return { page, errors, failed };
}

async function goTo(page, selector, ratio=0) {
  await page.locator(selector).evaluate((el,ratio) => window.scrollTo({top:el.offsetTop + Math.max(0,el.offsetHeight-innerHeight)*ratio,behavior:'instant'}), ratio);
  await page.waitForTimeout(420);
}

async function assertNoPageOverflow(page, label, tolerance=2) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert(overflow <= tolerance, `${label} horizontal overflow ${overflow}px`);
}

async function assertNavClear(page, selector, gap, label) {
  const nav = await page.locator('[data-site-nav]').boundingBox();
  const target = await page.locator(selector).boundingBox();
  assert(nav && target && target.y > nav.y + nav.height + gap, `${label} collides with navigation`);
}

try {
  {
    const {page,errors,failed} = await newPage({width:1440,height:900});
    await assertNoPageOverflow(page,'desktop');
    const styleHrefs = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    assert(styleHrefs.some(x => x?.includes('scrollcraft-v3.css')), 'Scrollcraft v3 stylesheet missing');
    assert(!styleHrefs.some(x => x?.includes('cinematic-base') || x?.includes('cinematic-polish')), 'legacy cinematic CSS still loaded');

    assert(await page.locator('[data-opening-film]').count() === 1, 'opening film missing');
    assert(await page.locator('[data-opening-video]').count() === 1, 'opening video missing');
    const openingHeight = await page.locator('[data-opening-film]').evaluate(el => el.getBoundingClientRect().height);
    assert(openingHeight > 1700, 'opening film is not a real scroll-scrub sequence');
    const openingSource = await page.locator('[data-opening-video] source').getAttribute('src');
    assert(Boolean(openingSource?.includes('brace-opening')), 'opening film source not selected');
    await page.waitForFunction(() => {
      const video = document.querySelector('[data-opening-video]');
      return Boolean(video && (video.classList.contains('is-ready') || video.readyState >= 1));
    }, null, {timeout:5000});
    await page.screenshot({path:path.join(out,'01-opening.png')});

    await goTo(page,'#hero',0);
    await assertNavClear(page,'#hero h1',32,'desktop hero heading');
    const heroHTML = await page.locator('#hero').innerHTML();
    assert(!/app-(graph|overview|inbox|recall|connections|settings)\.(png|jpg|webp)/i.test(heroHTML), 'legacy product/reference screenshot is still used inside the hero');
    assert(await page.locator('.hero-topography').count() === 1, 'new procedural hero topography missing');
    assert(await page.locator('.hero-field').count() === 1, 'new procedural hero field missing');
    assert(await page.locator('[data-live-chat]').isVisible(), 'hero live memory console missing');
    const heroHeight = await page.locator('#hero').evaluate(el => el.offsetHeight);
    assert(heroHeight > 1500, 'hero is not a scroll-driven transition');
    const heroStagePosition = await page.locator('.hero-stage').evaluate(el => getComputedStyle(el).position);
    assert(heroStagePosition === 'sticky', 'desktop hero is not scroll-pinned');

    const heroStart = Number(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--hero-p')) || 0);
    await goTo(page,'#hero',.62);
    await page.waitForFunction(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--hero-p')) > .25, null, {timeout:2500});
    const heroMid = Number(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--hero-p')) || 0);
    assert(heroMid > heroStart + .25, 'hero scroll progress is not driving motion');
    await goTo(page,'#hero',0);

    const before = await page.locator('[data-chat-stream] .message').count();
    await page.locator('[data-chat-prompt="source"]').click();
    await page.waitForFunction(() => document.querySelector('[data-chat-state]')?.textContent === 'READY', null, {timeout:8000});
    const after = await page.locator('[data-chat-stream] .message').count();
    assert(after > before, 'live memory console did not append messages');
    assert(await page.locator('[data-chat-stream] .is-typing').count() === 0, 'chat left a broken typing fragment');
    assert((await page.locator('[data-chat-stream]').innerText()).toLowerCase().includes('launch review'), 'source prompt did not resolve to a source-backed response');
    await page.screenshot({path:path.join(out,'02-hero-v3.png')});

    const flow = page.locator('[data-side-scroll]');
    await flow.evaluate(el => window.scrollTo({top:el.offsetTop + (el.offsetHeight-innerHeight)*.667,behavior:'instant'}));
    await page.waitForFunction(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--flow-p')) > .58, null, {timeout:2500});
    await page.waitForTimeout(180);
    const transform = await page.locator('[data-side-rail]').evaluate(el => getComputedStyle(el).transform);
    assert(transform !== 'none' && !transform.includes('matrix(1, 0, 0, 1, 0, 0)'), 'horizontal story rail did not move');
    const flowProgress = Number(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--flow-p')) || 0);
    assert(flowProgress > .5 && flowProgress < .9, `flow progress looks broken (${flowProgress})`);
    const sceneVisibility = await page.evaluate(() => {
      const panels=[...document.querySelectorAll('[data-side-panel]')];
      const viewport=innerWidth;
      const active=panels.map((el,index) => { const r=el.getBoundingClientRect(); const visible=Math.max(0,Math.min(viewport,r.right)-Math.max(0,r.left)); return {index,visible}; }).sort((a,b)=>b.visible-a.visible)[0];
      return active ? {...active,viewport} : null;
    });
    assert(sceneVisibility?.visible > sceneVisibility?.viewport*.72, 'horizontal story does not resolve into a dominant cinematic scene');
    await page.screenshot({path:path.join(out,'03-flow-v3.png')});

    await goTo(page,'#brain',.44);
    await assertNavClear(page,'#brain h2',18,'brain heading');
    await page.locator('[data-brain-hotspot="evidence"]').click();
    assert((await page.locator('[data-brain-kind]').innerText()).includes('EVIDENCE'), 'brain hotspot did not update the relationship receipt');
    const brainScale = await page.locator('.brain-product').evaluate(el => getComputedStyle(el).transform);
    assert(brainScale !== 'none', 'brain product does not use scroll-linked media expansion');
    await page.screenshot({path:path.join(out,'04-brain-v3.png')});

    const expensiveGlass = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => { const s=getComputedStyle(el); return s.backdropFilter && s.backdropFilter !== 'none'; }).length);
    assert(expensiveGlass <= 18, `too many backdrop-filter surfaces (${expensiveGlass}); glassmorphism is becoming visual/performance slop`);
    const vitals = await page.evaluate(() => window.__braceVitals);
    assert(vitals.cls < .18, `desktop cumulative layout shift too high (${vitals.cls})`);
    assert(errors.length === 0, `desktop console/page errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `desktop failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  {
    const {page,errors,failed} = await newPage({width:1920,height:1080});
    await goTo(page,'#hero',0);
    await assertNoPageOverflow(page,'ultrawide');
    const layout = await page.locator('.hero-layout').boundingBox();
    const chat = await page.locator('[data-live-chat]').boundingBox();
    assert(layout && layout.width > 1250, 'ultrawide hero does not use the viewport');
    assert(chat && chat.width > 560 && chat.x + chat.width < 1900, 'ultrawide chat geometry is weak or clipped');
    await page.screenshot({path:path.join(out,'05-ultrawide-hero.png')});
    assert(errors.length === 0, `ultrawide errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `ultrawide failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  {
    const {page,errors,failed} = await newPage({width:390,height:844});
    await goTo(page,'#hero',0);
    await assertNoPageOverflow(page,'mobile');
    await assertNavClear(page,'#hero h1',24,'mobile hero heading');
    assert(await page.locator('[data-live-chat]').isVisible(), 'mobile live memory console missing');
    const heroPosition = await page.locator('.hero-stage').evaluate(el => getComputedStyle(el).position);
    assert(heroPosition !== 'sticky', 'mobile hero should not trap vertical scrolling');
    const chatBox = await page.locator('[data-live-chat]').boundingBox();
    assert(chatBox && chatBox.x >= 8 && chatBox.x + chatBox.width <= 382, 'mobile chat clipped');
    await page.screenshot({path:path.join(out,'06-mobile-hero-v3.png')});

    await page.locator('[data-side-scroll]').scrollIntoViewIfNeeded();
    const flowOverflow = await page.locator('.flow-viewport').evaluate(el => getComputedStyle(el).overflowX);
    assert(flowOverflow === 'auto' || flowOverflow === 'scroll', 'mobile horizontal story is not swipeable');
    const sceneWidth = await page.locator('[data-side-panel]').first().evaluate(el => el.getBoundingClientRect().width);
    assert(sceneWidth > 300 && sceneWidth < 380, `mobile story scene width is not intentional (${sceneWidth})`);
    await page.screenshot({path:path.join(out,'07-mobile-flow-v3.png')});
    assert(errors.length === 0, `mobile console/page errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `mobile failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  {
    const {page,errors,failed} = await newPage({width:1440,height:900},'reduce');
    assert(await page.locator('[data-opening-stage]').evaluate(el => getComputedStyle(el).position) !== 'sticky', 'reduced-motion opening still scrubbed');
    assert(await page.locator('.hero-stage').evaluate(el => getComputedStyle(el).position) !== 'sticky', 'reduced-motion hero still pinned');
    assert(await page.locator('.brain-stage').evaluate(el => getComputedStyle(el).position) !== 'sticky', 'reduced-motion brain still pinned');
    assert(errors.length === 0, `reduced-motion errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `reduced-motion failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  {
    const {page,errors,failed} = await newPage({width:1440,height:900},'no-preference',`${base}/guide/`);
    await assertNoPageOverflow(page,'guide desktop');
    assert(await page.locator('.launchpad').isVisible(), 'guide launchpad missing');
    const bar = await page.locator('[data-guide-bar]').boundingBox();
    const title = await page.locator('#guide-title').boundingBox();
    assert(bar && title && title.y > bar.y + bar.height + 20, 'guide title collides with navigation');
    await page.locator('[data-platform-choice="windows"]').click();
    assert((await page.locator('[data-platform-title]').innerText()).toLowerCase().includes('windows'), 'guide platform picker did not react clearly');
    await page.screenshot({path:path.join(out,'08-guide-desktop.png')});
    await page.locator('#first-memory').scrollIntoViewIfNeeded();
    assert(await page.locator('#first-memory img').isVisible(), 'guide memory teaching screenshot missing');
    assert(errors.length === 0, `guide desktop errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `guide desktop failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  {
    const {page,errors,failed} = await newPage({width:390,height:844},'no-preference',`${base}/guide/`);
    await assertNoPageOverflow(page,'guide mobile');
    assert(await page.locator('#guide-title').isVisible(), 'guide mobile title missing');
    assert(await page.locator('.launchpad').isVisible(), 'guide mobile launchpad missing');
    await page.screenshot({path:path.join(out,'09-guide-mobile.png')});
    assert(errors.length === 0, `guide mobile errors: ${errors.join(' | ')}`);
    assert(failed.length === 0, `guide mobile failed requests: ${failed.join(' | ')}`);
    await page.close();
  }

  process.stdout.write('SCROLLCRAFT_V3_AUDIT_OK\n');
} finally {
  await browser.close();
}

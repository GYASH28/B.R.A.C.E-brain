#!/usr/bin/env node
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BRACE_SITE_URL || 'http://127.0.0.1:4517';
const out = path.resolve(import.meta.dirname, '..', 'lab', 'cinematic');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SCROLLCRAFT_CHROME || '/usr/bin/google-chrome', headless: true });

function assert(condition, message) { if (!condition) throw new Error(message); }

async function open(viewport, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport, reducedMotion });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === 'ready');
  return { page, errors };
}

async function openGuide(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/guide/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.braceGuideRuntime === 'ready');
  return { page, errors };
}

async function goToTopOf(page, selector) {
  await page.locator(selector).evaluate(el => window.scrollTo({ top: el.offsetTop, behavior: 'instant' }));
  await page.waitForTimeout(180);
}

try {
  {
    const { page, errors } = await open({ width: 1440, height: 900 });
    assert(await page.locator('[data-opening-film]').count() === 1, 'opening film missing');
    assert(await page.locator('[data-opening-video]').count() === 1, 'opening video missing');
    const openingHeight = await page.locator('[data-opening-film]').evaluate(el => el.getBoundingClientRect().height);
    assert(openingHeight > 1500, 'opening film is not scroll-scrubbed');
    const source = await page.locator('[data-opening-video] source').getAttribute('src');
    assert(Boolean(source?.includes('brace-opening')), 'opening video source not selected');
    await page.screenshot({ path: path.join(out, '01-opening.png') });

    await goToTopOf(page, '#hero');
    assert(await page.locator('[data-live-chat]').count() === 1, 'hero live chat missing');
    const heroBg = await page.locator('.hero-bg').evaluate(el => getComputedStyle(el).backgroundImage);
    assert(heroBg.includes('brace-opening-poster'), 'hero cinematic background not loaded');
    const navBox = await page.locator('[data-site-nav]').boundingBox();
    const titleBox = await page.locator('#hero h1').boundingBox();
    assert(navBox && titleBox && titleBox.y > navBox.y + navBox.height + 40, 'desktop hero title collides with navigation');

    const before = await page.locator('[data-chat-stream] .message').count();
    await page.locator('[data-chat-prompt="source"]').click();
    await page.waitForFunction(() => document.querySelector('[data-chat-state]')?.textContent === 'READY', null, { timeout: 7000 });
    const after = await page.locator('[data-chat-stream] .message').count();
    assert(after > before, 'live chat does not create new messages');
    assert(await page.locator('[data-chat-stream] .is-typing').count() === 0, 'live chat left an interrupted typing fragment');
    assert((await page.locator('[data-chat-stream]').innerText()).includes('launch review'), 'source prompt did not resolve to source-backed response');
    await page.screenshot({ path: path.join(out, '02-hero-chat.png') });

    const side = page.locator('[data-side-scroll]');
    await side.evaluate(el => scrollTo(0, el.offsetTop + (el.offsetHeight - innerHeight) * .56));
    await page.waitForTimeout(260);
    const sideTransform = await page.locator('[data-side-rail]').evaluate(el => getComputedStyle(el).transform);
    assert(sideTransform !== 'none' && !sideTransform.includes('matrix(1, 0, 0, 1, 0, 0)'), 'desktop side-scroll rail did not move');
    const visiblePanel = await page.evaluate(() => {
      const viewport = document.querySelector('.side-viewport')?.getBoundingClientRect();
      const panels = [...document.querySelectorAll('[data-side-panel]')];
      if (!viewport || !panels.length) return null;
      return panels.map((panel, index) => {
        const r = panel.getBoundingClientRect();
        const left = Math.max(r.left, viewport.left);
        const right = Math.min(r.right, viewport.right);
        return { index, visible: Math.max(0, right - left), panel: r, copy: panel.querySelector('.side-copy')?.getBoundingClientRect() };
      }).sort((a,b) => b.visible - a.visible)[0];
    });
    assert(visiblePanel?.copy && visiblePanel.copy.left >= 0 && visiblePanel.copy.right <= 1440, 'side-scroll active copy is clipped');
    await page.screenshot({ path: path.join(out, '03-side-scroll.png') });

    await goToTopOf(page, '#brain');
    const brainNav = await page.locator('[data-site-nav]').boundingBox();
    const brainTitle = await page.locator('#brain h2').boundingBox();
    assert(brainNav && brainTitle && brainTitle.y > brainNav.y + brainNav.height + 20, 'brain heading collides with navigation');
    await page.locator('[data-brain-hotspot="evidence"]').click();
    await page.waitForTimeout(120);
    assert((await page.locator('[data-brain-kind]').textContent())?.includes('EVIDENCE'), 'brain hotspot did not update receipt');
    await page.screenshot({ path: path.join(out, '04-brain.png') });

    assert(errors.length === 0, `desktop console/page errors: ${errors.join(' | ')}`);
    await page.close();
  }

  {
    const { page, errors } = await open({ width: 390, height: 844 });
    await goToTopOf(page, '#hero');
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    assert(overflow <= 2, `mobile horizontal overflow ${overflow}px`);
    assert(await page.locator('[data-live-chat]').isVisible(), 'mobile live chat not visible');
    const navBox = await page.locator('[data-site-nav]').boundingBox();
    const titleBox = await page.locator('#hero h1').boundingBox();
    assert(navBox && titleBox && titleBox.y > navBox.y + navBox.height + 28, 'mobile hero title collides with navigation');
    await page.screenshot({ path: path.join(out, '05-mobile-hero.png') });

    await page.locator('[data-side-scroll]').scrollIntoViewIfNeeded();
    const mobileOverflowX = await page.locator('.side-viewport').evaluate(el => getComputedStyle(el).overflowX);
    assert(mobileOverflowX === 'auto' || mobileOverflowX === 'scroll', 'mobile side story is not swipeable');
    assert(errors.length === 0, `mobile console/page errors: ${errors.join(' | ')}`);
    await page.close();
  }

  {
    const { page, errors } = await open({ width: 1440, height: 900 }, 'reduce');
    const position = await page.locator('[data-opening-stage]').evaluate(el => getComputedStyle(el).position);
    assert(position !== 'sticky', 'reduced-motion opening should not scrub');
    assert(errors.length === 0, `reduced-motion errors: ${errors.join(' | ')}`);
    await page.close();
  }

  {
    const { page, errors } = await openGuide({ width: 1440, height: 900 });
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    assert(overflow <= 2, `guide desktop horizontal overflow ${overflow}px`);
    assert(await page.locator('.launchpad').isVisible(), 'guide launchpad missing');
    const bar = await page.locator('[data-guide-bar]').boundingBox();
    const title = await page.locator('#guide-title').boundingBox();
    assert(bar && title && title.y > bar.y + bar.height + 24, 'guide hero title collides with navigation');
    await page.locator('[data-platform-choice="windows"]').click();
    assert((await page.locator('[data-platform-title]').innerText()).toLowerCase().includes('windows'), 'guide platform picker did not react');
    await page.screenshot({ path: path.join(out, '06-guide-hero.png') });

    await page.locator('#first-memory').scrollIntoViewIfNeeded();
    await page.waitForTimeout(220);
    assert(await page.locator('#first-memory img').isVisible(), 'guide memory screenshot missing');
    await page.screenshot({ path: path.join(out, '07-guide-memory.png') });
    assert(errors.length === 0, `guide desktop errors: ${errors.join(' | ')}`);
    await page.close();
  }

  {
    const { page, errors } = await openGuide({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    assert(overflow <= 2, `guide mobile horizontal overflow ${overflow}px`);
    assert(await page.locator('#guide-title').isVisible(), 'guide mobile title missing');
    assert(await page.locator('.launchpad').isVisible(), 'guide mobile launchpad missing');
    await page.screenshot({ path: path.join(out, '08-guide-mobile.png') });
    assert(errors.length === 0, `guide mobile errors: ${errors.join(' | ')}`);
    await page.close();
  }

  process.stdout.write('CINEMATIC_AUDIT_OK\n');
} finally {
  await browser.close();
}

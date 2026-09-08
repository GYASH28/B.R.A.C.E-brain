#!/usr/bin/env node
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BRACE_SITE_URL || 'http://127.0.0.1:4517';
const executablePath = process.env.SCROLLCRAFT_CHROME || '/usr/bin/google-chrome';
const out = path.resolve(import.meta.dirname, '..', 'lab', 'refinement');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.braceRuntime === 'ready');
  return page;
}

async function scrollToProgress(page, selector, progress) {
  await page.locator(selector).evaluate((el, p) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(0, el.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + travel * p, behavior: 'instant' });
  }, progress);
  await page.waitForTimeout(650);
}

async function navBox(page) {
  return page.locator('[data-site-nav]').boundingBox();
}

try {
  // 1. Navigation handoff must follow real scroll, not lag behind the eased scene.
  {
    const page = await open({ width: 1440, height: 900 });
    const film = page.locator('[data-opening-film]');
    await film.evaluate(el => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const reveal = top + el.offsetHeight - window.innerHeight * 0.08 + 6;
      window.scrollTo({ top: reveal, behavior: 'instant' });
    });
    await page.waitForTimeout(120);
    const navState = await page.locator('[data-site-nav]').evaluate(el => {
      const s = getComputedStyle(el);
      return { opacity: Number(s.opacity), pointerEvents: s.pointerEvents, className: el.className };
    });
    assert(navState.opacity > .95, `navigation still visually lags after opening (${navState.opacity})`);
    assert(navState.pointerEvents !== 'none', 'navigation remains non-interactive after opening');
    assert(navState.className.includes('nav-force-visible'), 'raw-scroll navigation synchronizer did not engage');
    await page.close();
  }

  // 2. Desktop hero must sit inside a deliberate cinematic gutter at 1440px.
  {
    const page = await open({ width: 1440, height: 900 });
    await scrollToProgress(page, '#hero', 0);
    const copy = await page.locator('.hero-copy').boundingBox();
    const chat = await page.locator('[data-live-chat]').boundingBox();
    const nav = await navBox(page);
    assert(copy && copy.x >= 56, `hero copy is still bleeding into the left edge (${copy?.x})`);
    assert(copy && copy.y > (nav?.y ?? 0) + (nav?.height ?? 0) + 24, 'hero copy collides with navigation');
    assert(chat && chat.x + chat.width <= 1384, `hero console is too close to/right of viewport (${chat?.x + chat?.width})`);
    assert(copy && chat && copy.x + copy.width + 36 < chat.x + chat.width, 'hero copy and live-memory surface no longer read as two deliberate planes');
    await page.screenshot({ path: path.join(out, '01-hero-refined.png') });
    await page.close();
  }

  // 3. Brain peak must be fully framed instead of being centred out of the viewport.
  {
    const page = await open({ width: 1440, height: 900 });
    await scrollToProgress(page, '#brain', .44);
    const nav = await navBox(page);
    const heading = await page.locator('#brain-title').boundingBox();
    const product = await page.locator('.brain-product').boundingBox();
    const receipt = await page.locator('[data-brain-receipt]').boundingBox();
    assert(heading && heading.y > (nav?.y ?? 0) + (nav?.height ?? 0) + 16, 'brain heading is clipped under the navigation');
    assert(product && product.x >= 56, `brain product escapes the left cinematic gutter (${product?.x})`);
    assert(product && product.x + product.width <= 1384, `brain product escapes the right cinematic gutter (${product?.x + product?.width})`);
    assert(product && product.y >= 190, `brain product starts too high (${product?.y})`);
    assert(product && product.y + product.height <= 886, `brain product is clipped below the viewport (${product?.y + product?.height})`);
    assert(receipt && product && receipt.x >= product.x && receipt.y >= product.y && receipt.x + receipt.width <= product.x + product.width && receipt.y + receipt.height <= product.y + product.height, 'brain relationship receipt escapes the product frame');
    await page.screenshot({ path: path.join(out, '02-brain-refined.png') });
    await page.close();
  }

  // 4. Mobile flow must begin below the fixed nav and lazy media must actually resolve.
  {
    const page = await open({ width: 390, height: 844 });
    await page.locator('#flow').scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const nav = await navBox(page);
    const title = await page.locator('#flow-title').boundingBox();
    assert(title && title.y > (nav?.y ?? 0) + (nav?.height ?? 0) + 26, 'mobile flow title still starts underneath the fixed navigation');
    const viewport = await page.locator('.flow-viewport').boundingBox();
    assert(viewport && viewport.x >= 0 && viewport.x + viewport.width <= 390, 'mobile flow viewport escapes the screen');
    const firstImage = page.locator('[data-side-panel]').first().locator('img');
    await firstImage.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-side-panel] img');
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.screenshot({ path: path.join(out, '03-mobile-flow-refined.png') });
    await page.close();
  }

  process.stdout.write('SCROLLCRAFT_REFINEMENT_AUDIT_OK\n');
} finally {
  await browser.close();
}

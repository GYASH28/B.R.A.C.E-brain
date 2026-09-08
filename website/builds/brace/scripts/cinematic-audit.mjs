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

try {
  {
    const { page, errors } = await open({ width: 1440, height: 900 });
    assert(await page.locator('[data-opening-film]').count() === 1, 'opening film missing');
    assert(await page.locator('[data-opening-video]').count() === 1, 'opening video missing');
    const openingHeight = await page.locator('[data-opening-film]').evaluate(el => el.getBoundingClientRect().height);
    assert(openingHeight > 1500, 'opening film is not scroll-scrubbed');
    await page.screenshot({ path: path.join(out, '01-opening.png') });

    await page.locator('#hero').scrollIntoViewIfNeeded();
    await page.waitForTimeout(220);
    assert(await page.locator('[data-live-chat]').count() === 1, 'hero live chat missing');
    const before = await page.locator('[data-chat-stream] .message').count();
    await page.locator('[data-chat-prompt="source"]').click();
    await page.waitForTimeout(1700);
    const after = await page.locator('[data-chat-stream] .message').count();
    assert(after > before, 'live chat does not create new messages');
    await page.screenshot({ path: path.join(out, '02-hero-chat.png') });

    const side = page.locator('[data-side-scroll]');
    await side.evaluate(el => scrollTo(0, el.offsetTop + el.offsetHeight * .5));
    await page.waitForTimeout(250);
    const sideTransform = await page.locator('[data-side-rail]').evaluate(el => getComputedStyle(el).transform);
    assert(sideTransform !== 'none' && !sideTransform.includes('matrix(1, 0, 0, 1, 0, 0)'), 'desktop side-scroll rail did not move');
    await page.screenshot({ path: path.join(out, '03-side-scroll.png') });

    await page.locator('#brain').scrollIntoViewIfNeeded();
    await page.locator('[data-brain-hotspot="evidence"]').click();
    await page.waitForTimeout(120);
    assert((await page.locator('[data-brain-kind]').textContent())?.includes('EVIDENCE'), 'brain hotspot did not update receipt');
    await page.screenshot({ path: path.join(out, '04-brain.png') });

    assert(errors.length === 0, `desktop console/page errors: ${errors.join(' | ')}`);
    await page.close();
  }

  {
    const { page, errors } = await open({ width: 390, height: 844 });
    await page.locator('#hero').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    assert(overflow <= 2, `mobile horizontal overflow ${overflow}px`);
    assert(await page.locator('[data-live-chat]').isVisible(), 'mobile live chat not visible');
    await page.screenshot({ path: path.join(out, '05-mobile-hero.png') });
    await page.locator('[data-side-scroll]').scrollIntoViewIfNeeded();
    assert(await page.locator('.side-viewport').evaluate(el => getComputedStyle(el).overflowX) !== 'visible', 'mobile side story is not swipeable');
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

  process.stdout.write('CINEMATIC_AUDIT_OK\n');
} finally {
  await browser.close();
}

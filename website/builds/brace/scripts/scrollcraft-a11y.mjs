#!/usr/bin/env node
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname,'..');
const base = process.env.BRACE_SITE_URL || 'http://127.0.0.1:4517';
const axePath = path.join(root,'node_modules','axe-core','axe.min.js');
const browser = await chromium.launch({executablePath:process.env.SCROLLCRAFT_CHROME || '/usr/bin/google-chrome',headless:true});
const targets = [
  {name:'home-desktop',url:`${base}/`,viewport:{width:1440,height:900},ready:'braceRuntime'},
  {name:'home-mobile',url:`${base}/`,viewport:{width:390,height:844},ready:'braceRuntime'},
  {name:'home-reduced',url:`${base}/`,viewport:{width:1440,height:900},ready:'braceRuntime',reducedMotion:'reduce'},
  {name:'guide-desktop',url:`${base}/guide/`,viewport:{width:1440,height:900},ready:'braceGuideRuntime'},
  {name:'guide-mobile',url:`${base}/guide/`,viewport:{width:390,height:844},ready:'braceGuideRuntime'},
];
const report=[];
try {
  for (const target of targets) {
    const page=await browser.newPage({viewport:target.viewport,reducedMotion:target.reducedMotion || 'no-preference',bypassCSP:true});
    const errors=[]; const http=[];
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400) http.push(`${r.status()} ${r.url()}`);});
    await page.goto(target.url,{waitUntil:'networkidle'});
    await page.waitForFunction(key=>document.documentElement.dataset[key]==='ready',target.ready);
    await page.addScriptTag({path:axePath});
    const axe=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},resultTypes:['violations']}));
    const structure=await page.evaluate(()=>({
      h1:document.querySelectorAll('h1').length,
      missingAlt:document.querySelectorAll('img:not([alt])').length,
      unlabeledInputs:[...document.querySelectorAll('input,select,textarea')].filter(el=>!el.getAttribute('aria-label') && !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) && !el.closest('label')).length,
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
      duplicateIds:(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length-new Set(ids).size;})(),
    }));
    report.push({name:target.name,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>n.target)})),structure,errors,http});
    await page.close();
  }
} finally { await browser.close(); }
fs.mkdirSync(path.join(root,'lab'),{recursive:true});
fs.writeFileSync(path.join(root,'lab','scrollcraft-a11y.json'),JSON.stringify(report,null,2));
for (const r of report) process.stdout.write(`${r.violations.length||r.errors.length||r.http.length||r.structure.h1!==1||r.structure.missingAlt||r.structure.unlabeledInputs||r.structure.overflow>2||r.structure.duplicateIds?'FAIL':'PASS'} a11y ${r.name} violations=${r.violations.length} overflow=${r.structure.overflow}\n`);
const failed=report.some(r=>r.violations.length||r.errors.length||r.http.length||r.structure.h1!==1||r.structure.missingAlt||r.structure.unlabeledInputs||r.structure.overflow>2||r.structure.duplicateIds);
if(failed){process.stdout.write(JSON.stringify(report.filter(r=>r.violations.length||r.errors.length||r.http.length||r.structure.h1!==1||r.structure.missingAlt||r.structure.unlabeledInputs||r.structure.overflow>2||r.structure.duplicateIds),null,2));process.exitCode=1;}

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const root = path.resolve(import.meta.dirname, "..");
const base = process.env.BRACE_SITE_URL || "http://127.0.0.1:4517";
const browser = await chromium.launch({executablePath: process.env.SCROLLCRAFT_CHROME || "/usr/bin/google-chrome", headless: true});
const targets = [
  ...[[1920,1080],[1600,1000],[1440,900],[1366,768],[1024,768],[900,900],[760,900],[430,932],[390,844],[375,812]].map(([width,height]) => ({path:"/",kind:"main",width,height})),
  ...[[1920,1080],[1440,900],[1024,768],[860,900],[620,900],[390,844],[375,812]].map(([width,height]) => ({path:"/guide/",kind:"guide",width,height})),
];
const pages = [];
try {
  for (const target of targets) {
    const page = await browser.newPage({viewport:{width:target.width,height:target.height},reducedMotion:"reduce"});
    const errors=[]; page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text())});
    await page.goto(`${base}${target.path}`,{waitUntil:"networkidle"});
    if(target.kind==="main")await page.waitForFunction(()=>document.documentElement.dataset.braceRuntime==="ready");
    else await page.waitForFunction(()=>document.documentElement.dataset.braceGuideRuntime==="ready");
    const issues = await page.evaluate(({kind}) => {
      const found=[];
      const overflow=Math.max(0,document.documentElement.scrollWidth-innerWidth);
      if(overflow>1)found.push(`page overflow ${overflow}px`);
      const selectors=kind==="main"?[".site-bar",".film-stage",".story-section",".demo-shell",".product-stage",".download-shell","footer"]:[".guide-bar",".guide-hero .guide-wrap",".guide-layout",".guide-article",".guide-shot"];
      selectors.forEach((selector)=>{
        const node=document.querySelector(selector); if(!node)return;
        const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
        if(style.display!=="none"&&(rect.left<-2||rect.right>innerWidth+2))found.push(`${selector} out of bounds ${rect.left.toFixed(1)}..${rect.right.toFixed(1)}`);
      });
      if(kind==="main"){
        const stage=document.querySelector(".film-stage"),product=document.querySelector(".product-stage");
        if(innerWidth>860&&stage&&Math.abs(stage.getBoundingClientRect().height-innerHeight)>3)found.push("film stage is not one viewport");
        if(product&&Math.abs(product.getBoundingClientRect().height-innerHeight)>3)found.push("gallery stage is not one viewport");
        const rail=document.querySelector(".product-rail");
        if(rail&&rail.scrollWidth-innerWidth<innerWidth*.5)found.push("gallery rail does not have healthy overflow");
        if(document.querySelectorAll("h1").length!==1)found.push("main page must have one h1");
      }
      return found;
    },{kind:target.kind});
    for(const selector of target.kind==="main"?["#story","#demo","#product","#download"]:["#first-run","#recall","#privacy"]){
      await page.locator(selector).evaluate((node)=>node.scrollIntoView({block:"center"}));
      await page.waitForTimeout(60);
      const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
      if(overflow>1)issues.push(`${selector} introduces ${overflow}px overflow`);
    }
    pages.push({...target,issues:[...issues,...errors]});
    process.stdout.write(`${issues.length||errors.length?"FAIL":"PASS"} ${target.kind} ${target.width}x${target.height}\n`);
    await page.close();
  }
} finally {await browser.close()}
fs.mkdirSync(path.join(root,"lab"),{recursive:true});
fs.writeFileSync(path.join(root,"lab","layout.json"),`${JSON.stringify({pages},null,2)}\n`);
if(pages.some((page)=>page.issues.length)){process.stdout.write(`${JSON.stringify(pages.filter((page)=>page.issues.length),null,2)}\n`);process.exitCode=1}

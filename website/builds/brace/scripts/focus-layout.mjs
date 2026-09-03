#!/usr/bin/env node
import { chromium } from "playwright-core";
const base=process.env.BRACE_SITE_URL||"http://127.0.0.1:4517";
const browser=await chromium.launch({executablePath:process.env.SCROLLCRAFT_CHROME||"/usr/bin/google-chrome",headless:true});
const viewports=[[1920,1080],[1440,900],[900,900],[430,932],[390,844],[375,812]];
const results=[];
try{
  for(const [width,height] of viewports){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:"reduce"});
    await page.goto(`${base}/`,{waitUntil:"networkidle"});
    await page.waitForFunction(()=>document.documentElement.dataset.braceExperience==="living-v9");
    const count=await page.locator('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])').evaluateAll((nodes)=>nodes.filter((node)=>{
      const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      if(node.closest('[inert],[aria-hidden="true"]'))return false;
      if(node.tabIndex<0)return false;
      return rect.width>0&&rect.height>0&&style.display!=="none"&&style.visibility!=="hidden"&&Number.parseFloat(style.opacity)>.1;
    }).length);
    const issues=[],visited=[];
    for(let index=0;index<count;index+=1){
      await page.keyboard.press("Tab");
      await page.waitForTimeout(40);
      const state=await page.evaluate(()=>{
        const node=document.activeElement,rect=node.getBoundingClientRect(),style=getComputedStyle(node);
        return{label:String(node.getAttribute("aria-label")||node.textContent||"").trim().slice(0,60),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,outline:Number.parseFloat(style.outlineWidth)||0,visible:style.visibility!=="hidden"&&style.display!=="none"&&Number.parseFloat(style.opacity)>.1};
      });
      visited.push(state.label);
      if(!state.visible)issues.push(`hidden focus: ${state.label}`);
      if(state.left<-3||state.right>width+3||state.top<-3||state.bottom>height+3)issues.push(`offscreen focus: ${state.label}`);
      if(state.outline<2)issues.push(`missing focus ring: ${state.label}`);
    }
    if(new Set(visited).size!==count)issues.push(`focus order visited ${new Set(visited).size} unique controls but expected ${count}`);
    results.push({viewport:`${width}x${height}`,controls:count,unique:new Set(visited).size,issues});
    process.stdout.write(`${issues.length?"FAIL":"PASS"} focus ${width}x${height}\n`);
    await page.close();
  }
}finally{await browser.close()}
if(results.some((result)=>result.issues.length)){process.stdout.write(`${JSON.stringify(results,null,2)}\n`);process.exitCode=1}

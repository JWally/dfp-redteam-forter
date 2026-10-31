#!/usr/bin/env node
/** ftr-events.mjs — capture the full Forter /events POST payload (the
 *  fingerprint) from Wish. Clean Chrome attach. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9243');
const ctx=b.contexts()[0];
const page=ctx.pages().find(p=>p.url().includes('wish'))||ctx.pages()[0];
const caps={ct:[],ev:[],wpt:[],script:null};
page.on('request',req=>{
  const u=req.url();
  if(/cdn[0-9]*\.forter\.com/.test(u)){
    if(req.method()==='POST'){
      const kind = u.includes('/events')?'ev': u.includes('wpt')?'wpt':'post';
      caps[kind].push({url:u.slice(0,120), postData:(req.postData()||'').slice(0,6000)});
    } else if(u.includes('prop.json')) caps.ct.push({url:u.slice(0,130)});
  }
  if(/cdn[0-9]*\.forter\.com\/\?u=/.test(u)) caps.ct.push({url:u.slice(0,130)});
});
page.on('response',async r=>{
  const u=r.url();
  if(/cdn[0-9]*\.forter\.com/.test(u) && /\?u=/.test(u)){ try{caps.script=await r.text();}catch(_){} }
});
await page.goto('https://www.wish.com/',{waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(15000);
await page.reload({waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(10000);
console.log('/events posts:', caps.ev.length, '| wpt:', caps.wpt.length, '| config:', caps.ct.length, '| script:', caps.script?caps.script.length:0);
console.log('\n=== /events payload ===');
for(const e of caps.ev.slice(0,4)){
  console.log('\n ', e.url);
  console.log('  ', e.postData.slice(0,1500));
}
console.log('\n=== wpt.json payload ===');
for(const e of caps.wpt.slice(0,2)){
  console.log('\n ', e.url);
  console.log('  ', e.postData.slice(0,800));
}
console.log('\n=== config (cdn123 ?u=) ===');
for(const e of caps.ct.slice(0,3)) console.log(' ', e.url);
if(caps.script){
  console.log('\nscript head:', caps.script.slice(0,200));
  writeFileSync('/tmp/opencode/frt/cdn123-response.txt', caps.script);
}
writeFileSync('/tmp/opencode/frt/events-capture.json', JSON.stringify({ev:caps.ev, wpt:caps.wpt, ct:caps.ct},null,2));
await b.close();

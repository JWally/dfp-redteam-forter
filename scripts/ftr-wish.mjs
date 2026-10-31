#!/usr/bin/env node
/** ftr-wish.mjs — Wish (Forter customer): capture the Forter sensor script,
 *  its payload POST, and the forterToken cookie format. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9243');
const ctx=b.contexts()[0];
const page=ctx.pages().find(p=>p.url().includes('wish'))||ctx.pages()[0];
const log={req:[],bundles:{},posts:[]};
page.on('request',req=>{
  const u=req.url();
  if(/forter|ftr|sensor|__forter|f\?flag/i.test(u)){
    log.req.push([req.method(),u.slice(0,180)]);
    if(req.method()==='POST') log.posts.push({url:u.slice(0,150), postData:(req.postData()||'').slice(0,4000)});
  }
});
page.on('response',async r=>{
  const u=r.url();
  if(/\.js($|\?)/.test(u)&&/forter|ftr/i.test(u)){try{const b=await r.text();if(b.length>3000)log.bundles[u]=b;}catch(_){}}
});
await page.goto('https://www.wish.com/',{waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(12000);
// force a reload to catch the sensor
await page.reload({waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(10000);
console.log('forter reqs:',log.req.length);
for(const r of log.req.slice(0,20))console.log(' ',r[0],r[1]);
console.log('\n=== POSTs ===');
for(const p of log.posts.slice(0,3)){console.log('\n ',p.url);console.log('  ',p.postData.slice(0,700));}
for(const [u,body] of Object.entries(log.bundles)){const n=(u.split('/').pop().split('?')[0]||'ftr')+'-'+body.length;writeFileSync('/tmp/opencode/frt/'+n,body);console.log('saved:',n,Math.round(body.length/1024)+'KB');}
writeFileSync('/tmp/opencode/frt/forter-wish.json',JSON.stringify({req:log.req.slice(0,30),posts:log.posts},null,2));
await b.close();

#!/usr/bin/env node
/** ftr-hook.mjs — hook fetch to capture the Forter /events body at the
 *  boundary (the fingerprint payload). Wish in clean Chrome. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9243');
const ctx=b.contexts()[0];
const page=ctx.pages().find(p=>p.url().includes('wish'))||ctx.pages()[0];
await page.addInitScript(()=>{
  self.__ftr=[];
  const of=window.fetch;
  window.fetch=function(...a){
    const u=a[0] instanceof Request?a[0].url:String(a[0]);
    if(/forter\.com/.test(u)){
      let body=null;
      try{ body = a[1] && a[1].body ? (typeof a[1].body==='string'?a[1].body:'[non-string]') : null; }catch(_){}
      self.__ftr.push({ url:u.slice(0,130), method:a[1]?.method||'GET', body: body ? body.slice(0,6000) : null });
    }
    return of.apply(this,a);
  };
  const os=XHR.prototype.send;
  XHR.prototype.send=function(bd){ if(this.__ftrUrl&&/forter\.com/.test(this.__ftrUrl)){ self.__ftr.push({url:this.__ftrUrl.slice(0,130),method:'XHR',body: bd?String(bd).slice(0,6000):null}); } return os.apply(this,arguments); };
  const oo=XHR.prototype.open;
  XHR.prototype.open=function(m,u,...r){ this.__ftrUrl=u; return oo.apply(this,m,u,...r); };
});
await page.goto('https://www.wish.com/',{waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(15000);
await page.reload({waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(10000);
const caps=await page.evaluate(()=>self.__ftr||[]).catch(()=>[]);
console.log('captured:',caps.length);
for(const c of caps.filter(x=>x.body).slice(0,6)){
  console.log('\n===', c.method, c.url);
  console.log('  ', c.body.slice(0,1200));
}
writeFileSync('/tmp/opencode/frt/ftr-hooked.json',JSON.stringify(caps,null,2));
await b.close();

#!/usr/bin/env node
/** ftr-blob.mjs — capture the Forter /events Blob body (the fingerprint
 *  payload) by hooking sendBeacon and reading the Blob. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9243');
const ctx=b.contexts()[0];
const page=ctx.pages().find(p=>p.url().includes('wish'))||ctx.pages()[0];
await page.addInitScript(()=>{
  self.__sb=[];
  const osb=navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon=function(u,d){
    if(/forter\.com/.test(String(u))){
      const p=(d instanceof Blob)?d.text().then(tw=>({url:String(u).slice(0,120), blobText:tw.slice(0,8000)})):Promise.resolve({url:String(u).slice(0,120), str:String(d).slice(0,4000)});
      self.__sb.push(p);
    }
    return osb(u,d);
  };
});
await page.goto('https://www.wish.com/',{waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(15000);
await page.reload({waitUntil:'load',timeout:60000}).catch(()=>{});
await page.waitForTimeout(12000);
const sb=await page.evaluate(async ()=>Promise.all(self.__sb||[])).catch(e=>({err:String(e).slice(0,150)}));
console.log('forter beacons:', Array.isArray(sb)?sb.length:0);
for(const s of (Array.isArray(sb)?sb:[]).slice(0,6)){
  console.log('\n=== ',s.url);
  if(s.blobText) console.log('BLOB:', s.blobText.slice(0,2500));
  if(s.str) console.log('STR:', s.str.slice(0,1500));
}
writeFileSync('/tmp/opencode/frt/forter-payload.json',JSON.stringify(sb,null,2));
await b.close();

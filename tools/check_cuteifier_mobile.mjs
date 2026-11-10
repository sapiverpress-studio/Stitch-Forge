/* Real Chromium mobile smoke, mocked AI — never charges API credits. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
const root=resolve('site');
const kind={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 const path=(req.url||'/').split('?')[0];
 const safe=path==='/'?'index.html':path.replace(/^\/+/,'');
 if(!/^[a-z0-9_./-]+$/i.test(safe)||safe.includes('..')){res.writeHead(404).end();return;}
 try{const bytes=await readFile(join(root,safe));res.writeHead(200,{'Content-Type':kind[extname(safe)]||'application/octet-stream'}).end(bytes);}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,errors=[],calls=[];
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const context=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/cuteifier.html');
 assert.equal(await page.title(),'AI Cuteifier for Ember | Sapiver Stitch Forge');
 assert.ok(await page.locator('#placeholder').isVisible());
 await page.evaluate(()=>window.StitchForgeTokenStore.save('test-owner-access'));
 const png=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const p=c.getContext('2d');
  p.fillStyle='#3586a5';p.beginPath();p.ellipse(124,126,92,67,0,0,Math.PI*2);p.fill();
  p.fillStyle='#f9a048';p.beginPath();p.ellipse(135,155,54,22,0,0,Math.PI*2);p.fill();
  p.fillStyle='#101010';p.beginPath();p.arc(159,105,6,0,Math.PI*2);p.fill();
  return c.toDataURL('image/png').split(',')[1];
 });
 const webp=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=512;c.height=512;const p=c.getContext('2d');
  p.fillStyle='#000';p.beginPath();p.ellipse(256,255,165,120,0,0,Math.PI*2);p.fill();
  p.fillStyle='#4b98b4';p.beginPath();p.ellipse(256,255,155,110,0,0,Math.PI*2);p.fill();
  p.fillStyle='#f9a746';p.beginPath();p.ellipse(265,293,85,48,0,0,Math.PI*2);p.fill();
  p.fillStyle='#000';p.beginPath();p.arc(304,232,16,0,Math.PI*2);p.fill();
  return c.toDataURL('image/webp',.92).split(',')[1];
 });
 const binary=Buffer.from(webp,'base64');
 assert.equal(binary.toString('ascii',0,4),'RIFF');
 const UUID='00127c2f-87fd-4c3c-b92f-60c9f57e6c32';
 await page.route('**/api/cuteifier-*',async route=>{
  const req=route.request(),url=new URL(req.url());
  calls.push({path:url.pathname,authorization:req.headers().authorization});
  if(url.pathname.endsWith('-submit')){
   const body=req.postDataJSON();
   assert.match(body.image,/^data:image\/webp;base64,/);
   assert.equal(body.style,'cute');assert.equal(body.colours,6);assert.equal(body.outline,'medium');
   return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({jobId:UUID})});
  }
  if(url.pathname.endsWith('-status'))
   return route.fulfill({status:200,contentType:'application/json',body:'{"state":"done"}'});
  if(url.pathname.endsWith('-result'))
   return route.fulfill({status:200,contentType:'image/webp',body:binary});
  return route.fulfill({status:404});
 });
 await page.locator('#sourceFile').setInputFiles({name:'bird.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 await page.locator('#generate').click();
 await page.waitForFunction(()=>!document.querySelector('#download').disabled);
 assert.ok(await page.locator('#result').isVisible(),'result canvas should be visible');
 assert.equal(await page.locator('#placeholder').isVisible(),false,'empty placeholder should disappear');
 assert.equal(await page.locator('#result').getAttribute('width'),'2000');
 assert.equal(await page.locator('#result').getAttribute('height'),'2000');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no mobile overflow');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
 const file=await readFile(await download.path());
 assert.equal(file.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(file.readUInt32BE(16),2000);assert.equal(file.readUInt32BE(20),2000);
 assert.equal(file[25],6,'RGBA PNG with alpha channel');
 assert.deepEqual(calls.map(x=>x.path),['/api/cuteifier-submit','/api/cuteifier-status','/api/cuteifier-result']);
 assert.ok(calls.every(x=>x.authorization==='Bearer test-owner-access'));
 assert.deepEqual(errors,[]);
 console.log('PASS — Pixel 7 Chromium, source upload → mock AI redraw → alpha preview → PNG download');
 await context.close();
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
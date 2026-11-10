/* Pixel 7-sized real Chromium acceptance; paid provider is mocked. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=resolve('site'),types={'.html':'text/html','.js':'text/javascript','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 const path=(req.url||'/').split('?')[0].replace(/^\/+/,'');
 if(!path||path.includes('..')||!/^[a-z0-9._/-]+$/i.test(path)){res.writeHead(404).end();return;}
 try{const bytes=await readFile(join(root,path));res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(bytes);}
 catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const ctx=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
 const page=await ctx.newPage(),errors=[],external=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{
  if(!req.url().startsWith('http://127.0.0.1:')&&!req.url().startsWith('blob:http://127.0.0.1:'))
   external.push(req.url());
 });
 const url='http://127.0.0.1:'+server.address().port+'/cuteifier.html';
 const response=await page.goto(url);
 assert.equal(response.status(),200);
 assert.equal(await page.locator('#blackOutline').isChecked(),false);
 await page.evaluate(()=>window.StitchForgeTokenStore.save('owner-test-token'));
 const original=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
  g.clearRect(0,0,256,256);g.fillStyle='#b87a43';g.beginPath();g.ellipse(128,128,90,85,0,0,Math.PI*2);g.fill();
  g.fillStyle='#211711';g.beginPath();g.ellipse(100,115,8,4,0,0,Math.PI*2);g.fill();
  return c.toDataURL('image/png').split(',')[1];
 });
 const generated=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d');
  g.clearRect(0,0,512,512);g.fillStyle='#ba7d48';
  g.beginPath();g.ellipse(256,255,145,135,0,0,Math.PI*2);g.fill();
  g.fillStyle='#edc08a';g.beginPath();g.ellipse(296,287,70,60,0,0,Math.PI*2);g.fill();
  g.strokeStyle='#241712';g.lineWidth=7;g.beginPath();g.arc(253,255,57,.1,2.4);g.stroke();
  g.beginPath();g.moveTo(225,211);g.quadraticCurveTo(246,196,264,211);g.stroke();
  return c.toDataURL('image/webp',.96).split(',')[1];
 });
 const webp=Buffer.from(generated,'base64');
 const uuid='24f8b964-e739-4d31-ac72-d6f7b1b01ab2';
 await page.route('**/api/cuteifier-*',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  calls.push({path:p,authorization:req.headers().authorization});
  if(p.endsWith('-submit')){
   const body=req.postDataJSON();
   assert.deepEqual(Object.keys(body),['image']);
   assert.match(body.image,/^data:image\/webp;base64,/);
   return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({jobId:uuid})});
  }
  if(p.endsWith('-status'))return route.fulfill({status:200,contentType:'application/json',body:'{"state":"done"}'});
  if(p.endsWith('-result'))return route.fulfill({status:200,contentType:'image/webp',body:webp});
  return route.fulfill({status:404});
 });
 await page.locator('#sourceFile').setInputFiles({name:'capybara.png',mimeType:'image/png',buffer:Buffer.from(original,'base64')});
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 assert.equal(calls.length,0,'no paid action before generate');
 await page.locator('#blackOutline').check();await page.locator('#blackOutline').uncheck();
 assert.equal(calls.length,0,'optional outline toggle must not cost API requests');
 await page.locator('#generate').click();
 await page.waitForFunction(()=>!document.querySelector('#download').disabled,{timeout:30000});
 assert.equal(await page.locator('#placeholder').isVisible(),false);
 assert.equal(await page.locator('#result').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 const output=async()=>page.locator('#result').evaluate(canvas=>({
  width:canvas.width,height:canvas.height,
  pixels:Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)
 }));
 const baseline=await output();
 async function downloadExact(expected){
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
  const bytes=await readFile(await dl.path());
  assert.equal(dl.suggestedFilename(),'capybara-cute.png');
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),expected.width);assert.equal(bytes.readUInt32BE(20),expected.height);
  assert.equal(bytes[25],6,'RGBA PNG');
  const pixels=await page.evaluate(async b64=>{
   const image=new Image();image.src='data:image/png;base64,'+b64;await image.decode();
   const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
   const g=c.getContext('2d');g.drawImage(image,0,0);
   return Array.from(g.getImageData(0,0,c.width,c.height).data);
  },bytes.toString('base64'));
  assert.deepEqual(pixels,expected.pixels);
 }
 await downloadExact(baseline);
 await page.locator('#blackOutline').check();
 const outlined=await output();
 assert.notDeepEqual(outlined.pixels,baseline.pixels,'the optional black outline must be visible');
 await downloadExact(outlined);
 await page.locator('#blackOutline').uncheck();
 assert.deepEqual((await output()).pixels,baseline.pixels,'outline switch must be reversible, no redrawing');
 assert.deepEqual(calls.map(c=>c.path),['/api/cuteifier-submit','/api/cuteifier-status','/api/cuteifier-result']);
 assert.ok(calls.every(c=>c.authorization==='Bearer owner-test-token'));
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS — Pixel 7 mobile: uploaded original → mocked illustrated image → alpha PNG downloads (outline on/off), no extra paid calls');
 await ctx.close();
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
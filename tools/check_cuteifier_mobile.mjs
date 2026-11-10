/* Phone-sized end-to-end simplification and exact preview PNG download. */
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
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:'))external.push(req.url());});
 const pageURL='http://127.0.0.1:'+server.address().port+'/cuteifier.html';
 const response=await page.goto(pageURL,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 const source=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=160;c.height=144;
  const g=c.getContext('2d');
  g.clearRect(0,0,160,144);
  g.fillStyle='#be8453';g.beginPath();g.ellipse(80,70,55,46,0,0,Math.PI*2);g.fill();
  g.fillStyle='#221712';g.beginPath();g.ellipse(62,50,10,5,0,0,Math.PI*2);g.fill();
  return c.toDataURL('image/png').split(',')[1];
 });
 await page.locator('#sourceFile').setInputFiles({name:'capybara.png',mimeType:'image/png',buffer:Buffer.from(source,'base64')});
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 await page.locator('#generate').click();
 await page.waitForFunction(()=>!document.querySelector('#download').disabled,{timeout:20000});
 assert.equal(await page.locator('#placeholder').isVisible(),false);
 assert.equal(await page.locator('#result').isVisible(),true);
 const original=await page.locator('#result').evaluate(canvas=>({
  width:canvas.width,height:canvas.height,
  pixels:Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)
 }));
 const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
 assert.equal(dl.suggestedFilename(),'capybara-simplified.png');
 const bytes=await readFile(await dl.path());
 assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(bytes.readUInt32BE(16),original.width);
 assert.equal(bytes.readUInt32BE(20),original.height);
 assert.equal(bytes[25],6);
 const decoded=await page.evaluate(async base64=>{
  const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
  const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
  return Array.from(ctx.getImageData(0,0,c.width,c.height).data);
 },bytes.toString('base64'));
 assert.deepEqual(decoded,original.pixels,'Downloaded PNG pixels must equal original simplified preview');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS — original simplifier + exact PNG pixels on Pixel 7 browser');
 await ctx.close();
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
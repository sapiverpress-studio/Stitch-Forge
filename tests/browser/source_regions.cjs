/* Actual Chromium against repository files. All URLs fulfilled locally.
 * The AI response below is a declared synthetic mock; no service is called.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),zlib=require('node:zlib');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?
 path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const ROOT=path.resolve(__dirname,'../..'),EVIDENCE=process.env.STITCH_FORGE_EVIDENCE;
let browser;
test.beforeEach(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.STITCH_FORGE_CHROMIUM||undefined,
  args:process.env.STITCH_FORGE_CHROMIUM_ARGS?JSON.parse(process.env.STITCH_FORGE_CHROMIUM_ARGS):[]});
 if(EVIDENCE)fs.mkdirSync(EVIDENCE,{recursive:true});
});
test.afterEach(async()=>{if(browser)await browser.close();});
function crc(bytes){let value=-1;for(const b of bytes){value^=b;for(let i=0;i<8;i++)value=(value>>>1)^(value&1?0xedb88320:0);}return (value^-1)>>>0;}
function image({detail=true,changed=false,eye=false}={}){
 const w=128,h=128,raw=Buffer.alloc(h*(1+w*4));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const selected=x>=20&&x<108&&y>=20&&y<108;
  const hole=detail&&x>=50&&x<62&&y>=52&&y<64;
  const island=detail&&x===14&&y===14;
  if((selected&&!hole)||island){const j=y*(1+w*4)+1+x*4;raw.set([64,128,192,255],j);}
 }
 if(changed)raw[30*(1+w*4)+1+30*4]++;
 if(eye)raw.set([5,5,5,255],40*(1+w*4)+1+40*4);
 const chunk=(name,bytes)=>{const body=Buffer.concat([Buffer.from(name),bytes]),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(bytes.length);check.writeUInt32BE(crc(body));return Buffer.concat([size,body,check]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function texturedImage(){
 const w=224,h=224,raw=Buffer.alloc(h*(1+w*4));
 for(let y=5;y<h-5;y++)for(let x=5;x<w-5;x++){
  const i=(((x*73856093)^(y*19349663))>>>0)&31;
  raw.set([(i%8)*32+16,((i>>3)%8)*32+16,((i*5)%8)*32+16,255],y*(1+w*4)+1+x*4);
 }
 const chunk=(name,bytes)=>{const body=Buffer.concat([Buffer.from(name),bytes]),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(bytes.length);check.writeUInt32BE(crc(body));return Buffer.concat([size,body,check]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
async function app(width=390,buffer=image()){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,acceptDownloads:true});
 const errors=[],unexpected=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='https://stitchforge.test'||url.pathname.startsWith('/api/')){
   unexpected.push(url.pathname);return route.fulfill({status:500,body:'Unexpected network operation blocked by local test'});
  }
  const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!/^[a-zA-Z0-9._-]+$/.test(relative))return route.fulfill({status:404});
  const file=path.join(ROOT,'site',relative);
  if(!fs.existsSync(file))return route.fulfill({status:404});
  await route.fulfill({path:file,contentType:relative.endsWith('.js')?'text/javascript':'text/html'});
 });
 await page.goto('https://stitchforge.test/');
 await page.waitForFunction('window.StitchForgeSourceRegionProject && document.querySelector("#sfSourceInspect")');
 await upload(page,buffer);return {page,errors,unexpected};
}
async function upload(page,buffer){
 await page.locator('#importFile').setInputFiles({name:'declared-synthetic-control.png',mimeType:'image/png',buffer});
 await page.waitForFunction(expected=>window.StitchForgeAIContext.getImage()===expected,'data:image/png;base64,'+buffer.toString('base64'));
 await page.waitForFunction('document.querySelector("#status").textContent.includes("Raster imported")');
}
async function downloaded(page,selector){
 const wait=page.waitForEvent('download');await page.locator(selector).click();const item=await wait;
 return {filename:item.suggestedFilename(),bytes:fs.readFileSync(await item.path())};
}
const proposal=()=>({status:'AI_GEOMETRY_PROPOSAL_NOT_STITCHED',regions:[{
 id:'synthetic-region',label:'Synthetic control label',kind:'fill',semantic:'other',color:'#4080C0',
 confidence:'high',layer:0,points:[{x:50,y:50},{x:950,y:50},{x:950,y:950},{x:50,y:950}]}]});

test('default source-native action reports an unavailable worker without any OpenAI fallback',async()=>{
 const {page,errors,unexpected}=await app();let calls=0;
 await page.route('**/api/artwork-embroidery',route=>{calls++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Native artwork route disabled'})});});
 try{
  const previous=await page.evaluate('window.__stitchforge_test.paths');
  await page.locator('#sfAutoToken').fill('synthetic-local-owner-token');await page.locator('#sfAutoRun').click();
  await page.waitForFunction('!document.querySelector("#sfAutoRun").disabled');
  assert.match(await page.locator('#sfAutoStatus').innerText(),/route disabled/);
  assert.equal(calls,1);assert.ok(await page.locator('#sfAutoNativeReport').isDisabled());assert.ok(await page.locator('#sfAutoDownload').isDisabled());
  assert.deepEqual(await page.evaluate('window.__stitchforge_test.paths'),previous);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});

test('changing native physical size during phase one aborts the request and prevents a DST phase',async()=>{
 const {page,errors,unexpected}=await app();
 try{
  await page.evaluate(()=>{window.__nativePhases=[];window.fetch=(url,opts)=>{window.__nativePhases.push(JSON.parse(opts.body).phase);window.__nativeWaiting=true;return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));};});
  await page.locator('#sfAutoToken').fill('synthetic-local-owner-token');await page.locator('#sfAutoRun').click();await page.waitForFunction('window.__nativeWaiting');
  await page.locator('#sfNativeWidth').fill('100');await page.locator('#sfNativeWidth').dispatchEvent('change');
  await page.waitForFunction('!document.querySelector("#sfAutoRun").disabled');
  assert.deepEqual(await page.evaluate('window.__nativePhases'),['pes']);assert.ok(await page.locator('#sfAutoDownload').isDisabled());assert.ok(await page.locator('#sfAutoNativeReport').isDisabled());
  assert.match(await page.locator('#sfAutoStatus').innerText(),/settings changed/);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});

test('prepared source objects render on mobile, retain bindings, and clear after physical resize',async()=>{
 const {page,errors,unexpected}=await app(390,image({eye:true}));
 try{
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfObjectBuild").disabled');
  await page.locator('#sfObjectBuild').click();await page.waitForFunction('!document.querySelector("#sfObjectSave").disabled');
  const plan=JSON.parse((await downloaded(page,'#sfObjectSave')).bytes);
  assert.equal(plan.schema,'stitch-forge-source-object-plan-v1');assert.equal(plan.machineEligible,false);
  assert.equal(plan.summary.omittedPixels,0);assert.equal(plan.summary.protectedPartsRecoloured,0);
  assert.ok(await page.locator('#sfObjectShow').isChecked());
  await page.locator('#sfObjectShow').uncheck();await page.locator('#sfObjectShow').check();
  assert.match(await page.evaluate('(()=>{try{window.StitchForgeAIContext.exportMachineProject();return "allowed"}catch(e){return e.message}})()'),/blocked/);
  await page.locator('#sfSourceWidth').fill('100');await page.locator('#sfSourceWidth').dispatchEvent('change');
  assert.ok(await page.locator('#sfObjectSave').isDisabled());assert.ok(await page.locator('#sfObjectShow').isDisabled());
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});

test('a pending prepared-artwork result is discarded when physical size changes',async()=>{
 const {page,errors,unexpected}=await app();
 try{
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfObjectBuild").disabled');
  await page.evaluate(()=>{const api=window.StitchForgeSourceObjectPlan;window.StitchForgeSourceObjectPlan={...api,build:async d=>{const p=await api.build(d);window.__objectPending=true;await new Promise(resolve=>window.__releaseObject=resolve);return p;}};});
  await page.locator('#sfObjectBuild').click();await page.waitForFunction('window.__objectPending');
  await page.locator('#sfSourceWidth').fill('100');await page.locator('#sfSourceWidth').dispatchEvent('change');
  await page.evaluate('window.__releaseObject()');await page.waitForFunction('document.querySelector("#sfSourceStatus").textContent.includes("stale")');
  assert.ok(await page.locator('#sfObjectSave').isDisabled());assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});

test('offline prepared-artwork comparison runs private source modules with no network',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.48-source-objects/Prepared_Artwork_OFFLINE.html')).href);
  await page.locator('#file').setInputFiles({name:'synthetic-original.png',mimeType:'image/png',buffer:image({eye:true})});
  await page.locator('#prepare').click();await page.waitForFunction('!document.querySelector("#save").disabled');
  assert.equal(await page.locator('#result img').count(),3);
  const plan=JSON.parse((await downloaded(page,'#save')).bytes);
  assert.equal(plan.machineEligible,false);assert.equal(plan.summary.omittedPixels,0);
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,'prepared-artwork-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,'prepared-artwork-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});

test('real-artwork offline evidence renders actual decoded PNGs and exact reports on mobile',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.48-source-objects/Native_Artwork_Evidence_OFFLINE.html')).href);
  assert.equal(await page.locator('.panels img').count(),12);
  assert.equal(await page.locator('img').evaluateAll(images=>images.every(im=>im.complete&&im.naturalWidth>0)),true);
  const report=JSON.parse((await downloaded(page,'a[download="macaw-machine-report-NOT-APPROVED.json"]')).bytes);
  assert.equal(report.machineEligible,false);assert.equal(report.pesVersion,6);
  assert.equal(report.decoded[0].needleStitches,12328);
  assert.equal(report.decoded[0].needleSegmentsOutsideWorkingColour,0);
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,'native-artwork-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1450,height:1000});
  if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,'native-artwork-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});

test('mobile source inspection retains holes/islands, saves/reopens/resizes, and blocks stale playback and exports',async()=>{
 const {page,errors,unexpected}=await app();
 try{
  const before=await page.evaluate('window.__stitchforge_test.paths');
  assert.equal(await page.locator('#sfSourceFile').isVisible(),false);
  assert.equal(await page.locator('#sfAutoReplayFile').isVisible(),false);
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfSourceSave").disabled');
  assert.match(await page.locator('#sfSourceStatus').innerText(),/1 holes/);
  const saved=await downloaded(page,'#sfSourceSave'),project=JSON.parse(saved.bytes);
  assert.equal(project.summary.holeCount,1);assert.equal(project.summary.smallComponents,1);
  assert.equal(project.foregroundPixels,7601);assert.equal(project.machineEligible,false);
  await page.locator('#sfSourceWidth').fill('100');await page.locator('#sfSourceWidth').dispatchEvent('change');
  const resized=JSON.parse((await downloaded(page,'#sfSourceSave')).bytes);
  assert.equal(resized.physical.imageWidthMm,100);assert.deepEqual(resized.regions,project.regions);
  const svg=(await downloaded(page,'#sfSourceSvg')).bytes.toString();assert.match(svg,/fill-rule="evenodd"/);
  assert.match(svg,/width="100.000000mm"/);
  await page.locator('#sfSourceFile').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:saved.bytes});
  await page.waitForFunction('document.querySelector("#sfSourceWidth").value==="80"');
  const downloads=[];page.on('download',d=>downloads.push(d));
  await page.locator('#playBtn').click();assert.match(await page.locator('#status').innerText(),/no stitch plan/);
  for(const id of ['dstBtn','pesBtn','zipBtn'])await page.locator('#'+id).click();
  assert.equal(downloads.length,0);
  assert.match(await page.evaluate('(()=>{try{window.StitchForgeAIContext.exportMachineProject();return "allowed"}catch(e){return e.message}})()'),/blocked/);
  assert.deepEqual(await page.evaluate('window.__stitchforge_test.paths'),before);
  assert.equal(await page.locator('#paths').evaluate(el=>getComputedStyle(el).display),'none');
  if(EVIDENCE)await page.locator('#sfSourceRegionPanel').screenshot({path:path.join(EVIDENCE,'app-mobile-source-controls.png')});
  await page.locator('#sfSourceClose').click();assert.ok(await page.evaluate('window.StitchForgeAIContext.exportMachineProject().paths.length>0'));
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('failed synthetic AI attempt downloads safe diagnostics and replays exactly without an additional request',async()=>{
 const {page,errors,unexpected}=await app();let calls=0;
 try{
  await page.route('**/api/reconstruct-embroidery',route=>{calls++;return route.fulfill({status:200,json:proposal()});});
  const before=await page.evaluate('window.__stitchforge_test.paths');
  await page.locator('#sfAutoWorkflow').selectOption('ai');await page.locator('#sfAutoToken').fill('synthetic-private-access-token');await page.locator('#sfAutoRun').click();
  await page.waitForFunction('!document.querySelector("#sfAutoRun").disabled');
  assert.match(await page.locator('#sfAutoStatus').innerText(),/Reconstruction not applied/);
  assert.deepEqual(await page.evaluate('window.__stitchforge_test.paths'),before);
  const saved=await downloaded(page,'#sfAutoDiagnostic'),text=saved.bytes.toString();
  assert.doesNotMatch(text,/synthetic-private-access-token|data:image|Synthetic control label|synthetic-region/);
  assert.ok(JSON.parse(text).assessment.rejected.some(r=>['small_components_not_stitchable','fill_holes_not_supported'].includes(r.reason)));
  await page.locator('#sfAutoReplayFile').setInputFiles({name:'diagnostic.json',mimeType:'application/json',buffer:saved.bytes});
  await page.waitForFunction('document.querySelector("#sfAutoStatus").textContent.includes("Local replay reproduced")');
  assert.equal(calls,1);assert.deepEqual(await page.evaluate('window.__stitchforge_test.paths'),before);
  await upload(page,image({changed:true}));
  await page.locator('#sfAutoReplayFile').setInputFiles({name:'diagnostic.json',mimeType:'application/json',buffer:saved.bytes});
  await page.waitForFunction('document.querySelector("#sfAutoStatus").textContent.includes("different source pixels")');
  assert.equal(calls,1);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('server geometry rejection remains downloadable without exposing raw model or request data',async()=>{
 const {page,errors,unexpected}=await app(1280);
 try{
  await page.route('**/api/reconstruct-embroidery',route=>route.fulfill({status:422,json:{code:'INVALID_MODEL_GEOMETRY',
   error:'Unsafe model geometry',raw:'server-private-output',diagnostics:{rejected_regions:[{region:3,reason:'degenerate_outline'}]}}}));
  await page.locator('#sfAutoWorkflow').selectOption('ai');await page.locator('#sfAutoToken').fill('synthetic-private-access-token');await page.locator('#sfAutoRun').click();
  await page.waitForFunction('!document.querySelector("#sfAutoRun").disabled');
  const text=(await downloaded(page,'#sfAutoDiagnostic')).bytes.toString();
  assert.doesNotMatch(text,/server-private-output|synthetic-private-access-token/);
  assert.equal(JSON.parse(text).assessment.status,'server_rejected');
  assert.equal(JSON.parse(text).server.rejectedRegions[0].reason,'degenerate_outline');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('all three licensed raster inputs run through the actual desktop app controls with no model or worker',async()=>{
 const {page,errors,unexpected}=await app(1280);
 const reports=[];
 try{
  for(const id of ['butterfly','macaw','rose']){
   await upload(page,fs.readFileSync(path.join(ROOT,'tests/fixtures/artwork-evaluation',id+'.png')));
   await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfSourceSave").disabled');
   const saved=JSON.parse((await downloaded(page,'#sfSourceSave')).bytes);
   assert.ok(saved.summary.componentCount>128);assert.equal(saved.machineEligible,false);
   assert.equal(saved.summary.contoursUnavailable,0);reports.push({id,summary:saved.summary,source:saved.source,quantisation:saved.quantisation});
   if(EVIDENCE&&id==='macaw'){
    await page.locator('#design').screenshot({path:path.join(EVIDENCE,'app-desktop-macaw-source-geometry.png')});
    await page.locator('#sfSourceRegionPanel').screenshot({path:path.join(EVIDENCE,'app-desktop-source-controls.png')});
   }
  }
  if(EVIDENCE)fs.writeFileSync(path.join(EVIDENCE,'browser-licensed-reports.json'),JSON.stringify(reports,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
for(const width of [390,1280])test('offline inspector at '+width+'px performs no network calls and exports actual geometry',async()=>{
  const page=await browser.newPage({viewport:{width,height:844},acceptDownloads:true}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
  try{
   await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.43-source-region-drafts/Source_Regions_OFFLINE.html')).href);
   assert.equal(await page.locator('.uncertain').first().isVisible(),false);
   await page.locator('#uncertainty').check();assert.equal(await page.locator('.uncertain').first().isVisible(),true);
   if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,'offline-'+(width<500?'mobile':'desktop')+'.png'),fullPage:true});
   await page.locator('#artwork').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:image()});
   await page.locator('#inspect').click();await page.waitForFunction('!document.querySelector("#save").disabled');
   assert.equal(JSON.parse((await downloaded(page,'#save')).bytes).summary.holeCount,1);
   assert.match((await downloaded(page,'#svg')).bytes.toString(),/fill-rule="evenodd"/);
   assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
   assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  }finally{await page.close();}
});
test('actual compound machine evidence renders all real panels offline at desktop/mobile widths',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:844}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.44-compound-machine/Compound_Machine_Evidence_OFFLINE.html')).href);
  await page.waitForFunction('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');
  assert.equal(await page.locator('article').count(),4);assert.equal(await page.locator('article img').count(),16);
  assert.match(await page.locator('.notice').innerText(),/Synthetic control evidence/);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   if(EVIDENCE)await page.locator('#horizontal').screenshot({path:path.join(EVIDENCE,'compound-proof-'+(width<500?'mobile':'desktop')+'.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});
test('actual mobile app retains a small contrasting eye in the bounded working palette and source graph',async()=>{
 const {page,errors,unexpected}=await app(390,image({detail:false,eye:true}));
 try{
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfSourceSave").disabled');
  const project=JSON.parse((await downloaded(page,'#sfSourceSave')).bytes);
  const eye=project.graph.nodes.find(n=>n.color==='#050505');
  assert.equal(eye.pixelArea,1);assert.equal(eye.protectedFeature,true);
  assert.equal(project.graph.palette[eye.paletteIndex],'#050505');assert.ok(project.regions.length<=12);
  assert.equal(project.machineEligible,false);assert.equal(project.summary.protectedColourMismatch,0);
  const candidates=JSON.parse((await downloaded(page,'#sfSourceCandidates')).bytes);
  assert.equal(candidates.sourceSha256,project.source.sha256);assert.equal(candidates.machineEligible,false);
  assert.ok(candidates.objects.some(o=>o.protectedSourceNodeIds.includes(eye.id)&&o.candidate==='narrow_detail_review'));
  await page.locator('#sfSourceWidth').fill('100');await page.locator('#sfSourceWidth').dispatchEvent('change');
  const resizedCandidates=JSON.parse((await downloaded(page,'#sfSourceCandidates')).bytes);
  assert.notEqual(resizedCandidates.sourcePlanSignature,candidates.sourcePlanSignature);
  assert.equal(resizedCandidates.physical.imageWidthMm,100);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('working-likeness proof renders real old/new approximations offline on desktop and mobile',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:844}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.45-working-likeness/Working_Likeness_OFFLINE.html')).href);
  await page.waitForFunction('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');
  assert.equal(await page.locator('article img').count(),9);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:844});assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   if(EVIDENCE)await page.locator('article').first().screenshot({path:path.join(EVIDENCE,'working-likeness-'+(width<500?'mobile':'desktop')+'.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});
test('boundary-planning proof renders actual approximations and honest candidate limitations offline',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:844}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.46-boundary-planning/Working_Likeness_OFFLINE.html')).href);
  await page.waitForFunction('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');
  assert.equal(await page.locator('article img').count(),9);
  assert.match(await page.locator('article').first().innerText(),/Unverified physical candidates/);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:844});assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   if(EVIDENCE)await page.locator('article').first().screenshot({path:path.join(EVIDENCE,'boundary-planning-'+(width<500?'mobile':'desktop')+'.png')});
  }
  await page.locator('#tryArtwork').setInputFiles({name:'synthetic-eye.png',mimeType:'image/png',buffer:image({detail:false,eye:true})});
  await page.locator('#tryInspect').click();await page.waitForFunction('!document.querySelector("#trySave").disabled');
  const privateProject=JSON.parse((await downloaded(page,'#trySave')).bytes);
  assert.equal(privateProject.graph.algorithm,'bounded_reference_graph_MD-2.46');
  assert.ok(privateProject.graph.nodes.some(n=>n.color==='#050505'&&n.protectedFeature));
  const candidate=JSON.parse((await downloaded(page,'#tryCandidates')).bytes);
  assert.equal(candidate.machineEligible,false);assert.equal(candidate.sourceSha256,privateProject.source.sha256);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});
test('changing physical size while candidate compilation is pending discards the stale download',async()=>{
 const {page,errors,unexpected}=await app();const downloads=[];page.on('download',d=>downloads.push(d));
 try{
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfSourceCandidates").disabled');
  await page.evaluate(()=>{const original=window.StitchForgeSourceStitchCandidates;
   window.StitchForgeSourceStitchCandidates={...original,buildCandidates:async d=>{await new Promise(r=>window.releaseCandidate=r);return original.buildCandidates(d);}};});
  await page.locator('#sfSourceCandidates').click();await page.waitForFunction('typeof window.releaseCandidate==="function"');
  await page.locator('#sfSourceWidth').fill('100');await page.locator('#sfSourceWidth').dispatchEvent('change');
  await page.evaluate('window.releaseCandidate()');
  await page.waitForFunction('document.querySelector("#sfSourceStatus").textContent.includes("stale candidates discarded")');
  assert.equal(downloads.length,0);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('textured source gets an explicit preview fallback in the actual app without stitch approval',async()=>{
 const {page,errors,unexpected}=await app(390,texturedImage());
 try{
  await page.locator('#sfSourceInspect').click();await page.waitForFunction('!document.querySelector("#sfSourceSave").disabled');
  assert.match(await page.locator('#sfSourceStatus').innerText(),/Preview only/);
  assert.equal(await page.locator('#sfSourceCandidates').isDisabled(),true);
  const saved=JSON.parse((await downloaded(page,'#sfSourceSave')).bytes);
  assert.equal(saved.schema,'stitch-forge-source-region-approximation-v1');assert.equal(saved.machineEligible,false);
  assert.equal(saved.approximation.referenceGraphAvailable,false);
  const svg=(await downloaded(page,'#sfSourceSvg')).bytes.toString();assert.match(svg,/SOURCE_GEOMETRY_NOT_DIGITISED/);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await page.close();}
});
test('latest offline inspector supports the bounded textured preview without network or paid calls',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  await page.goto(pathToFileURL(path.join(ROOT,'docs/test-evidence/MD-2.47-textured-preview/Working_Likeness_OFFLINE.html')).href);
  await page.locator('#tryArtwork').setInputFiles({name:'synthetic-texture.png',mimeType:'image/png',buffer:texturedImage()});
  await page.locator('#tryInspect').click();await page.waitForFunction('!document.querySelector("#trySave").disabled');
  assert.match(await page.locator('#tryStatus').innerText(),/Preview fallback/);assert.equal(await page.locator('#tryCandidates').isDisabled(),true);
  const saved=JSON.parse((await downloaded(page,'#trySave')).bytes);assert.equal(saved.approximation.reasonCode,'source_graph_node_budget');
  assert.equal(saved.machineEligible,false);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 }finally{await page.close();}
});

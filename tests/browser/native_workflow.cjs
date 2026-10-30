/* Actual browser -> repository Function -> loopback WSGI -> real Ink/Stitch.
 * No external, hosted or paid API is allowed. No ideal geometry is supplied.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {readArchive}=require('../../site/artwork-pipeline.js');
const ROOT=path.resolve(__dirname,'../..'),EVIDENCE=process.env.STITCH_FORGE_NATIVE_EVIDENCE;
const cases=['rose','macaw','butterfly'].map(id=>({id,file:path.join(ROOT,'tests/fixtures/artwork-evaluation',id+'.png'),private:false}));
if(process.env.STITCH_FORGE_PRIVATE_ARTWORK)cases.push({id:'private-painted',file:process.env.STITCH_FORGE_PRIVATE_ARTWORK,private:true});
for(const sample of cases)test('actual automatic app/native workflow: '+sample.id,{timeout:180000,skip:!process.env.STITCH_FORGE_INKSTITCH},async()=>{
 const {startLocalApp}=await import(pathToFileURL(path.join(ROOT,'tools/local_app_server.mjs')).href);
 const phases=[],ownerToken='local-synthetic-owner-access-token';
 const app=await startLocalApp({ownerToken,engine:process.env.STITCH_FORGE_INKSTITCH,onPhase:p=>phases.push(p),diagnosticsDirectory:sample.private?process.env.STITCH_FORGE_PRIVATE_DIAGNOSTICS:null});
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.STITCH_FORGE_CHROMIUM,args:JSON.parse(process.env.STITCH_FORGE_CHROMIUM_ARGS||'[]')});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  const errors=[],external=[],apiCalls=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==app.url){external.push(u.origin);return route.abort();}if(u.pathname.startsWith('/api/'))apiCalls.push(u.pathname);return route.continue();});
  await page.goto(app.url);await page.locator('#importFile').setInputFiles(sample.file);await page.waitForFunction('window.StitchForgeAIContext.getImage() && document.querySelector("#status").textContent.includes("Raster imported")');
  assert.equal(await page.locator('#sfAutoWorkflow').inputValue(),'native');const originalPaths=await page.evaluate('window.__stitchforge_test.paths');
  await page.locator('#sfAutoToken').fill(ownerToken);
  await page.locator('#sfAutoAdvanced summary').click();
  await page.locator('#sfAutoUseAI').uncheck(); // Offline no-API native regression remains deterministic
  let download;page.on('download',item=>{download=item;});
  await page.locator('#sfAutoRun').click();await page.waitForFunction('!document.querySelector("#sfAutoRun").disabled',{},{timeout:150000});
  const status=await page.locator('#sfAutoStatus').innerText();assert.match(status,/Actual decoded stitches are shown/,status);assert.ok(download,status);
  const bytes=fs.readFileSync(await download.path()),files=await readArchive(new Uint8Array(bytes)),report=JSON.parse(Buffer.from(files['machine-report.json']));
  assert.equal(report.machineEligible,false);assert.equal(report.sourceBinding.foregroundIndependentlyVerified,true);assert.equal(report.workflow,'TWO_NATIVE_PHASES_NO_AI');
  assert.equal(report.decoded[0].needleStitches,report.decoded[1].needleStitches);assert.ok(report.decoded[0].needleStitches>100);
  assert.ok(report.decoded.every(d=>d.needlePointsOutsideWorkingColour===0&&d.needleSegmentsOutsideWorkingColour===0));
  assert.ok(await page.locator('#sfNativeDecodedOverlay [data-evidence="actual-decoded-PES6"]').count()>0);
  assert.deepEqual(await page.evaluate('window.__stitchforge_test.paths'),originalPaths);
  assert.match(await page.evaluate('(()=>{try{window.StitchForgeAIContext.exportMachineProject();return "allowed"}catch(e){return e.message}})()'),/blocked/);
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  assert.deepEqual(phases.map(p=>[p.phase,p.status]),report.nativePasses===2?[['pes',200],['dst',202],['pes',200],['dst',200]]:[['pes',200],['dst',200]]);assert.ok(phases.every(p=>p.elapsedMs<55000));
  assert.deepEqual(apiCalls,Array(phases.length).fill('/api/artwork-embroidery'));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  assert.ok(files['native-artwork-input.svg'].length>100);assert.equal(report.nativePasses<=2,true);
  assert.ok(!JSON.stringify(report).includes(ownerToken));
  if(EVIDENCE){
   fs.mkdirSync(EVIDENCE,{recursive:true});
   const summary={sample:sample.id,private:sample.private,sourceDimensions:[report.source.width,report.source.height],needleStitchesPerFormat:report.decoded[0].needleStitches,
    colourChanges:report.decoded[0].colourChanges,unresolvedObjects:report.unresolvedObjects,unresolvedPixels:report.unresolvedPixels,
    outsidePoints:0,outsideSegments:0,nativePasses:report.nativePasses,repairedObjects:report.nativeRepairObjects.length,
    repairedSourcePixels:report.nativeRepairObjects.reduce((n,o)=>n+o.pixels,0),phases,externalCalls:external.length,pageErrors:errors.length,legacyPathsUnchanged:true,machineApproved:false};
   fs.writeFileSync(path.join(EVIDENCE,sample.id+'-workflow-summary.json'),JSON.stringify(summary,null,2)+'\n');
   if(!sample.private){
    await page.locator('#sfAutoPanel').screenshot({path:path.join(EVIDENCE,sample.id+'-mobile-controls.png')});
    await page.locator('#design').screenshot({path:path.join(EVIDENCE,sample.id+'-actual-decoded-canvas.png')});
    fs.writeFileSync(path.join(EVIDENCE,sample.id+'-actual-app-trial.zip'),bytes);
   }
  }
  await page.locator('#sfAutoShow').uncheck();assert.equal(await page.locator('#sfNativeDecodedOverlay path').count(),0);await page.locator('#sfAutoShow').check();
  await page.locator('#sfAutoUndo').click();assert.equal(await page.locator('#sfNativeDecodedOverlay path').count(),0);
  assert.equal(await page.evaluate('window.StitchForgeAIContext.exportMachineProject().paths.length'),originalPaths.length);
  await page.close();
 }finally{if(browser)await browser.close();await app.close();}
});

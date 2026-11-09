const test=require('node:test'),assert=require('node:assert/strict');
const {ghost}=require('../tools/simple_ghost_fixture.cjs');
const M=require('../site/motif-prep.js'),A=require('../site/source-object-plan.js'),
 P=require('../site/artwork-pipeline.js');
const R=require('../site/auto-reconstruct.js');
test('simple ghost automatically detects complete black/white motif and preserves pixel ownership',async()=>{
 const {pixels,width,height}=ghost();
 const {draft,quality}=await M.prepare(pixels,width,height,{imageWidthMm:80});
 assert.equal(quality.colourCount,2);
 assert.equal(quality.allForegroundPixelsAccountedFor,true);
 assert.equal(quality.meanRgbError,0);
 assert.ok(draft.regions.some(r=>r.color==='#131313'));
 assert.ok(draft.regions.some(r=>r.color==='#F6F6F6'));
 const original=R.sourceForegroundMask(pixels,width,height);
 let count=0;
 for(const region of draft.regions)count+=region.ledger.foregroundPixels;
 assert.equal(count,original.reduce((a,b)=>a+b,0));
 const plan=await A.build(draft);
 assert.equal(plan.summary.representedPixels,quality.sourcePixels);
 assert.equal(plan.summary.omittedPixels,0);
 assert.equal(plan.machineEligible,false);
});
test('simple ghost builds actual signed compressed worker packet for native PES/DST',async()=>{
 const {pixels,width,height}=ghost();
 const p=await P.pack(pixels,width,height,{
   imageWidthMm:80,sizeMode:'visible',texturePolicy:'off',maxWorkingParts:160,
   profile:'simple_motif'});
 assert.equal(p.profile,'simple_motif');
 assert.equal(p.motifQuality.colourCount,2);
 assert.ok(p.sizing.imageWidthMm>80);
 assert.equal(p.packet.requestId.length,64);
 assert.equal(JSON.parse(p.packet.header).palette.length,2);
 assert.equal(p.plan.summary.omittedPixels,0);
});
test('no silent fallback to detailed art, paid vision or unsupported mode',async()=>{
 const {pixels,width,height}=ghost();
 await assert.rejects(()=>P.pack(pixels,width,height,{profile:'unknown'}),/Unsupported/);
 await assert.rejects(()=>P.pack(pixels,width,height,{profile:'simple_motif'}),/must not silently/);
});
test('simple mode rejects textured artwork rather than making unusable stitch files',async()=>{
 const {pixels,width,height}=ghost();
 let seed=123456789;
 for(let k=0;k<width*height;k++)if(pixels[k*4+3]){
  seed=(1664525*seed+1013904223)>>>0;pixels[k*4]=(seed>>>24);
  seed=(1664525*seed+1013904223)>>>0;pixels[k*4+1]=(seed>>>24);
  seed=(1664525*seed+1013904223)>>>0;pixels[k*4+2]=(seed>>>24);
 }
 await assert.rejects(()=>M.prepare(pixels,width,height),/too much shading|fragments/);
});
test('existing site automatically loads new bounded motif source prior to native pack',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync(require('node:path').join(__dirname,'../site/index.html'),'utf8');
 const ui=fs.readFileSync(require('node:path').join(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');
 const simple=fs.readFileSync(require('node:path').join(__dirname,'../site/simple-workflow.js'),'utf8');
 assert.ok(html.indexOf('/motif-prep.js')<html.indexOf('/artwork-pipeline.js'));
 assert.match(ui,/motifMode\?'simple_motif':'detailed'/);
 assert.match(ui,/!motifMode&&q\('#sfAutoUseAI'\)\.checked/);
 assert.match(simple,/Simple motif — automatic \(recommended\)/);
});

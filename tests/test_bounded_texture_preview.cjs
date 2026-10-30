const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../site/source-region-project.js'),candidates=require('../site/source-stitch-candidates.js');
const {maskFromLedger}=require('../site/source-mask-ledger.js'),{sourceForegroundMask}=require('../site/auto-reconstruct.js');
const w=224,h=224;
function texture(){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=(((x*73856093)^(y*19349663))>>>0)&31;
  rgba.set([(i%8)*32+16,((i>>3)%8)*32+16,((i*5)%8)*32+16,255],(y*w+x)*4);
 }
 return rgba;
}
test('fine-graph budget refusal produces an explicit bounded preview without raising limits or deleting pixels',async()=>{
 const rgba=texture();await assert.rejects(()=>api.createGraphDraft(rgba,w,h),/node budget/);
 const d=await api.createInspectionDraft(rgba,w,h),union=new Uint8Array(w*h);
 assert.equal(d.schema,'stitch-forge-source-region-approximation-v1');assert.equal(d.approximation.reasonCode,'source_graph_node_budget');
 assert.equal(d.approximation.referenceGraphAvailable,false);assert.equal(d.approximation.smallFeaturePreservationVerified,false);
 assert.ok(d.regions.length<=12);assert.equal(d.machineEligible,false);
 for(const r of d.regions){const m=maskFromLedger(r.ledger);for(let k=0;k<m.length;k++)union[k]|=m[k];}
 assert.deepEqual(union,sourceForegroundMask(rgba,w,h));
});
test('fallback preview save/reopen checks original pixels and cannot forge graph or stitch approval',async()=>{
 const rgba=texture(),d=await api.createInspectionDraft(rgba,w,h),saved=api.serialiseDraft(d),loaded=api.parseDraft(saved);
 assert.ok(saved.length<8000000);assert.ok(await api.assertMatchesSource(loaded,rgba,w,h));
 const bad=JSON.parse(saved);bad.machineEligible=true;bad.graph={machineEligible:true};bad.approximation.referenceGraphAvailable=true;
 const checked=api.parseDraft(JSON.stringify(bad));assert.equal(checked.machineEligible,false);assert.equal(checked.graph,undefined);
 assert.equal(checked.approximation.referenceGraphAvailable,false);
 await assert.rejects(()=>candidates.buildCandidates(checked),/source graph/);
});
test('non-budget validation failures never silently become fallback previews',async()=>{
 await assert.rejects(()=>api.createInspectionDraft(new Uint8ClampedArray(8),w,h),/Invalid source/);
 await assert.rejects(()=>api.createInspectionDraft(texture(),w,h,{imageWidthMm:Infinity}),/width/);
 const invalid=new Uint8ClampedArray(512*512*4);
 for(let y=1;y<511;y++)for(let x=1;x<511;x++)invalid.set((x+y)%2?[0,0,0,255]:[255,255,255,255],(y*512+x)*4);
 await assert.rejects(()=>api.createInspectionDraft(invalid,512,512),/run budget/);
});

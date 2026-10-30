const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const P=require('../site/source-region-project.js');
const A=require('../site/source-object-plan.js');
const api=require('../site/artwork-pipeline.js');

test('physically sized candidate analysis preserves requested machine width and stays deterministic',()=>{
 assert.deepEqual(api.analysisSizes(80,1145,1374),[384,307,230,173]);
 assert.deepEqual(api.analysisSizes(80,1353,1163),[320,256,192,144]);
 assert.deepEqual(api.analysisSizes(80,1145,1374,'off'),[768]);
 assert.deepEqual(api.analysisSizes(250,1145,1374),[768,720,540]);
 for(const args of [[NaN,200,200],[80,0,300],[80,200,NaN],[80,200,300,'risky']])
  assert.throws(()=>api.analysisSizes(...args),/Invalid physical analysis sizing/);
});

test('physical colour preparation rejects excessive parts before any native worker request',async()=>{
 const w=96,h=96,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<88;y++)for(let x=8;x<88;x++){
  const checker=(x+y)%3===0;
  rgba.set(checker?[35,125,168,255]:[205,95,42,255],(y*w+x)*4);
 }
 const before=rgba.slice(),opts={imageWidthMm:80,maxWorkingParts:1};
 await assert.rejects(api.pack(rgba,w,h,opts),e=>e.code==='SOURCE_DETAIL_BUDGET'&&e.workingParts>1);
 assert.deepEqual(rgba,before);
 await assert.rejects(api.pack(rgba,w,h,{maxWorkingParts:10001}),/maximum working-part/);
});

test('source-graph size fallback retains original fingerprint and exact source geometry',async()=>{
 const w=96,h=96,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<88;y++)for(let x=8;x<88;x++)rgba.set([120+(x%6)*10,45+(y%6)*10,130,255],4*(y*w+x));
 const draft=await P.createApproximationDraft(rgba,w,h,{reasonCode:'source_graph_serialisation_budget'});
 const matched=await P.assertMatchesSource(draft,rgba,w,h);
 assert.equal(matched.foregroundPixels,draft.foregroundPixels);
 const generalized=await A.build(draft,{maxRgbChange:180,maxReachMm:2});
 assert.equal(generalized.summary.representedPixels,draft.foregroundPixels);
 assert.equal(generalized.summary.omittedPixels,0);
 assert.equal(generalized.summary.protectedPartsRecoloured,0);
 assert.equal(generalized.machineEligible,false);
 const verified=await A.assertBindings(generalized,draft);
 assert.equal(verified.sourcePlanSignature,generalized.sourcePlanSignature);
});

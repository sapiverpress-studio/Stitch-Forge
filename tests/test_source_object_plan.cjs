const test=require('node:test'),assert=require('node:assert/strict');
const project=require('../site/source-region-project.js'),api=require('../site/source-object-plan.js');
const {maskFromLedger}=require('../site/source-mask-ledger.js');
const {maskFromContours}=require('../site/source-topology.js');
const w=128,h=128;
function image(){
 const p=new Uint8ClampedArray(w*h*4);
 for(let y=12;y<116;y++)for(let x=12;x<116;x++)p.set([180,100,50,255],(y*w+x)*4);
 for(let y=20;y<100;y+=6)for(let x=20;x<100;x+=6)p.set([140,90,45,255],(y*w+x)*4);
 for(let y=40;y<44;y++)for(let x=40;x<44;x++)p.set([2,2,2,255],(y*w+x)*4);
 for(let y=70;y<90;y++)for(let x=70;x<90;x++)p.fill(0,(y*w+x)*4,(y*w+x+1)*4);
 p.set([10,180,200,255],(5*w+5)*4);return p;
}
test('groups adjacent shading fragments while preserving eye, detached detail, foreground and holes',async()=>{
 const d=await project.createApproximationDraft(image(),w,h,{imageWidthMm:40}),plan=await api.build(d);
 assert.ok(plan.summary.workingParts<plan.summary.sourceParts/2);
 assert.equal(plan.summary.sourcePixels,plan.summary.representedPixels);assert.equal(plan.summary.omittedPixels,0);
 assert.equal(plan.summary.protectedPartsRecoloured,0);assert.ok(plan.summary.protectedParts>0);
 const before=new Uint8Array(w*h),after=new Uint8Array(w*h);
 for(const r of d.regions){const mask=maskFromLedger(r.ledger);for(let i=0;i<mask.length;i++)before[i]+=mask[i];}
 for(const r of plan.regions){const mask=maskFromLedger(r.ledger);assert.deepEqual(maskFromContours(r.topology),mask);for(let i=0;i<mask.length;i++)after[i]+=mask[i];}
 assert.deepEqual(after,before);assert.equal(after[80*w+80],0);assert.equal(after[5*w+5],1);
 assert.equal(plan.machineEligible,false);assert.equal(plan.status,'GENERALISED_ARTWORK_NOT_DIGITISED');
 assert.ok(plan.summary.maxReachBoundMm<=plan.options.maxReachMm);
 assert.ok(plan.summary.maxRgbChange<=plan.options.maxRgbChange);
 const eye=plan.assignments.find(a=>a.sourceColor==='#020202');assert.ok(eye?.protected);assert.equal(eye.action,'retained');
});
test('all original working parts are bound once; changed size, source, assignments and flags are refused',async()=>{
 const d=await project.createApproximationDraft(image(),w,h,{imageWidthMm:40}),plan=await api.build(d);
 assert.equal(new Set(plan.assignments.map(a=>a.sourcePartId)).size,d.summary.componentCount);
 assert.equal(plan.assignments.reduce((n,a)=>n+a.pixels,0),d.foregroundPixels);
 await api.assertBindings(plan,d);
 await assert.rejects(api.assertBindings(plan,project.resizeDraft(d,100)),/Stale/);
 for(const mutate of [p=>p.machineEligible=true,p=>p.assignments.pop(),p=>p.regions[0].color='#000000']){
  const bad=structuredClone(plan);mutate(bad);await assert.rejects(api.assertBindings(bad,d),/changed/);
 }
});
test('physical grouping is deterministic, bounded, and rejects malformed configuration',async()=>{
 const d=await project.createApproximationDraft(image(),w,h,{imageWidthMm:40}),p=await api.build(d);
 assert.deepEqual(await api.build(d),p);assert.match(api.geometrySvg(p),/not stitches/);
 assert.throws(()=>api.geometrySvg(structuredClone(p)),/Rebuild/);
 for(const options of [{maxRgbChange:201},{maxReachMm:Infinity},{smallAreaMm2:-1},{allowOmissions:true}])await assert.rejects(api.build(d,options),/option/);
 const resized=await api.build(project.resizeDraft(d,200));assert.notEqual(resized.sourcePlanSignature,p.sourcePlanSignature);
 assert.ok(resized.summary.recolouredPixels<p.summary.recolouredPixels);
});

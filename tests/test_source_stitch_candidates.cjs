const test=require('node:test'),assert=require('node:assert/strict');
const project=require('../site/source-region-project.js'),api=require('../site/source-stitch-candidates.js');
const w=128,h=96;
function source(){
 const p=new Uint8ClampedArray(w*h*4);
 for(let y=10;y<86;y++)for(let x=10;x<110;x++)p.set([180,70,20,255],(y*w+x)*4);
 for(let y=25;y<70;y++)for(let x=40;x<75;x++)p.fill(0,(y*w+x)*4,(y*w+x+1)*4);
 p.set([5,5,5,255],(35*w+25)*4);return p;
}
test('every reference node is bound exactly once to a physical candidate, with no omissions',async()=>{
 const d=await project.createGraphDraft(source(),w,h),c=await api.buildCandidates(d);
 const ids=c.objects.flatMap(o=>o.sourceNodeIds);
 assert.equal(new Set(ids).size,ids.length);assert.deepEqual(new Set(ids),new Set(d.graph.nodes.map(n=>n.id)));
 assert.equal(c.objects.reduce((n,o)=>n+o.pixelArea,0),d.foregroundPixels);
 assert.equal(c.machineEligible,false);assert.ok(c.objects.every(o=>!o.machineEligible));
 assert.ok(c.objects.some(o=>o.holeCount===2));assert.ok(c.summary.fill_candidate>=1); // transparent void + contrasting eye
});
test('a protected tiny eye remains explicit narrow-detail review rather than automatic omission',async()=>{
 const c=await api.buildCandidates(await project.createGraphDraft(source(),w,h));
 const eye=c.objects.find(o=>o.protectedSourceNodeIds.length);
 assert.ok(eye);assert.equal(eye.candidate,'narrow_detail_review');
 assert.ok(eye.reviewFlags.includes('contrasting_source_feature_must_be_accounted_for'));
 assert.ok(eye.reviewFlags.includes('running_centreline_or_satin_rails_required'));
 assert.equal(c.status,'PHYSICAL_REVIEW_CANDIDATES_NO_STITCHES');
});
test('physical width changes invalidate candidate bindings and change millimetre geometry only',async()=>{
 const d=await project.createGraphDraft(source(),w,h,{imageWidthMm:80}),a=await api.buildCandidates(d);
 const resized=project.resizeDraft(d,100),b=await api.buildCandidates(resized);
 assert.notEqual(a.sourcePlanSignature,b.sourcePlanSignature);
 assert.deepEqual(a.objects.map(o=>o.id),b.objects.map(o=>o.id));
 assert.ok(Math.abs(b.objects[0].areaMm2/a.objects[0].areaMm2-1.5625)<1e-9);
 await assert.rejects(()=>api.assertBindings(a,resized),/Stale/);
 assert.equal((await api.assertBindings(b,resized)).machineEligible,false);
});
test('geometry axes remain explicitly provisional and unset density/underlay cannot imply approval',async()=>{
 const d=await project.createGraphDraft(source(),w,h),c=await api.buildCandidates(d);
 for(const o of c.objects){assert.ok(o.reviewFlags.includes('local_minimum_width_unverified'));
  assert.equal('rowSpacingMm' in o,false);assert.equal('underlay' in o,false);}
 const corrupt=structuredClone(c);corrupt.objects[0].candidate='machine_ready';
 await assert.rejects(()=>api.assertBindings(corrupt,d),/changed/);
 await assert.rejects(()=>api.buildCandidates({...d,physical:{imageWidthMm:Infinity}}),/width/);
});

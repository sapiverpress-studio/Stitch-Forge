const test=require('node:test'),assert=require('node:assert/strict');
const {classifyRegion,classifyDraft}=require('../site/stitch-classifier.js');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const rotated=(p,a)=>p.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
test('thin feature proposes running only',()=>{
 const r=classifyRegion(rect(0,0,50,2),.25);
 assert.equal(r.candidate,'running_candidate');assert.equal(r.proposedCentreline.length,9);
 assert.equal(r.machineApproved,false);assert.equal(r.proposedRails,null);
});
test('regular narrow band produces 9 paired satin previews',()=>{
 const r=classifyRegion(rect(0,0,60,12),.25);
 assert.equal(r.candidate,'satin_candidate');assert.equal(r.proposedRails.left.length,9);
 assert.equal(r.proposedRails.right.length,9);assert.equal(r.medianWidthMm,3);
 assert.equal(r.machineApproved,false);
});
test('rotated satin retains physical metric',()=>{
 const a=classifyRegion(rect(0,0,60,12),.25);
 const b=classifyRegion(rotated(rect(0,0,60,12),Math.PI/4),.25);
 assert.equal(b.candidate,a.candidate);assert.equal(b.medianWidthMm,a.medianWidthMm);
});
test('reversed winding and repeated closing vertex',()=>{
 const p=rect(0,0,60,12).reverse();p.push(p[0]);
 assert.equal(classifyRegion(p,.25).candidate,'satin_candidate');
});
test('open and explicitly closed triangles have the same physical category proposal',()=>{
 const triangle=[[0,0],[100,0],[0,80]];
 const open=classifyRegion(triangle,.3);
 assert.notEqual(open.reason,'invalid_or_self_intersecting_contour');
 assert.deepEqual(open,classifyRegion([...triangle,triangle[0]],.3));
 assert.equal(open.machineApproved,false);
});
test('broad region is fill proposal',()=>{
 const r=classifyRegion(rect(0,0,60,45),.25);
 assert.equal(r.candidate,'fill_candidate');assert.equal(r.proposedRails,null);
});
test('tiny 5x5 eye is reviewed not stitched',()=>{
 const r=classifyRegion(rect(0,0,5,5),.2);
 assert.equal(r.candidate,'manual_review');assert.equal(r.reason,'below_conservative_stitch_size');
});
test('notched feature cannot invent satin rail',()=>{
 const p=[[0,0],[60,0],[60,15],[45,15],[45,4],[15,4],[15,15],[0,15]];
 assert.equal(classifyRegion(p,.25).candidate,'manual_review');
});
test('bowtie self intersection rejected',()=>{
 const r=classifyRegion([[0,0],[20,20],[0,20],[20,0]],.25);
 assert.equal(r.reason,'invalid_or_self_intersecting_contour');
});
test('physical scale absent or nonfinite',()=>{
 for(const v of [0,-1,NaN,Infinity,null,'2'])
  assert.equal(classifyRegion(rect(0,0,60,12),v).reason,'physical_scale_unavailable');
});
test('nonfinite and degenerate contours',()=>{
 for(const p of [[[0,0],[10,0],[10,NaN],[0,10]],[[0,0],[10,0],[10,0],[0,10]],[[0,0],[10,0],[10,10]]])
  assert.equal(classifyRegion(p,.2).candidate,'manual_review');
});
test('requested millimetres change satin versus fill choice',()=>{
 const r=[{id:'stripe',kind:'fill',points:rect(0,0,60,12)},
          {id:'line',kind:'running',points:[[10,10],[40,10]]}];
 const a=classifyDraft(r,15),b=classifyDraft(r,60);
 assert.equal(a.scaleMmPerPixel,.25);assert.equal(b.scaleMmPerPixel,1);
 assert.equal(a.regions[0].candidate,'satin_candidate');
 assert.equal(b.regions[0].candidate,'fill_candidate');
 assert.equal(a.regions[1].candidate,'running_candidate');
 assert.equal(a.regions[1].machineApproved,false);
});
test('invalid draft does not fabricate scale',()=>{
 assert.throws(()=>classifyDraft([],30),/Invalid region list/);
 assert.throws(()=>classifyDraft([{kind:'fill',points:rect(0,0,3,2)}],0),/Invalid design width/);
 assert.throws(()=>classifyDraft([{kind:'fill',points:[[0,0],[NaN,0],[2,2]]}],20),/Invalid source point/);
});

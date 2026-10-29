const test=require('node:test'),assert=require('node:assert/strict');
const {validateRails}=require('../site/satin-geometry.js');
const {classifyRegion}=require('../site/stitch-classifier.js');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const rails=(w=12)=>({left:[[0,0],[20,0],[40,0],[60,0]],right:[[0,w],[20,w],[40,w],[60,w]]});
test('regular pair becomes bounded rungs and visual zigzag',()=>{
 const r=validateRails(rails(),.25);
 assert.equal(r.accepted,true);assert.equal(r.rungs.length,4);
 assert.ok(r.zigzagGuide.length>8);assert.equal(r.minimumWidthMm,3);
 assert.equal(r.machineApproved,false);assert.equal(r.geometryOnly,true);
});
test('new classifier nine rail sections feed satin geometry',()=>{
 const c=classifyRegion(rect(0,0,60,12),.25);
 assert.equal(c.candidate,'satin_candidate');
 const r=validateRails(c.proposedRails,.25);
 assert.equal(r.accepted,true);assert.equal(r.rungs.length,9);
});
test('rotation leaves widths and length acceptable',()=>{
 const a=Math.PI/4;const rot=p=>p.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
 const p=rails();const r=validateRails({left:rot(p.left),right:rot(p.right)},.25);
 assert.equal(r.accepted,true);assert.equal(r.minimumWidthMm,3);
});
test('gentle curved satin rails generate bend checkpoints',()=>{
 const p={left:[[0,0],[10,0],[20,2],[30,6],[40,12]],
          right:[[0,12],[10,12],[20,14],[30,18],[40,24]]};
 const r=validateRails(p,.25);
 assert.equal(r.accepted,true);assert.equal(r.rungs.length,5);
});
test('opposing rail direction is rejected',()=>{
 const p=rails();p.right.reverse();
 assert.equal(validateRails(p,.25).reason,'opposing_rail_direction');
});
test('thin and overwide satin columns are refused',()=>{
 assert.equal(validateRails(rails(4),.25).reason,'column_width_outside_conservative_satin_range');
 assert.equal(validateRails(rails(25),.25).reason,'column_width_outside_conservative_satin_range');
});
test('invalid physical scale cannot silently be accepted',()=>{
 for(const x of [0,-1,NaN,Infinity,'0.2',null])
  assert.equal(validateRails(rails(),x).reason,'invalid_physical_scale');
});
test('incomplete and mismatched rails fail closed',()=>{
 assert.equal(validateRails({left:[[0,0],[10,0]],right:[[0,10],[10,10]]},.2).reason,'missing_or_unpaired_rails');
 assert.equal(validateRails({left:[[0,0],[10,0],[20,0]],right:[[0,10],[10,10]]},.2).reason,'missing_or_unpaired_rails');
});
test('nonfinite points are rejected before geometry',()=>{
 const p=rails();p.left[2]=[NaN,0];
 assert.equal(validateRails(p,.2).reason,'invalid_rail_coordinate');
});
test('acute reversal or rail collapse cannot be passed to native model',()=>{
 const p={left:[[0,0],[20,0],[20,20],[0,20]],
          right:[[0,12],[20,12],[8,20],[-10,20]]};
 assert.equal(validateRails(p,.25).accepted,false);
});
test('large taper is not treated as clean satin',()=>{
 const p={left:[[0,0],[20,0],[40,0],[60,0]],
          right:[[0,8],[20,12],[40,20],[60,22]]};
 assert.equal(validateRails(p,.25).accepted,false);
});
test('preview point budget is bounded',()=>{
 const r=validateRails(rails(),.25,{previewSpacingMm:.01});
 assert.equal(r.reason,'invalid_preview_spacing');
});
test('independent rung crossing is rejected',()=>{
 const p={left:[[0,0],[20,0],[40,0],[60,0]],
          right:[[0,12],[40,12],[20,12],[60,12]]};
 assert.equal(validateRails(p,.25).accepted,false);
});

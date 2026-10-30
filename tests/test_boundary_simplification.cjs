const test=require('node:test'),assert=require('node:assert/strict');
const project=require('../site/source-region-project.js'),{maskFromLedger}=require('../site/source-mask-ledger.js');
const w=96,h=96;
function source(){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<88;y++)for(let x=8;x<88;x++)rgba.set(x<48?[20,20,20,255]:[200,100,20,255],(y*w+x)*4);
 rgba.set([182,92,20,255],(40*w+48)*4);
 rgba.set([5,180,240,255],(60*w+60)*4);return rgba;
}
const reference=n=>{const {paletteIndex,basePaletteIndex,...rest}=n;return rest;};
test('one tiny boundary blend joins a directly adjacent stable colour without changing reference nodes',async()=>{
 const rgba=source(),before=await project.createGraphDraft(rgba,w,h,{simplifyBoundaryBlends:false}),after=await project.createGraphDraft(rgba,w,h);
 assert.deepEqual(after.graph.nodes.map(reference),before.graph.nodes.map(reference));
 assert.equal(after.graph.simplification.reassignments.length,1);
 assert.equal(after.graph.simplification.pixelsReassigned,1);
 assert.ok(after.summary.componentCount<before.summary.componentCount);
 const owners=new Int32Array(w*h).fill(-1);
 for(const [i,node] of after.graph.nodes.entries())for(const [y,x0,x1] of node.runs)owners.fill(i,y*w+x0,y*w+x1);
 for(const r of after.graph.simplification.reassignments){
  assert.ok(after.graph.nodes[r.parent].pixelArea>=16);assert.equal(r.maxBoundaryShiftPixels,1);
  for(const [y,x0,x1] of after.graph.nodes[r.node].runs)for(let x=x0;x<x1;x++){
   const k=y*w+x;assert.ok([k-1,k+1,k-w,k+w].some(p=>p>=0&&p<owners.length&&owners[p]===r.parent));
  }
 }
});
test('contrasting core pixels are never reassigned and selected foreground never changes',async()=>{
 const rgba=source(),before=await project.createGraphDraft(rgba,w,h,{simplifyBoundaryBlends:false}),after=await project.createGraphDraft(rgba,w,h);
 for(const node of after.graph.nodes)if(node.protectedFeature)assert.equal(node.paletteIndex,node.basePaletteIndex);
 const union=d=>{const m=new Uint8Array(w*h);for(const r of d.regions){const a=maskFromLedger(r.ledger);for(let i=0;i<m.length;i++)m[i]|=a[i];}return m;};
 assert.deepEqual(union(before),union(after));assert.equal(after.machineEligible,false);
});
test('recorded reassignments cannot be changed or extended into propagated smoothing',async()=>{
 const d=await project.createGraphDraft(source(),w,h),bad=JSON.parse(project.serialiseDraft(d));
 bad.graph.simplification.reassignments[0].parent=bad.graph.simplification.reassignments[0].node;
 assert.throws(()=>project.parseDraft(JSON.stringify(bad)),/simplification/);
 bad.graph.simplification.reassignments[0].maxBoundaryShiftPixels=2;
 assert.throws(()=>project.parseDraft(JSON.stringify(bad)),/simplification/);
});
test('MD-2.45 unsimplified graphs still reopen against original pixels',async()=>{
 const rgba=source(),d=await project.createGraphDraft(rgba,w,h,{simplifyBoundaryBlends:false});
 assert.equal(d.graph.algorithm,'bounded_reference_graph_MD-2.45');
 const loaded=project.parseDraft(project.serialiseDraft(d));assert.ok(await project.assertMatchesSource(loaded,rgba,w,h));
});

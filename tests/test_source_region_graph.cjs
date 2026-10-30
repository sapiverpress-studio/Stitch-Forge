const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../site/source-region-project.js');
const {validateGraph}=require('../site/source-region-graph.js');
const {sourceForegroundMask}=require('../site/auto-reconstruct.js');
const w=96,h=96;
function source(){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<88;y++)for(let x=8;x<88;x++)rgba.set([190,70,35,255],(y*w+x)*4);
 rgba.set([5,5,5,255],(40*w+40)*4); // A one-pixel contrasting eye control.
 for(let y=54;y<58;y++)for(let x=60;x<64;x++)rgba.set([25,130,200,255],(y*w+x)*4);
 for(let y=20;y<28;y++)for(let x=66;x<74;x++)rgba.fill(0,(y*w+x)*4,(y*w+x+1)*4);
 rgba.set([190,70,35,255],(3*w+3)*4);return rgba;
}
test('a one-pixel contrasting eye retains its identity and working colour without adding thread slots',async()=>{
 const rgba=source(),old=await api.createDraft(rgba,w,h),next=await api.createGraphDraft(rgba,w,h);
 assert.ok(old.quantisation.pixelsBeyondRgb60>=1);
 const eye=next.graph.nodes.find(n=>n.runs.some(([y,x0,x1])=>y===40&&x0<=40&&x1>40));
 assert.equal(eye.pixelArea,1);assert.equal(eye.protectedFeature,true);assert.equal(eye.color,'#050505');
 assert.equal(next.graph.palette[eye.paletteIndex],'#050505');
 assert.equal(next.summary.protectedColourMismatch,0);assert.equal(next.summary.collapsedProtectedEdges,0);
 assert.equal(next.quantisation.pixelsBeyondRgb60,0);assert.ok(next.regions.length<=12);
 assert.equal(next.machineEligible,false);
});
test('reference nodes partition every selected pixel, retain holes and detached parts, and record true adjacency',async()=>{
 const rgba=source(),d=await api.createGraphDraft(rgba,w,h),mask=new Uint8Array(w*h);
 for(const n of d.graph.nodes)for(const [y,x0,x1] of n.runs)for(let x=x0;x<x1;x++){const k=y*w+x;assert.equal(mask[k],0);mask[k]=1;}
 assert.deepEqual(mask,sourceForegroundMask(rgba,w,h));assert.ok(d.summary.holeCount>=1);
 const eyeIndex=d.graph.nodes.findIndex(n=>n.protectedFeature&&n.pixelArea===1);
 assert.ok(d.graph.edges.some(e=>e.a===eyeIndex||e.b===eyeIndex));
 const detached=d.graph.nodes.findIndex(n=>n.runs[0][0]===3);
 assert.equal(d.graph.edges.some(e=>e.a===detached||e.b===detached),false);
 assert.equal(new Set(d.graph.nodes.map(n=>n.id)).size,d.graph.nodes.length);
});
test('graph IDs, palette, save/load and physical edits are deterministic and never approve export',async()=>{
 const first=await api.createGraphDraft(source(),w,h),text=api.serialiseDraft(first),loaded=api.parseDraft(text);
 assert.equal(api.serialiseDraft(loaded),text);
 assert.equal(api.serialiseDraft(await api.createGraphDraft(source(),w,h)),text);
 assert.deepEqual(api.resizeDraft(first,110).graph,first.graph);
 const bad=JSON.parse(text);bad.machineEligible=true;bad.graph.machineEligible=true;
 bad.graph.headers={Authorization:'Bearer injected-credential'};
 assert.equal(api.parseDraft(JSON.stringify(bad)).machineEligible,false);
 assert.doesNotMatch(api.serialiseDraft(api.parseDraft(JSON.stringify(bad))),/injected-credential/);
});
test('geometry and evidence are rechecked against actual source pixels when reopening',async()=>{
 const rgba=source(),d=await api.createGraphDraft(rgba,w,h);
 assert.equal((await api.assertMatchesSource(d,rgba,w,h)).source.sha256,d.source.sha256);
 const corrupt=api.parseDraft(api.serialiseDraft(d));corrupt.graph.edges[0].meanContrast=0;
 await assert.rejects(()=>api.assertMatchesSource(corrupt,rgba,w,h),/does not match/);
 const different=rgba.slice();different[(40*w+40)*4]=6;
 await assert.rejects(()=>api.assertMatchesSource(d,different,w,h),/different artwork/);
 const legacy=await api.createDraft(rgba,w,h);assert.ok(await api.assertMatchesSource(legacy,rgba,w,h));
});
test('malformed node identity, overlaps, graph edges and inconsistent colour assignments are refused',async()=>{
 const graph=(await api.createGraphDraft(source(),w,h)).graph;
 const corruptions=[g=>g.nodes[0].id='forged',g=>g.nodes.push(g.nodes[0]),g=>g.edges[0].edgePixels++,
  g=>g.nodes[0].runs[0][1]=-1,g=>g.nodes[0].paletteIndex=999,g=>g.nodes[0].minRGB[0]=256,
  g=>g.nodes[0].color='#FFFFFF',g=>g.nodes[0].pixelArea++];
 for(const mutate of corruptions){const bad=structuredClone(graph);mutate(bad);assert.throws(()=>validateGraph(bad));}
});
test('complex source graph is explicitly refused within its run budget with caller pixels unchanged',async()=>{
 const w=768,h=768,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)rgba.set((x+y)%2?[20,30,150,255]:[230,180,20,255],(y*w+x)*4);
 const before=rgba.slice();await assert.rejects(()=>api.createGraphDraft(rgba,w,h),/run budget/);
 assert.deepEqual(rgba,before);
});

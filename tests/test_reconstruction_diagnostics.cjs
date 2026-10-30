const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../site/reconstruction-diagnostics.js');
const w=128,h=128;
function source(island=false){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=20;y<108;y++)for(let x=20;x<108;x++)rgba.set([64,128,192,255],(y*w+x)*4);
 if(island)rgba.set([64,128,192,255],(14*w+14)*4);return rgba;
}
const plan=()=>({status:'AI_GEOMETRY_PROPOSAL_NOT_STITCHED',regions:[{
 id:'private-owner-label',label:'private label',kind:'fill',semantic:'other',color:'#4080c0',
 layer:0,confidence:'high',notes:'private free text',points:[{x:50,y:50},{x:950,y:50},{x:950,y:950},{x:50,y:950}]}]});
test('a complete geometry result is captured and replayed on exact source pixels without network',async()=>{
 const rgba=source(),{capture,result,error}=await api.captureAnalysis(rgba,w,h,plan());
 assert.equal(error,null);assert.equal(result.regions.length,1);
 const saved=api.parseCapture(api.serialiseCapture(capture)),replay=await api.replayCapture(rgba,w,h,saved);
 assert.equal(replay.reproduced,true);assert.equal(replay.status,'LOCAL_REPLAY_NOT_APPLIED');
 assert.equal(replay.machineEligible,false);assert.equal(saved.applicationStage,'not_applied');
});
test('source rejection reasons survive when no region can be reconstructed',async()=>{
 const rgba=source(true),{capture,error}=await api.captureAnalysis(rgba,w,h,plan());
 assert.ok(error);assert.equal(capture.assessment.status,'reconstruction_refused');
 assert.deepEqual(capture.assessment.rejected,[{region:1,reason:'small_components_not_stitchable'}]);
 const replay=await api.replayCapture(rgba,w,h,api.parseCapture(api.serialiseCapture(capture)));
 assert.equal(replay.reproduced,true);assert.equal(replay.assessment.retainedRegions,0);
});
test('allowlisted diagnostic excludes images, request headers, tokens, labels, IDs and free model text',async()=>{
 const p=plan();p.image='data:image/png;base64,secret-image';p.headers={Authorization:'Bearer secret-token'};
 p.token='secret-token';p.error='private server dump';
 const {capture}=await api.captureAnalysis(source(),w,h,p);
 capture.authorization='Bearer secret-token';capture.raw=p;capture.source.image=p.image;
 const saved=api.serialiseCapture(capture);
 for(const word of ['secret-image','secret-token','private-owner-label','private label','private free text','private server dump','Authorization','data:image'])
  assert.equal(saved.includes(word),false,word);
 assert.ok(saved.includes('proposal-1'));assert.equal(JSON.parse(saved).machineEligible,false);
});
test('invalid server response retains bounded safe diagnostics but never pretends to be replayable geometry',async()=>{
 const {capture}=await api.captureAnalysis(source(),w,h,{code:'INVALID_MODEL_GEOMETRY',image:'private',
  diagnostics:{rejected_regions:[{region:7,reason:'degenerate_outline',raw:'private'}]}},{httpStatus:422});
 assert.deepEqual(capture.server.rejectedRegions,[{region:7,reason:'degenerate_outline'}]);
 assert.equal(capture.assessment.status,'server_rejected');
 const saved=api.parseCapture(api.serialiseCapture(capture));
 await assert.rejects(()=>api.replayCapture(source(),w,h,saved),/no replayable/);
 assert.doesNotMatch(api.serialiseCapture(saved),/"private"/);
});
test('wrong source, changed analysis revision and corrupt counters block replay',async()=>{
 const {capture}=await api.captureAnalysis(source(),w,h,plan());
 await assert.rejects(()=>api.replayCapture(source(true),w,h,capture),/different source pixels/);
 const bad=structuredClone(capture);bad.algorithmRevision='old';
 assert.throws(()=>api.parseCapture(JSON.stringify(bad)),/Unsupported/);
 bad.algorithmRevision=capture.algorithmRevision;bad.assessment.retainedRegions=999;
 assert.throws(()=>api.parseCapture(JSON.stringify(bad)),/counters/);
});
test('changed expected results are reported as a mismatch without applying a draft',async()=>{
 const {capture}=await api.captureAnalysis(source(),w,h,plan());capture.assessment.coverage=.1;
 const replay=await api.replayCapture(source(),w,h,capture);assert.equal(replay.reproduced,false);
 assert.equal(replay.status,'LOCAL_REPLAY_NOT_APPLIED');
});

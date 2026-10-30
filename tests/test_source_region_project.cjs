const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../site/source-region-project.js');
const {sourceForegroundMask}=require('../site/auto-reconstruct.js');
const {maskFromLedger}=require('../site/source-mask-ledger.js');
const {maskFromContours}=require('../site/source-topology.js');
const w=96,h=64;
function source(){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<56;y++)for(let x=8;x<88;x++)rgba.set([200,45,40,255],(y*w+x)*4);
 for(let y=20;y<34;y++)for(let x=22;x<38;x++)rgba.fill(0,(y*w+x)*4,(y*w+x+1)*4);
 for(let y=22;y<26;y++)for(let x=60;x<64;x++)rgba.set([20,30,35,255],(y*w+x)*4);
 rgba.set([200,45,40,255],(3*w+3)*4);return rgba;
}
test('automatic palette partition preserves all selected source pixels without overlaps',async()=>{
 const rgba=source(),out=await api.createDraft(rgba,w,h),union=new Uint8Array(w*h);
 for(const r of out.regions){
  const m=maskFromLedger(r.ledger);assert.deepEqual(maskFromContours(r.topology),m);
  for(let k=0;k<m.length;k++)if(m[k]){assert.equal(union[k],0);union[k]=1;}
 }
 assert.deepEqual(union,sourceForegroundMask(rgba,w,h));
 assert.ok(out.summary.holeCount>=1);assert.ok(out.summary.smallComponents>=1);
 assert.equal(out.machineEligible,false);assert.ok(out.blockers.includes('stitch_plan_missing'));
});
test('source-region IDs and saved geometry are deterministic, rederived and never machine approved',async()=>{
 const first=await api.createDraft(source(),w,h),second=await api.createDraft(source(),w,h);
 assert.equal(api.serialiseDraft(first),api.serialiseDraft(second));
 const input=JSON.parse(api.serialiseDraft(first));input.machineEligible=true;
 input.regions[0].topology={points:'malicious or stale geometry'};
 const loaded=api.parseDraft(JSON.stringify(input));
 assert.equal(loaded.machineEligible,false);assert.deepEqual(loaded.regions,first.regions);
 assert.equal(loaded.summary.holeCount,first.summary.holeCount);
});
test('physical size edits preserve ring topology and use one scale for both axes',async()=>{
 const first=await api.createDraft(source(),w,h,{imageWidthMm:90}),next=api.resizeDraft(first,120);
 assert.deepEqual(next.regions,first.regions);assert.equal(first.physical.imageWidthMm,90);
 assert.equal(next.physical.imageHeightMm,80);assert.equal(next.physical.scaleMmPerPixel,1.25);
 const svg=api.geometrySvg(next);assert.match(svg,/width="120.000000mm" height="80.000000mm"/);
 assert.match(svg,/fill-rule="evenodd"/);assert.match(svg,/NOT_DIGITISED/);
 assert.doesNotMatch(svg,/inkstitch:|<image|<script|https?:\/\/(?!www.w3.org)/);
});
test('invalid dimensions, disconnected-component tampering and overlapping colour masks are refused',async()=>{
 const first=await api.createDraft(source(),w,h),text=api.serialiseDraft(first);
 for(const value of [0,-1,NaN,Infinity,251,'100',true])assert.throws(()=>api.resizeDraft(first,value),/width/);
 let bad=JSON.parse(text);bad.source.originalWidth=1000;
 assert.throws(()=>api.parseDraft(JSON.stringify(bad)),/aspect ratio/);
 bad=JSON.parse(text);bad.regions[0].ledger.components[0].id='changed';
 assert.throws(()=>api.parseDraft(JSON.stringify(bad)),/Noncanonical/);
 bad=JSON.parse(text);bad.regions[1].ledger=structuredClone(bad.regions[0].ledger);
 assert.throws(()=>api.parseDraft(JSON.stringify(bad)),/overlap/);
 bad=JSON.parse(text);bad.foregroundPixels++;
 assert.throws(()=>api.parseDraft(JSON.stringify(bad)),/accounting/);
});
test('a missing tiny eye colour is measured as palette uncertainty instead of claimed preserved',async()=>{
 const rgba=source();
 for(let y=22;y<26;y++)for(let x=60;x<64;x++)rgba.set([200,45,40,255],(y*w+x)*4);
 rgba.set([5,5,5,255],(24*w+62)*4);
 const out=await api.createDraft(rgba,w,h);
 assert.ok(out.quantisation.pixelsBeyondRgb60>=1);
 assert.ok(out.blockers.includes('semantic_regions_unverified'));
 assert.equal(out.machineEligible,false);
});
test('fingerprints bind exact analysis pixels and dimensions; source input is not changed',async()=>{
 const rgba=source(),before=rgba.slice(),a=await api.fingerprint(rgba,w,h);
 const b=await api.fingerprint(rgba,h,w);rgba[400]++;
 assert.notEqual(a,b);assert.notEqual(a,await api.fingerprint(rgba,w,h));
 const fresh=source();await api.createDraft(fresh,w,h);assert.deepEqual(fresh,before);
});

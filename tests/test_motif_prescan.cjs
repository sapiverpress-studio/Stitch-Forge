const test=require('node:test');
const assert=require('node:assert/strict');
const {ghost,fleckedGhost}=require('../tools/simple_ghost_fixture.cjs');
const prescan=require('../site/motif-prescan.js');
const M=require('../site/motif-prep.js');
const P=require('../site/artwork-pipeline.js');
const L=require('../site/source-mask-ledger.js');
const R=require('../site/auto-reconstruct.js');

function sourceIndex(draft,color,x,y){
 const region=draft.regions.find(r=>r.color===color);
 return region?L.maskFromLedger(region.ledger)[y*draft.source.width+x]:0;
}
test('prescan turns over 160 low-contrast isolated source flecks into stable body colour',async()=>{
 const {pixels,width,height,added}=fleckedGhost();
 const beforeMask=R.sourceForegroundMask(pixels,width,height);
 const {draft,quality}=await M.prepare(pixels,width,height,{imageWidthMm:80});
 assert.ok(quality.prescan.componentsBefore>160,quality.prescan);
 assert.ok(quality.prescan.componentsAfter<quality.prescan.componentsBefore,quality.prescan);
 assert.ok(quality.prescan.recolouredFragments>100,quality.prescan);
 assert.ok(quality.prescan.recolouredPixels<=Math.floor(quality.sourcePixels*.025));
 assert.equal(quality.prescan.sourceRgbaPixelsChanged,false);
 assert.equal(quality.prescan.originalForegroundPixelsPreserved,true);
 assert.equal(quality.sourcePixels,beforeMask.reduce((n,x)=>n+x,0));
 assert.ok(quality.components<=160,quality);
 // Stable facial dark ink remains, despite near-body colour noise.
 assert.equal(sourceIndex(draft,'#131313',78,84),1);
 assert.equal(sourceIndex(draft,'#131313',115,84),1);
 assert.equal(sourceIndex(draft,'#131313',97,115),1);
 assert.equal(sourceIndex(draft,'#F6F6F6',80,100),1);
 const packed=await P.pack(pixels,width,height,{
  imageWidthMm:80,profile:'simple_motif',texturePolicy:'off',
  sizeMode:'visible',maxWorkingParts:160});
 assert.equal(packed.plan.summary.omittedPixels,0);
 assert.equal(packed.motifQuality.prescan.sourceRgbaPixelsChanged,false);
 assert.equal(JSON.parse(packed.packet.header).source.sha256,await
  require('../site/source-region-project.js').fingerprint(pixels,width,height));
});
test('high-contrast miniature eye and mouth are not erased in name of making connected shapes',()=>{
 const {pixels,width,height}=ghost();
 const labels=new Uint8Array(width*height);
 const black=[19,19,19],white=[246,246,246];
 for(let k=0;k<labels.length;k++)if(pixels[k*4+3]){
  labels[k]=pixels[k*4]===19?1:2;
 }
 const singleton=120*width+120;
 assert.equal(labels[singleton],2);
 labels[singleton]=1;
 const result=prescan.simplify(labels,pixels,width,height,[black,white],80);
 assert.equal(result.labels[singleton],1);
 assert.equal(result.quality.originalForegroundPixelsPreserved,true);
 assert.equal(result.quality.recolouredPixels,0);
});
test('prescan never touches transparency or original full RGBA pixels',()=>{
 const {pixels,width,height}=fleckedGhost();
 const snapshot=Buffer.from(pixels);
 const labels=new Uint8Array(width*height);
 for(let k=0;k<labels.length;k++)if(pixels[k*4+3])labels[k]=pixels[k*4]===19?1:(pixels[k*4]===210?3:2);
 const res=prescan.simplify(labels,pixels,width,height,
  [[19,19,19],[246,246,246],[210,210,210]],80);
 assert.equal(Buffer.compare(snapshot,Buffer.from(pixels)),0);
 for(let k=0;k<labels.length;k++)assert.equal(Boolean(labels[k]),Boolean(res.labels[k]));
});
test('prescan refuses unbounded inputs and cannot turn texture rejection into false approval',async()=>{
 const {pixels,width,height}=ghost();
 assert.throws(()=>prescan.simplify(new Uint8Array(5),pixels,width,height,[[19,19,19]],80),/Invalid/);
 const random=ghost();
 let seed=123456789;
 for(let k=0;k<width*height;k++)if(random.pixels[k*4+3]){
  for(let c=0;c<3;c++){
   seed=(1664525*seed+1013904223)>>>0;
   random.pixels[k*4+c]=seed>>>24;
  }
 }
 await assert.rejects(()=>M.prepare(random.pixels,width,height),/too much shading|fragments/);
});

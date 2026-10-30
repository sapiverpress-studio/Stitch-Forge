const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare}=require('../site/fill-geometry.js');
const bounds={x:35,y:140,w:510,h:300};
const wing=[[100,195],[148,167],[223,175],[281,213],[255,262],[200,304],[121,268]];
test('closes a manually traced wing while preserving all source points',()=>{
 const copy=structuredClone(wing),result=prepare(wing,bounds);
 assert.equal(result.status,'MANUAL_CLOSED_FILL_UNVERIFIED');
 assert.equal(result.vertexCount,7);assert.equal(result.points.length,8);
 assert.deepEqual(result.points[0],result.points.at(-1));
 assert.ok(result.areaCanvas>3000);
 assert.deepEqual(wing,copy);
});
test('rejects rectangle submitted as if AI boxes were auto-segmentation when outside artwork',()=>{
 assert.throws(()=>prepare([[0,0],[600,0],[600,600],[0,600]],bounds),/artwork/);
});
test('rejects self-crossing polygons and near-duplicate points',()=>{
 assert.throws(()=>prepare([[100,185],[250,305],[245,180],[102,300]],bounds),/crosses|flattened/);
 assert.throws(()=>prepare([[100,185],[100.5,185],[250,245],[160,320]],bounds),/too close/);
});
test('rejects incomplete, degenerate, giant or non-finite paths',()=>{
 assert.throws(()=>prepare([[100,200],[200,200]],bounds),/3/);
 assert.throws(()=>prepare([[100,200],[120,200],[140,200],[160,200]],bounds),/small|flattened|thin/);
 assert.throws(()=>prepare([[100,200],[200,210],[NaN,250],[120,260]],bounds),/Invalid/);
 assert.throws(()=>prepare(Array(121).fill([100,180]),bounds),/120/);
});
test('preserves a valid three-corner fill and closes it once',()=>{
 const input=[[100,200],[240,200],[100,320]],out=prepare(input,bounds);
 assert.equal(out.vertexCount,3);
 assert.deepEqual(out.points,[...input,input[0]]);
 assert.equal(out.areaCanvas,8400);
 assert.throws(()=>prepare([[100,200],[160,200],[220,200]],bounds),/small|flattened/);
});
test('prevents committing the same close point twice',()=>{
 assert.throws(()=>prepare([[100,195],[200,165],[240,260],[120,320],[100,195]],bounds),/Close boundary/);
});

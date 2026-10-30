const test=require('node:test'),assert=require('node:assert/strict');
const {ledgerFromMask,maskFromLedger}=require('../site/source-mask-ledger.js');
const w=128,h=128;
function rectangle(){const m=new Uint8Array(w*h);for(let y=20;y<108;y++)m.fill(1,y*w+20,y*w+108);return m;}
test('one detached pixel keeps the entire large component and the unresolved detail',()=>{
 const mask=rectangle();mask[14*w+14]=1;
 const out=ledgerFromMask(mask,w,h);
 assert.equal(out.components.length,2);
 assert.deepEqual(out.components.map(c=>c.pixelArea).sort((a,b)=>a-b),[1,7744]);
 assert.equal(out.foregroundPixels,7745);
 assert.deepEqual(maskFromLedger(out),mask);
 assert.equal(out.components.filter(c=>c.reviewFlags.length).length,1);
 assert.equal(out.machineEligible,false);
});
test('a hole survives exactly instead of rejecting or filling the enclosing region',()=>{
 const mask=rectangle();mask[60*w+60]=0;
 const out=ledgerFromMask(mask,w,h);
 assert.equal(out.components.length,1);assert.equal(out.foregroundPixels,7743);
 assert.deepEqual(maskFromLedger(out),mask);
 assert.equal(maskFromLedger(out)[60*w+60],0);
});
test('more than 128 isolated details remain accounted for',()=>{
 const mask=new Uint8Array(w*h);for(let y=10;y<118;y+=4)for(let x=10;x<118;x+=4)mask[y*w+x]=1;
 const out=ledgerFromMask(mask,w,h);
 assert.equal(out.components.length,729);assert.equal(out.foregroundPixels,729);
 assert.deepEqual(maskFromLedger(out),mask);assert.equal(out.machineEligible,false);
});
test('four-connected topology separates diagonal touches and merges connected runs',()=>{
 const mask=new Uint8Array(8*8);mask[0]=mask[9]=mask[10]=mask[18]=1;
 const out=ledgerFromMask(mask,8,8);
 assert.deepEqual(out.components.map(c=>c.pixelArea),[1,3]);
 assert.deepEqual(maskFromLedger(out),mask);
});
test('malformed or overlapping ledgers cannot silently alter source geometry',()=>{
 const out=ledgerFromMask(rectangle(),w,h),invalid=structuredClone(out);
 invalid.components[0].runs.push(invalid.components[0].runs[0]);
 assert.throws(()=>maskFromLedger(invalid),/overlap/);
 invalid.components[0].runs.pop();invalid.foregroundPixels++;
 assert.throws(()=>maskFromLedger(invalid),/accounting/);
 assert.throws(()=>ledgerFromMask(new Uint8Array([2]),1,1),/zero or one/);
 assert.throws(()=>ledgerFromMask(new Uint8Array(2),2,2),/Invalid source mask/);
 assert.throws(()=>ledgerFromMask(new Uint8Array(750001),750001,1),/dimensions/);
});
test('complexity overflow is explicit and preserves the caller input',()=>{
 const mask=new Uint8Array(400*400);for(let y=0;y<400;y++)for(let x=0;x<400;x++)mask[y*400+x]=(x+y)%2;
 const before=mask.slice();assert.throws(()=>ledgerFromMask(mask,400,400),/run budget; no pixels were discarded/);
 assert.deepEqual(mask,before);
});

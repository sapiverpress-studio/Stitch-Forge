const test=require('node:test'),assert=require('node:assert/strict');
const {ledgerFromMask}=require('../site/source-mask-ledger.js');
const {contoursFromLedger,maskFromContours}=require('../site/source-topology.js');
const roundtrip=(m,w,h)=>{const out=contoursFromLedger(ledgerFromMask(m,w,h));assert.deepEqual(maskFromContours(out),m);return out;};
test('all 65,536 possible four-by-four masks preserve every pixel and hole',()=>{
 for(let bits=0;bits<65536;bits++)roundtrip(Uint8Array.from({length:16},(_,i)=>(bits>>i)&1),4,4);
});
test('nested island, two holes, tiny detail and image-border edges survive as rings',()=>{
 const w=48,h=48,m=new Uint8Array(w*h);
 for(let y=0;y<40;y++)m.fill(1,y*w,y*w+40);
 for(let y=8;y<20;y++)m.fill(0,y*w+8,y*w+20);
 for(let y=24;y<32;y++)m.fill(0,y*w+24,y*w+32);
 m[12*w+12]=m[46*w+46]=1;
 const out=roundtrip(m,w,h);
 assert.equal(out.components.length,3);
 assert.equal(out.components.flatMap(c=>c.rings).filter(r=>r.role==='hole').length,2);
 assert.equal(out.machineEligible,false);
});
test('touching background corners remain exact but carry an explicit topology review flag',()=>{
 const m=new Uint8Array(25).fill(1);m[6]=m[12]=0;
 const out=roundtrip(m,5,5);
 assert.ok(out.components[0].reviewFlags.some(f=>f.includes('touching')));
});
test('729 disconnected single pixels are retained without the old 128-component truncation',()=>{
 const m=new Uint8Array(128*128);for(let y=10;y<118;y+=4)for(let x=10;x<118;x+=4)m[y*128+x]=1;
 const out=roundtrip(m,128,128);
 assert.equal(out.components.length,729);assert.equal(out.vertexCount,729*4);
 assert.ok(out.components.every(c=>c.reviewFlags.includes('small_source_component_requires_review')));
});
test('tampered component grouping, ring orientation and off-grid geometry fail closed',()=>{
 const m=new Uint8Array(64);m[0]=m[63]=1;
 const ledger=ledgerFromMask(m,8,8),bad=structuredClone(ledger);
 bad.components[0].id='forged';assert.throws(()=>contoursFromLedger(bad),/Noncanonical/);
 const out=contoursFromLedger(ledger);out.components[0].rings[0].role='hole';
 assert.throws(()=>maskFromContours(out),/orientation/);
 out.components[0].rings[0].role='outer';out.components[0].rings[0].points[0][0]=.2;
 assert.throws(()=>maskFromContours(out),/bounded pixel edges/);
});
test('contour resource refusal leaves the original mask ledger intact',()=>{
 const w=1000,h=750,m=new Uint8Array(w*h);
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=20)m.fill(1,y*w+x,y*w+x+10);
 const ledger=ledgerFromMask(m,w,h),before=JSON.stringify(ledger);
 assert.throws(()=>contoursFromLedger(ledger),/exceed edge budget; mask retained/);
 assert.equal(JSON.stringify(ledger),before);
});

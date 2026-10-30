// Protocol/parser tests only. Byte mocks are not embroidery evidence.
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),{createHash}=require('node:crypto');
const api=require('../site/artwork-pipeline.js');
const w=128,h=96;
function pixels(){const p=new Uint8ClampedArray(w*h*4);for(let y=10;y<86;y++)for(let x=10;x<118;x++)p.set([180,70,30,255],(y*w+x)*4);for(let y=30;y<50;y++)for(let x=40;x<60;x++)p.fill(0,(y*w+x)*4,(y*w+x+1)*4);p.set([5,5,5,255],(25*w+30)*4);return p;}
test('packed original pixels and prepared labels have a size/source-bound digest and exact foreground',async()=>{
 const rgba=pixels(),{packet,draft}=await api.pack(rgba,w,h);
 const raw=zlib.gunzipSync(Buffer.from(packet.rgbaGzip,'base64')),labels=zlib.gunzipSync(Buffer.from(packet.labelsGzip,'base64'));
 assert.deepEqual(raw,Buffer.from(rgba));assert.equal(labels.length,w*h);
 assert.equal(labels.reduce((n,v)=>n+(v>0),0),draft.foregroundPixels);
 assert.equal(labels[40*w+50],0);assert.ok(labels[25*w+30]);
 assert.equal(createHash('sha256').update(packet.header).update(raw).update(labels).digest('hex'),packet.requestId);
 const resized=await api.pack(rgba,w,h,{imageWidthMm:100});assert.notEqual(resized.packet.requestId,packet.requestId);
});
test('wrong-source native phase and stale source prevent the second engine request',async()=>{
 const packed=await api.pack(pixels(),w,h);let calls=0;
 await assert.rejects(api.generate(packed,{token:'local-token',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({requestId:'0'.repeat(64)}),{headers:{'content-type':'application/json'}});}}),/different artwork/);
 assert.equal(calls,1);
 await assert.rejects(api.generate(packed,{token:'local-token',isCurrent:()=>false,fetchImpl:async()=>{throw Error('Must not call');}}),/stale/);
 const fs=require('node:fs'),path=require('node:path');
 const pes=fs.readFileSync(path.join(__dirname,'../docs/test-evidence/MD-2.48-source-objects/artwork-machine/rose/ENGINEERING-TRIAL-NOT-APPROVED.pes'));
 let current=true;calls=0;
 await assert.rejects(api.generate(packed,{token:'local-token',isCurrent:()=>current,fetchImpl:async()=>{calls++;current=false;return new Response(JSON.stringify({requestId:packed.packet.requestId,pesBase64:pes.toString('base64'),receipt:{requestId:packed.packet.requestId,mac:'a'.repeat(64),pesSha256:createHash('sha256').update(pes).digest('hex')}}));}}),/stale/);
 assert.equal(calls,1);
});
test('decoded preview refuses executable colours, out-of-frame movements and invalid physical size',()=>{
 const p={schema:'stitch-forge-decoded-preview-v1',widthMm:84,heightMm:64,palette:['#AABBCC'],segments:[[2,2,3,3,0]]};
 assert.equal(api.previewPacket(p),p);
 for(const patch of [{palette:['url(evil)']},{segments:[[2,2,Infinity,3,0]]},{segments:[[2,2,300,3,0]]},{segments:[[2,2,3,3,1]]},{widthMm:NaN}])assert.throws(()=>api.previewPacket({...p,...patch}));
});
test('broken/incomplete archives fail before a preview or download can be accepted',async()=>{
 for(const bytes of [new Uint8Array(200),Uint8Array.from([80,75,3,4,...Array(200).fill(0)])])await assert.rejects(api.readArchive(bytes));
});
test('a worker-requested native repair is source-bound and limited to one complete retry',async()=>{
 const fs=require('node:fs'),path=require('node:path'),packed=await api.pack(pixels(),w,h),calls=[];
 const pes=fs.readFileSync(path.join(__dirname,'../docs/test-evidence/MD-2.48-source-objects/artwork-machine/rose/ENGINEERING-TRIAL-NOT-APPROVED.pes'));
 const id=packed.packet.requestId,repair={requestId:id,objectIds:['B4461E-0'],issuedAt:1000,mac:'a'.repeat(64)};
 await assert.rejects(api.generate(packed,{token:'local-token',fetchImpl:async(url,opts)=>{
  const req=JSON.parse(opts.body);calls.push(req);
  return req.phase==='pes'?new Response(JSON.stringify({requestId:id,pesBase64:pes.toString('base64'),receipt:{requestId:id,mac:'b'.repeat(64),pesSha256:createHash('sha256').update(pes).digest('hex')}})):
   new Response(JSON.stringify({status:'BOUNDED_NATIVE_REPAIR_REQUIRED',requestId:id,repairReceipt:repair}),{status:202});
 }}),/one-pass bound/);
 assert.deepEqual(calls.map(c=>c.phase),['pes','dst','pes','dst']);assert.ok(!calls[0].repairReceipt);assert.deepEqual(calls[2].repairReceipt,repair);
});

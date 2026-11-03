// Offline protocol regression only. No original customer artwork or live calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {createHash}=require('node:crypto');
const api=require('../site/artwork-pipeline.js');
const hash=b=>createHash('sha256').update(b).digest('hex');

function pngChunk(name,raw){
 const head=Buffer.alloc(8);
 head.writeUInt32BE(raw.length,0);
 head.write(name,4,4,'ascii');
 let crc=-1;
 for(const x of Buffer.concat([Buffer.from(name,'ascii'),raw])){
  crc^=x;
  for(let i=0;i<8;i++)crc=crc>>>1 ^ ((crc&1)?0xedb88320:0);
 }
 const tail=Buffer.alloc(4);tail.writeUInt32BE((crc^-1)>>>0);
 return Buffer.concat([head,raw,tail]);
}
function sourceFixture(w=128,h=96){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<h-8;y++)for(let x=8;x<w-8;x++){
  const i=(y*w+x)*4;
  rgba.set(x<60?[15,95,175,255]:[225,100,32,255],i);
 }
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);
 ihdr[8]=8;ihdr[9]=6;
 const rows=[];
 for(let y=0;y<h;y++){
  rows.push(Buffer.from([0]));
  rows.push(Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4));
 }
 const original=Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR',ihdr),
  pngChunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),
  pngChunk('IEND',Buffer.alloc(0))
 ]);
 return {rgba,w,h,original};
}

test('V2 packet binds a genuine full PNG while V1 remains unchanged',async()=>{
 const {rgba,w,h,original}=sourceFixture();
 const older=await api.pack(rgba,w,h);
 const v2=await api.pack(rgba,w,h,{
  originalWidth:w,originalHeight:h,originalPngBytes:new Uint8Array(original)});
 const meta=JSON.parse(v2.packet.header);
 assert.equal(meta.schema,'stitch-forge-artwork-request-v2');
 assert.equal(meta.originalPng.sha256,hash(original));
 assert.equal(meta.originalPng.bytes,original.length);
 assert.equal(v2.packet.originalPngBase64,original.toString('base64'));
 const src=zlib.gunzipSync(Buffer.from(v2.packet.rgbaGzip,'base64'));
 const labels=zlib.gunzipSync(Buffer.from(v2.packet.labelsGzip,'base64'));
 assert.equal(hash(Buffer.concat([Buffer.from(v2.packet.header),src,labels])),v2.packet.requestId);
 const v1=JSON.parse(older.packet.header);
 assert.equal(v1.schema,'stitch-forge-artwork-request-v1');
 assert.equal(older.packet.originalPngBase64,undefined);
 assert.notEqual(older.packet.requestId,v2.packet.requestId);
 const {validPacket}=await import('../netlify/functions/lib/artwork-jobs.mjs');
 assert.equal(validPacket(JSON.stringify(older.packet)),true);
 assert.equal(validPacket(JSON.stringify(v2.packet)),true);
 assert.equal(validPacket(JSON.stringify({...v2.packet,sourceUrl:'https://attacker.invalid'})),false);
 assert.equal(validPacket(JSON.stringify({...v2.packet,originalPngBase64:'bad%%'})),false);
 assert.equal(validPacket(JSON.stringify({...v2.packet,originalPngBase64:undefined})),false);
});

test('rejects oversized or non-PNG originals without substituting lower resolution',async()=>{
 const {rgba,w,h,original}=sourceFixture();
 await assert.rejects(api.pack(rgba,w,h,{
  originalPngBytes:new Uint8Array(Buffer.from('not-png'))}),/Original PNG/);
 const huge=new Uint8Array(2450001);
 huge.set(original.subarray(0,8));
 await assert.rejects(api.pack(rgba,w,h,{
  originalPngBytes:huge}),/Original PNG/);
});

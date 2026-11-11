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
function pngBytes(rgba,w,h){
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);
 ihdr[8]=8;ihdr[9]=6;
 const rows=[];
 for(let y=0;y<h;y++){
  rows.push(Buffer.from([0]));
  rows.push(Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4));
 }
 return Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR',ihdr),
  pngChunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),
  pngChunk('IEND',Buffer.alloc(0))
 ]);
}
function sourceFixture(w=128,h=96){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=8;y<h-8;y++)for(let x=8;x<w-8;x++)
  rgba.set(x<60?[15,95,175,255]:[225,100,32,255],(y*w+x)*4);
 return {rgba,w,h,original:pngBytes(rgba,w,h)};
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

test('Full image binds the entire canvas, including differently coloured edges and transparent holes',async()=>{
 const w=128,h=96,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const colour=x<64?[240,226,197,255]:[95,123,27,255];
  rgba.set(colour,(y*w+x)*4);
 }
 rgba[4*(10*w+30)+3]=0;
 const originalPngBytes=pngBytes(rgba,w,h);
 await assert.rejects(api.pack(rgba,w,h,{originalPngBytes}),/Background is complex/);
 await assert.rejects(api.pack(rgba,w,h,{fullImage:true}),/requires the original/);
 const {packet,draft}=await api.pack(rgba,w,h,{imageWidthMm:80,originalPngBytes,fullImage:true});
 const meta=JSON.parse(packet.header),labels=zlib.gunzipSync(Buffer.from(packet.labelsGzip,'base64'));
 assert.equal(meta.fullImage,true);
 assert.equal(meta.foregroundPixels,w*h-1);
 assert.equal(meta.imageWidthMm,80);
 assert.equal(draft.physical.imageHeightMm,60);
 assert.ok(labels[0]&&labels[w-1]&&labels[labels.length-1]);
 assert.equal(labels[10*w+30],0);
 assert.equal(packet.requestId,hash(Buffer.concat([Buffer.from(packet.header),Buffer.from(rgba),labels])));
 const {validPacket}=await import('../netlify/functions/lib/artwork-jobs.mjs');
 assert.equal(validPacket(JSON.stringify({...packet,mode:'fine-detail'})),true);
});

test('existing published browser remains V1 unless full-source protocol explicitly enabled',()=>{
 const {readFileSync}=require('node:fs');
 const browser=readFileSync(require('node:path').join(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');
 assert.match(browser,/window\.STITCH_FORGE_V2_FULL_SOURCE_ENABLED===true/);
 assert.match(browser,/\? await originalSourcePng\(source,original\) : null/);
 assert.match(browser,/maxWorkingParts:originalPngBytes\?4500:1500/);
 assert.match(browser,/originalPngBytes,blackSatin,fullImage\}\)/);
});

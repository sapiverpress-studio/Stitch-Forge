'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare,MAX_BYTES,MAX_PIXELS}=require('../site/fine-detail-source.js');
const image=(w,h)=>({naturalWidth:w,naturalHeight:h});
const png=(length=512)=>{const bytes=new Uint8Array(length);bytes.set([137,80,78,71,13,10,26,10]);return bytes;};
function mockCanvas({acceptBelow=1200,alwaysTooLarge=false}={}){
 const sizes=[];
 return {sizes,canvasFactory:()=>{
  const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage(){}}),toBlob(cb){
   sizes.push([this.width,this.height]);
   const tooLarge=alwaysTooLarge||this.width>acceptBelow;
   const bytes=tooLarge?null:png();
   cb({size:tooLarge?4_000_000:bytes.length,async arrayBuffer(){return bytes.buffer;}});
  }};
  return canvas;
 }};
}
test('small PNG passes unchanged and never creates a canvas',async()=>{
 const bytes=png(500),result=await prepare('data:image/png;base64,...',image(1000,1000),{
  fetchImpl:async()=>({ok:true,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes.buffer}),
  canvasFactory:()=>{throw Error('No canvas should be used');}
 });
 assert.equal(result.resized,false);assert.equal(result.bytes.length,500);
 assert.deepEqual([result.width,result.height],[1000,1000]);result.release();
});
test('5000px artwork fits without changing the original input',async()=>{
 const original=image(5000,5000),mock=mockCanvas(),revoked=[];
 const prepared=await prepare('data:large',original,{fetchImpl:()=>{throw Error('Oversized original must not be fetched')},...mock,
  makeUrl:()=> 'blob:processed',revokeUrl:url=>revoked.push(url)});
 assert.equal(prepared.resized,true);
 assert.ok(prepared.width*prepared.height<=MAX_PIXELS);
 assert.ok(prepared.bytes.length<=MAX_BYTES);
 assert.deepEqual([original.naturalWidth,original.naturalHeight],[5000,5000]);
 assert.equal(prepared.source,'blob:processed');
 prepared.release();assert.deepEqual(revoked,['blob:processed']);
 assert.ok(mock.sizes.length>=2);
});
test('oversized processing PNG fails closed instead of sending corrupt source',async()=>{
 const mock=mockCanvas({alwaysTooLarge:true});
 await assert.rejects(prepare('data:large',image(5000,5000),{
  fetchImpl:()=>{throw Error('should not fetch')},...mock,
  makeUrl:()=>{throw Error('should not allocate URL')}
 }),/could not fit the private Fine Detail processing limit/);
 assert.ok(mock.sizes.length>=2);
});
test('reject more than 45 million pixels before allocating memory',async()=>{
 await assert.rejects(prepare('anything',image(8000,8000)),/45 million pixels/);
});

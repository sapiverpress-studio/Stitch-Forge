/* Adapt high-resolution artwork for the private Fine Detail V2 source contract.
 * The user's original remains untouched in the editor; the worker receives a
 * bounded, dimensionally accurate PNG processing copy when necessary.
 */
(function(root){
'use strict';
const MAX_PIXELS=12000000, MAX_BYTES=2450000, MAX_UPLOAD_PIXELS=45000000;
const PNG_SIGNATURE=[137,80,78,71,13,10,26,10];
const isPng=bytes=>bytes.length>=8&&PNG_SIGNATURE.every((n,i)=>bytes[i]===n);
async function prepare(source,image,{fetchImpl=root.fetch?.bind(root),canvasFactory=()=>root.document.createElement('canvas'),makeUrl=blob=>root.URL.createObjectURL(blob),revokeUrl=url=>root.URL.revokeObjectURL(url)}={}){
 const width=image.naturalWidth,height=image.naturalHeight,area=width*height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||Math.min(width,height)<48||area>MAX_UPLOAD_PIXELS)
  throw Error('Artwork must be at least 48 pixels per side and no more than 45 million pixels');
 // A small original PNG can be transferred unchanged. Larger images never get
 // copied into a full-size canvas or fetched into memory unnecessarily.
 if(area<=MAX_PIXELS&&fetchImpl){
  try{
   const response=await fetchImpl(source,{cache:'no-store'});
   const length=Number(response.headers?.get?.('content-length')||0);
   if(response.ok&&(!length||length<=MAX_BYTES)){
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length>=100&&bytes.length<=MAX_BYTES&&isPng(bytes))
     return {bytes,width,height,source,resized:false,release(){}};
   }
  }catch{} // A local, bounded canvas copy is the fallback.
 }
 const longSide=Math.max(width,height),minimumScale=Math.min(1,768/longSide);
 let scale=Math.min(1,Math.sqrt(MAX_PIXELS/area));
 let previous='';
 for(let attempt=0;attempt<10;attempt++){
  const w=Math.max(48,Math.floor(width*scale)),h=Math.max(48,Math.floor(height*scale));
  if(w*h>MAX_PIXELS)throw Error('Fine Detail processing resolution exceeded its safety budget');
  const dimensions=w+'x'+h;
  if(dimensions===previous)break;
  previous=dimensions;
  const canvas=canvasFactory();canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Image preparation is unavailable on this device');
  ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
   value=>value?resolve(value):reject(Error('Cannot encode Fine Detail processing PNG')),'image/png'));
  if(blob.size>=100&&blob.size<=MAX_BYTES){
   const url=makeUrl(blob);
   try{
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(!isPng(bytes))throw Error('Processing copy is not a PNG');
    return {bytes,width:w,height:h,source:url,resized:w!==width||h!==height,release(){revokeUrl(url)}};
   }catch(error){revokeUrl(url);throw error;}
  }
  if(scale<=minimumScale+0.000001)break;
  // Use measured encoding size to avoid repeated expensive full-size canvas
  // attempts on low-memory phones. Never go below the native 768px grid.
  const proposed=scale*Math.min(.84,.96*Math.sqrt((MAX_BYTES-100000)/blob.size));
  scale=Math.max(minimumScale,Math.min(scale*.84,proposed));
 }
 throw Error('Artwork could not fit the private Fine Detail processing limit at 768 pixels; no stitch file was generated');
}
const api=Object.freeze({prepare,MAX_PIXELS,MAX_BYTES,MAX_UPLOAD_PIXELS});
root.StitchForgeFineDetailSource=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

/* Bounded source-mask storage used by local app inspection, not machine export.
 * Keeps every selected source pixel, including holes and tiny disconnected
 * parts. Physical stitch suitability is a later decision, never pixel deletion.
 */
(function(root){
'use strict';
const MAX_PIXELS=750000,MAX_RUNS=50000;
function dimensions(w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>MAX_PIXELS)
  throw Error('Invalid source-mask dimensions');
}
function ledgerFromMask(mask,w,h,{smallComponentPixels=25}={}){
 dimensions(w,h);
 if(!(mask instanceof Uint8Array||mask instanceof Uint8ClampedArray)||mask.length!==w*h||
   !Number.isInteger(smallComponentPixels)||smallComponentPixels<1||smallComponentPixels>1000)
  throw Error('Invalid source mask or review threshold');
 const runs=[],parent=[];
 const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const p=parent[i];parent[i]=r;i=p;}return r;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);};
 let previous=[];
 for(let y=0;y<h;y++){
  const current=[];
  for(let x=0;x<w;){
   if(mask[y*w+x]!==0&&mask[y*w+x]!==1)throw Error('Source mask must contain zero or one');
   if(!mask[y*w+x]){x++;continue;}
   const x0=x++;
   while(x<w&&mask[y*w+x]===1)x++;
   if(runs.length===MAX_RUNS)throw Error('Source mask exceeds run budget; no pixels were discarded');
   const i=runs.length;runs.push([y,x0,x]);parent.push(i);current.push(i);
  }
  let left=0;
  for(const i of current){
   const [,x0,x1]=runs[i];
   while(left<previous.length&&runs[previous[left]][2]<=x0)left++;
   for(let j=left;j<previous.length&&runs[previous[j]][1]<x1;j++)join(i,previous[j]);
  }
  previous=current;
 }
 const groups=new Map();let foregroundPixels=0;
 for(let i=0;i<runs.length;i++){
  const key=find(i),run=runs[i],[y,x0,x1]=run;
  let item=groups.get(key);
  if(!item){item={id:'component-'+(groups.size+1),pixelArea:0,bounds:{x:x0,y,w:x1-x0,h:1},runs:[]};groups.set(key,item);}
  const right=Math.max(item.bounds.x+item.bounds.w,x1),bottom=Math.max(item.bounds.y+item.bounds.h,y+1);
  item.bounds.x=Math.min(item.bounds.x,x0);item.bounds.y=Math.min(item.bounds.y,y);
  item.bounds.w=right-item.bounds.x;item.bounds.h=bottom-item.bounds.y;
  item.pixelArea+=x1-x0;foregroundPixels+=x1-x0;item.runs.push(run.slice());
 }
 const components=[...groups.values()].map(item=>({...item,
  reviewFlags:item.pixelArea<smallComponentPixels?['small_source_component_requires_review']:[]}));
 return {schema:'stitch-forge-source-mask-v1',width:w,height:h,foregroundPixels,runCount:runs.length,
  components,machineEligible:false,status:'SOURCE_PIXELS_ONLY_NOT_DIGITISED'};
}
function maskFromLedger(ledger){
 dimensions(ledger?.width,ledger?.height);
 if(ledger.schema!=='stitch-forge-source-mask-v1'||!Array.isArray(ledger.components)||ledger.components.length>MAX_RUNS)
  throw Error('Invalid source-mask ledger');
 const {width:w,height:h}=ledger,mask=new Uint8Array(w*h);let count=0,runCount=0;
 for(const item of ledger.components){
  if(!item||!Array.isArray(item.runs)||!Number.isInteger(item.pixelArea)||item.pixelArea<1)
   throw Error('Invalid source component');
  let pixels=0;
  for(const run of item.runs){
   if(++runCount>MAX_RUNS||!Array.isArray(run)||run.length!==3||!run.every(Number.isInteger))
    throw Error('Invalid source-mask run');
   const [y,x0,x1]=run;
   if(y<0||y>=h||x0<0||x0>=x1||x1>w)throw Error('Source-mask run outside image');
   for(let x=x0;x<x1;x++){
    const at=y*w+x;if(mask[at])throw Error('Source-mask runs overlap');mask[at]=1;
   }
   pixels+=x1-x0;
  }
  if(pixels!==item.pixelArea)throw Error('Source-component pixel count mismatch');
  count+=pixels;
 }
 if(count!==ledger.foregroundPixels||runCount!==ledger.runCount)throw Error('Source-mask accounting mismatch');
 return mask;
}
const api=Object.freeze({ledgerFromMask,maskFromLedger});
root.StitchForgeSourceMaskLedger=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

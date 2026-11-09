/* MD-2.78: Guarded automatic flat-motif prescan.
 * Snap only sub-millimetre, LOW-CONTRAST palette islands to existing
 * adjacent colours. Never delete silhouette, alpha, background holes,
 * high-contrast details, or draw guessed facial features.
 * Signed source pixels stay untouched; native worker re-audits labels.
 */
(function(root){
'use strict';
const MAX_RECOLOURED_FRACTION=.025,MAX_RECOLOURED_PIXELS=1800;
const MAX_RGB_DISTANCE=74,MAX_ERROR_INCREASE=68;
function channelDistance(a,b){
 return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
}
function lightness(a){return .2126*a[0]+.7152*a[1]+.0722*a[2];}
function components(labels,w,h,palette){
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
 const all=[];
 for(let start=0;start<labels.length;start++){
  if(!labels[start]||visited[start])continue;
  const color=labels[start];
  let head=0,tail=1,x0=w,y0=h,x1=0,y1=0;
  queue[0]=start;visited[start]=1;
  const pixels=[];
  const boundaries=new Int32Array(palette.length+1);
  while(head<tail){
   const k=queue[head++],x=k%w,y=Math.floor(k/w);
   if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   if(pixels.length<32)pixels.push(k);
   const ns=[x? k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1];
   for(const j of ns)if(j>=0){
    const neighbour=labels[j];
    if(neighbour===color){if(!visited[j]){visited[j]=1;queue[tail++]=j;}}
    else if(neighbour)boundaries[neighbour]++;
   }
  }
  all.push({color,area:tail,bounds:[x0,y0,x1+1,y1+1],
    pixels:tail<=32?pixels:null,boundaries});
 }
 return all;
}
function simplify(labels,rgba,w,h,palette,imageWidthMm){
 if(!(labels instanceof Uint8Array)||labels.length!==w*h||
    !(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||
    rgba.length!==w*h*4||!Array.isArray(palette)||!palette.length||
    palette.length>6||palette.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x)||x<0||x>255))||
    !Number.isFinite(imageWidthMm)||imageWidthMm<10||imageWidthMm>250)
  throw Error('Invalid bounded prescan input');
 const mm=imageWidthMm/w;
 // The candidate must be both physically small and pixel-small. A facial
 // outline or a several-pixel eye cannot be relabelled simply for being dark.
 const maxArea=Math.max(2,Math.min(16,Math.floor(.20/(mm*mm))));
 const maxSpanPx=Math.max(2,Math.min(9,Math.floor(.85/mm)));
 const pieces=components(labels,w,h,palette);
 const originalParts=pieces.length;
 const totalForeground=labels.reduce((n,x)=>n+(x?1:0),0);
 const budget=Math.min(MAX_RECOLOURED_PIXELS,Math.floor(totalForeground*MAX_RECOLOURED_FRACTION));
 const selected=[],candidates=[];
 let protectedContrastComponents=0,offeredPixels=0;
 for(const item of pieces){
  const [x0,y0,x1,y1]=item.bounds;
  if(item.area>maxArea||x1-x0>maxSpanPx||y1-y0>maxSpanPx||!item.pixels)continue;
  const src=palette[item.color-1],sourceLuma=lightness(src);
  let target=0,score=Infinity;
  for(let ci=1;ci<=palette.length;ci++){
   if(ci===item.color||item.boundaries[ci]===0)continue;
   const dst=palette[ci-1],delta=channelDistance(src,dst);
   if(delta>MAX_RGB_DISTANCE)continue; // dark line/eye vs body stays
   const dstLuma=lightness(dst);
   if((sourceLuma<115&&dstLuma-sourceLuma>30) ||
      (sourceLuma>175&&sourceLuma-dstLuma>45))continue;
   let meanIncrease=0,nearTarget=true;
   for(const k of item.pixels){
    const p=[rgba[4*k],rgba[4*k+1],rgba[4*k+2]];
    const oldError=channelDistance(p,src),newError=channelDistance(p,dst);
    if(newError>88){nearTarget=false;break;}
    meanIncrease+=newError-oldError;
   }
   if(!nearTarget||meanIncrease/item.area>MAX_ERROR_INCREASE)continue;
   const candidateScore=meanIncrease/item.area+delta*.1-2*Math.log1p(item.boundaries[ci]);
   if(candidateScore<score){score=candidateScore;target=ci;}
  }
  if(!target){protectedContrastComponents++;continue;}
  offeredPixels+=item.area;
  candidates.push({area:item.area,pixels:item.pixels,target,score,
    first:item.pixels[0]});
 }
 // A bounded, deterministic selected subset. Exceeding budget is not a
 // licence to erase faces or alter larger source components.
 candidates.sort((a,b)=>a.score-b.score||a.first-b.first);
 let changed=0;
 const out=labels.slice();
 for(const c of candidates){
  if(changed+c.area>budget)continue;
  for(const k of c.pixels)out[k]=c.target;
  selected.push(c.first);changed+=c.area;
 }
 const after=components(out,w,h,palette);
 const foregroundAfter=out.reduce((n,x)=>n+(x?1:0),0);
 if(foregroundAfter!==totalForeground)
  throw Error('Prescan changed original silhouette or cutout accounting');
 const countByColour=new Int32Array(palette.length);
 for(const x of out)if(x)countByColour[x-1]++;
 if(countByColour.reduce((n,x)=>n+x,0)!==totalForeground)
  throw Error('Prescan lost source colour ownership');
 return {labels:out,quality:{
  strategy:'adjacent_low_contrast_micro_islands_v1',
  componentsBefore:originalParts,componentsAfter:after.length,
  recolouredFragments:selected.length,recolouredPixels:changed,
  recolouredFraction:totalForeground?Number((changed/totalForeground).toFixed(6)):0,
  protectedContrastingTinyComponents:protectedContrastComponents,
  eligiblePixelsNotChangedDueToBudget:offeredPixels-changed,
  originalForegroundPixelsPreserved:true,
  sourceRgbaPixelsChanged:false,
  imageSemanticFeatureRecognised:false,
  physicalStitchQualityVerified:false}};
}
const api=Object.freeze({simplify,components});
root.StitchForgeMotifPrescan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

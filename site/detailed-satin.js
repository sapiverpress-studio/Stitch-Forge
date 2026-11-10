/* Source-derived satin rails shared by illustration review and the private job. */
(function (root) {
'use strict';
const dependency=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const {boundaryPixels,sourceForegroundMask}=dependency('StitchForgeAutoReconstruct','./auto-reconstruct.js');
const FINISH='black_satin_v1', COLOUR='#000000', PITCH=.43;
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const area=ring=>ring.reduce((sum,[x,y],i)=>{
 const [a,b]=ring[(i+1)%ring.length];return sum+x*b-y*a;
},0)/2;

function boxFilter(mask,w,h,radius,threshold){
 const stride=w+1,integral=new Int32Array(stride*(h+1)),out=new Uint8Array(mask.length);
 for(let y=1;y<=h;y++)for(let x=1,row=0;x<=w;x++){
  row+=mask[(y-1)*w+x-1];
  integral[y*stride+x]=integral[(y-1)*stride+x]+row;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=Math.max(0,x-radius),b=Math.min(w,x+radius+1);
  const c=Math.max(0,y-radius),d=Math.min(h,y+radius+1);
  const count=integral[d*stride+b]-integral[d*stride+a]-integral[c*stride+b]+integral[c*stride+a];
  out[y*w+x]=count>=threshold?1:0;
 }
 return out;
}

function sample(line,closed){
 const path=closed?[...line,line[0]]:line;
 const lengths=[0];
 for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+distance(path[i-1],path[i]));
 const length=lengths.at(-1);
 if(length<2||length>1400)throw Error('Satin curve length is outside the supported range.');
 const n=Math.max(6,Math.round(length/PITCH)*2),points=[];
 for(let i=0,j=0;i<(closed?n:n+1);i++){
  const s=i*length/n;
  while(j+1<path.length-1&&lengths[j+1]<s)j++;
  const a=path[j],b=path[j+1],t=(s-lengths[j])/(lengths[j+1]-lengths[j]);
  points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
 }
 return points;
}

function smoothPoints(points){
 const weights=[1,4,7,9,7,4,1];
 return points.map((p,i)=>{
  const neighbours=weights.map((_,j)=>points[(i+j-3+points.length)%points.length]);
  return [0,1].map(axis=>neighbours.reduce((sum,q,j)=>sum+q[axis]*weights[j],0)/33);
 });
}

function satinRails(points,closed,width){
 const at=i=>points[closed?(i+points.length)%points.length:Math.min(points.length-1,Math.max(0,i))];
 const directions=points.map((_,i)=>{
  const a=at(i-1),b=at(i+1),span=distance(a,b);
  if(span<.06)throw Error('The satin curve folds back on itself at this width.');
  return [(b[0]-a[0])/span,(b[1]-a[1])/span,span];
 });
 const n=points.length,left=[],right=[];
 for(let i=0;i<n;i++){
  const [tx,ty,span]=directions[i],normal=[-ty,tx],p=points[i];
  const a=directions[closed?(i+n-1)%n:Math.max(0,i-1)];
  const b=directions[closed?(i+1)%n:Math.min(n-1,i+1)];
  const k=((b[0]-a[0])*normal[0]+(b[1]-a[1])*normal[1])/span;
  const outer=Math.min(closed?.23:width/2,.70/Math.max(-k,.01));
  const inner=Math.min(closed?width-.23:width/2,.70/Math.max(k,.01));
  if(outer+inner<.42)throw Error('A sharp satin turn would be too narrow at this size.');
  left.push(p.map((v,j)=>Number((v-normal[j]*outer).toFixed(4))));
  right.push(p.map((v,j)=>Number((v+normal[j]*inner).toFixed(4))));
 }
 if(closed){left.push(left[0]);right.push(right[0]);}
 return {left,right,closed};
}

function plan(rgba,w,h,imageWidthMm){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>750000||
    rgba?.length!==4*w*h||!Number.isFinite(imageWidthMm)||imageWidthMm<30||imageWidthMm>250)
  throw Error('The image cannot be sized for a black satin finish.');
 const scale=imageWidthMm/w,alpha=sourceForegroundMask(new Uint8ClampedArray(rgba),w,h);
 const foreground=alpha.reduce((sum,bit)=>sum+bit,0);
 const toMm=([x,y])=>[2+x*scale,2+y*scale];
 let failure=Error('A single continuous edge could not be followed for black satin.');
 for(const smoothingMm of [.32,.75]){
  const radius=Math.min(7,Math.max(1,Math.round(smoothingMm/scale)));
  const smooth=boxFilter(alpha,w,h,radius,Math.ceil((2*radius+1)**2/2));
  const raw=boundaryPixels(smooth,w,h);
  if(raw.length<24||Math.abs(area(raw))<foreground*.91)continue;
  let outline=sample((area(raw)>0?raw:raw.reverse()).map(toMm),true);
  for(let attempt=0;attempt<7;attempt++){
   outline=sample(smoothPoints(outline),true);
   try{return {columns:[satinRails(outline,true,1.08)],pitchMm:PITCH};}
   catch(error){failure=error;}
  }
 }
 throw failure;
}

const api=Object.freeze({plan,FINISH,COLOUR});
root.StitchForgeDetailedSatin=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

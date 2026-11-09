/* Source-derived satin rails shared by illustration review and the private job. */
(function (root) {
'use strict';
const dependency=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const {boundaryPixels}=dependency('StitchForgeAutoReconstruct','./auto-reconstruct.js');
const {thinMask}=dependency('StitchForgeDetailGuides','./ai-guides.js');
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

function smoothPoints(line,closed){
 const points=sample(line,closed),weights=[1,4,7,9,7,4,1];
 const smoothed=points.map((p,i)=>{
  if(!closed&&(i===0||i===points.length-1))return p;
  const neighbours=weights.map((_,j)=>points[closed?(i+j-3+points.length)%points.length:
   Math.min(points.length-1,Math.max(0,i+j-3))]);
  return [0,1].map(axis=>neighbours.reduce((sum,q,j)=>sum+q[axis]*weights[j],0)/33);
 });
 return sample(smoothed,closed);
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

function adjacent(i,w,h,mask){
 const x=i%w,y=Math.floor(i/w),out=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const a=x+dx,b=y+dy,j=b*w+a;
  if((dx||dy)&&a>=0&&a<w&&b>=0&&b<h&&mask[j])out.push(j);
 }
 return out;
}

function walk(seed,w,h,mask,visited){
 const previous=new Map([[seed,-1]]),queue=[seed];
 for(let i=0;i<queue.length;i++)for(const next of adjacent(queue[i],w,h,mask)){
  if(previous.has(next))continue;
  previous.set(next,queue[i]);queue.push(next);
 }
 if(visited)for(const i of queue)visited[i]=1;
 return {tip:queue.at(-1),previous};
}

function crossLineContrast(pixels,alpha,luma,w,h,scale){
 function brightness(x,y){
  const a=Math.floor(x),b=Math.floor(y),i=b*w+a;
  return a>=0&&a<w&&b>=0&&b<h&&alpha[i]?luma[i]:0;
 }
 let contrast=0;
 for(let i=2;i<pixels.length-2;i++){
  const [x,y]=pixels[i],a=pixels[i-2],b=pixels[i+2],span=distance(a,b);
  const nx=(a[1]-b[1])/(span*scale),ny=(b[0]-a[0])/(span*scale);
  const side=sign=>[.72,1.08,1.45].reduce((sum,mm)=>
   sum+brightness(x+nx*mm*sign,y+ny*mm*sign),0)/3;
  contrast+=Math.max(0,Math.min(side(-1),side(1))-brightness(x,y));
 }
 return contrast/(pixels.length-4);
}

function darkColumns(rgba,alpha,w,h,scale,toMm){
 const luma=new Float32Array(alpha.length);
 let dark=255;
 for(let i=0;i<alpha.length;i++)if(alpha[i]){
  const j=i*4;
  luma[i]=.299*rgba[j]+.587*rgba[j+1]+.114*rgba[j+2];dark=Math.min(dark,luma[i]);
 }
 if(dark>85)return [];
 const mask=Uint8Array.from(alpha,(value,i)=>+(value&&luma[i]<=Math.min(92,dark+16)));
 const radius=Math.min(3,Math.max(1,Math.round(.27/scale)));
 const bridged=boxFilter(boxFilter(mask,w,h,radius,1),w,h,radius,(2*radius+1)**2);
 const skel=thinMask(bridged,w,h),visited=new Uint8Array(skel.length),candidates=[];
 const support=boxFilter(mask,w,h,1,Math.min(5,Math.max(3,Math.round(.57/scale)+1)));
 for(let i=0;i<skel.length;i++)if(skel[i]&&!visited[i]){
  const first=walk(i,w,h,skel,visited);
  if(first.previous.size*scale<3.3)continue;
  const {tip,previous}=walk(first.tip,w,h,skel);
  const pixels=[];
  for(let at=tip;at!==-1;at=previous.get(at))pixels.push([at%w+.5,Math.floor(at/w)+.5]);
  if(pixels.length<7)continue;
  const line=pixels.map(toMm);
  const length=line.slice(1).reduce((sum,p,i)=>sum+distance(p,line[i]),0);
  const direct=distance(line[0],line.at(-1));
  if(length<3.5||length>29||direct/length<.51)continue;
  // A whisker or isolated pixel can contribute a running stitch in the base.
  // Only an interior stroke with sustained, thicker dark support gains satin.
  const core=pixels.filter(([x,y])=>support[Math.floor(y)*w+Math.floor(x)]).length/pixels.length;
  if(core<.60)continue;
  const contrast=crossLineContrast(pixels,alpha,luma,w,h,scale);
  if(contrast<72)continue;
  try{
   candidates.push({score:length*core*contrast,rails:satinRails(smoothPoints(line,false),false,.82)});
  }catch{/* A sharp or broken dark mark stays in its original stitch family. */}
 }
 return candidates.sort((a,b)=>b.score-a.score).slice(0,2).map(x=>x.rails);
}

function plan(rgba,w,h,imageWidthMm){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||Math.max(w,h)>640||
    rgba?.length!==4*w*h||!Number.isFinite(imageWidthMm)||imageWidthMm<30||imageWidthMm>250)
  throw Error('The image cannot be sized for a black satin finish.');
 const scale=imageWidthMm/w,alpha=new Uint8Array(w*h);
 let foreground=0;
 for(let i=0;i<alpha.length;i++)foreground+=alpha[i]=+(rgba[i*4+3]===255);
 const radius=Math.min(4,Math.max(1,Math.round(.32/scale)));
 const smooth=boxFilter(alpha,w,h,radius,Math.ceil((2*radius+1)**2/2));
 const raw=boundaryPixels(smooth,w,h);
 if(raw.length<24||Math.abs(area(raw))<foreground*.91)
  throw Error('A single continuous edge could not be followed for black satin.');
 const toMm=([x,y])=>[2+x*scale,2+y*scale];
 const outline=smoothPoints((area(raw)>0?raw:raw.reverse()).map(toMm),true);
 const columns=[satinRails(outline,true,1.08),...darkColumns(rgba,alpha,w,h,scale,toMm)];
 return {columns,pitchMm:PITCH};
}

const api=Object.freeze({plan,FINISH,COLOUR});
root.StitchForgeDetailedSatin=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

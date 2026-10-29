/* Pixel-derived candidate running stitches, NOT machine-approved.
   AI boxes only restrict image search; no rectangle becomes a stitch path. */
(function(root){
'use strict';
const TYPES=new Set(['wing_marking','wing_vein','antenna','leg']);
const N=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
function buildDraft(pixels,w,h,regions,widthMm=78,opts={}){
 if(!(pixels instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>1000000||pixels.length!==w*h*4)throw Error('Invalid image pixels');
 if(!Array.isArray(regions)||regions.length>24||!Number.isFinite(widthMm)||widthMm<10||widthMm>250)throw Error('Invalid regions or design size');
 const threshold=opts.threshold??6,minMm=opts.minLengthMm??1.7,maxPaths=opts.maxGuides??80;
 if(!Number.isFinite(threshold)||threshold<5||threshold>40||!Number.isFinite(minMm)||minMm<1.5||minMm>20||!Number.isInteger(maxPaths)||maxPaths<1||maxPaths>100)throw Error('Invalid draft limits');
 const count=w*h,lum=new Float32Array(count),alpha=new Uint8Array(count),step=w+1,integ=new Float64Array(step*(h+1));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x,j=k*4,a=pixels[j+3]/255;
  lum[k]=(pixels[j]*.299+pixels[j+1]*.587+pixels[j+2]*.114)*a+255*(1-a);alpha[k]=pixels[j+3];
  integ[(y+1)*step+x+1]=lum[k]+integ[y*step+x+1]+integ[(y+1)*step+x]-integ[y*step+x];
 }
 const eligible=regions.filter(r=>r&&TYPES.has(r.category)&&r.bbox&&
  ['x_min','y_min','x_max','y_max'].every(k=>Number.isInteger(r.bbox[k])&&r.bbox[k]>=0&&r.bbox[k]<=1000)&&
  r.bbox.x_min<r.bbox.x_max&&r.bbox.y_min<r.bbox.y_max);
 const sorted=eligible.map((r,i)=>({r,i,area:(r.bbox.x_max-r.bbox.x_min)*(r.bbox.y_max-r.bbox.y_min)})).sort((a,b)=>a.area-b.area);
 const mask=new Uint8Array(count),owner=new Int16Array(count);owner.fill(-1);
 const radius=7;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x;if(alpha[k]<40||lum[k]>247)continue;
  const x0=Math.max(0,x-radius),x1=Math.min(w,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(h,y+radius+1);
  const avg=(integ[y1*step+x1]-integ[y0*step+x1]-integ[y1*step+x0]+integ[y0*step+x0])/((x1-x0)*(y1-y0));
  if(avg-lum[k]<threshold)continue;
  const nx=(x+.5)*1000/w,ny=(y+.5)*1000/h;
  for(const o of sorted){let b=o.r.bbox;if(nx>=b.x_min&&nx<=b.x_max&&ny>=b.y_min&&ny<=b.y_max){owner[k]=o.i;mask[k]=1;break;}}
 }
 // Morphological thinning; all candidate pixels originate from source image contrast.
 for(let iteration=0;iteration<22;iteration++){
  let removed=0;
  for(let pass=0;pass<2;pass++){
   const deletion=[];
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const k=y*w+x;if(!mask[k])continue;
    const p=[mask[k-w],mask[k-w+1],mask[k+1],mask[k+w+1],mask[k+w],mask[k+w-1],mask[k-1],mask[k-w-1]];
    const n=p.reduce((a,b)=>a+b,0);if(n<2||n>6)continue;
    let trans=0;for(let j=0;j<8;j++)if(!p[j]&&p[(j+1)%8])trans++;
    if(trans!==1)continue;
    if(pass===0&&(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]))continue;
    if(pass===1&&(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;
    deletion.push(k);
   }
   for(let k of deletion)mask[k]=0;
   removed+=deletion.length;
  }
  if(!removed)break;
 }
 const result=[],used=new Set();
 const neighbours=(k,id)=>{
  let y=Math.floor(k/w),x=k-y*w,out=[];
  for(let [dx,dy] of N){let xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   let next=yy*w+xx;if(mask[next]&&owner[next]===id)out.push(next);
  }return out;
 };
 const edge=(a,b)=>a<b?a+'-'+b:b+'-'+a;
 const compact=points=>{
  if(points.length<3)return points;
  let out=[points[0]],last=points[0];
  for(let i=1;i<points.length-1;i++){
   let p=points[i],next=points[i+1],dx=p[0]-last[0],dy=p[1]-last[1],ex=next[0]-p[0],ey=next[1]-p[1];
   if(Math.hypot(dx,dy)>=3.5||Math.abs(dx*ey-dy*ex)>2){out.push(p);last=p;}
  }out.push(points.at(-1));return out;
 };
 for(let id=0;id<eligible.length;id++){
  const nodes=[];for(let k=0;k<count;k++)if(mask[k]&&owner[k]===id)nodes.push(k);
  const order=nodes.filter(k=>neighbours(k,id).length!==2).concat(nodes.filter(k=>neighbours(k,id).length===2));
  for(const start of order){
   if(result.length>=maxPaths)break;
   for(const next of neighbours(start,id)){
    if(used.has(edge(start,next)))continue;
    let chain=[start],prev=start,at=next;
    for(let hop=0;hop<1500;hop++){
     let key=edge(prev,at);if(used.has(key))break;used.add(key);chain.push(at);
     let neigh=neighbours(at,id);if(neigh.length!==2)break;
     let n=neigh.find(k=>k!==prev);if(n===undefined||used.has(edge(at,n)))break;
     prev=at;at=n;
    }
    if(chain.length<4)continue;
    let len=0;for(let j=1;j<chain.length;j++){
     let a=chain[j-1],b=chain[j],dx=a%w-b%w,dy=Math.floor(a/w)-Math.floor(b/w);
     len+=Math.hypot(dx,dy);
    }
    const mm=len*widthMm/w;if(mm<minMm)continue;
    let points=compact(chain.map(k=>[(k%w)+.5,Math.floor(k/w)+.5]));
    if(points.length>150)continue;
    result.push({regionId:eligible[id].id,label:eligible[id].label||eligible[id].category,
     category:eligible[id].category, suggestedStitch:'running',points,lengthMm:Math.round(mm*10)/10});
   }
  }
 }
 return {status:'DRAFT_IMAGE_DERIVED_NOT_MACHINE_VERIFIED',width:w,height:h,paths:result,
  proposedRegions:eligible.length,ignoredNonLineRegions:regions.length-eligible.length,
  warnings:['Image contrast may create false or duplicated lines.','Fill and satin areas are not generated by this tool.',
   'Review candidate lines before applying; machine testing is still required.']};
}
root.StitchForgeDetailGuides=Object.freeze({buildDraft});
if(typeof module!=='undefined'&&module.exports)module.exports={buildDraft};
})(typeof window==='undefined'?globalThis:window);

/* Automatic image-grounded reconstruction: AI semantic contours plus original pixels.
 * AI polygon vertices are only guides. Closed fills are clipped to actual artwork
 * foreground. They are NOT satin or machine-verified stitches.
 * Standalone browser/Node module, no network or external dependencies.
 */
(function(root){
"use strict";
const finite=n=>typeof n==="number"&&Number.isFinite(n);
function polygonArea(points){let a=0;for(let i=0;i<points.length;i++){let p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function inside(px,py,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
function boundsOf(points){let xx=points.map(p=>p[0]),yy=points.map(p=>p[1]);return{x0:Math.min(...xx),x1:Math.max(...xx),y0:Math.min(...yy),y1:Math.max(...yy)};}
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function invalidPolygon(points){
 if(points.length<5||points.length>32)return true;
 const p=points;
 for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
  if(i===0&&j===p.length-1)continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
  if(c1*c2<0&&c3*c4<0)return true;
 }
 return polygonArea(points)<35;
}
function foregroundMask(rgba,w,h){
 const sample=[];
 for(const [cx,cy] of [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1]]){
  const k=(cy*w+cx)*4;sample.push([rgba[k],rgba[k+1],rgba[k+2],rgba[k+3]]);
 }
 const opaque=sample.filter(p=>p[3]>245),transparent=sample.filter(p=>p[3]<25);
 if(!transparent.length&&opaque.length>=4){
  const mean=[0,1,2].map(c=>opaque.reduce((n,p)=>n+p[c],0)/opaque.length);
  const maxdist=Math.max(...opaque.map(p=>Math.hypot(p[0]-mean[0],p[1]-mean[1],p[2]-mean[2])));
  if(maxdist>45)throw Error("Background is complex; cannot safely isolate embroidery artwork automatically");
  const mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){
   const j=4*i;
   const difference=Math.hypot(rgba[j]-mean[0],rgba[j+1]-mean[1],rgba[j+2]-mean[2]);
   mask[i]=rgba[j+3]>50&&difference>=28?1:0;
  }
  return mask;
 }
 if(transparent.length>=4){
  const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=rgba[4*i+3]>60?1:0;return mask;
 }
 throw Error("Cannot confidently separate artwork from its background");
}
function largestComponent(mask,w,h){
 const visited=new Uint8Array(mask.length);let best=[];
 for(let start=0;start<mask.length;start++){
  if(!mask[start]||visited[start])continue;
  let queue=[start],head=0;visited[start]=1;
  while(head<queue.length){
   let k=queue[head++],x=k%w,y=Math.floor(k/w);
   for(const n of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1]){
    if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue.push(n);}
   }
  }
  if(queue.length>best.length)best=queue;
 }
 const out=new Uint8Array(mask.length);for(const k of best)out[k]=1;
 return{mask:out,size:best.length};
}
function boundaryPixels(mask,w,h){
 const edges=new Map(),add=(x1,y1,x2,y2)=>{const k=x1+","+y1;let a=edges.get(k);if(!a)edges.set(k,a=[]);a.push([x2,y2]);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x;if(!mask[k])continue;
  if(y===0||!mask[k-w])add(x,y,x+1,y);
  if(x===w-1||!mask[k+1])add(x+1,y,x+1,y+1);
  if(y===h-1||!mask[k+w])add(x+1,y+1,x,y+1);
  if(x===0||!mask[k-1])add(x,y+1,x,y);
 }
 let best=[];
 for(const [key,targets] of edges){
  for(const first of targets){
   let pts=[key.split(",").map(Number)],at=first,seen=new Set([key]),limit=0;
   while(limit++<40000){
    const now=at[0]+","+at[1];if(now===key)break;
    if(seen.has(now)){pts=[];break;}seen.add(now);pts.push(at);
    const next=edges.get(now);if(!next?.length){pts=[];break;}at=next[0];
   }
   if(pts.length>best.length)best=pts;
  }
 }
 return best;
}
function simplifyRing(points,maxVertices=115){
 if(points.length<5)return[];
 const p=[];
 for(let i=0;i<points.length;i++){
  const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
  if(Math.abs(cross(a,b,c))>.01)p.push(b);
 }
 if(p.length<=maxVertices)return p;
 const result=[];for(let j=0;j<maxVertices;j++)result.push(p[Math.floor(j*p.length/maxVertices)]);
 return result;
}
function checkedRegion(r){
 if(!r||typeof r.id!=="string"||r.id.length>60||typeof r.label!=="string"||
  !["fill","running"].includes(r.kind)||!/^#[0-9a-f]{6}$/i.test(r.color)||
  !["high","medium","low"].includes(r.confidence)||
  !Array.isArray(r.points)||r.points.length<(r.kind==="fill"?5:2)||r.points.length>32||
  !r.points.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=1000))
  throw Error("AI sent invalid region geometry");
 return r;
}
function reconstruct(rgba,w,h,plan,opts={}){
 if(!(rgba instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||
 w<48||h<48||w*h>750000||rgba.length!==w*h*4)throw Error("Invalid source image");
 if(!plan||!Array.isArray(plan.regions)||plan.regions.length<1||plan.regions.length>16||
  plan.status!=="AI_GEOMETRY_PROPOSAL_NOT_STITCHED")throw Error("Invalid AI geometry plan");
 const foreground=foregroundMask(rgba,w,h),regions=[],rejected=[];
 const ordered=plan.regions.map(checkedRegion).sort((a,b)=>(a.layer||0)-(b.layer||0));
 for(const r of ordered){
  const points=r.points.map(p=>[p.x*w/1000,p.y*h/1000]),base={id:r.id,label:r.label,
   kind:r.kind,color:r.color,confidence:r.confidence,semantic:r.semantic,layer:r.layer};
  if(r.kind==="running"){
   if(points.length>32)continue;
   let supported=0;
   for(const p of points){
    const cx=Math.max(0,Math.min(w-1,Math.round(p[0]))),cy=Math.max(0,Math.min(h-1,Math.round(p[1])));
    let found=false;for(let yy=Math.max(0,cy-3);yy<=Math.min(h-1,cy+3)&&!found;yy++)
     for(let xx=Math.max(0,cx-3);xx<=Math.min(w-1,cx+3);xx++)if(foreground[yy*w+xx]){found=true;break;}
    if(found)supported++;
   }
   if(supported/points.length<.65){rejected.push({id:r.id,reason:"line_off_artwork"});continue;}
   regions.push({...base,points,sourceSupport:supported/points.length});continue;
  }
  if(invalidPolygon(points)){rejected.push({id:r.id,reason:"invalid_fill_outline"});continue;}
  const bb=boundsOf(points),x0=Math.max(0,Math.floor(bb.x0)),x1=Math.min(w-1,Math.ceil(bb.x1));
  const y0=Math.max(0,Math.floor(bb.y0)),y1=Math.min(h-1,Math.ceil(bb.y1));
  const mask=new Uint8Array(w*h);let candidate=0,signal=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inside(x+.5,y+.5,points)){
   candidate++;if(foreground[y*w+x]){mask[y*w+x]=1;signal++;}
  }
  if(candidate<40||signal<25||signal/candidate<.15){rejected.push({id:r.id,reason:"fill_not_supported_by_pixels"});continue;}
  const cc=largestComponent(mask,w,h);
  if(cc.size<25||cc.size/signal<.55){rejected.push({id:r.id,reason:"fragmented_fill"});continue;}
  const contour=simplifyRing(boundaryPixels(cc.mask,w,h));
  if(contour.length<5||invalidPolygon(contour)){rejected.push({id:r.id,reason:"could_not_reconstruct_boundary"});continue;}
  regions.push({...base,points:contour,sourceSupport:cc.size/candidate,
   pixelArea:cc.size,geometrySource:"ai_polygon_intersected_with_artwork_pixels"});
 }
 const fills=regions.filter(r=>r.kind==="fill").length;
 if(fills<2)throw Error("AI reconstruction did not yield at least two supported fill regions; design unchanged");
 if(regions.length>128)throw Error("Too many reconstruction regions");
 return {status:"AUTO_RECONSTRUCTED_DRAFT_NOT_MACHINE_VERIFIED",regions,rejected,
  proposed:plan.regions.length,autoApplied:false,
  warnings:["AI outlines are approximate; source-pixel clipping is not semantic segmentation.",
   "Colours are approximate and PES/DST export is not multi-colour validated.",
   "Satin columns, underlay, trims, pull compensation and physical stitch-out are not verified."]};
}
root.StitchForgeAutoReconstruct=Object.freeze({reconstruct});
if(typeof module!=="undefined"&&module.exports)module.exports={reconstruct};
})(typeof window==="undefined"?globalThis:window);

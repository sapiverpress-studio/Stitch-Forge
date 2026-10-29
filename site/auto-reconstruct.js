/* Automatic image-grounded reconstruction: AI semantic contours plus original pixels.
 * AI polygon vertices are only guides. Closed fills are clipped to actual artwork
 * foreground. They are NOT satin or machine-verified stitches.
 * Standalone browser/Node module, no network or external dependencies.
 */
(function(root){
"use strict";
const finite=n=>typeof n==="number"&&Number.isFinite(n);
function formatFillValidationFailure(accepted,failures){
 const passed=Array.isArray(accepted)?accepted:[],items=Array.isArray(failures)?failures:[];
 const describe=r=>{
  const label=String(r.label||"").replace(/[<>]/g,"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,32);
  return "region "+r.region+(label?" ("+label+")":"");
 };
 const acceptedText=passed.slice(0,8).map(describe).join(", ")||"none";
 const acceptedMore=passed.length>8?"; "+(passed.length-8)+" additional accepted region(s)":"";
 const total=items.length;
 const shown=items.slice(0,4).map(f=>describe(f)+": "+
  String(f.reason||"Fill geometry rejected").replace(/\s+/g," ").slice(0,100)).join("; ");
 const more=total>4?"; "+(total-4)+" additional fill region(s) failed":"";
 return "Basic geometry checks passed for "+passed.length+" region(s): "+acceptedText+acceptedMore+
  ". "+total+" fill region(s) failed ("+shown+more+"). The original design is unchanged; partial replacement and machine export were blocked.";
}
function formatModelRejectionDiagnostics(diagnostics){
 if(!diagnostics||!Array.isArray(diagnostics.rejected_regions))return "";
 const rows=diagnostics.rejected_regions.slice(0,8).map(item=>{
  const number=Number.isInteger(item?.region)&&item.region>0?"region "+item.region:"whole plan";
  const reason=/^[a-z_]{1,40}$/.test(item?.reason||"")?item.reason:"geometry_check_failed";
  const explanation={
   plan_shape_invalid:"the model response did not contain a regions list",
   plan_validation_failed:"the complete region plan failed a required check",
   no_regions_returned:"the model returned no regions",
   region_limit_exceeded:"the model returned more than 32 regions",
   invalid_region:"required region fields failed validation",
   invalid_points:"region coordinates were invalid or outside the image bounds",
   degenerate_outline:"too few distinct points remained after duplicate removal",
   duplicate_id:"two proposed regions used the same ID"
  }[reason]||"the geometry check failed";
  return number+": "+explanation+" ["+reason+"]";
 });
 if(!rows.length)return "";
 const extra=Number.isInteger(diagnostics.additional_rejections)&&diagnostics.additional_rejections>0?
  "; "+diagnostics.additional_rejections+" more rejected":"";
 return " Rejected proposal checks: "+rows.join("; ")+extra+".";
}
function polygonArea(points){let a=0;for(let i=0;i<points.length;i++){let p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function inside(px,py,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
function boundsOf(points){let xx=points.map(p=>p[0]),yy=points.map(p=>p[1]);return{x0:Math.min(...xx),x1:Math.max(...xx),y0:Math.min(...yy),y1:Math.max(...yy)};}
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function invalidPolygon(points,maxPoints=32,minPoints=4,minArea=35){
 if(points.length<minPoints||points.length>maxPoints)return true;
 const p=points;
 for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
  if(i===0&&j===p.length-1)continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
  if(c1*c2<0&&c3*c4<0)return true;
 }
 return polygonArea(points)<minArea;
}
function foregroundMask(rgba,w,h){
 const sample=[];
 const border=[];
 for(let x=0;x<w;x++){border.push(x);border.push((h-1)*w+x);}
 for(let y=1;y<h-1;y++){border.push(y*w);border.push(y*w+w-1);}
 const stride=Math.max(1,Math.floor(border.length/512));
 for(let n=0;n<border.length;n+=stride){const k=border[n]*4;sample.push([rgba[k],rgba[k+1],rgba[k+2],rgba[k+3]]);}
 const opaque=sample.filter(p=>p[3]>245),transparent=sample.filter(p=>p[3]<25);
 if(!transparent.length&&opaque.length>=sample.length*.9){
  const mean=[0,1,2].map(c=>opaque.reduce((n,p)=>n+p[c],0)/opaque.length);
  const maxdist=Math.max(...opaque.map(p=>Math.hypot(p[0]-mean[0],p[1]-mean[1],p[2]-mean[2])));
  if(maxdist>45)throw Error("Background is complex; cannot safely isolate embroidery artwork automatically");
  // A white background can contain nearly-white moth wings; a fixed 28 RGB
  // threshold erased them. Increase tolerance only when the border is noisy.
  const threshold=Math.min(55,Math.max(9,8+maxdist*1.25));
  const mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){
   const j=4*i;
   const difference=Math.hypot(rgba[j]-mean[0],rgba[j+1]-mean[1],rgba[j+2]-mean[2]);
   mask[i]=rgba[j+3]>50&&difference>=threshold?1:0;
  }
  return mask;
 }
 if(transparent.length>=sample.length*.9){
  const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=rgba[4*i+3]>60?1:0;return mask;
 }
 throw Error("Cannot confidently separate artwork from its background");
}
// Deterministic, on-device artwork examination. This performs no API calls,
// sends no pixels to a server and does not claim to be semantic segmentation.
function analyseArtwork(rgba,w,h){
 if(!(rgba instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||
    w<48||h<48||w*h>750000||rgba.length!==w*h*4)
  throw Error("Invalid source image");
 const mask=foregroundMask(rgba,w,h),bins=new Map(),tileEdges=new Uint32Array(16);
 let foregroundPixels=0,edgePixels=0,alphaPixels=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,j=4*i;
  if(rgba[j+3]<245)alphaPixels++;
  if(!mask[i])continue;
  foregroundPixels++;
  const r=rgba[j],g=rgba[j+1],b=rgba[j+2];
  const key=((r>>5)<<10)|((g>>5)<<5)|(b>>5);
  const bin=bins.get(key)||{count:0,r:0,g:0,b:0};
  bin.count++;bin.r+=r;bin.g+=g;bin.b+=b;bins.set(key,bin);
  const neighbour=x<w-1?i+1:y<h-1?i+w:-1;
  if(neighbour>=0){
   const k=4*neighbour;
   const contrast=mask[neighbour]?
    Math.hypot(r-rgba[k],g-rgba[k+1],b-rgba[k+2]):55;
   if(contrast>35){
    edgePixels++;
    const tile=Math.min(3,Math.floor(4*y/h))*4+Math.min(3,Math.floor(4*x/w));
    tileEdges[tile]++;
   }
  }
 }
 if(foregroundPixels<25)throw Error("Artwork has too little distinguishable foreground");
 const palette=[...bins.values()].filter(bin=>bin.count>=Math.max(8,foregroundPixels*.004))
  .sort((a,b)=>b.count-a.count).slice(0,12)
  .map(bin=>({color:"#"+[bin.r,bin.g,bin.b].map(v=>Math.round(v/bin.count).toString(16).padStart(2,"0")).join("").toUpperCase(),
    percent:Number((100*bin.count/foregroundPixels).toFixed(1))}));
 const density=edgePixels/foregroundPixels;
 const detailLevel=density>.22?"high":density>.09?"medium":"low";
 const hotspot=[...tileEdges].map((count,index)=>({column:index%4,row:Math.floor(index/4),edgeCount:count}))
  .sort((a,b)=>b.edgeCount-a.edgeCount).slice(0,4);
 return {width:w,height:h,foregroundPixels,palette,
  distinctColourBins:bins.size,edgeDensity:Number(density.toFixed(3)),
  detailLevel,transparentBackground:alphaPixels>w*h*.1,hotspot,
  source:"local_pixel_scan",requiresMachineTest:true};
}
function connectedComponents(mask,w,h){
 const visited=new Uint8Array(mask.length);const components=[];
 for(let start=0;start<mask.length;start++){
  if(!mask[start]||visited[start])continue;
  let queue=[start],head=0;visited[start]=1;
  while(head<queue.length){
   let k=queue[head++],x=k%w,y=Math.floor(k/w);
   for(const n of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1]){
    if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue.push(n);}
   }
  }
  components.push(queue);
  if(components.length>128)return components;
 }
 return components.sort((a,b)=>b.length-a.length);
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
 let best=[],used=new Set();
 const keyOf=(from,to)=>from+"->"+to[0]+","+to[1];
 for(const [start,targets] of edges){
  for(const first of targets){
   if(used.has(keyOf(start,first)))continue;
   let pts=[start.split(",").map(Number)],from=start,at=first,limit=0,closed=false;
   while(limit++<40000){
    const edgeKey=keyOf(from,at);if(used.has(edgeKey))break;
    used.add(edgeKey);
    const now=at[0]+","+at[1];
    if(now===start){closed=true;break;}
    pts.push(at);
    const options=edges.get(now);
    if(!options?.length)break;
    const next=options.find(target=>!used.has(keyOf(now,target)));
    if(!next)break;
    from=now;at=next;
   }
   if(closed&&pts.length>best.length)best=pts;
  }
 }
 return best;
}
// Error-bounded simplification. Never subsample a contour to satisfy a budget:
// that can bridge a notch or erase a feather. Over-budget shapes fail closed.
function simplifyRing(points,maxVertices=512){
 if(points.length<4)return[];
 const p=points.filter((b,i)=>Math.abs(cross(points[(i+points.length-1)%points.length],b,points[(i+1)%points.length]))>.01);
 if(p.length<=115)return p;
 function rdp(seq){
  const keep=new Uint8Array(seq.length);keep[0]=keep[seq.length-1]=1;
  const stack=[[0,seq.length-1]];
  while(stack.length){
   const [i,j]=stack.pop(),a=seq[i],b=seq[j],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
   let index=-1,maximum=.75*.75;
   for(let k=i+1;k<j;k++){
    const t=den?Math.max(0,Math.min(1,((seq[k][0]-a[0])*dx+(seq[k][1]-a[1])*dy)/den)):0;
    const d=(seq[k][0]-a[0]-t*dx)**2+(seq[k][1]-a[1]-t*dy)**2;
    if(d>maximum){maximum=d;index=k;}
   }
   if(index>=0){keep[index]=1;stack.push([i,index],[index,j]);}
  }
  return seq.filter((_,i)=>keep[i]);
 }
 let split=1;
 for(let i=2;i<p.length;i++)if(Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1])>Math.hypot(p[split][0]-p[0][0],p[split][1]-p[0][1]))split=i;
 const out=rdp(p.slice(0,split+1)).slice(0,-1).concat(rdp(p.slice(split).concat([p[0]])).slice(0,-1));
 return out.length<=maxVertices?out:[];
}
// Scan conversion at pixel centres, independent of boundary extraction.
function paintPolygon(points,w,h,visit){
 const bb=boundsOf(points);
 for(let y=Math.max(0,Math.floor(bb.y0));y<Math.min(h,Math.ceil(bb.y1));y++){
  const cuts=[];
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];
   if((a[1]>y+.5)!==(b[1]>y+.5))cuts.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }
  cuts.sort((a,b)=>a-b);
  for(let i=0;i+1<cuts.length;i+=2)for(let x=Math.max(0,Math.ceil(cuts[i]-.5));x<Math.min(w,Math.ceil(cuts[i+1]-.5));x++)visit(y*w+x);
 }
}
// Catch coherent high-contrast details that are too small for palette totals.
// This detects missing detail only; it does not invent stitches or geometry.
function fineDetailOmissions(rgba,w,h,foreground,owner,colours,collect=false){
 const mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x,region=owner[k];if(region<0||!foreground[k])continue;
  const j=k*4,c=colours[region],r=rgba[j],g=rgba[j+1],b=rgba[j+2];
  if(Math.hypot(r-c[0],g-c[1],b-c[2])<100)continue;
  let supportedNeighbour=false;
  for(let dy=-2;dy<=2&&!supportedNeighbour;dy++)for(let dx=-2;dx<=2;dx++){
   if(!dx&&!dy)continue;
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   const n=yy*w+xx;if(owner[n]!==region||!foreground[n])continue;
   const q=n*4,nr=rgba[q],ng=rgba[q+1],nb=rgba[q+2];
   if(Math.hypot(nr-c[0],ng-c[1],nb-c[2])<=55&&
      Math.hypot(nr-r,ng-g,nb-b)>=95){supportedNeighbour=true;break;}
  }
  if(supportedNeighbour)mask[k]=1;
 }
 let details=0,detailPixels=0,components=[];
 for(let k=0;k<mask.length;k++){
  if(mask[k]!==1)continue;
  const queue=[k];mask[k]=2;let head=0,minX=w,maxX=0,minY=h,maxY=0;
  while(head<queue.length){
   const at=queue[head++],x=at%w,y=Math.floor(at/w);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);
   minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
    const next=ny*w+nx;if(mask[next]===1){mask[next]=2;queue.push(next);}
   }
  }
  const spanX=maxX-minX+1,spanY=maxY-minY+1;
  if(queue.length>=12&&(Math.max(spanX,spanY)>=8||
     (queue.length>=16&&Math.min(spanX,spanY)>=3))){
   details++;detailPixels+=queue.length;
   if(collect&&components.length<16)components.push(queue);
  }
 }
 return {count:details,pixels:detailPixels,components};
}

function auditReconstruction(rgba,w,h,foreground,regions,collect=false){
 const owner=new Int16Array(w*h);owner.fill(-1);
 let overlapPixels=0;
 regions.forEach((r,index)=>{
  const visit=k=>{if(owner[k]>=0&&owner[k]!==index)overlapPixels++;owner[k]=index;};
  if(r.kind==='fill')paintPolygon(r.points,w,h,visit);
  else for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
   for(let j=0;j<=steps;j++){
    const x=Math.round(a[0]+(b[0]-a[0])*j/steps),y=Math.round(a[1]+(b[1]-a[1])*j/steps);
    // Only a diagnostic corridor, NOT a running-stitch coverage/width claim.
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=9&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&foreground[(y+dy)*w+x+dx])visit((y+dy)*w+x+dx);
   }
  }
 });
 const colours=regions.map(r=>[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16)));
 let foregroundPixels=0,missingPixels=0,falseFillPixels=0,colourMismatchPixels=0;
 const bins=new Map();
 for(let k=0;k<foreground.length;k++){
  if(!foreground[k]){if(owner[k]>=0)falseFillPixels++;continue;}
  foregroundPixels++;const j=4*k,c=colours[owner[k]];
  if(!c)missingPixels++;
  const mismatch=!c||Math.hypot(rgba[j]-c[0],rgba[j+1]-c[1],rgba[j+2]-c[2])>60;
  if(c&&mismatch)colourMismatchPixels++;
  const key=(rgba[j]>>5)+','+(rgba[j+1]>>5)+','+(rgba[j+2]>>5);
  const bin=bins.get(key)||{pixels:0,unrepresented:0};bin.pixels++;if(mismatch)bin.unrepresented++;bins.set(key,bin);
 }
 const missingColourGroups=[...bins.values()].filter(b=>b.pixels>=Math.max(25,foregroundPixels*.004)&&b.unrepresented/b.pixels>.25).length;
 const fineDetails=fineDetailOmissions(rgba,w,h,foreground,owner,colours,collect);
 const blockers=[];
 if(fineDetails.count)blockers.push('unrepresented_fine_details');
 if(regions.some(r=>r.confidence==='low'))blockers.push('low_confidence_regions');
 if(regions.some(r=>r.kind==='running'&&r.sourceSupport<.9))blockers.push('partial_running_centreline');
 if(missingPixels>Math.max(16,foregroundPixels*.03))blockers.push('uncovered_source_artwork');
 if(falseFillPixels>Math.max(4,foregroundPixels*.005))blockers.push('false_filled_background');
 if(missingColourGroups)blockers.push('unrepresented_source_colours');
 return {foregroundPixels,missingPixels,falseFillPixels,colourMismatchPixels,missingColourGroups,overlapPixels,
  unrepresentedFineDetails:fineDetails.count,unrepresentedFineDetailPixels:fineDetails.pixels,
  ...(collect?{_detailSeeds:fineDetails.components}:{}),
  coverage:Number((1-missingPixels/Math.max(1,foregroundPixels)).toFixed(4)),blockers,
  machineEligible:blockers.length===0,scope:'pixel_fidelity_only_not_semantic_or_stitch_validation'};
}
// Image-grounded running centreline: AI points are only a search corridor.
// Every retained centreline segment must be supported by local cross-line contrast.
// A generic foreground check incorrectly accepted invented lines across solid wings.
function contrastCentreline(rgba,mask,w,h,points){
 const luminance=(x,y)=>{
  const xx=Math.round(x),yy=Math.round(y);
  if(xx<0||yy<0||xx>=w||yy>=h)return null;
  const j=(yy*w+xx)*4;
  if(rgba[j+3]<50)return null;
  return rgba[j]*.2126+rgba[j+1]*.7152+rgba[j+2]*.0722;
 };
 const samples=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<.2)continue;
  const nx=-dy/length,ny=dx/length,steps=Math.ceil(length/1.7);
  for(let t=(i===1?0:1);t<=steps;t++){
   const px=a[0]+dx*t/steps,py=a[1]+dy*t/steps;
   let strongest=null,bestScore=9;
   for(let offset=-4;offset<=4;offset++){
    const xx=Math.round(px+nx*offset),yy=Math.round(py+ny*offset);
    if(xx<0||yy<0||xx>=w||yy>=h||!mask[yy*w+xx])continue;
    const mid=luminance(xx,yy);
    for(const radius of [3,5,7]){
     const left=luminance(xx+nx*radius,yy+ny*radius);
     const right=luminance(xx-nx*radius,yy-ny*radius);
     if(left===null||right===null)continue;
     const dark=Math.min(left-mid,right-mid);
     const light=Math.min(mid-left,mid-right);
     const score=Math.max(dark,light);
     if(score>bestScore){bestScore=score;strongest=[xx,yy];}
    }
   }
   samples.push(strongest);
   if(samples.length>2000)break;
  }
  if(samples.length>2000)break;
 }
 if(samples.length<5)return null;
 // Bridging no more than three unsampled positions avoids long false seams.
 let runs=[],run=[],missing=0;
 for(const s of samples){
  if(s){if(missing>3){if(run.length)runs.push(run);run=[];}missing=0;run.push(s);}
  else missing++;
 }
 if(run.length)runs.push(run);
 runs.sort((a,b)=>b.length-a.length);
 let best=runs[0]||[];
 if(best.length<6||best.length/samples.length<.32)return null;
 const compact=[];
 for(const p of best)if(!compact.length||Math.hypot(p[0]-compact.at(-1)[0],p[1]-compact.at(-1)[1])>1.1)compact.push(p);
 if(compact.length<2)return null;
 // Distance-based simplification retains turns without the full pixel jitter.
 const simplify=(seq,epsilon)=>{
  const keep=new Uint8Array(seq.length);keep[0]=keep[seq.length-1]=1;
  const stack=[[0,seq.length-1]];
  while(stack.length){
   const [i,j]=stack.pop(),a=seq[i],b=seq[j],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
   let k=-1,max=epsilon*epsilon;
   for(let m=i+1;m<j;m++){
    const p=seq[m],q=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
    const dist=(p[0]-a[0]-dx*q)**2+(p[1]-a[1]-dy*q)**2;
    if(dist>max){max=dist;k=m;}
   }
   if(k>=0){keep[k]=1;stack.push([i,k],[k,j]);}
  }
  return seq.filter((p,i)=>keep[i]);
 };
 let out=simplify(compact,1.6);
 if(out.length>100)out=Array.from({length:100},(_,i)=>out[Math.floor(i*(out.length-1)/99)]);
 if(Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<6)return null;
 return{points:out,support:best.length/samples.length};
}
// Recover source-backed colour islands using only the existing pixel canvas.
// These contours do not imply a selected stitch type, sewability or anatomy.
function recoverLocalDetails(rgba,w,h,foreground,regions,components){
 if(!components.length)return [];
 const owner=new Int16Array(w*h);owner.fill(-1);
 regions.forEach((r,i)=>{if(r.kind==='fill')paintPolygon(r.points,w,h,k=>{owner[k]=i;});});
 const visited=new Uint8Array(w*h),recovered=[];
 const rgb=k=>{const j=k*4;return [rgba[j],rgba[j+1],rgba[j+2]];};
 const diff=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 for(const edge of components){
  if(recovered.length>=16||regions.length+recovered.length>=128)break;
  const seed=edge.find(k=>owner[k]>=0&&!visited[k]);
  if(seed===undefined)continue;
  const parentIndex=owner[seed],parent=regions[parentIndex];
  if(parent.kind!=='fill')continue;
  const base=[1,3,5].map(i=>parseInt(parent.color.slice(i,i+2),16));
  const anchor=rgb(seed);if(diff(base,anchor)<95)continue;
  const queue=[seed],mean=[0,0,0];let front=0,tooLarge=false;visited[seed]=1;
  while(front<queue.length){
   const k=queue[front++],x=k%w,y=Math.floor(k/w),p=rgb(k);
   for(let i=0;i<3;i++)mean[i]+=p[i];
   if(queue.length>1600){tooLarge=true;break;}
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
    const n=yy*w+xx;
    if(visited[n]||!foreground[n]||owner[n]!==parentIndex)continue;
    const c=rgb(n);
    if(diff(c,anchor)>42||diff(c,base)<90)continue;
    visited[n]=1;queue.push(n);
   }
  }
  if(tooLarge||queue.length<25)continue;
  const mask=new Uint8Array(w*h);for(const k of queue)mask[k]=1;
  const boundary=boundaryPixels(mask,w,h);
  if(boundary.length<4||Math.abs(polygonArea(boundary)-queue.length)>.25)continue;
  const points=simplifyRing(boundary);
  if(points.length<4||invalidPolygon(points,512,4,12))continue;
  let correct=0,falsePixels=0;
  paintPolygon(points,w,h,k=>{if(mask[k])correct++;else falsePixels++;});
  if(falsePixels>Math.max(2,queue.length*.005)||
     queue.length-correct>Math.max(2,queue.length*.02))continue;
  const colour='#'+mean.map(v=>Math.round(v/queue.length).toString(16).padStart(2,'0')).join('').toUpperCase();
  recovered.push({id:'source-detail-'+(recovered.length+1),parentId:parent.id,
   label:'Unclassified image detail',semantic:'source_only_unclassified_marking',
   layer:(Number.isFinite(parent.layer)?parent.layer:0)+0.5,kind:'fill',color:colour,
   points,confidence:'low',sourceSupport:1,pixelArea:queue.length,
   geometrySource:'local_contrast_island_unverified_stitch_type',
   requiresDigitisingReview:true,recoveryStatus:'SOURCE_GEOMETRY_ONLY_NOT_MACHINE_APPROVED'});
 }
 return recovered;
}

function checkedRegion(r){
 if(!r||typeof r.id!=="string"||r.id.length>60||typeof r.label!=="string"||
  !["fill","running"].includes(r.kind)||!/^#[0-9a-f]{6}$/i.test(r.color)||
  !["high","medium","low"].includes(r.confidence)||
  !Array.isArray(r.points)||r.points.length<(r.kind==="fill"?4:2)||r.points.length>32||
  !r.points.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=1000))
  throw Error("AI sent invalid region geometry");
 return r;
}
function reconstruct(rgba,w,h,plan,opts={}){
 if(!(rgba instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||
 w<48||h<48||w*h>750000||rgba.length!==w*h*4)throw Error("Invalid source image");
 if(!plan||!Array.isArray(plan.regions)||plan.regions.length<1||plan.regions.length>32||
  plan.status!=="AI_GEOMETRY_PROPOSAL_NOT_STITCHED")throw Error("Invalid AI geometry plan");
 const foreground=foregroundMask(rgba,w,h),regions=[],rejected=[];
 const ids=new Set();
 for(const r of plan.regions){checkedRegion(r);if(ids.has(r.id))throw Error("Duplicate region id");ids.add(r.id);}
 const ordered=plan.regions.map(checkedRegion).sort((a,b)=>(a.layer||0)-(b.layer||0));
 for(const r of ordered){
  const points=r.points.map(p=>[p.x*w/1000,p.y*h/1000]),base={id:r.id,label:r.label,
   kind:r.kind,color:r.color,confidence:r.confidence,semantic:r.semantic,layer:r.layer};
  if(r.kind==="running"){
   const line=contrastCentreline(rgba,foreground,w,h,points);
   if(!line){rejected.push({id:r.id,reason:"line_not_supported_by_image_contrast"});continue;}
   regions.push({...base,points:line.points,sourceSupport:line.support,
    geometrySource:"source_pixel_contrast_snapped_centreline"});continue;
  }
  if(invalidPolygon(points)){rejected.push({id:r.id,reason:"invalid_fill_outline"});continue;}
  const bb=boundsOf(points),x0=Math.max(0,Math.floor(bb.x0)),x1=Math.min(w-1,Math.ceil(bb.x1));
  const y0=Math.max(0,Math.floor(bb.y0)),y1=Math.min(h-1,Math.ceil(bb.y1));
  // Body/wing base polygons use the foreground. Markings must additionally
  // match the proposed colour in the original image, or the wing's underlying
  // foreground would incorrectly turn the whole AI search polygon into fill.
  // Never fill a rectangle merely because AI enclosed a coloured wing.
  const isMarking=["wing_marking","marking"].includes(r.semantic);
  const baseMask=new Uint8Array(w*h),colourMask=new Uint8Array(w*h);
  const colour=[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16));
  let candidate=0,baseSignal=0,colourSignal=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inside(x+.5,y+.5,points)){
   candidate++;const k=y*w+x,j=k*4;
   if(!foreground[k])continue;
   baseMask[k]=1;baseSignal++;
   const distance=Math.hypot(rgba[j]-colour[0],rgba[j+1]-colour[1],rgba[j+2]-colour[2]);
   if(distance<=(isMarking?48:60)){colourMask[k]=1;colourSignal++;}
  }
  // If the AI names a colour which is clearly present in a mixed-colour
  // polygon, keep only those source pixels. Never pretend one colour region
  // includes another. In monochrome art or an unreliable colour swatch, use
  // the validated foreground outline instead, as the older path did.
  const selectColour=isMarking||
   (baseSignal>0&&colourSignal/baseSignal>=.22&&colourSignal/baseSignal<.96);
  const mask=selectColour?colourMask:baseMask;
  const signal=selectColour?colourSignal:baseSignal;
  if(candidate<40||signal<25||signal/candidate<(isMarking ? 0.03 : 0.15)){
   rejected.push({id:r.id,reason:isMarking?"marking_colour_not_supported_by_pixels":"fill_not_supported_by_pixels"});continue;
  }
  const components=connectedComponents(mask,w,h),parts=[],failures=[];
  if(components.length>128){rejected.push({id:r.id,reason:'too_many_components'});continue;}
  for(let index=0;index<components.length;index++){
   const pixels=components[index],partMask=new Uint8Array(w*h);
   if(pixels.length<25){failures.push('small_components_not_stitchable');continue;}
   for(const k of pixels)partMask[k]=1;
   const boundary=boundaryPixels(partMask,w,h);
   // Compound holes are deliberately blocked until the entire editor/engine
   // contract can preserve them. Even a one-pixel hole must not disappear.
   if(Math.abs(polygonArea(boundary)-pixels.length)>.25){failures.push('fill_holes_not_supported');continue;}
   const contour=simplifyRing(boundary);
   if(contour.length<4||invalidPolygon(contour,512,4,12)){failures.push('could_not_reconstruct_boundary');continue;}
   let matched=0,extra=0;
   paintPolygon(contour,w,h,k=>{if(partMask[k])matched++;else extra++;});
   if(extra>Math.max(2,pixels.length*.005)||pixels.length-matched>Math.max(2,pixels.length*.02)){
    failures.push('simplification_lost_pixel_fidelity');continue;
   }
   parts.push({...base,id:components.length===1?r.id:r.id+'::component-'+(index+1),parentId:r.id,
    componentIndex:index,points:contour,sourceSupport:pixels.length/candidate,pixelArea:pixels.length,
    colourEvidence:Number((colourSignal/Math.max(1,baseSignal)).toFixed(3)),
    geometrySource:selectColour?'ai_polygon_intersected_with_colour_matched_artwork_pixels':'ai_polygon_intersected_with_artwork_pixels'});
  }
  // Atomic per-proposal: never keep only the easiest disconnected fragments.
  if(failures.length){rejected.push({id:r.id,reason:failures[0]});continue;}
  regions.push(...parts);
 }
 if(!regions.length)throw Error("AI reconstruction did not yield any supported regions; design unchanged");
 if(regions.length>128)throw Error("Too many reconstruction regions");
 const before=auditReconstruction(rgba,w,h,foreground,regions,true);
 const recovery=recoverLocalDetails(rgba,w,h,foreground,regions,before._detailSeeds);
 delete before._detailSeeds; // No large source-pixel index arrays in the public result.
 if(recovery.length){
  // Place recovered detail immediately after its supporting layer, rather
  // than painting it above unrelated later AI layers.
  const ordered=[];
  for(const r of regions){ordered.push(r,...recovery.filter(x=>x.parentId===r.id));}
  regions.length=0;regions.push(...ordered);
 }
 const quality=recovery.length?auditReconstruction(rgba,w,h,foreground,regions):before;
 quality.initialUnrepresentedFineDetails=before.unrepresentedFineDetails;
 quality.remainingUnrepresentedFineDetails=quality.unrepresentedFineDetails;
 quality.autoRecoveredDetails=recovery.length;
 quality.autoRecoveredDetailPixels=recovery.reduce((n,r)=>n+r.pixelArea,0);
 if(recovery.length){
  // Keep original omission evidence. A visual recovery is not stitch approval.
  quality.blockers=[...new Set([...before.blockers,...quality.blockers,
    'unverified_auto_recovered_details'])];
  quality.unrepresentedFineDetails=before.unrepresentedFineDetails;
  quality.unrepresentedFineDetailPixels=before.unrepresentedFineDetailPixels;
  quality.machineEligible=false;
 }
 return {status:"AUTO_RECONSTRUCTED_DRAFT_NOT_MACHINE_VERIFIED",regions,rejected,quality,
  proposed:plan.regions.length,autoApplied:false,
  warnings:["AI outlines are approximate; source-pixel clipping is not semantic segmentation.",
   "Pixel colour fidelity is not calibrated thread matching or stitch quality.",
   "Satin columns, underlay, trims, pull compensation and physical stitch-out are not verified.",
   "Locally recovered image details need stitch-type verification and cannot trigger machine export."]};
}
root.StitchForgeAutoReconstruct=Object.freeze({reconstruct,analyseArtwork,formatFillValidationFailure,formatModelRejectionDiagnostics});
if(typeof module!=="undefined"&&module.exports)module.exports={reconstruct,analyseArtwork,formatFillValidationFailure,formatModelRejectionDiagnostics};
})(typeof window==="undefined"?globalThis:window);

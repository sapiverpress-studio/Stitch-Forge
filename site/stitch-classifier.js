/* Physical-scale embroidery category proposals. Never machine-ready stitch paths.
 * Nine contour cross-sections provide preview rail and centreline geometry only.
 */
(function(root){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n), rnd=(n,d=3)=>Number(n.toFixed(d));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function touch(a,b,p){
 return Math.abs(cross(a,b,p))<1e-8&&
  p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&
  p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
}
function intersects(a,b,c,d){
 return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||
  touch(a,b,c)||touch(a,b,d)||touch(c,d,a)||touch(c,d,b);
}
function ring(points){
 if(!Array.isArray(points)||points.length<4||points.length>513)throw Error('Invalid contour size');
 const p=points.map(x=>{
  if(!Array.isArray(x)||x.length!==2||!x.every(finite))throw Error('Invalid contour point');
  return x.slice();
 });
 if(dist(p[0],p.at(-1))<1e-8)p.pop();
 if(p.length<3||p.length>512)throw Error('Invalid contour vertices');
 let area2=0;
 for(let i=0;i<p.length;i++){
  const b=p[(i+1)%p.length];
  if(dist(p[i],b)<1e-6)throw Error('Degenerate contour edge');
  area2+=p[i][0]*b[1]-b[0]*p[i][1];
  for(let j=i+2;j<p.length;j++){
   if(i===0&&j===p.length-1)continue;
   if(intersects(p[i],b,p[j],p[(j+1)%p.length]))throw Error('Crossing contour');
  }
 }
 if(Math.abs(area2)<1e-4)throw Error('Collapsed contour');
 return p;
}
function moments(p){
 let a2=0,cx=0,cy=0,xx=0,yy=0,xy=0;
 for(let i=0;i<p.length;i++){
  const [x,y]=p[i],[X,Y]=p[(i+1)%p.length],z=x*Y-X*y;
  a2+=z;cx+=(x+X)*z;cy+=(y+Y)*z;
  xx+=(x*x+x*X+X*X)*z;yy+=(y*y+y*Y+Y*Y)*z;
  xy+=(2*x*y+x*Y+X*y+2*X*Y)*z;
 }
 const a=a2/2;cx/=3*a2;cy/=3*a2;
 const vx=xx/(12*a)-cx*cx,vy=yy/(12*a)-cy*cy,cv=xy/(24*a)-cx*cy;
 const angle=.5*Math.atan2(2*cv,vx-vy);
 return {origin:[cx,cy],axis:[Math.cos(angle),Math.sin(angle)],angle,area:Math.abs(a)};
}
function classifyRegion(points,mmPerPixel){
 const baseline={status:'CATEGORY_PROPOSAL_ONLY_NOT_MACHINE_APPROVED',
  candidate:'manual_review',reason:'geometry_uncertain',machineApproved:false,
  proposedRails:null,proposedCentreline:null};
 if(!finite(mmPerPixel)||mmPerPixel<=0||mmPerPixel>10)
  return {...baseline,reason:'physical_scale_unavailable'};
 let p,m;try{p=ring(points);m=moments(p);}
 catch{return {...baseline,reason:'invalid_or_self_intersecting_contour'};}
 const normal=[-m.axis[1],m.axis[0]],rotated=p.map(q=>{
  const x=q[0]-m.origin[0],y=q[1]-m.origin[1];
  return [x*m.axis[0]+y*m.axis[1],x*normal[0]+y*normal[1]];
 });
 const low=Math.min(...rotated.map(p=>p[0]));
 const length=Math.max(...rotated.map(p=>p[0]))-low;
 const areaMm2=m.area*mmPerPixel*mmPerPixel,widths=[],pairs=[];
 for(let j=1;j<=9;j++){
  const t=low+length*j/10,cuts=[];
  for(let i=0;i<rotated.length;i++){
   const a=rotated[i],b=rotated[(i+1)%rotated.length];
   if((a[0]<=t&&t<b[0])||(b[0]<=t&&t<a[0]))
    cuts.push(a[1]+(t-a[0])*(b[1]-a[1])/(b[0]-a[0]));
  }
  cuts.sort((a,b)=>a-b);
  if(cuts.length!==2||cuts[1]-cuts[0]<1e-6)
   return {...baseline,reason:'ambiguous_cross_sections',areaMm2:rnd(areaMm2)};
  widths.push((cuts[1]-cuts[0])*mmPerPixel);
  const src=u=>[rnd(m.origin[0]+t*m.axis[0]+u*normal[0]),
                rnd(m.origin[1]+t*m.axis[1]+u*normal[1])];
  pairs.push([src(cuts[0]),src(cuts[1])]);
 }
 const sorted=widths.slice().sort((a,b)=>a-b),med=sorted[4],spread=sorted[8]/sorted[0];
 const lenMm=length*mmPerPixel;
 const metrics={lengthMm:rnd(lenMm),medianWidthMm:rnd(med),minWidthMm:rnd(sorted[0]),
  maxWidthMm:rnd(sorted[8]),widthSpread:rnd(spread),areaMm2:rnd(areaMm2),
  principalAxisDeg:rnd(m.angle*180/Math.PI,2)};
 if(lenMm<1.2||areaMm2<.5||med<.3)
  return {...baseline,reason:'below_conservative_stitch_size',...metrics};
 if(spread>2.5)return {...baseline,reason:'irregular_width_requires_review',...metrics};
 if(med<=.7&&lenMm>=Math.max(2,3*med))
  return {...baseline,candidate:'running_candidate',reason:'thin_coherent_source_shape',
   proposedCentreline:pairs.map(([a,b])=>[rnd((a[0]+b[0])/2),rnd((a[1]+b[1])/2)]),...metrics};
 if(med>.7&&med<=5&&lenMm>=Math.max(3,2.8*med)&&spread<=1.75)
  return {...baseline,candidate:'satin_candidate',reason:'consistent_narrow_rail_pair',
   proposedRails:{left:pairs.map(p=>p[0]),right:pairs.map(p=>p[1])},...metrics};
 if(med>5||lenMm<2.8*med)
  return {...baseline,candidate:'fill_candidate',reason:'broad_source_region',...metrics};
 return {...baseline,reason:'tapered_or_marginal_column',...metrics};
}
function classifyDraft(regions,designWidthMm){
 if(!Array.isArray(regions)||!regions.length||regions.length>128)throw Error('Invalid region list');
 if(!finite(designWidthMm)||designWidthMm<10||designWidthMm>250)throw Error('Invalid design width');
 const all=[];
 for(const r of regions){
  if(!r||!['fill','running'].includes(r.kind)||!Array.isArray(r.points))
   throw Error('Invalid region');
  for(const p of r.points){
   if(!Array.isArray(p)||p.length!==2||!p.every(finite))throw Error('Invalid source point');
   all.push(p);
  }
 }
 const xs=all.map(p=>p[0]),span=Math.max(...xs)-Math.min(...xs);
 if(span<=1e-3)throw Error('Degenerate physical scale');
 const scale=designWidthMm/span;
 return {scaleMmPerPixel:rnd(scale,6),regions:regions.map(r=>({id:r.id,
  ...(r.kind==='running'?{
   status:'CATEGORY_PROPOSAL_ONLY_NOT_MACHINE_APPROVED',candidate:'running_candidate',
   reason:'existing_source_centreline_unverified',machineApproved:false,
   proposedRails:null,proposedCentreline:r.points}:classifyRegion(r.points,scale))}))};
}
const api=Object.freeze({classifyRegion,classifyDraft});
root.StitchForgeStitchClassifier=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

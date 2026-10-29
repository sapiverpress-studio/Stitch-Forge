/* Bounded satin rail/rung proposal geometry for Sapiver Stitch Forge.
 * Preview ONLY: not embroidery needle commands, Ink/Stitch SVG or machine files.
 * A native Ink/Stitch simulation and physical sew-out are mandatory next gates.
 */
(function(root){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const vec=(a,b)=>[b[0]-a[0],b[1]-a[1]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const round=n=>Number(n.toFixed(4));
const mix=(a,b,t)=>[round(a[0]+(b[0]-a[0])*t),round(a[1]+(b[1]-a[1])*t)];
function intersects(a,b,c,d){
 const ab=vec(a,b),ac=vec(a,c),ad=vec(a,d),cd=vec(c,d);
 const ca=vec(c,a),cb=vec(c,b);
 const p=cross(ab,ac),q=cross(ab,ad),r=cross(cd,ca),s=cross(cd,cb);
 const on=(u,v,w)=>Math.abs(cross(vec(u,v),vec(u,w)))<1e-8&&
  w[0]>=Math.min(u[0],v[0])-1e-8&&w[0]<=Math.max(u[0],v[0])+1e-8&&
  w[1]>=Math.min(u[1],v[1])-1e-8&&w[1]<=Math.max(u[1],v[1])+1e-8;
 return (p*q<0&&r*s<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function validateRails(rails,mmPerPixel,opts={}){
 const fail=reason=>({status:'SATIN_GEOMETRY_REJECTED',reason,accepted:false,
  machineApproved:false,geometryOnly:true});
 if(!finite(mmPerPixel)||mmPerPixel<=0||mmPerPixel>10)return fail('invalid_physical_scale');
 if(!rails||!Array.isArray(rails.left)||!Array.isArray(rails.right)||
    rails.left.length!==rails.right.length||rails.left.length<3||
    rails.left.length>128)return fail('missing_or_unpaired_rails');
 const n=rails.left.length,left=rails.left,right=rails.right;
 for(const p of [...left,...right]){
  if(!Array.isArray(p)||p.length!==2||!p.every(finite)||
     p.some(v=>Math.abs(v)>10000))return fail('invalid_rail_coordinate');
 }
 const pitch=opts.previewSpacingMm===undefined?.45:opts.previewSpacingMm;
 if(!finite(pitch)||pitch<.3||pitch>.6)return fail('invalid_preview_spacing');
 const totalLeft=vec(left[0],left[n-1]),totalRight=vec(right[0],right[n-1]);
 if(dot(totalLeft,totalRight)<=0)return fail('opposing_rail_direction');
 const centre=left.map((l,i)=>mix(l,right[i],.5));
 let sign=0,totalLength=0;
 const rungWidths=[];
 for(let i=0;i<n;i++){
  const width=length(left[i],right[i])*mmPerPixel;
  if(width<=1.5||width>5)return fail('column_width_outside_conservative_satin_range');
  rungWidths.push(width);
  if(i===n-1)continue;
  const lc=length(left[i],left[i+1])*mmPerPixel,rc=length(right[i],right[i+1])*mmPerPixel;
  const cc=length(centre[i],centre[i+1])*mmPerPixel;
  if(lc<.08||rc<.08||cc<.1)return fail('collapsed_rail_segment');
  const tangent=vec(centre[i],centre[i+1]),across=vec(left[i],right[i]);
  const s=cross(tangent,across);
  if(Math.abs(s)<1e-8)return fail('tangent_parallel_to_rung');
  if(sign!==0&&s*sign<=0)return fail('rail_orientation_flipped');
  sign=Math.sign(s);
  if(dot(vec(left[i],left[i+1]),vec(right[i],right[i+1]))<=0)
   return fail('local_opposing_rail_direction');
  const orth=Math.abs(dot(tangent,across))/(length(centre[i],centre[i+1])*length(left[i],right[i]));
  if(orth>.55)return fail('rung_angle_excessive');
  totalLength+=cc;
  if(i>0){
   const before=vec(centre[i-1],centre[i]),after=tangent;
   if(dot(before,after)/(length(centre[i-1],centre[i])*length(centre[i],centre[i+1]))<.55)
    return fail('abrupt_centreline_turn');
  }
 }
 if(totalLength<3||totalLength>120)return fail('column_length_outside_preview_budget');
 const sorted=rungWidths.slice().sort((a,b)=>a-b);
 if(sorted.at(-1)/sorted[0]>1.8)return fail('column_taper_exceeds_preview_limit');
 for(let i=0;i<n-1;i++){
  for(let j=i+2;j<n-1;j++){
   if(intersects(left[i],left[i+1],left[j],left[j+1])||
      intersects(right[i],right[i+1],right[j],right[j+1]))return fail('self_intersecting_rail');
  }
  for(let j=0;j<n-1;j++)
   if(intersects(left[i],left[i+1],right[j],right[j+1]))
    return fail('crossed_satin_rails');
 }
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++)
  if(intersects(left[i],right[i],left[j],right[j]))return fail('crossed_rungs');
 const rungs=left.map((p,i)=>({left:[...p],right:[...right[i]],widthMm:round(rungWidths[i])}));
 const zigzagGuide=[];
 for(let i=0;i<n-1;i++){
  const segment=length(centre[i],centre[i+1])*mmPerPixel;
  const steps=Math.max(1,Math.ceil(segment/pitch));
  for(let j=0;j<steps;j++){
   const t=j/steps,side=zigzagGuide.length%2?'right':'left';
   zigzagGuide.push(mix(rails[side][i],rails[side][i+1],t));
   if(zigzagGuide.length>1000)return fail('preview_point_budget_exceeded');
  }
 }
 zigzagGuide.push([...right[n-1]]);
 return {status:'SATIN_RAIL_RUNG_PREVIEW_NOT_INKSTITCH_VERIFIED',accepted:true,
  machineApproved:false,geometryOnly:true,
  previewSpacingMm:pitch,rungs,zigzagGuide,
  columnLengthMm:round(totalLength),minimumWidthMm:round(sorted[0]),
  maximumWidthMm:round(sorted.at(-1)),
  limitations:['No actual native Ink/Stitch stitch commands are generated.',
    'No underlay, lock stitches, pull compensation, thread density or fabric preset.',
    'Rungs and rail curves require physical sewing and independent Ink/Stitch acceptance.']};
}
const api=Object.freeze({validateRails});
root.StitchForgeSatinGeometry=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

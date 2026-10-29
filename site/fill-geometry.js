/* Guarded closed-region geometry for manual embroidery fill proposals.
 * AI boxes are never converted directly into fill polygons.
 * Review only; a valid SVG boundary does not guarantee successful embroidery.
 */
(function(root){
'use strict';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersects(a,b,c,d){
 const s1=cross(a,b,c),s2=cross(a,b,d),s3=cross(c,d,a),s4=cross(c,d,b);
 if((s1>0&&s2<0||s1<0&&s2>0)&&(s3>0&&s4<0||s3<0&&s4>0))return true;
 const on=(p,q,r)=>Math.abs(cross(p,q,r))<1e-7&&r[0]>=Math.min(p[0],q[0])-1e-7&&
 r[0]<=Math.max(p[0],q[0])+1e-7&&r[1]>=Math.min(p[1],q[1])-1e-7&&r[1]<=Math.max(p[1],q[1])+1e-7;
 return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function prepare(points,sourceBounds,options={}){
 const minDistance=options.automatic===true ? .01 : 3;
 const minArea=options.automatic===true?4:200;
 const minExtent=options.automatic===true ? .5 : 12;
 const maxVertices=options.automatic===true?512:120;
 if(!Array.isArray(points)||points.length<4||points.length>maxVertices)throw Error('Trace 4–'+maxVertices+' boundary points');
 if(!sourceBounds||!['x','y','w','h'].every(k=>Number.isFinite(sourceBounds[k]))||
   sourceBounds.w<20||sourceBounds.h<20)throw Error('Artwork bounds unavailable');
 const out=points.map(p=>{
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error('Invalid fill point');
  if(p[0]<sourceBounds.x-0.5||p[0]>sourceBounds.x+sourceBounds.w+0.5||
     p[1]<sourceBounds.y-0.5||p[1]>sourceBounds.y+sourceBounds.h+0.5)
    throw Error('Fill points must remain inside the artwork');
  return p.map(n=>Math.round(n*100)/100);
 });
 if(distance(out[0],out.at(-1))<minDistance)throw Error('Do not tap the first point twice; use Close boundary');
 for(let i=1;i<out.length;i++)if(distance(out[i-1],out[i])<minDistance)throw Error('Boundary points too close together');
 if(distance(out.at(-1),out[0])<minDistance)throw Error('Closing edge too short');
 let area=0;for(let i=0;i<out.length;i++){let a=out[i],b=out[(i+1)%out.length];area+=a[0]*b[1]-b[0]*a[1];}
 if(Math.abs(area)<2*minArea)throw Error('Region is too small or flattened for a fill');
 let loX=Math.min(...out.map(p=>p[0])),hiX=Math.max(...out.map(p=>p[0]));
 let loY=Math.min(...out.map(p=>p[1])),hiY=Math.max(...out.map(p=>p[1]));
 if(hiX-loX<minExtent||hiY-loY<minExtent)throw Error('Region is too thin for experimental tatami fill');
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
  if(j===i+1||(i===0&&j===out.length-1))continue;
  if(intersects(out[i],out[(i+1)%out.length],out[j],out[(j+1)%out.length]))
   throw Error('Boundary crosses itself; reposition the points');
 }
 const closed=out.concat([out[0].slice()]);
 return {points:closed,areaCanvas:Math.abs(area)/2,vertexCount:out.length,
  bounds:{x:loX,y:loY,w:hiX-loX,h:hiY-loY},
  status:'MANUAL_CLOSED_FILL_UNVERIFIED'};
}
root.StitchForgeFillGeometry=Object.freeze({prepare});
if(typeof module!=='undefined'&&module.exports)module.exports={prepare};
})(typeof window==='undefined'?globalThis:window);

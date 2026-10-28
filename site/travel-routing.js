/* Geometry-only travel sequencing for experimental single-colour running/bean paths.
 * Does not create thread trims, lock stitches, new detail, or professional output.
 * Closed perimeter is sewn last ONLY when there is one unmistakably dominant outline.
 * No reordering of mixed fill/stitch patterns: layered sewing order is then preserved.
 */
(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function area(path){let sum=0;for(let i=0;i<path.length-1;i++)sum+=path[i][0]*path[i+1][1]-path[i+1][0]*path[i][1];return Math.abs(sum)/2;}
function isClosed(p){return p.length>=4&&dist(p[0],p.at(-1))<1.2;}
function route(items,optimize=true){
 if(!Array.isArray(items)||items.length>128)throw Error('Invalid routing path list');
 for(const item of items)if(!item||!Array.isArray(item.points)||item.points.length<2||item.points.length>2048||
 !item.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||
 !['running','bean','tatami'].includes(item.style))throw Error('Invalid embroidery routing input');
 const plain=items.map((it,i)=>({points:it.points.map(p=>p.slice()),style:it.style,sourceIndex:it.sourceIndex??i}));
 if(!optimize||plain.length<3||plain.some(it=>it.style==='tatami'))return plain;
 // Dominant closed perimeter, if any, stays last to keep its continuous outline intact.
 const closed=plain.map((it,i)=>({i,closed:isClosed(it.points),area:area(it.points)})).filter(it=>it.closed).sort((a,b)=>b.area-a.area);
 const outline=closed.length&&closed[0].area>200&&(!closed[1]||closed[0].area>closed[1].area*3)?closed[0].i:-1;
 const pending=plain.map((it,i)=>({it,i})).filter(e=>e.i!==outline);
 const ordered=[];let current=[0,0];
 while(pending.length){
  let bestIndex=-1,bestDistance=Infinity,bestReversed=false;
  for(let j=0;j<pending.length;j++){
   const p=pending[j].it.points,closed=isClosed(p);
   const first=dist(current,p[0]),last=closed?Infinity:dist(current,p.at(-1));
   const d=Math.min(first,last);
   if(d<bestDistance-1e-6){bestDistance=d;bestIndex=j;bestReversed=last<first;}
  }
  const next=pending.splice(bestIndex,1)[0].it;
  if(bestReversed)next.points.reverse();
  ordered.push(next);current=next.points.at(-1);
 }
 if(outline!==-1){
  const item=plain[outline],p=item.points.slice(0,-1);
  let best=0,dd=Infinity;
  for(let i=0;i<p.length;i++){const d=dist(current,p[i]);if(d<dd){dd=d;best=i;}}
  const rotated=p.slice(best).concat(p.slice(0,best));
  rotated.push(rotated[0].slice());
  ordered.push({...item,points:rotated});
 }
 return ordered;
}
function measureTravel(items,origin=[0,0]){
 let travel=0,last=origin;
 for(const item of items){if(item.points.length<2)continue;travel+=dist(last,item.points[0]);last=item.points.at(-1);}
 return travel;
}
root.StitchForgeTravelRouting=Object.freeze({route,measureTravel});
if(typeof module!=='undefined'&&module.exports)module.exports={route,measureTravel};
})(typeof window==='undefined'?globalThis:window);

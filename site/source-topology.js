/* Exact pixel-edge contours for source masks, not digitised stitch paths.
 * Four-connected components, all rings and all islands survive. Collinear
 * vertices alone are removed; no smoothing, hole filling or area filtering.
 */
(function(root){
'use strict';
const ledgerAPI=root.StitchForgeSourceMaskLedger||
 (typeof require==='function'?require('./source-mask-ledger.js'):null);
const MAX_EDGES=250000,MAX_VERTICES=200000;
const area2=points=>points.reduce((n,a,i)=>{const b=points[(i+1)%points.length];return n+a[0]*b[1]-b[0]*a[1];},0);
function contoursFromLedger(ledger){
 if(!ledgerAPI)throw Error('Source-mask ledger unavailable');
 const mask=ledgerAPI.maskFromLedger(ledger),{width:w,height:h}=ledger;
 const canonical=ledgerAPI.ledgerFromMask(mask,w,h);
 // Component IDs and grouping are derived, never trusted from a saved file.
 if(JSON.stringify(canonical.components.map(c=>[c.id,c.pixelArea,c.bounds,c.runs]))!==
    JSON.stringify(ledger.components.map(c=>[c.id,c.pixelArea,c.bounds,c.runs])))
  throw Error('Noncanonical source-mask component grouping');
 let edgeCount=0,vertexCount=0;
 const has=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x]===1;
 const components=[];
 for(const component of canonical.components){
  const outgoing=new Map(),edges=[];
  const edge=(x,y,dx,dy,d)=>{
   if(++edgeCount>MAX_EDGES)throw Error('Source contours exceed edge budget; mask retained');
   const item={x,y,ex:x+dx,ey:y+dy,d,used:false},key=y*(w+1)+x;
   if(!outgoing.has(key))outgoing.set(key,[]);
   outgoing.get(key).push(item);edges.push(item);
  };
  for(const [y,x0,x1] of component.runs)for(let x=x0;x<x1;x++){
   if(!has(x,y-1))edge(x,y,1,0,0);
   if(!has(x+1,y))edge(x+1,y,0,1,1);
   if(!has(x,y+1))edge(x+1,y+1,-1,0,2);
   if(!has(x-1,y))edge(x,y+1,0,-1,3);
  }
  const rings=[],reviewFlags=[...component.reviewFlags];
  const touches=[...outgoing.values()].some(list=>list.length>1);
  if(touches)reviewFlags.push('touching_pixel_boundaries_require_review');
  for(const seed of edges){
   if(seed.used)continue;
   const points=[];let current=seed,closed=false;
   for(let step=0;step<=edges.length;step++){
    if(current.used)throw Error('Source contour traversal repeated an edge');
    current.used=true;points.push([current.x,current.y]);
    if(current.ex===seed.x&&current.ey===seed.y){closed=true;break;}
    const candidates=(outgoing.get(current.ey*(w+1)+current.ex)||[]).filter(e=>!e.used);
    // Keep foreground on the right. At a diagonal vertex, choose the
    // right-hand turn first rather than joining unrelated pixel lobes.
    const priority=e=>[1,0,3,2].indexOf((e.d-current.d+4)%4);
    candidates.sort((a,b)=>priority(a)-priority(b));
    if(!candidates.length)throw Error('Open source contour');
    current=candidates[0];
   }
   if(!closed||points.length<4)throw Error('Incomplete source contour');
   const corners=points.filter((p,i)=>{
    const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
    return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);
   });
   vertexCount+=corners.length;
   if(vertexCount>MAX_VERTICES)throw Error('Source contours exceed vertex budget; mask retained');
   const signed=area2(corners);
   if(signed===0)throw Error('Degenerate source contour');
   if(new Set(corners.map(p=>p.join(','))).size!==corners.length)
    reviewFlags.push('self_touching_pixel_ring_requires_review');
   rings.push({role:signed>0?'outer':'hole',points:corners});
  }
  const exactArea=rings.reduce((sum,r)=>sum+area2(r.points)/2,0);
  if(exactArea!==component.pixelArea)throw Error('Source contour area does not match selected pixels');
  if(rings.filter(r=>r.role==='outer').length!==1)reviewFlags.push('multiple_outer_rings_require_review');
  components.push({id:component.id,pixelArea:component.pixelArea,bounds:component.bounds,rings,
   reviewFlags:[...new Set(reviewFlags)]});
 }
 return {schema:'stitch-forge-source-topology-v1',width:w,height:h,
  foregroundPixels:canonical.foregroundPixels,components,edgeCount,vertexCount,
  machineEligible:false,status:'EXACT_PIXEL_GEOMETRY_NOT_DIGITISED'};
}
function maskFromContours(topology){
 const {width:w,height:h}=topology||{};
 if(topology?.schema!=='stitch-forge-source-topology-v1'||!Number.isInteger(w)||!Number.isInteger(h)||
    w<1||h<1||w*h>750000||!Array.isArray(topology.components)||topology.components.length>50000)
  throw Error('Invalid source topology');
 const mask=new Uint8Array(w*h);let vertices=0,edgeWork=0;
 for(const component of topology.components){
  if(!Array.isArray(component.rings)||!component.rings.length)throw Error('Missing source rings');
  const crossings=new Map();let componentArea=0;
  for(const ring of component.rings){
   if(!Array.isArray(ring.points)||ring.points.length<4||
      (vertices+=ring.points.length)>MAX_VERTICES)throw Error('Invalid source-ring vertex count');
   for(let i=0;i<ring.points.length;i++){
    const a=ring.points[i],b=ring.points[(i+1)%ring.points.length];
    if(![a,b].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<=w&&p[1]>=0&&p[1]<=h)||
       (a[0]===b[0])===(a[1]===b[1]))throw Error('Source rings must follow bounded pixel edges');
    edgeWork+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
    if(edgeWork>MAX_EDGES)throw Error('Source contour rasterisation exceeds edge budget');
    if(a[0]!==b[0])continue;
    for(let y=Math.min(a[1],b[1]);y<Math.max(a[1],b[1]);y++){
     if(!crossings.has(y))crossings.set(y,[]);crossings.get(y).push(a[0]);
    }
   }
   const signed=area2(ring.points);
   if(!signed||ring.role!==(signed>0?'outer':'hole'))throw Error('Invalid source-ring orientation');
  }
  for(const [y,xx] of crossings){
   xx.sort((a,b)=>a-b);if(xx.length%2)throw Error('Unpaired source contour edges');
   for(let i=0;i<xx.length;i+=2)for(let x=xx[i];x<xx[i+1];x++){
    const at=y*w+x;if(mask[at])throw Error('Source components overlap');mask[at]=1;componentArea++;
   }
  }
  if(componentArea!==component.pixelArea)throw Error('Source contour pixel-area mismatch');
 }
 if(mask.reduce((a,b)=>a+b,0)!==topology.foregroundPixels)throw Error('Source topology accounting mismatch');
 return mask;
}
const api=Object.freeze({contoursFromLedger,maskFromContours});
root.StitchForgeSourceTopology=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

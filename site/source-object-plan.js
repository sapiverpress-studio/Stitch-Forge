/* Source-bound object generalisation. Original masks remain authoritative.
 * Only small, short, low-contrast fragments may join adjacent stable cores.
 * This prepares artwork; it does not assign approved stitch families.
 */
(function(root){
'use strict';
const dep=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const project=dep('StitchForgeSourceRegionProject','./source-region-project.js');
const ledger=dep('StitchForgeSourceMaskLedger','./source-mask-ledger.js');
const topology=dep('StitchForgeSourceTopology','./source-topology.js');
const SCHEMA='stitch-forge-source-object-plan-v1';
const trusted=new WeakSet();
const DEFAULTS=Object.freeze({smallAreaMm2:.35,maxFragmentSpanMm:1.2,maxReachMm:1.2,maxRgbChange:90,protectContrast:90,protectAreaMm2:.025});
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function digest(text){
 const cryptoAPI=root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);
 return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function parameters(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(DEFAULTS,k)))throw Error('Unknown object-generalisation option');
 const p={...DEFAULTS,...input};
 for(const [k,lo,hi] of [['smallAreaMm2',.01,1],['maxFragmentSpanMm',.1,2],['maxReachMm',.1,2],['maxRgbChange',0,100],['protectContrast',50,120],['protectAreaMm2',0,.1]])
  if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid object-generalisation option: '+k);
 return p;
}
class Heap{
 constructor(){this.items=[];}
 push(v){const a=this.items;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(this.compare(a[p],v)<=0)break;a[i]=a[p];i=p;}a[i]=v;}
 compare(a,b){return a.cost-b.cost||a.seed-b.seed||a.node-b.node;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&this.compare(a[j+1],a[j])<0)j++;if(this.compare(last,a[j])<=0)break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}
async function build(input,options={}){
 const draft=project.validateDraft(input),p=parameters(options),w=draft.source.width,h=draft.source.height,s=draft.physical.scaleMmPerPixel;
 const colors=draft.regions.map(r=>r.color),rgbs=colors.map(rgb),owners=new Int32Array(w*h).fill(-1),nodes=[];
 for(const [ci,r] of draft.regions.entries())for(const c of r.ledger.components){
  const index=nodes.length,first=c.runs[0][0]*w+c.runs[0][1];
  for(const [y,x0,x1] of c.runs)owners.fill(index,y*w+x0,y*w+x1);
  nodes.push({id:'part-'+draft.source.sha256.slice(0,12)+'-'+colors[ci].slice(1)+'-'+first.toString(36),ci,c,edges:new Set(),protected:false});
 }
 if(nodes.length>50000)throw Error('Object plan exceeds source-component budget');
 const protectedPixels=new Uint8Array(w*h);
 for(const n of draft.graph?.nodes||[])if(n.protectedFeature)for(const [y,x0,x1] of n.runs)protectedPixels.fill(1,y*w+x0,y*w+x1);
 let edgeCount=0;
 for(let k=0;k<owners.length;k++)if(owners[k]>=0){
  const a=owners[k];if(protectedPixels[k])nodes[a].protected=true;
  for(const j of [k%w<w-1?k+1:-1,k+w<owners.length?k+w:-1])if(j>=0&&owners[j]>=0&&owners[j]!==a){
   const b=owners[j];if(!nodes[a].edges.has(b)){if(++edgeCount>200000)throw Error('Object adjacency budget exceeded');nodes[a].edges.add(b);nodes[b].edges.add(a);}
  }
 }
 const parent=new Int32Array(nodes.length).fill(-1),reach=new Float64Array(nodes.length),queue=new Heap();
 for(const [i,n] of nodes.entries()){
  const area=n.c.pixelArea*s*s,span=Math.max(n.c.bounds.w,n.c.bounds.h)*s;
  const contrast=n.edges.size?Math.min(...[...n.edges].map(j=>distance(rgbs[n.ci],rgbs[nodes[j].ci]))):Infinity;
  if(area>=p.protectAreaMm2&&contrast>=p.protectContrast)n.protected=true;
  n.core=n.protected||area>=p.smallAreaMm2||span>p.maxFragmentSpanMm;
  if(n.core)parent[i]=i;
 }
 function enqueue(from){
  const seed=parent[from];
  for(const j of nodes[from].edges){
   if(parent[j]>=0||nodes[j].core)continue;
   const n=nodes[j],delta=distance(rgbs[n.ci],rgbs[nodes[seed].ci]);
   const nextReach=reach[from]+Math.hypot(n.c.bounds.w,n.c.bounds.h)*s+s;
   if(delta>p.maxRgbChange||nextReach>p.maxReachMm)continue;
   queue.push({node:j,seed,reach:nextReach,cost:delta*delta+nextReach*nextReach*100});
  }
 }
 for(let i=0;i<nodes.length;i++)if(parent[i]===i)enqueue(i);
 while(queue.items.length){const item=queue.pop();if(parent[item.node]>=0)continue;parent[item.node]=item.seed;reach[item.node]=item.reach;enqueue(item.node);}
 const masks=colors.map(()=>new Uint8Array(w*h));let changed=0,maxReach=0,maxDelta=0;
 const assignments=nodes.map((n,i)=>{
  const target=parent[i]>=0?parent[i]:i,color=colors[nodes[target].ci],reassigned=color!==colors[n.ci];
  for(const [y,x0,x1] of n.c.runs)masks[nodes[target].ci].fill(1,y*w+x0,y*w+x1);
  if(reassigned){changed+=n.c.pixelArea;maxReach=Math.max(maxReach,reach[i]);maxDelta=Math.max(maxDelta,distance(rgbs[n.ci],rgbs[nodes[target].ci]));}
  return {sourcePartId:n.id,sourceColor:colors[n.ci],targetCoreId:nodes[target].id,workingColor:color,pixels:n.c.pixelArea,
   protected:n.protected,action:reassigned?'adjacent_texture_grouping':'retained',reachBoundMm:reach[i]};
 });
 const regions=[];let pieces=0;
 for(const [ci,mask] of masks.entries()){
  const l=ledger.ledgerFromMask(mask,w,h);if(!l.foregroundPixels)continue;
  const t=topology.contoursFromLedger(l);pieces+=l.components.length;
  regions.push({color:colors[ci],ledger:l,topology:t});
 }
 const canonical=JSON.stringify({source:project.serialiseDraft(draft),options:p});
 const sourcePlanSignature=await digest(canonical);
 const result={schema:SCHEMA,algorithm:'adjacent_core_generalisation_MD-2.48',source:draft.source,physical:draft.physical,options:p,
  sourcePlanSignature,assignments,regions,summary:{sourceParts:nodes.length,workingParts:pieces,sourcePixels:draft.foregroundPixels,
   representedPixels:regions.reduce((n,r)=>n+r.ledger.foregroundPixels,0),recolouredPixels:changed,
   protectedParts:assignments.filter(a=>a.protected).length,protectedPartsRecoloured:assignments.filter(a=>a.protected&&a.action!=='retained').length,
   maxReachBoundMm:maxReach,maxRgbChange:maxDelta,omittedPixels:0},
  status:'GENERALISED_ARTWORK_NOT_DIGITISED',machineEligible:false,
  limitations:['Numerical contrast protects candidates, not verified eyes or feathers.','Original source masks remain required; fine shading is deliberately simplified.',
   'Grouping bounds concern reassigned pixels, not fabric compensation.','Running/satin/fill, directions, density, underlay and routing remain unverified.']};
 if(result.summary.representedPixels!==draft.foregroundPixels||result.summary.protectedPartsRecoloured)throw Error('Object source accounting failed');
 trusted.add(result);return result;
}
async function assertBindings(plan,draft){
 if(plan?.schema!==SCHEMA)throw Error('Invalid source object schema');
 const fresh=await build(draft,plan.options);
 if(JSON.stringify(fresh)!==JSON.stringify(plan))throw Error('Stale or changed source object plan');
 return fresh;
}
function geometrySvg(plan){
 if(!trusted.has(plan))throw Error('Rebuild and verify the source object plan before SVG export');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+plan.physical.imageWidthMm+'mm" height="'+plan.physical.imageHeightMm+'mm" viewBox="0 0 '+plan.source.width+' '+plan.source.height+'"><title>Generalised source artwork; not stitches</title>'+plan.regions.map(r=>'<path fill="'+r.color+'" fill-rule="evenodd" d="'+r.topology.components.flatMap(c=>c.rings.map(ring=>ring.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+'Z')).join(' ')+'"/>').join('')+'</svg>';
}
const api=Object.freeze({build,assertBindings,geometrySvg,DEFAULTS});root.StitchForgeSourceObjectPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

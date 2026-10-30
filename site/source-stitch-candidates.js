/* Physical, source-ID-bound review candidates; never a native stitch plan.
 * A thinness proxy is not minimum local width. Shape axes are not semantic
 * feather/fur direction. No density, underlay or fabric preset is invented.
 */
(function(root){
'use strict';
const project=root.StitchForgeSourceRegionProject||(typeof require==='function'?require('./source-region-project.js'):null);
async function digest(text){
 const cryptoAPI=root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);
 if(!cryptoAPI?.subtle)throw Error('Local plan fingerprinting unavailable');
 return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function buildCandidates(input){
 const draft=project.validateDraft(input),graph=draft.graph;
 if(!graph)throw Error('Rebuild source inspection with a source graph before planning');
 const {width:w,height:h}=draft.source,scale=draft.physical.scaleMmPerPixel;
 const owners=new Int32Array(w*h).fill(-1),working=new Int32Array(w*h).fill(-1);
 for(const [i,node] of graph.nodes.entries())for(const [y,x0,x1] of node.runs)owners.fill(i,y*w+x0,y*w+x1);
 const components=[];
 const topologyMaps=new Map(draft.regions.map(r=>[r.id,new Map((r.topology?.components||[]).map(c=>[c.id,c]))]));
 for(const region of draft.regions)for(const component of region.ledger.components){
  const index=components.length;
  for(const [y,x0,x1] of component.runs)working.fill(index,y*w+x0,y*w+x1);
  components.push({region,component});
 }
 const objects=[],counts={fill_candidate:0,narrow_detail_review:0,small_detail_review:0,tiny_blend_review:0};
 for(const [index,{region,component}] of components.entries()){
  let perimeter=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;const sourceNodes=new Set();
  for(const [y,x0,x1] of component.runs)for(let x=x0;x<x1;x++){
   const k=y*w+x,px=x+.5,py=y+.5;sourceNodes.add(owners[k]);
   sx+=px;sy+=py;sxx+=px*px;syy+=py*py;sxy+=px*py;
   for(const neighbour of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(neighbour<0||working[neighbour]!==index)perimeter++;
  }
  if(sourceNodes.has(-1))throw Error('Working component has no source-node binding');
  const n=component.pixelArea,area=n*scale*scale,perimeterMm=perimeter*scale;
  const thinness=perimeterMm?2*area/perimeterMm:0;
  const box={xMm:component.bounds.x*scale,yMm:component.bounds.y*scale,
   widthMm:component.bounds.w*scale,heightMm:component.bounds.h*scale};
  const refs=[...sourceNodes].sort((a,b)=>a-b),protectedRefs=refs.filter(i=>graph.nodes[i].protectedFeature);
  const allBlend=refs.every(i=>graph.nodes[i].boundaryBlendCandidate);
  let candidate='small_detail_review';
  if(!protectedRefs.length&&allBlend&&area<.05)candidate='tiny_blend_review';
  else if(Math.min(box.widthMm,box.heightMm)<.8||thinness<.8)candidate='narrow_detail_review';
  else if(area>=1)candidate='fill_candidate';
  counts[candidate]++;
  const xx=sxx/n-(sx/n)**2,yy=syy/n-(sy/n)**2,xy=sxy/n-sx*sy/(n*n);
  const trace=xx+yy,spread=Math.hypot(xx-yy,2*xy),major=(trace+spread)/2,minor=Math.max(0,(trace-spread)/2);
  const directional=major>1e-9&&major/Math.max(minor,1e-9)>=1.5;
  const axis=directional?-Math.atan2(2*xy,xx-yy)*90/Math.PI:null;
  const topo=topologyMaps.get(region.id).get(component.id);
  const flags=['stitch_family_unverified','local_minimum_width_unverified','semantic_features_unverified'];
  if(candidate==='fill_candidate')flags.push('fill_direction_density_underlay_unset');
  if(candidate==='narrow_detail_review')flags.push('running_centreline_or_satin_rails_required');
  if(candidate==='tiny_blend_review')flags.push('simplification_or_omission_requires_explicit_plan_review');
  if(protectedRefs.length)flags.push('contrasting_source_feature_must_be_accounted_for');
  if(!topo)flags.push('contours_unavailable');
  objects.push({id:'object-'+draft.source.sha256.slice(0,12)+'-'+region.color.slice(1)+'-'+(component.runs[0][0]*w+component.runs[0][1]).toString(36),
   workingColor:region.color,sourceNodeIds:refs.map(i=>graph.nodes[i].id),protectedSourceNodeIds:protectedRefs.map(i=>graph.nodes[i].id),
   pixelArea:n,areaMm2:area,perimeterMm,boundsMm:box,thinnessIndicatorMm:thinness,
   geometryAxisDeg:axis===null?null:Math.round(axis*10)/10,candidate,
   holeCount:topo?.rings.filter(r=>r.role==='hole').length??null,
   contourVertices:topo?.rings.reduce((s,r)=>s+r.points.length,0)??null,
   reviewFlags:flags,machineEligible:false});
 }
 const signature=await digest(JSON.stringify({schema:'source-candidate-bindings-v1',source:draft.source.sha256,
  graphAlgorithm:graph.algorithm,palette:graph.palette,assignments:graph.nodes.map(n=>[n.id,n.paletteIndex]),
  imageWidthMm:draft.physical.imageWidthMm}));
 return {schema:'stitch-forge-source-stitch-candidates-v1',sourceSha256:draft.source.sha256,
  graphAlgorithm:graph.algorithm,sourcePlanSignature:signature,physical:{...draft.physical},
  objects,summary:{...counts,objects:objects.length,protectedSourceNodes:graph.protectedFeatures,
   tinyBlendPixels:objects.filter(o=>o.candidate==='tiny_blend_review').reduce((n,o)=>n+o.pixelArea,0)},
  status:'PHYSICAL_REVIEW_CANDIDATES_NO_STITCHES',machineEligible:false,
  limitations:['Candidates and geometry axes are estimates, not semantic stitch planning.',
   'No tiny detail was omitted; review candidates still bind all source nodes.',
   'No running centreline, satin rails, fill density, underlay or native commands are generated.',
   'Physical changes require a new signature and review; no fabric preset or thread chart is implied.']};
}
async function assertBindings(candidates,draft){
 if(!candidates||candidates.schema!=='stitch-forge-source-stitch-candidates-v1')throw Error('Invalid source candidate schema');
 const expected=await buildCandidates(draft);
 if(candidates.sourcePlanSignature!==expected.sourcePlanSignature||JSON.stringify(candidates.objects)!==JSON.stringify(expected.objects))
  throw Error('Stale or changed source candidate bindings; rebuild the physical review');
 return expected;
}
const api=Object.freeze({buildCandidates,assertBindings});root.StitchForgeSourceStitchCandidates=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

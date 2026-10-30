/* Source-region inspection contract. No API, machine exporter or paid model.
 * A colour partition is an automatic proposal, NOT semantic reconstruction.
 * RLE masks are authoritative; contours are rederived when loading a project.
 */
(function(root){
'use strict';
const dep=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const ledgerAPI=dep('StitchForgeSourceMaskLedger','./source-mask-ledger.js');
const topologyAPI=dep('StitchForgeSourceTopology','./source-topology.js');
const reconstruction=dep('StitchForgeAutoReconstruct','./auto-reconstruct.js');
const graphAPI=dep('StitchForgeSourceRegionGraph','./source-region-graph.js');
const SCHEMA='stitch-forge-source-region-project-v1',GRAPH_SCHEMA='stitch-forge-source-region-project-v2',
 APPROX_SCHEMA='stitch-forge-source-region-approximation-v1',MAX_BYTES=8000000,MAX_TOTAL_RUNS=200000;
function dimensions(w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>750000)
  throw Error('Invalid analysis pixel dimensions');
}
async function fingerprint(rgba,w,h){
 dimensions(w,h);
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length!==w*h*4)throw Error('Invalid source pixels');
 const cryptoAPI=root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);
 if(!cryptoAPI?.subtle)throw Error('Local source fingerprinting unavailable');
 const input=new Uint8Array(8+rgba.length),header=new DataView(input.buffer);
 header.setUint32(0,w);header.setUint32(4,h);input.set(rgba,8);
 const digest=new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',input));
 return [...digest].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function physicalSize(w,h,widthMm){
 if(typeof widthMm!=='number'||!Number.isFinite(widthMm)||widthMm<10||widthMm>250||widthMm*h/w>400)
  throw Error('Source image width must be 10–250 mm and height at most 400 mm');
 return {imageWidthMm:widthMm,imageHeightMm:widthMm*h/w,scaleMmPerPixel:widthMm/w};
}
function validateSource(source){
 if(!source||!/^([0-9a-f]{64})$/.test(source.sha256||''))throw Error('Missing source fingerprint');
 dimensions(source.width,source.height);
 const originalWidth=source.originalWidth,originalHeight=source.originalHeight;
 if(!Number.isInteger(originalWidth)||!Number.isInteger(originalHeight)||originalWidth<1||originalHeight<1||
    originalWidth*originalHeight>45000000||source.width>originalWidth||source.height>originalHeight||
    Math.abs(source.width/source.height-originalWidth/originalHeight)>2/source.height)
  throw Error('Invalid original image dimensions or aspect ratio');
 return {sha256:source.sha256,width:source.width,height:source.height,originalWidth,originalHeight,
  fingerprintScope:'analysis_RGBA8_plus_big_endian_width_height'};
}
function validateDraft(input){
 if(!input||![SCHEMA,GRAPH_SCHEMA,APPROX_SCHEMA].includes(input.schema)||!Array.isArray(input.regions)||!input.regions.length||input.regions.length>12)
  throw Error('Invalid source-region project');
 const source=validateSource(input.source),{width:w,height:h}=source;
 const physical=physicalSize(w,h,input.physical?.imageWidthMm);
 const occupied=new Uint8Array(w*h),regions=[];let totalRuns=0,foregroundPixels=0;
 const ids=new Set(),colors=new Set();
 for(const [i,item] of input.regions.entries()){
  if(!item||!/^#[0-9A-F]{6}$/.test(item.color)||colors.has(item.color)||
     item.id!==source.sha256.slice(0,12)+'-colour-'+(i+1)||ids.has(item.id)||
     item.ledger?.width!==w||item.ledger?.height!==h)
   throw Error('Invalid source-region identity, colour or dimensions');
  if(i&&input.regions[i-1].color>=item.color)throw Error('Source colours are not in canonical order');
  colors.add(item.color);ids.add(item.id);
  const mask=ledgerAPI.maskFromLedger(item.ledger);
  totalRuns+=item.ledger.runCount;
  if(totalRuns>MAX_TOTAL_RUNS)throw Error('Source regions exceed total run budget; prior draft unchanged');
  for(let k=0;k<mask.length;k++)if(mask[k]){
   if(occupied[k])throw Error('Source colour regions overlap');occupied[k]=1;foregroundPixels++;
  }
  let topology=null,contourStatus='exact_pixel_edges';
  try{topology=topologyAPI.contoursFromLedger(item.ledger);}
  catch(error){
   // Resource refusal keeps the authoritative mask in the inspectable draft.
   // Structural validation failures are never converted into a soft warning.
   if(!/exceed (?:edge|vertex) budget; mask retained/.test(error.message))throw error;
   contourStatus='contour_budget_exceeded_mask_retained';
  }
  const ledger=ledgerAPI.ledgerFromMask(mask,w,h);
  regions.push({id:item.id,color:item.color,ledger,topology,contourStatus,
   source:'automatic_nearest_palette_partition',machineEligible:false});
 }
 if(!foregroundPixels||foregroundPixels!==input.foregroundPixels)
  throw Error('Source-region foreground accounting mismatch');
 const quantisation=input.quantisation;
 if(!quantisation||!Number.isInteger(quantisation.pixelsBeyondRgb60)||quantisation.pixelsBeyondRgb60<0||
    quantisation.pixelsBeyondRgb60>foregroundPixels||!Number.isFinite(quantisation.meanRgbDistance)||
    quantisation.meanRgbDistance<0||quantisation.meanRgbDistance>442)
  throw Error('Invalid palette uncertainty accounting');
 const componentCount=regions.reduce((n,r)=>n+r.ledger.components.length,0);
 const smallComponents=regions.reduce((n,r)=>n+r.ledger.components.filter(c=>c.reviewFlags.length).length,0);
 const holeCount=regions.reduce((n,r)=>n+(r.topology?.components.reduce((m,c)=>m+c.rings.filter(x=>x.role==='hole').length,0)||0),0);
 const output={schema:input.schema,source,physical,regions,foregroundPixels,
  quantisation:{pixelsBeyondRgb60:quantisation.pixelsBeyondRgb60,meanRgbDistance:quantisation.meanRgbDistance},
  summary:{colorGroups:regions.length,componentCount,smallComponents,holeCount,
   contoursUnavailable:regions.filter(r=>!r.topology).length},
  status:'SOURCE_REGION_DRAFT_NOT_DIGITISED',machineEligible:false,
  blockers:['semantic_regions_unverified','palette_quantisation_unverified','stitch_plan_missing',
   ...(smallComponents?['small_source_components_require_review']:[]),
   ...(regions.some(r=>!r.topology)?['contour_budget_exceeded']:[]),
   ...(regions.some(r=>r.topology?.components.some(c=>c.reviewFlags.some(f=>f.includes('touch'))))?
     ['touching_boundaries_require_review']:[])]};
 if(input.schema===GRAPH_SCHEMA){
  const graph=graphAPI.validateGraph(input.graph);
  if(graph.width!==w||graph.height!==h||graph.sourceSha256!==source.sha256||
     graph.nodes.reduce((n,r)=>n+r.pixelArea,0)!==foregroundPixels)
   throw Error('Graph does not match source project');
  const masks=new Map(regions.map(r=>[r.color,ledgerAPI.maskFromLedger(r.ledger)]));
  for(const node of graph.nodes){const mask=masks.get(graph.palette[node.paletteIndex]);
   if(!mask)throw Error('Graph working colour missing from project');
   for(const [y,x0,x1] of node.runs)for(let x=x0;x<x1;x++)if(!mask[y*w+x])throw Error('Graph and working geometry disagree');
  }
  if(quantisation.pixelsBeyondRgb60!==graph.metrics.pixelsBeyondRgb60||quantisation.meanRgbDistance!==graph.metrics.meanRgbDistance)
   throw Error('Graph colour accounting mismatch');
  output.graph=graph;output.summary.sourceNodes=graph.nodes.length;output.summary.adjacencies=graph.edges.length;
  output.summary.smallContrastingFeatures=graph.protectedFeatures;
  output.summary.protectedColourMismatch=graph.metrics.protectedColourMismatch;
  output.summary.collapsedProtectedEdges=graph.metrics.collapsedProtectedEdges;
  if(graph.metrics.protectedColourMismatch||graph.metrics.collapsedProtectedEdges)output.blockers.push('small_contrasting_colour_features_need_review');
 }
 if(input.schema===APPROX_SCHEMA){
  if(input.approximation?.algorithm!=='palette_first_preview_MD-2.47'||
     !['source_graph_node_budget','source_graph_run_budget','source_graph_adjacency_budget','explicit_preview_only','source_graph_serialisation_budget'].includes(input.approximation.reasonCode))
   throw Error('Invalid bounded preview provenance');
  output.approximation={algorithm:'palette_first_preview_MD-2.47',reasonCode:input.approximation.reasonCode,
   referenceGraphAvailable:false,smallFeaturePreservationVerified:false,semanticFeaturesVerified:false,machineEligible:false};
  output.blockers.push('fine_reference_graph_unavailable','small_feature_preservation_unverified');
 }
 return output;
}
async function createDraft(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h}={}){
 const scan=reconstruction.analyseArtwork(rgba,w,h),foreground=reconstruction.sourceForegroundMask(rgba,w,h);
 if(!scan.palette.length)throw Error('No stable source palette; automatic partition unavailable');
 const palette=[...new Set(scan.palette.map(p=>p.color))].sort();
 const rgb=palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
 const masks=palette.map(()=>new Uint8Array(w*h));
 let distanceTotal=0,pixelsBeyondRgb60=0;
 for(let k=0;k<foreground.length;k++){
  if(!foreground[k])continue;
  let best=Infinity,index=0;const j=k*4;
  for(let i=0;i<rgb.length;i++){
   const distance=(rgba[j]-rgb[i][0])**2+(rgba[j+1]-rgb[i][1])**2+(rgba[j+2]-rgb[i][2])**2;
   if(distance<best){best=distance;index=i;}
  }
  masks[index][k]=1;distanceTotal+=Math.sqrt(best);if(best>3600)pixelsBeyondRgb60++;
 }
 const sha256=await fingerprint(rgba,w,h),regions=[];
 for(let i=0;i<palette.length;i++){
  const ledger=ledgerAPI.ledgerFromMask(masks[i],w,h);
  if(!ledger.foregroundPixels)continue;
  regions.push({id:sha256.slice(0,12)+'-colour-'+(regions.length+1),color:palette[i],ledger});
 }
 return validateDraft({schema:SCHEMA,source:{sha256,width:w,height:h,originalWidth,originalHeight},
  physical:{imageWidthMm},regions,foregroundPixels:scan.foregroundPixels,
  quantisation:{pixelsBeyondRgb60,meanRgbDistance:distanceTotal/scan.foregroundPixels}});
}
async function createGraphDraft(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h,simplifyBoundaryBlends=true}={}){
 const sha256=await fingerprint(rgba,w,h),graph=graphAPI.buildGraph(rgba,w,h,sha256,{simplifyBoundaryBlends});
 const masks=graph.palette.map(()=>new Uint8Array(w*h)),regions=[];
 for(const n of graph.nodes)for(const [y,x0,x1] of n.runs)masks[n.paletteIndex].fill(1,y*w+x0,y*w+x1);
 for(let i=0;i<graph.palette.length;i++){
  const ledger=ledgerAPI.ledgerFromMask(masks[i],w,h);if(!ledger.foregroundPixels)continue;
  regions.push({id:sha256.slice(0,12)+'-colour-'+(regions.length+1),color:graph.palette[i],ledger});
 }
 return validateDraft({schema:GRAPH_SCHEMA,source:{sha256,width:w,height:h,originalWidth,originalHeight},
  physical:{imageWidthMm},regions,graph,foregroundPixels:graph.nodes.reduce((n,r)=>n+r.pixelArea,0),
  quantisation:{pixelsBeyondRgb60:graph.metrics.pixelsBeyondRgb60,meanRgbDistance:graph.metrics.meanRgbDistance}});
}
async function createApproximationDraft(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h,reasonCode='explicit_preview_only'}={}){
 const sha256=await fingerprint(rgba,w,h),{palette,foreground}=graphAPI.histogramPalette(rgba,w,h);
 const colors=palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16))),masks=colors.map(()=>new Uint8Array(w*h));
 let count=0,strong=0,distanceTotal=0;
 for(let k=0;k<foreground.length;k++)if(foreground[k]){
  const j=k*4;let best=Infinity,index=0;
  for(let i=0;i<colors.length;i++){const d=colors[i].reduce((n,v,c)=>n+(rgba[j+c]-v)**2,0);if(d<best){best=d;index=i;}}
  masks[index][k]=1;count++;distanceTotal+=Math.sqrt(best);if(best>3600)strong++;
 }
 const regions=[];
 for(let i=0;i<palette.length;i++){
  const ledger=ledgerAPI.ledgerFromMask(masks[i],w,h);if(!ledger.foregroundPixels)continue;
  regions.push({id:sha256.slice(0,12)+'-colour-'+(regions.length+1),color:palette[i],ledger});
 }
 return validateDraft({schema:APPROX_SCHEMA,source:{sha256,width:w,height:h,originalWidth,originalHeight},physical:{imageWidthMm},regions,
  foregroundPixels:count,quantisation:{pixelsBeyondRgb60:strong,meanRgbDistance:distanceTotal/count},
  approximation:{algorithm:'palette_first_preview_MD-2.47',reasonCode}});
}
async function createInspectionDraft(rgba,w,h,options={}){
 try{return await createGraphDraft(rgba,w,h,options);}
 catch(error){
  const code=/^Source graph exceeds (node|run|adjacency) budget;/.exec(error.message||'');
  if(!code&&!/^Source-region project exceeds download budget$/.test(error.message||''))throw error;
  return createApproximationDraft(rgba,w,h,{...options,reasonCode:code?'source_graph_'+code[1]+'_budget':'source_graph_serialisation_budget'});
 }
}
async function assertMatchesSource(draft,rgba,w,h){
 const checked=validateDraft(draft);
 if(checked.source.width!==w||checked.source.height!==h||checked.source.sha256!==await fingerprint(rgba,w,h))
  throw Error('Saved source regions belong to different artwork pixels');
 const options={imageWidthMm:checked.physical.imageWidthMm,originalWidth:checked.source.originalWidth,originalHeight:checked.source.originalHeight};
 if(checked.graph)options.simplifyBoundaryBlends=checked.graph.algorithm==='bounded_reference_graph_MD-2.46';
 if(checked.approximation)options.reasonCode=checked.approximation.reasonCode;
 const factory=checked.schema===GRAPH_SCHEMA?createGraphDraft:checked.schema===APPROX_SCHEMA?createApproximationDraft:createDraft;
 const fresh=await factory(rgba,w,h,options);
 if(serialiseDraft(checked)!==serialiseDraft(fresh))throw Error('Saved geometry or colour evidence does not match the original pixels');
 return checked;
}
function serialiseDraft(draft){
 const checked=validateDraft(draft);
 const text=JSON.stringify({...checked,regions:checked.regions.map(({id,color,ledger})=>({id,color,ledger}))});
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Source-region project exceeds download budget');
 return text;
}
function parseDraft(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Oversized source-region project');
 return validateDraft(JSON.parse(text));
}
function resizeDraft(draft,imageWidthMm){return validateDraft({...draft,physical:{imageWidthMm}});}
function geometrySvg(draft){
 const checked=validateDraft(draft),{source,physical}=checked;
 if(checked.regions.some(r=>!r.topology))throw Error('Some contours exceed the budget; all masks remain available in JSON');
 const paths=checked.regions.map(r=>{
  const d=r.topology.components.flatMap(c=>c.rings.map(ring=>ring.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+'Z')).join(' ');
  return '<path id="'+r.id+'" fill="'+r.color+'" fill-rule="evenodd" d="'+d+'"/>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+physical.imageWidthMm.toFixed(6)+'mm" height="'+
  physical.imageHeightMm.toFixed(6)+'mm" viewBox="0 0 '+source.width+' '+source.height+'" data-status="SOURCE_GEOMETRY_NOT_DIGITISED">'+
  '<title>Automatic source-pixel colour partition. Semantic regions and stitches unverified.</title>'+paths+'</svg>';
}
const api=Object.freeze({fingerprint,createDraft,createGraphDraft,createApproximationDraft,createInspectionDraft,assertMatchesSource,validateDraft,serialiseDraft,parseDraft,resizeDraft,geometrySvg});
root.StitchForgeSourceRegionProject=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

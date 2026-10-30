/* Source-supported region graph and a bounded working colour approximation.
 * Every selected pixel stays in a reference node. Working colours may simplify
 * shading; small contrasting features are measured separately. No semantics,
 * calibrated thread matching, stitch assignment or machine approval is implied.
 */
(function(root){
'use strict';
const reconstruction=root.StitchForgeAutoReconstruct||
 (typeof require==='function'?require('./auto-reconstruct.js'):null);
const MAX_RUNS=200000,MAX_NODES=30000,MAX_EDGES=100000,PALETTE_LIMIT=12;
const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
const hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('').toUpperCase();
const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const nearest=(value,palette)=>{let index=0,best=Infinity;for(let i=0;i<palette.length;i++){
 const d=distance2(value,palette[i]);if(d<best){best=d;index=i;}}return index;};
function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>750000)throw Error('Invalid graph dimensions');}
function componentsFromLabels(labels,w,h,sha256){
 dimensions(w,h);
 if(!(labels instanceof Int16Array)||labels.length!==w*h||!/^[0-9a-f]{64}$/.test(sha256))throw Error('Invalid graph source');
 const runs=[],parent=[];let previous=[];
 const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){let p=parent[i];parent[i]=r;i=p;}return r;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);};
 for(let y=0;y<h;y++){
  const current=[];
  for(let x=0;x<w;){
   const bin=labels[y*w+x];if(!Number.isInteger(bin)||bin< -1||bin>511)throw Error('Invalid source colour bin');
   if(bin<0){x++;continue;}
   const x0=x++;while(x<w&&labels[y*w+x]===bin)x++;
   if(runs.length===MAX_RUNS)throw Error('Source graph exceeds run budget; no pixels were discarded');
   const i=runs.length;runs.push([y,x0,x,bin]);parent.push(i);current.push(i);
  }
  let left=0;
  for(const i of current){const [,x0,x1,bin]=runs[i];
   while(left<previous.length&&runs[previous[left]][2]<=x0)left++;
   for(let j=left;j<previous.length&&runs[previous[j]][1]<x1;j++)if(runs[previous[j]][3]===bin)join(i,previous[j]);
  }
  previous=current;
 }
 const groups=new Map(),owners=new Int32Array(w*h).fill(-1),nodes=[];
 for(let i=0;i<runs.length;i++){
  const key=find(i),[y,x0,x1,bin]=runs[i];let node=groups.get(key);
  if(!node){
   if(nodes.length===MAX_NODES)throw Error('Source graph exceeds node budget; no pixels were discarded');
   node={id:'node-'+sha256.slice(0,12)+'-'+bin.toString(16)+'-'+(y*w+x0).toString(36),
    bin,pixelArea:0,bounds:{x:x0,y,w:x1-x0,h:1},runs:[]};
   node.index=nodes.length;groups.set(key,node);nodes.push(node);
  }
  const right=Math.max(node.bounds.x+node.bounds.w,x1),bottom=y+1;
  node.bounds.x=Math.min(node.bounds.x,x0);node.bounds.w=right-node.bounds.x;node.bounds.h=bottom-node.bounds.y;
  node.pixelArea+=x1-x0;node.runs.push([y,x0,x1]);owners.fill(node.index,y*w+x0,y*w+x1);
 }
 for(const node of nodes)delete node.index;
 return {nodes,owners,runCount:runs.length};
}
function adjacency(owners,w,h,rgba=null){
 const map=new Map();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x,a=owners[k];if(a<0)continue;
  for(const other of [x<w-1?k+1:-1,y<h-1?k+w:-1]){
   if(other<0||owners[other]<0||owners[other]===a)continue;
   const b=owners[other],lo=Math.min(a,b),hi=Math.max(a,b),key=lo+':'+hi;
   if(!map.has(key)){
    if(map.size===MAX_EDGES)throw Error('Source graph exceeds adjacency budget; no geometry was merged');
    map.set(key,{a:lo,b:hi,edgePixels:0,contrastSum:0,maxContrast:0});
   }
   const edge=map.get(key);edge.edgePixels++;
   if(rgba){const j=k*4,l=other*4,d=Math.hypot(rgba[j]-rgba[l],rgba[j+1]-rgba[l+1],rgba[j+2]-rgba[l+2]);
    edge.contrastSum+=d;edge.maxContrast=Math.max(edge.maxContrast,d);}
  }
 }
 return [...map.values()].sort((a,b)=>a.a-b.a||a.b-b.b).map(e=>({a:e.a,b:e.b,edgePixels:e.edgePixels,
  meanContrast:rgba?e.contrastSum/e.edgePixels:0,maxContrast:e.maxContrast}));
}
function markFeatures(nodes,edges){
 const boundary=nodes.map(()=>({pixels:0,sum:0,max:0,neighbours:[]}));
 for(const edge of edges)for(const i of [edge.a,edge.b]){
  boundary[i].pixels+=edge.edgePixels;boundary[i].sum+=edge.meanContrast*edge.edgePixels;
  boundary[i].max=Math.max(boundary[i].max,edge.maxContrast);
  boundary[i].neighbours.push({index:i===edge.a?edge.b:edge.a,pixels:edge.edgePixels});
 }
 return nodes.map((n,i)=>{
  const b=boundary[i],contrast=b.pixels?b.sum/b.pixels:0;
  const color=rgb(n.color),neighbours=b.neighbours.sort((a,b)=>b.pixels-a.pixels||a.index-b.index).slice(0,12).map(x=>rgb(nodes[x.index].color));
  // A tiny colour lying on a blend between two neighbouring colours may be an
  // antialiased boundary, rather than an eye/mark requiring its own colour.
  // This is a recorded approximation hypothesis, never deletion of the node.
  let boundaryBlendCandidate=false;
  for(let a=0;a<neighbours.length&&!boundaryBlendCandidate;a++)for(let j=a+1;j<neighbours.length;j++){
   const left=neighbours[a],right=neighbours[j],length=distance2(left,right);
   if(length<60**2)continue;
   const t=color.reduce((s,v,c)=>s+(v-left[c])*(right[c]-left[c]),0)/length;
   if(t<=.05||t>=.95)continue;
   const blend=left.map((v,c)=>v+t*(right[c]-v));
   if(distance2(color,blend)<=18**2){boundaryBlendCandidate=true;break;}
  }
  const protectedFeature=n.pixelArea<=25&&n.opaquePixels/n.pixelArea>=.8&&contrast>=60&&!boundaryBlendCandidate;
  return {...n,boundaryContrast:contrast,protectedFeature,
   boundaryBlendCandidate,
   reviewFlags:[...(n.pixelArea<25?['small_source_feature']:[]),...(protectedFeature?['small_contrasting_feature']:[]),
    ...(boundaryBlendCandidate?['possible_boundary_blend_not_semantically_verified']:[])]};
 });
}
function proposePalette(nodes){
 const values=nodes.map(n=>rgb(n.color));
 const first=nodes.reduce((best,n,i)=>n.pixelArea>nodes[best].pixelArea?i:best,0);
 const palette=[values[first].slice()],locked=[false];
 // A maximum of four slots may be held by small contrasting features. Any
 // unrepresented feature remains explicit; no feature is removed to fit 12.
 for(let slots=0;slots<4&&palette.length<PALETTE_LIMIT;slots++){
  let chosen=-1,error=40**2;
  for(let i=0;i<nodes.length;i++)if(nodes[i].protectedFeature){
   const d=distance2(values[i],palette[nearest(values[i],palette)]);
   if(d>error){error=d;chosen=i;}
  }
  if(chosen<0)break;palette.push(values[chosen].slice());locked.push(true);
 }
 while(palette.length<PALETTE_LIMIT){
  let chosen=-1,error=4;
  for(let i=0;i<nodes.length;i++){
   const score=nodes[i].pixelArea*distance2(values[i],palette[nearest(values[i],palette)]);
   if(score>error){error=score;chosen=i;}
  }
  if(chosen<0)break;palette.push(values[chosen].slice());locked.push(false);
 }
 for(let iteration=0;iteration<6;iteration++){
  const sums=palette.map(()=>[0,0,0,0]);
  for(let i=0;i<nodes.length;i++){
   const index=nearest(values[i],palette),sum=sums[index],count=nodes[i].pixelArea;
   for(let c=0;c<3;c++)sum[c]+=values[i][c]*count;sum[3]+=count;
  }
  for(let i=0;i<palette.length;i++)if(!locked[i]&&sums[i][3])palette[i]=sums[i].slice(0,3).map(v=>Math.round(v/sums[i][3]));
 }
 return [...new Set(palette.map(hex))].sort();
}
function paletteAssessment(nodes,edges,palette,workingAssignment=null){
 const colors=palette.map(rgb),assignment=workingAssignment||nodes.map(n=>nearest(rgb(n.color),colors));
 let collapsedProtectedEdges=0,protectedColourMismatch=0;
 for(let i=0;i<nodes.length;i++)if(nodes[i].protectedFeature&&distance2(rgb(nodes[i].color),colors[assignment[i]])>40**2)protectedColourMismatch++;
 for(const edge of edges)if((nodes[edge.a].protectedFeature||nodes[edge.b].protectedFeature)&&edge.meanContrast>=60){
  const contrast=Math.sqrt(distance2(colors[assignment[edge.a]],colors[assignment[edge.b]]));
  if(contrast<Math.min(40,edge.meanContrast*.5))collapsedProtectedEdges++;
 }
 return {assignment,protectedColourMismatch,collapsedProtectedEdges};
}
function simplifyBlendAssignments(nodes,edges,palette,owners,w,h){
 const colors=palette.map(rgb),base=nodes.map(n=>nearest(rgb(n.color),colors)),assignment=base.slice();
 const neighbours=nodes.map(()=>[]);
 for(const edge of edges){neighbours[edge.a].push({index:edge.b,edge});neighbours[edge.b].push({index:edge.a,edge});}
 const reassignments=[];
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];
  if(!node.boundaryBlendCandidate||node.protectedFeature||node.pixelArea>4)continue;
  const color=rgb(node.color),oldError=Math.sqrt(distance2(color,colors[base[i]])),choices=[];
  for(const {index:parent,edge} of neighbours[i]){
   // Stable, directly adjacent parents only. They cannot themselves be a
   // reassignment candidate, so no iterative/chain smoothing is possible.
   if(nodes[parent].pixelArea<16||base[parent]===base[i])continue;
   const error=Math.sqrt(distance2(color,colors[base[parent]]));
   if(error>96||error-oldError>64)continue;
   let onePixel=true;
   for(const [y,x0,x1] of node.runs)for(let x=x0;x<x1;x++){
    const k=y*w+x;
    if(!((x>0&&owners[k-1]===parent)||(x<w-1&&owners[k+1]===parent)||
       (y>0&&owners[k-w]===parent)||(y<h-1&&owners[k+w]===parent)))onePixel=false;
   }
   if(!onePixel)continue;
   let weakensProtected=false;
   for(const other of neighbours[i])if(nodes[other.index].protectedFeature&&other.edge.meanContrast>=60){
    const before=Math.sqrt(distance2(colors[base[i]],colors[base[other.index]]));
    const after=Math.sqrt(distance2(colors[base[parent]],colors[base[other.index]]));
    if(after+1e-9<Math.min(before,40))weakensProtected=true;
   }
   if(!weakensProtected)choices.push({parent,error,edgePixels:edge.edgePixels});
  }
  choices.sort((a,b)=>a.error-b.error||b.edgePixels-a.edgePixels||nodes[b.parent].pixelArea-nodes[a.parent].pixelArea||a.parent-b.parent);
  if(!choices.length)continue;
  const chosen=choices[0];assignment[i]=base[chosen.parent];
  reassignments.push({node:i,parent:chosen.parent,from:base[i],to:assignment[i],pixels:node.pixelArea,
   maxBoundaryShiftPixels:1,meanRgbErrorIncrease:chosen.error-oldError});
 }
 return {assignment,reassignments,pixelsReassigned:reassignments.reduce((n,r)=>n+r.pixels,0)};
}
function measurePixels(rgba,owners,nodes,palette,assignment){
 const colors=palette.map(rgb);let pixelsBeyondRgb60=0,sum=0,squares=0,max=0;
 for(let k=0;k<owners.length;k++)if(owners[k]>=0){
  const j=4*k,color=colors[assignment[owners[k]]],d=Math.hypot(rgba[j]-color[0],rgba[j+1]-color[1],rgba[j+2]-color[2]);
  if(d>60)pixelsBeyondRgb60++;sum+=d;squares+=d*d;max=Math.max(max,d);
 }
 const count=nodes.reduce((n,r)=>n+r.pixelArea,0);
 return {pixelsBeyondRgb60,meanRgbDistance:sum/count,rmsRgbDistance:Math.sqrt(squares/count),maxRgbDistance:max};
}
function buildGraph(rgba,w,h,sha256,{simplifyBoundaryBlends=true}={}){
 dimensions(w,h);
 const foreground=reconstruction.sourceForegroundMask(rgba,w,h),labels=new Int16Array(w*h).fill(-1);
 for(let k=0;k<labels.length;k++)if(foreground[k]){const j=4*k;labels[k]=((rgba[j]>>5)<<6)|((rgba[j+1]>>5)<<3)|(rgba[j+2]>>5);}
 const raw=componentsFromLabels(labels,w,h,sha256);
 if(!raw.nodes.length)throw Error('No supported source foreground');
 let nodes=raw.nodes.map(n=>{
  const sum=[0,0,0],min=[255,255,255],max=[0,0,0];let opaquePixels=0;
  for(const [y,x0,x1] of n.runs)for(let x=x0;x<x1;x++){
   const j=(y*w+x)*4;for(let c=0;c<3;c++){sum[c]+=rgba[j+c];min[c]=Math.min(min[c],rgba[j+c]);max[c]=Math.max(max[c],rgba[j+c]);}
   if(rgba[j+3]>=245)opaquePixels++;
  }
  return {...n,color:hex(sum.map(v=>v/n.pixelArea)),minRGB:min,maxRGB:max,opaquePixels};
 });
 const edges=adjacency(raw.owners,w,h,rgba);nodes=markFeatures(nodes,edges);
 const adaptive=proposePalette(nodes),baseline=[...new Set(reconstruction.analyseArtwork(rgba,w,h).palette.map(p=>p.color))].sort();
 if(!baseline.length)baseline.push(adaptive[0]);
 const candidates=[adaptive,baseline].map(palette=>{
  const assessed=paletteAssessment(nodes,edges,palette);
  return {palette,...assessed,...measurePixels(rgba,raw.owners,nodes,palette,assessed.assignment)};
 });
 // Compare two bounded proposals. Important contrasting features take priority;
 // colour-error counts and RMS then decide. Reference nodes never disappear.
 const ranked=candidates.slice().sort((a,b)=>(a.collapsedProtectedEdges+a.protectedColourMismatch)-(b.collapsedProtectedEdges+b.protectedColourMismatch)||
  a.pixelsBeyondRgb60-b.pixelsBeyondRgb60||a.rmsRgbDistance-b.rmsRgbDistance);
 const chosen=ranked[0];
 const simplification=simplifyBoundaryBlends?simplifyBlendAssignments(nodes,edges,chosen.palette,raw.owners,w,h):null;
 const working=simplification?.assignment||chosen.assignment;
 const assessment=paletteAssessment(nodes,edges,chosen.palette,working),measured=measurePixels(rgba,raw.owners,nodes,chosen.palette,working);
 nodes=nodes.map((node,i)=>({...node,...(simplification?{basePaletteIndex:chosen.assignment[i]}:{}),paletteIndex:working[i]}));
 const metrics={...measured,collapsedProtectedEdges:assessment.collapsedProtectedEdges,protectedColourMismatch:assessment.protectedColourMismatch};
 return {schema:'stitch-forge-source-region-graph-v1',algorithm:simplification?'bounded_reference_graph_MD-2.46':'bounded_reference_graph_MD-2.45',width:w,height:h,sourceSha256:sha256,
  nodes,edges,runCount:raw.runCount,palette:chosen.palette,
  paletteMethod:chosen===candidates[0]?'feature_aware_bounded_12':'baseline_node_palette_retained',metrics,
  protectedFeatures:nodes.filter(n=>n.protectedFeature).length,
  baselineNodePaletteMetrics:{pixelsBeyondRgb60:candidates[1].pixelsBeyondRgb60,meanRgbDistance:candidates[1].meanRgbDistance,
   collapsedProtectedEdges:candidates[1].collapsedProtectedEdges,protectedColourMismatch:candidates[1].protectedColourMismatch},
  ...(simplification?{simplification:{reassignments:simplification.reassignments,pixelsReassigned:simplification.pixelsReassigned,
   maxBoundaryShiftPixels:1,referenceNodesUnchanged:true,unsimplifiedMetrics:{pixelsBeyondRgb60:chosen.pixelsBeyondRgb60,
    meanRgbDistance:chosen.meanRgbDistance,rmsRgbDistance:chosen.rmsRgbDistance,maxRgbDistance:chosen.maxRgbDistance}}}:{}),
  machineEligible:false,status:'SOURCE_GRAPH_AND_WORKING_COLOURS_NOT_DIGITISED'};
}
function validateGraph(graph){
 dimensions(graph?.width,graph?.height);
 if(graph?.schema!=='stitch-forge-source-region-graph-v1'||!['bounded_reference_graph_MD-2.45','bounded_reference_graph_MD-2.46'].includes(graph.algorithm)||
    !/^[0-9a-f]{64}$/.test(graph.sourceSha256||'')||!Array.isArray(graph.nodes)||!graph.nodes.length||graph.nodes.length>MAX_NODES||
    !Array.isArray(graph.edges)||graph.edges.length>MAX_EDGES||!Array.isArray(graph.palette)||!graph.palette.length||graph.palette.length>PALETTE_LIMIT||
    !graph.palette.every(c=>/^#[0-9A-F]{6}$/.test(c))||new Set(graph.palette).size!==graph.palette.length)
  throw Error('Invalid source graph');
 const {width:w,height:h}=graph,labels=new Int16Array(w*h).fill(-1);let runCount=0;
 for(const n of graph.nodes){
  if(!Number.isInteger(n.bin)||n.bin<0||n.bin>511||!Array.isArray(n.runs)||!n.runs.length||
     !Number.isInteger(n.pixelArea)||n.pixelArea<1||!/^#[0-9A-F]{6}$/.test(n.color)||
     !Number.isInteger(n.opaquePixels)||n.opaquePixels<0||n.opaquePixels>n.pixelArea||
     !Number.isInteger(n.paletteIndex)||n.paletteIndex<0||n.paletteIndex>=graph.palette.length||
     ![n.minRGB,n.maxRGB].every(v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isInteger(x)&&x>=0&&x<=255))||
     rgb(n.color).some((v,i)=>v<n.minRGB[i]||v>n.maxRGB[i])||
     n.minRGB.some((v,i)=>v>n.maxRGB[i]||v<((n.bin>>((2-i)*3))&7)*32||n.maxRGB[i]>(((n.bin>>((2-i)*3))&7)+1)*32-1))
   throw Error('Invalid source node statistics');
  for(const run of n.runs){
   if(++runCount>MAX_RUNS||!Array.isArray(run)||run.length!==3||!run.every(Number.isInteger)||
      run[0]<0||run[0]>=h||run[1]<0||run[1]>=run[2]||run[2]>w)throw Error('Invalid source graph run');
   for(let x=run[1];x<run[2];x++){const k=run[0]*w+x;if(labels[k]>=0)throw Error('Source graph nodes overlap');labels[k]=n.bin;}
  }
 }
 const canonical=componentsFromLabels(labels,w,h,graph.sourceSha256);
 if(runCount!==graph.runCount||JSON.stringify(canonical.nodes)!==JSON.stringify(graph.nodes.map(({id,bin,pixelArea,bounds,runs})=>({id,bin,pixelArea,bounds,runs}))))
  throw Error('Source graph identity/grouping/accounting mismatch');
 const expected=adjacency(canonical.owners,w,h);
 if(expected.length!==graph.edges.length)throw Error('Source graph adjacency mismatch');
 const edges=graph.edges.map((e,i)=>{
  const x=expected[i];if(!e||e.a!==x.a||e.b!==x.b||e.edgePixels!==x.edgePixels||
   !Number.isFinite(e.meanContrast)||!Number.isFinite(e.maxContrast)||e.meanContrast<0||e.maxContrast<e.meanContrast-1e-9||e.maxContrast>442)
   throw Error('Invalid source boundary evidence');
  return {a:e.a,b:e.b,edgePixels:e.edgePixels,meanContrast:e.meanContrast,maxContrast:e.maxContrast};
 });
 const hasSimplification=graph.algorithm==='bounded_reference_graph_MD-2.46';
 const nodes=markFeatures(graph.nodes.map(n=>({id:n.id,bin:n.bin,pixelArea:n.pixelArea,bounds:{...n.bounds},runs:n.runs.map(r=>r.slice()),
  color:n.color,minRGB:n.minRGB.slice(),maxRGB:n.maxRGB.slice(),opaquePixels:n.opaquePixels,
  ...(hasSimplification?{basePaletteIndex:n.basePaletteIndex}:{}),paletteIndex:n.paletteIndex})),edges);
 const assessed=paletteAssessment(nodes,edges,graph.palette);
 const simplification=hasSimplification?simplifyBlendAssignments(nodes,edges,graph.palette,canonical.owners,w,h):null;
 if(JSON.stringify(simplification?.assignment||assessed.assignment)!==JSON.stringify(nodes.map(n=>n.paletteIndex))||
    (hasSimplification&&JSON.stringify(assessed.assignment)!==JSON.stringify(nodes.map(n=>n.basePaletteIndex))))
  throw Error('Working palette assignments are inconsistent');
 const working=paletteAssessment(nodes,edges,graph.palette,nodes.map(n=>n.paletteIndex));
 const metrics=graph.metrics;
 if(!metrics||!Number.isInteger(metrics.pixelsBeyondRgb60)||metrics.pixelsBeyondRgb60<0||metrics.pixelsBeyondRgb60>nodes.reduce((a,n)=>a+n.pixelArea,0)||
   !['meanRgbDistance','rmsRgbDistance','maxRgbDistance'].every(k=>Number.isFinite(metrics[k])&&metrics[k]>=0&&metrics[k]<=442))
  throw Error('Invalid graph colour metrics');
 const baseline=graph.baselineNodePaletteMetrics;
 if(!['feature_aware_bounded_12','baseline_node_palette_retained'].includes(graph.paletteMethod)||!baseline||
    !Number.isInteger(baseline.pixelsBeyondRgb60)||baseline.pixelsBeyondRgb60<0||baseline.pixelsBeyondRgb60>nodes.reduce((s,n)=>s+n.pixelArea,0)||
    !Number.isFinite(baseline.meanRgbDistance)||baseline.meanRgbDistance<0||baseline.meanRgbDistance>442||
    !['collapsedProtectedEdges','protectedColourMismatch'].every(k=>Number.isInteger(baseline[k])&&baseline[k]>=0&&baseline[k]<=MAX_EDGES))
  throw Error('Invalid baseline graph comparison');
 let simplificationRecord=null;
 if(hasSimplification){
  const s=graph.simplification,u=s?.unsimplifiedMetrics;
  if(!s||s.pixelsReassigned!==simplification.pixelsReassigned||s.maxBoundaryShiftPixels!==1||
     JSON.stringify(s.reassignments)!==JSON.stringify(simplification.reassignments)||!u||
     !Number.isInteger(u.pixelsBeyondRgb60)||u.pixelsBeyondRgb60<0||u.pixelsBeyondRgb60>nodes.reduce((n,r)=>n+r.pixelArea,0)||
     !['meanRgbDistance','rmsRgbDistance','maxRgbDistance'].every(k=>Number.isFinite(u[k])&&u[k]>=0&&u[k]<=442))
   throw Error('Invalid boundary simplification evidence');
  simplificationRecord={reassignments:simplification.reassignments,pixelsReassigned:simplification.pixelsReassigned,
   maxBoundaryShiftPixels:1,referenceNodesUnchanged:true,unsimplifiedMetrics:{pixelsBeyondRgb60:u.pixelsBeyondRgb60,
    meanRgbDistance:u.meanRgbDistance,rmsRgbDistance:u.rmsRgbDistance,maxRgbDistance:u.maxRgbDistance}};
 }
 return {schema:graph.schema,algorithm:graph.algorithm,width:w,height:h,sourceSha256:graph.sourceSha256,
  runCount,nodes,edges,palette:graph.palette.slice(),paletteMethod:graph.paletteMethod,
  baselineNodePaletteMetrics:{pixelsBeyondRgb60:baseline.pixelsBeyondRgb60,meanRgbDistance:baseline.meanRgbDistance,
   collapsedProtectedEdges:baseline.collapsedProtectedEdges,protectedColourMismatch:baseline.protectedColourMismatch},
  ...(simplificationRecord?{simplification:simplificationRecord}:{}),
  machineEligible:false,protectedFeatures:nodes.filter(n=>n.protectedFeature).length,
  metrics:{pixelsBeyondRgb60:metrics.pixelsBeyondRgb60,meanRgbDistance:metrics.meanRgbDistance,rmsRgbDistance:metrics.rmsRgbDistance,
   maxRgbDistance:metrics.maxRgbDistance,collapsedProtectedEdges:working.collapsedProtectedEdges,protectedColourMismatch:working.protectedColourMismatch},
  status:'SOURCE_GRAPH_AND_WORKING_COLOURS_NOT_DIGITISED'};
}
function histogramPalette(rgba,w,h){
 const foreground=reconstruction.sourceForegroundMask(rgba,w,h),bins=new Map();
 for(let k=0;k<foreground.length;k++)if(foreground[k]){
  const j=k*4,key=((rgba[j]>>5)<<6)|((rgba[j+1]>>5)<<3)|(rgba[j+2]>>5),bin=bins.get(key)||{pixelArea:0,sum:[0,0,0]};
  bin.pixelArea++;for(let c=0;c<3;c++)bin.sum[c]+=rgba[j+c];bins.set(key,bin);
 }
 if(!bins.size)throw Error('No source foreground for bounded approximation');
 // This lightweight route makes no component-level feature-protection claim.
 // It returns a working palette, not a fine reference graph or stitch plan.
 const samples=[...bins.values()].map(b=>({pixelArea:b.pixelArea,color:hex(b.sum.map(v=>v/b.pixelArea)),protectedFeature:false}));
 return {palette:proposePalette(samples),foreground};
}
const api=Object.freeze({buildGraph,validateGraph,histogramPalette});root.StitchForgeSourceRegionGraph=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

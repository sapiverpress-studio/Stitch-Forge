// Local PNG-RGBA evaluation, no ideal polygons, AI, worker or deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const api=require('../site/source-region-project.js'),{maskFromLedger}=require('../site/source-mask-ledger.js');
const {maskFromContours}=require('../site/source-topology.js');
const candidatesAPI=require('../site/source-stitch-candidates.js');
(async()=>{
 const [raw,width,height,output,version='MD-2.46']=process.argv.slice(2),w=+width,h=+height;
 const rgba=new Uint8ClampedArray(fs.readFileSync(raw)),before=await api.createDraft(rgba,w,h),
  adaptive=await api.createGraphDraft(rgba,w,h,{simplifyBoundaryBlends:false}),after=await api.createGraphDraft(rgba,w,h,{simplifyBoundaryBlends:version!=='MD-2.45'});
 const candidates=await candidatesAPI.buildCandidates(after);
 const graphPixels=after.graph.nodes.reduce((s,n)=>s+n.pixelArea,0);
 assert.equal(graphPixels,after.foregroundPixels);
 for(const r of after.regions)assert.deepEqual(maskFromContours(r.topology),maskFromLedger(r.ledger));
 const saved=api.serialiseDraft(after);assert.equal(api.serialiseDraft(api.parseDraft(saved)),saved);
 assert.deepEqual(api.resizeDraft(after,100).graph,after.graph);
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'before.svg'),api.geometrySvg(before));fs.writeFileSync(path.join(output,'after.svg'),api.geometrySvg(after));
 fs.writeFileSync(path.join(output,'adaptive.svg'),api.geometrySvg(adaptive));
 fs.writeFileSync(path.join(output,'stitch-candidates.json'),JSON.stringify(candidates,null,2)+'\n');
 const changed=new Uint8Array(w*h);
 for(const r of after.graph.simplification?.reassignments||[])for(const [y,x0,x1] of after.graph.nodes[r.node].runs)changed.fill(1,y*w+x0,y*w+x1);
 fs.writeFileSync(path.join(output,'changed-boundaries.mask'),changed);
 fs.writeFileSync(path.join(output,'source-graph-project.json'),saved+'\n');
 const report={source:after.source,physical:after.physical,before:before.quantisation,after:after.quantisation,
  palette:after.graph.palette,referenceNodes:after.graph.nodes.length,adjacencies:after.graph.edges.length,
  smallContrastingCandidates:after.summary.smallContrastingFeatures,
  protectedColourMismatch:after.summary.protectedColourMismatch,collapsedProtectedEdges:after.summary.collapsedProtectedEdges,
  workingComponents:after.summary.componentCount,boundaryBlendCandidates:after.graph.nodes.filter(n=>n.boundaryBlendCandidate).length,
  exactSelectedPixelAccounting:true,workingMaskRingRoundtrip:true,saveReloadAndResizeVerified:true,
  humanLikenessVerified:false,semanticFeaturesVerified:false,machineEligible:false,blockers:after.blockers};
 report.beforeGrouping={quantisation:adaptive.quantisation,workingComponents:adaptive.summary.componentCount};
 report.simplification={nodesReassigned:after.graph.simplification?.reassignments.length||0,pixelsReassigned:after.graph.simplification?.pixelsReassigned||0,
  maxBoundaryShiftPixels:1,maxBoundaryShiftMm:after.physical.scaleMmPerPixel,
  protectedCorePixelsReassigned:(after.graph.simplification?.reassignments||[]).filter(r=>after.graph.nodes[r.node].protectedFeature).reduce((n,r)=>n+r.pixels,0),
  referenceNodeIdsUnchanged:JSON.stringify(adaptive.graph.nodes.map(n=>n.id))===JSON.stringify(after.graph.nodes.map(n=>n.id)),
  referenceGeometryUnchanged:JSON.stringify(adaptive.graph.nodes.map(({paletteIndex,basePaletteIndex,...rest})=>rest))===
   JSON.stringify(after.graph.nodes.map(({paletteIndex,basePaletteIndex,...rest})=>rest))};
 report.physicalCandidates=candidates.summary;report.sourcePlanSignature=candidates.sourcePlanSignature;
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

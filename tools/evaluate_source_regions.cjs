/* Raster-only local acceptance probe. Called by build_source_region_proof.py.
 * No original vector geometry, model, network, or machine exporter is used.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const api=require('../site/source-region-project.js');
const {sourceForegroundMask}=require('../site/auto-reconstruct.js');
const {maskFromLedger}=require('../site/source-mask-ledger.js');
const {maskFromContours}=require('../site/source-topology.js');
(async()=>{
 const [rgbaFile,width,height,output]=process.argv.slice(2),w=Number(width),h=Number(height);
 const rgba=new Uint8ClampedArray(fs.readFileSync(rgbaFile));
 const draft=await api.createDraft(rgba,w,h,{imageWidthMm:80});
 const saved=api.serialiseDraft(draft),loaded=api.parseDraft(saved),resized=api.resizeDraft(loaded,100);
 assert.deepEqual(resized.regions,draft.regions);
 assert.deepEqual(loaded,draft);
 const union=new Uint8Array(w*h),uncertain=new Uint8Array(w*h);let selected=0;
 for(const region of draft.regions){
  const mask=maskFromLedger(region.ledger);
  if(!region.topology)throw Error('Contour budget refusal; not an accepted vector result');
  assert.deepEqual(maskFromContours(region.topology),mask);
  const color=[1,3,5].map(i=>parseInt(region.color.slice(i,i+2),16));
  for(let k=0;k<mask.length;k++)if(mask[k]){
   assert.equal(union[k],0);union[k]=1;selected++;
   const j=k*4;if(Math.hypot(rgba[j]-color[0],rgba[j+1]-color[1],rgba[j+2]-color[2])>60)uncertain[k]=1;
  }
 }
 assert.deepEqual(union,sourceForegroundMask(rgba,w,h));
 let sourceVisible=0,sourceOpaque=0,excludedVisible=0,excludedOpaque=0;
 for(let k=0;k<union.length;k++){
  if(rgba[k*4+3]){sourceVisible++;if(!union[k])excludedVisible++;}
  if(rgba[k*4+3]===255){sourceOpaque++;if(!union[k])excludedOpaque++;}
 }
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'source-region-project.json'),saved+'\n');
 fs.writeFileSync(path.join(output,'automatic-source-geometry.svg'),api.geometrySvg(draft));
 fs.writeFileSync(path.join(output,'uncertainty.mask'),uncertain);
 const result={scope:'automatic_source_colour_partition_not_semantic_reconstruction',width:w,height:h,
  selectedPixels:selected,sourceVisiblePixels:sourceVisible,sourceOpaquePixels:sourceOpaque,
  excludedVisiblePixels:excludedVisible,excludedOpaquePixels:excludedOpaque,
  ...draft.summary,quantisation:draft.quantisation,maskContourRoundtripExact:true,
  saveLoadRoundtripExact:true,physicalResizePreservesGeometry:true,physical:draft.physical,
  machineEligible:false,blockers:draft.blockers,sourceHash:draft.source.sha256};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

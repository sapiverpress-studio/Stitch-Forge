/* MD-2.74 local-only staged-review data contract.
 * Strictly data-only. No images, upload endpoint, machine approval or paid AI.
 * The Python worker re-verifies every decision against the original plan.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.StitchStageReview=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const BUNDLE='stitch-forge-offline-stage-review-v1';
  const DECISION='stitch-forge-offline-stage-decisions-v1';
  const SHA=/^[a-f0-9]{64}$/;
  const ID=/^[0-9A-F]{6}-[0-9]+$/;
  function isObj(x){return x && typeof x==='object' && !Array.isArray(x)}
  function validate(bundle){
    if(!isObj(bundle)||bundle.schema!==BUNDLE||bundle.dataOnly!==true||
       bundle.originalImageIncluded!==false||bundle.machineApproved!==false||
       !SHA.test(bundle.sourcePlanSignature||'')||!SHA.test(bundle.sourceSha256||'')||
       !isObj(bundle.counts)||!Array.isArray(bundle.candidates)||bundle.candidates.length>35)
      throw Error('Not a bounded Stitch Forge offline review bundle');
    if(Object.keys(bundle.counts).sort().join('|')!=='running|satin|tatami')
      throw Error('Incorrect stage inventory');
    for(const n of Object.values(bundle.counts))
      if(!Number.isSafeInteger(n)||n<0||n>1500)throw Error('Invalid stitch-stage count');
    const seen=new Set();
    for(const c of bundle.candidates){
      if(!isObj(c)||!ID.test(c.sourceObjectId||'')||
         !['straight','curved'].includes(c.method)||
         !/^[#][0-9A-F]{6}$/.test(c.color||'')||
         c.sourceObjectId.slice(0,6)!==c.color.slice(1)||
         !Number.isFinite(c.estimatedFootprintAreaFraction)||
         c.estimatedFootprintAreaFraction<=0||
         c.estimatedFootprintAreaFraction>1.001||
         c.sourceGeometryStrictlyContained!==true||
         c.originalWorkingPixelsChanged!==false||
         c.fabricSewoutVerified!==false||
         seen.has(c.sourceObjectId))
        throw Error('Malformed or repeated satin source candidate');
      seen.add(c.sourceObjectId);
    }
    return bundle;
  }
  function createDecisions(bundle,selectedIds){
    validate(bundle);
    if(!Array.isArray(selectedIds)||selectedIds.length>35)throw Error('Invalid satin selections');
    const picks=new Set(selectedIds);
    if(picks.size!==selectedIds.length)throw Error('Repeated satin selection');
    const candidates=new Map(bundle.candidates.map(c=>[c.sourceObjectId,c]));
    for(const id of picks)if(!candidates.has(id))throw Error('Selection not in source review');
    const choices=[...picks].sort().map(id=>({sourceObjectId:id,method:candidates.get(id).method}));
    return {schema:DECISION,sourcePlanSignature:bundle.sourcePlanSignature,
            sourceSha256:bundle.sourceSha256,choices};
  }
  return {validate,createDecisions};
});

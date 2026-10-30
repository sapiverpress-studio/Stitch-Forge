/* Owner-downloadable geometry diagnostics. Memory only, no network or storage.
 * Images, headers, tokens, free-form model text and request bodies are excluded.
 * A replay requires the same privately held analysis pixels and runs locally.
 */
(function(root){
'use strict';
const project=root.StitchForgeSourceRegionProject||(typeof require==='function'?require('./source-region-project.js'):null);
const engine=root.StitchForgeAutoReconstruct||(typeof require==='function'?require('./auto-reconstruct.js'):null);
const SCHEMA='stitch-forge-private-reconstruction-diagnostic-v1',REVISION='MD-2.43';
const SEMANTICS=['wing_panel','wing_marking','wing_vein','body','head','antenna','leg','marking','outline','detail','other'];
const REASONS=['plan_shape_invalid','plan_validation_failed','no_regions_returned','region_limit_exceeded',
 'invalid_region','invalid_points','degenerate_outline','duplicate_id'];
const CODES=['line_not_supported_by_image_contrast','invalid_fill_outline','marking_colour_not_supported_by_pixels',
 'fill_not_supported_by_pixels','too_many_components','small_components_not_stitchable','fill_holes_not_supported',
 'could_not_reconstruct_boundary','simplification_lost_pixel_fidelity','unrepresented_fine_details',
 'low_confidence_regions','partial_running_centreline','uncovered_source_artwork','false_filled_background',
 'unrepresented_source_colours','unverified_auto_recovered_details'];
const code=value=>CODES.includes(value)?value:'check_failed';
function safePlan(plan){
 if(plan?.status!=='AI_GEOMETRY_PROPOSAL_NOT_STITCHED'||!Array.isArray(plan.regions)||
    !plan.regions.length||plan.regions.length>32)throw Error('No replayable validated geometry response');
 const ids=new Map();
 const regions=plan.regions.map(r=>{
  if(!r||typeof r.id!=='string'||r.id.length>60||!['fill','running'].includes(r.kind)||
     !SEMANTICS.includes(r.semantic)||!/^#[0-9a-f]{6}$/i.test(r.color)||
     !['high','medium','low'].includes(r.confidence)||!Number.isInteger(r.layer)||r.layer<0||r.layer>50||
     !Array.isArray(r.points)||r.points.length<(r.kind==='fill'?3:2)||r.points.length>32||
     !r.points.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<=1000&&p.y<=1000))
   throw Error('Geometry response cannot be safely captured');
  if(!ids.has(r.id))ids.set(r.id,'proposal-'+(ids.size+1));
  const id=ids.get(r.id);
  return {id,label:id,kind:r.kind,semantic:r.semantic,color:r.color.toUpperCase(),layer:r.layer,
   confidence:r.confidence,points:r.points.map(({x,y})=>({x,y}))};
 });
 const modelRejected=plan.model_rejected_count??0;
 if(!Number.isInteger(modelRejected)||modelRejected<0||modelRejected>32)throw Error('Invalid model rejection count');
 return {status:plan.status,regions,model_rejected_count:modelRejected};
}
function rejectionSummary(rejected,plan){
 return (rejected||[]).slice(0,128).map(r=>({
  region:Math.max(0,plan.regions.findIndex(p=>p.id===r.id)+1),reason:code(r.reason)}));
}
function assess(rgba,w,h,plan){
 let result=null,error=null,complete=false;
 try{
  result=engine.reconstruct(rgba,w,h,plan);
  engine.assertCompleteReconstruction(result,plan.model_rejected_count||0);complete=true;
 }catch(e){error=e;}
 const assessment={status:complete?'complete_geometry_only':result?'incomplete_geometry':'reconstruction_refused',
  retainedRegions:result?.regions.length||0,coverage:result?.quality.coverage??null,
  rejected:rejectionSummary(result?.rejected||error?.rejected,plan),
  autoRecoveredDetails:result?.quality.autoRecoveredDetails||0,
  fidelityBlockers:(result?.quality.blockers||[]).map(code)};
 return {result,error,assessment};
}
function serverSummary(response,httpStatus){
 const rejected=response?.diagnostics?.rejected_regions||response?.model_rejected_regions;
 return {httpStatus:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:0,
  code:['INVALID_MODEL_GEOMETRY','MODEL_TIMEOUT','MODEL_RESPONSE_INVALID','NOT_CONFIGURED','UNAUTHORIZED'].includes(response?.code)?response.code:null,
  rejectedRegions:(Array.isArray(rejected)?rejected:[])
   .slice(0,8).map(r=>({region:Number.isInteger(r?.region)&&r.region>=0&&r.region<=32?r.region:0,
    reason:REASONS.includes(r?.reason)?r.reason:'plan_validation_failed'}))};
}
async function captureAnalysis(rgba,w,h,response,{httpStatus=200}={}){
 const source={sha256:await project.fingerprint(rgba,w,h),width:w,height:h};
 const capture={schema:SCHEMA,algorithmRevision:REVISION,source,server:serverSummary(response,httpStatus),
  privacy:'GEOMETRY_ONLY_NO_IMAGE_OR_CREDENTIALS_KEEP_PRIVATE',machineEligible:false,
  plan:null,assessment:null,applicationStage:'not_applied'};
 if(httpStatus<200||httpStatus>=300){capture.assessment={status:'server_rejected'};return {capture,result:null,error:null};}
 try{capture.plan=safePlan(response);}
 catch{capture.assessment={status:'unreplayable_response'};return {capture,result:null,error:Error('Invalid geometry response; safe diagnostic recorded')};}
 // Run the actual received plan; aliases are used only in the saved copy.
 const evaluated=assess(rgba,w,h,response);capture.assessment=evaluated.assessment;
 return {...evaluated,capture};
}
function serialiseCapture(capture){
 // Rebuild every field through an allowlist, including imported diagnostics.
 const checked=parseCapture(JSON.stringify(capture));return JSON.stringify(checked,null,2);
}
function parseCapture(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>256000)throw Error('Oversized diagnostic');
 const value=JSON.parse(text);
 if(value?.schema!==SCHEMA||value.algorithmRevision!==REVISION||
    !/^[0-9a-f]{64}$/.test(value.source?.sha256||'')||
    !Number.isInteger(value.source.width)||!Number.isInteger(value.source.height)||
    value.source.width<48||value.source.height<48||value.source.width*value.source.height>750000)
  throw Error('Unsupported diagnostic version or source dimensions');
 const status=value.assessment?.status;
 if(!['server_rejected','unreplayable_response','complete_geometry_only','incomplete_geometry','reconstruction_refused'].includes(status))
  throw Error('Invalid diagnostic assessment');
 const plan=value.plan?safePlan(value.plan):null;
 if(!plan&&!['server_rejected','unreplayable_response'].includes(status))throw Error('Diagnostic geometry missing');
 let assessment={status};
 if(plan){
  const a=value.assessment;
  if(!Number.isInteger(a.retainedRegions)||a.retainedRegions<0||a.retainedRegions>128||
     (a.coverage!==null&&(!Number.isFinite(a.coverage)||a.coverage<0||a.coverage>1))||
     !Array.isArray(a.rejected)||a.rejected.length>128||!Array.isArray(a.fidelityBlockers)||a.fidelityBlockers.length>64||
     !Number.isInteger(a.autoRecoveredDetails)||a.autoRecoveredDetails<0||a.autoRecoveredDetails>128)
   throw Error('Invalid diagnostic counters');
  assessment={status,retainedRegions:a.retainedRegions,coverage:a.coverage,
   rejected:a.rejected.map(r=>{if(!Number.isInteger(r?.region)||r.region<0||r.region>32)throw Error('Invalid rejected region');
    return {region:r.region,reason:code(r.reason)};}),
   autoRecoveredDetails:a.autoRecoveredDetails,fidelityBlockers:a.fidelityBlockers.map(code)};
 }
 const applicationStage=['not_applied','editor_rejected','applied_geometry'].includes(value.applicationStage)?value.applicationStage:'not_applied';
 return {schema:SCHEMA,algorithmRevision:REVISION,
  source:{sha256:value.source.sha256,width:value.source.width,height:value.source.height},
  server:serverSummary({code:value.server?.code,diagnostics:{rejected_regions:value.server?.rejectedRegions||[]}},value.server?.httpStatus),
  privacy:'GEOMETRY_ONLY_NO_IMAGE_OR_CREDENTIALS_KEEP_PRIVATE',machineEligible:false,plan,assessment,applicationStage};
}
async function replayCapture(rgba,w,h,capture){
 const checked=parseCapture(JSON.stringify(capture));
 if(w!==checked.source.width||h!==checked.source.height||await project.fingerprint(rgba,w,h)!==checked.source.sha256)
  throw Error('Diagnostic belongs to different source pixels; replay blocked');
 if(!checked.plan)throw Error('This diagnostic contains no replayable model geometry');
 const evaluated=assess(rgba,w,h,checked.plan);
 return {assessment:evaluated.assessment,expected:checked.assessment,
  reproduced:JSON.stringify(evaluated.assessment)===JSON.stringify(checked.assessment),
  result:evaluated.result,machineEligible:false,status:'LOCAL_REPLAY_NOT_APPLIED'};
}
const api=Object.freeze({captureAnalysis,serialiseCapture,parseCapture,replayCapture});
root.StitchForgeReconstructionDiagnostics=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

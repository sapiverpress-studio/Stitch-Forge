/* Single-action AI reconstruction UI.
 * One deliberate click: model geometry -> original pixel-constrained boundaries
 * -> atomic editable design rebuild, with undo. No manual boundary tapping.
 */
(()=>{
"use strict";
const q=s=>document.querySelector(s),context=window.StitchForgeAIContext,host=q("#tracePanel"),canvasSvg=q("#design");
if(!context||!host||!canvasSvg)return;
const panel=document.createElement("section");
panel.className="ai-detail-panel";
panel.id="sfAutoPanel";
panel.innerHTML=[
 '<div class="ai-detail-head"><strong>Automatic artwork digitising</strong><small>Engineering trial</small></div>',
 '<label class="tiny" for="sfAutoWorkflow">Workflow</label><select id="sfAutoWorkflow"><option value="native">Source-based PES/DST trial · no OpenAI call</option><option value="ai">AI geometry proposal · experimental, uses API credits</option></select>',
 '<p class="tiny">Prepare colour shapes from the original pixels, generate real Ink/Stitch files and inspect independently decoded stitches. Trial files require review and have not been physically sewn.</p>',
 '<label class="tiny" for="sfNativeWidth">Full artwork image width (mm)</label><input id="sfNativeWidth" type="number" min="10" max="250" value="80" step="1" inputmode="decimal">',
 '<label class="tiny"><input id="sfNativeTexture" type="checkbox" checked> Allow measured simplification of tiny texture if geometry is too complex. Fine details may change.</label>',
 '<label for="sfAutoToken" class="tiny">Private access token (not saved)</label>',
 '<input id="sfAutoToken" type="password" autocomplete="off" placeholder="Your Stitch Forge analysis token">',
 '<div class="ai-actions"><button class="btn primary" id="sfAutoRun" type="button">Generate PES/DST trial automatically</button>',
 '<button class="btn" id="sfAutoCancelNative" type="button" disabled>Cancel</button>',
 '<button class="btn" type="button" id="sfAutoDownload" disabled>Download editable colour SVG</button>',
 '<button class="btn" type="button" id="sfAutoUndo" disabled>Undo reconstruction</button>',
 '<button class="btn" type="button" id="sfAutoNativeReport" disabled>Download actual machine report</button></div>',
 '<div class="ai-actions"><button class="btn" type="button" id="sfAutoNativeGeometry" disabled>Download editable Ink/Stitch SVG</button></div>',
 '<div class="ai-actions"><button class="btn" type="button" id="sfAutoDiagnostic" disabled>Download private diagnostic</button>',
 '<button class="btn" type="button" id="sfAutoReplay">Replay saved diagnostic locally</button></div>',
 '<input type="file" id="sfAutoReplayFile" accept="application/json,.json" hidden>',
 '<p class="tiny">Diagnostics contain proposed artwork geometry and rejection codes, without the image or access token. Keep them private. Replay uses the same original image and no AI credits.</p>',
 '<label class="toggle"><input id="sfAutoShow" type="checkbox" checked> Show result on the artwork</label>',
 '<p class="tiny" role="status" id="sfAutoStatus">Upload the original artwork, enter the private token and generate a trial. The source-based workflow uses no OpenAI request.</p>',
 '<p class="tiny">Reduced source pixels and proposed colour labels go only to your configured private native worker. App and worker must both support this workflow. No generated file is machine-approved, physically stitch-tested or approved for sale.</p>'
].join("");
host.prepend(panel);
const css=document.createElement("style");css.textContent=[
 "#sfAutoPanel{border:2px solid #90b9b1;background:#f8fbfa}",
 "#sfAutoStatus{border-left:3px solid #187a82;background:#edf7f5;padding:10px;margin:12px 0}",
 "#sfAutoOverlay path{stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none}",
 "#sfAutoPanel strong{font-size:1.05em}"
 ,"#sfAutoWorkflow,#sfNativeWidth{max-width:100%;box-sizing:border-box}"
 ,"#sfAutoReplayFile[hidden]{display:none!important}"
].join("\n");document.head.appendChild(css);
const overlay=document.createElementNS("http://www.w3.org/2000/svg","g");
overlay.setAttribute("id","sfAutoOverlay");
overlay.setAttribute("pointer-events","none");canvasSvg.appendChild(overlay);
const nativeOverlay=document.createElementNS('http://www.w3.org/2000/svg','g');nativeOverlay.id='sfNativeDecodedOverlay';nativeOverlay.setAttribute('pointer-events','none');canvasSvg.appendChild(nativeOverlay);
let last=null,diagnostic=null,running=false,revision=0,nativeResult=null,nativeAbort=null;
const status=s=>q("#sfAutoStatus").textContent=s;
function paint(){
 nativeOverlay.replaceChildren();overlay.replaceChildren();
 if(nativeResult){
  if(!q('#sfAutoShow').checked)return;const b=context.getBounds();if(!b)return;
  const mm=nativeResult.sourceDraft.physical.imageWidthMm,scale=b.w/mm;
  nativeOverlay.setAttribute('transform','translate('+(b.x-2*scale)+' '+(b.y-2*scale)+') scale('+scale+')');
  const p=nativeResult.preview,groups=p.palette.map(()=>[]);
  for(const [ax,ay,bx,by,index] of p.segments)groups[index].push('M'+ax+' '+ay+'L'+bx+' '+by);
  for(const [i,commands] of groups.entries()){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',commands.join(' '));path.setAttribute('stroke',p.palette[i]);path.setAttribute('fill','none');path.setAttribute('stroke-width','.15');path.setAttribute('data-evidence','actual-decoded-PES6');nativeOverlay.appendChild(path);}return;
 }
 if(!last||!q("#sfAutoShow").checked)return;
 const b=context.getBounds();if(!b)return;
 const ns="http://www.w3.org/2000/svg";
 for(const region of last.regions){
  const mapped=region.points.map(p=>[
    b.x+p[0]*b.w/last.width,b.y+p[1]*b.h/last.height
  ]);
  const path=document.createElementNS(ns,"path");
  path.setAttribute("d",mapped.map(([x,y],i)=>(i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)).join(" ")+(region.kind==="fill"?"Z":""));
  path.setAttribute("fill",region.kind==="fill"?region.color:"none");
  path.setAttribute("fill-opacity",region.kind==="fill"?"0.32":"0");
  path.setAttribute("stroke",region.color);
  path.setAttribute("stroke-width",region.kind==="fill"?"1.5":"2.4");
  if(region.requiresDigitisingReview)path.setAttribute("stroke-dasharray","4 3");
  overlay.appendChild(path);
 }
}
function clearNative(){if(nativeResult)context.setSourceRegionInspectionActive(false);nativeResult=null;nativeOverlay.replaceChildren();q('#sfAutoNativeReport').disabled=true;q('#sfAutoNativeGeometry').disabled=true;}
function saveBytes(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function invalidateNative(){revision++;nativeAbort?.abort();clearNative();q('#sfAutoDownload').disabled=!last;q('#sfAutoUndo').disabled=!last;q('#sfAutoDownload').textContent='Download editable colour SVG';status('Artwork settings changed. Previous native result cleared; generate again when ready.');}
q('#sfAutoWorkflow').onchange=()=>{invalidateNative();q('#sfAutoRun').textContent=q('#sfAutoWorkflow').value==='native'?'Generate PES/DST trial automatically':'Reconstruct AI geometry proposal';status(q('#sfAutoWorkflow').value==='native'?'Source-based trial: reduced pixels go to the private native worker. No OpenAI call.':'AI geometry proposals use API credits and are not machine-approved stitch plans.');};
q('#sfNativeWidth').onchange=invalidateNative;q('#sfNativeTexture').onchange=invalidateNative;
q('#sfAutoCancelNative').onclick=()=>{invalidateNative();status('Native generation cancelled. No further phase will be requested.');};
q('#sfAutoNativeReport').onclick=()=>{if(nativeResult)saveBytes(JSON.stringify(nativeResult.report,null,2),'stitch-forge-machine-report-PRIVATE-NOT-APPROVED.json','application/json');};
q('#sfAutoNativeGeometry').onclick=()=>{if(nativeResult)saveBytes(nativeResult.geometry,'stitch-forge-editable-native-TRIAL-NOT-APPROVED.svg','image/svg+xml');};
q("#sfAutoShow").onchange=paint;
async function decoded(src,maxDim){
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("Cannot decode original artwork"));image.src=src;});
 if(image.naturalWidth*image.naturalHeight>45000000)throw Error("Image resolution too large");
 const scale=Math.min(1,maxDim/Math.max(image.naturalWidth,image.naturalHeight));
 const cvs=document.createElement("canvas");
 cvs.width=Math.round(image.naturalWidth*scale);
 cvs.height=Math.round(image.naturalHeight*scale);
 if(cvs.width<48||cvs.height<48)throw Error('Source is too narrow for bounded analysis; no aspect-ratio stretching was applied');
 const ctx=cvs.getContext("2d",{willReadFrequently:true});
 ctx.clearRect(0,0,cvs.width,cvs.height);ctx.drawImage(image,0,0,cvs.width,cvs.height);
 return {canvas:cvs,ctx};
}
async function modelImage(source){
 const {canvas,ctx}=await decoded(source,1000);
 // White background is only for AI vision; original alpha/RGB is retained locally
 // for geometry clipping and is never swapped into the editable project.
 const base=document.createElement("canvas");base.width=canvas.width;base.height=canvas.height;
 const out=base.getContext("2d");out.fillStyle="#fff";out.fillRect(0,0,base.width,base.height);
 out.drawImage(canvas,0,0);
 const data=base.toDataURL("image/jpeg",.82);
 if(data.length>2100000)throw Error("Image too large for the vision endpoint");
 return data;
}
q("#sfAutoRun").onclick=async()=>{
 if(running)return;
 const source=context.getImage();if(!source){status("Upload the original detailed image first.");return;}
 if(context.getSourceStatus()!=="original"){
  status("Re-upload the original artwork to reconstruct. A restored project contains only a reduced trace reference, not the original colours and fine detail. Existing design unchanged.");return;
 }
 const token=q("#sfAutoToken").value.trim()||q("#sfAiToken")?.value.trim();
 if(!token){status("Enter your private analysis token (not your OpenAI API key).");return;}
 if(q('#sfAutoWorkflow').value==='native'){
  const api=window.StitchForgeArtworkPipeline,stamp=revision,width=Number(q('#sfNativeWidth').value),texturePolicy=q('#sfNativeTexture').checked?'if_needed':'off';
  if(!api){status('Source-native pipeline unavailable; reload the current app. No AI request was made.');return;}
  running=true;q('#sfAutoRun').disabled=true;q('#sfAutoCancelNative').disabled=false;nativeAbort=new AbortController();
  const current=()=>revision===stamp&&context.getImage()===source;
  status('Preparing source pixels and colour shapes locally…');
  try{
   const original=new Image();await new Promise((yes,no)=>{original.onload=yes;original.onerror=no;original.src=source;});
   // Native fill detail is physically bounded. Attempt the finest reasonable
   // resolution first, then reduce *analysis* resolution if there are still too
   // many unsewable working parts. Never resize the physical embroidery width.
   // Raw analysis pixels and the exact foreground remain independently bound
   // in each source packet; the reference image stays untouched in the editor.
   const attempts=api.analysisSizes(width,original.naturalWidth,original.naturalHeight,texturePolicy);
   let packed=null,analysisPixels=null;
   for(const size of [...new Set(attempts)]){
    if(!current()||nativeAbort.signal.aborted)throw Error('Cancelled: original artwork or settings changed');
    status('Preparing source-bound colour regions at '+size+' analysis pixels (longest side); protecting the silhouette and contrasting details…');
    const {canvas,ctx}=await decoded(source,size);
    try{
     packed=await api.pack(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,
      {imageWidthMm:width,originalWidth:original.naturalWidth,originalHeight:original.naturalHeight,
       texturePolicy,maxWorkingParts:1500});
     analysisPixels=canvas.width+' × '+canvas.height;
     break;
    }catch(error){
     if(texturePolicy==='off'||(error.code!=='SOURCE_DETAIL_BUDGET'&&
       !/^(Object plan exceeds source-component budget|Source (graph|regions) exceed)/.test(error.message||'')))throw error;
     if(!current())throw Error('Original artwork changed during preparation');
    }
   }
   if(!packed)throw Error('Detailed regions remain beyond the native trial budget at this physical size. The original image is unchanged; no machine file was produced');
   const result=await api.generate(packed,{token,signal:nativeAbort.signal,isCurrent:current,onProgress:text=>{if(current())status(text);}});
   if(!current())throw Error('Source or size changed; stale result discarded');
   window.dispatchEvent(new Event('stitchforge:source-inspection-ended'));nativeResult=result;q('#sfAutoShow').checked=true;context.setSourceRegionInspectionActive(true);paint();
   q('#sfAutoDownload').disabled=false;q('#sfAutoDownload').textContent='Download PES/DST trial ZIP';q('#sfAutoNativeReport').disabled=false;q('#sfAutoNativeGeometry').disabled=false;q('#sfAutoUndo').disabled=false;
   const r=result.report,d=r.decoded.find(x=>x.format==='pes');
   status('Source-aware preparation '+analysisPixels+' ('+packed.plan.summary.workingParts+' working colour shapes; original upload preserved). Real Ink/Stitch PES6/DST generated: '+d.needleStitches.toLocaleString('en-GB')+' needle stitches; '+d.colourChanges+' colour changes. Actual decoded stitches are shown. '+r.unresolvedObjects.toLocaleString('en-GB')+' tiny/short details remain unresolved; '+d.trims.toLocaleString('en-GB')+' PES trims. Review the likeness, fine details, stitch directions and travel in the machine report. Not machine-approved or physically stitched. ZIP downloaded.');
   saveBytes(result.bytes,'stitch-forge-artwork-TRIAL-NOT-APPROVED.zip','application/zip');
  }catch(error){if(current())status('Native artwork trial unavailable: '+(error.message||error)+'. No OpenAI request or substitute machine file was produced.');}
  finally{running=false;nativeAbort=null;q('#sfAutoRun').disabled=false;q('#sfAutoCancelNative').disabled=true;}return;
 }
 if(!window.StitchForgeAutoReconstruct){status("Automatic reconstruction engine missing; no changes made.");return;}
 const diagnostics=window.StitchForgeReconstructionDiagnostics;
 if(!diagnostics){status('Local diagnostic module missing; reload before using AI analysis.');return;}
 const analysisRevision=revision;
 running=true;q("#sfAutoRun").disabled=true;
 diagnostic=null;q('#sfAutoDiagnostic').disabled=true;
 status("OpenAI is proposing visible colour areas and line details. The existing design remains unchanged until geometry passes validation.");
 try{
  // One local, free pixel scan per click. Reuse these exact image pixels
  // after the single AI call; never upload the audit or make a second call.
  const {canvas,ctx}=await decoded(source,768);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const inspection=window.StitchForgeAutoReconstruct.analyseArtwork(rgba,canvas.width,canvas.height);
  status("Local artwork scan: "+inspection.palette.length+" prominent colour groups, "+
   inspection.detailLevel+" edge detail. Preparing one AI request...");
  const image=await modelImage(source);
  const response=await fetch("/api/reconstruct-embroidery",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
   body:JSON.stringify({image}),cache:"no-store"
  });
  let plan;try{plan=await response.json();}catch{
   const captured=await diagnostics.captureAnalysis(rgba,canvas.width,canvas.height,{}, {httpStatus:response.status});
   diagnostic=captured.capture;q('#sfAutoDiagnostic').disabled=false;
   throw Error("Reconstruction service response unreadable (HTTP "+response.status+")");
  }
  const evaluation=await diagnostics.captureAnalysis(rgba,canvas.width,canvas.height,plan,{httpStatus:response.status});
  diagnostic=evaluation.capture;q('#sfAutoDiagnostic').disabled=false;
  if(!response.ok){
   const details=plan.code==="INVALID_MODEL_GEOMETRY"?
    window.StitchForgeAutoReconstruct.formatModelRejectionDiagnostics(plan.diagnostics):"";
   throw Error((plan.error||"AI reconstruction failed")+details+(plan.code?" ["+plan.code+"]":""));
  }
  if(plan.status!=="AI_GEOMETRY_PROPOSAL_NOT_STITCHED")throw Error("Invalid geometry response");
  const modelRejectionDetails=window.StitchForgeAutoReconstruct.formatModelRejectionDiagnostics({
   rejected_regions:plan.model_rejected_regions||[],additional_rejections:plan.model_rejected_additional||0
  });
  status("AI returned "+plan.regions.length+" usable proposed regions"+(plan.model_rejected_count?" ("+plan.model_rejected_count+" unsupported proposals held out)":"")+modelRejectionDetails+" Checking artwork pixels and preparing closed fills...");
  if(evaluation.error)throw evaluation.error;
  const result=evaluation.result;
  // Never replace the user's design with a tiny, partial AI result. The
  // 97% floor matches the source-pixel audit's existing 3% missing-pixel limit.
  window.StitchForgeAutoReconstruct.assertCompleteReconstruction(result,plan.model_rejected_count||0);
  // Proposed centreline and satin-rail geometry is not machine-ready.
  let candidateSummary="";
  if(result.quality.autoRecoveredDetails&&window.StitchForgeStitchClassifier){
   const classes=window.StitchForgeStitchClassifier.classifyDraft(result.regions,context.getWidthMm());
   result.stitchScaleMmPerPixel=classes.scaleMmPerPixel;
   const counts={running_candidate:0,satin_candidate:0,fill_candidate:0,manual_review:0};
   result.regions.forEach((region,n)=>{
    if(!region.requiresDigitisingReview)return;
    region.stitchCandidate=classes.regions[n];
    counts[region.stitchCandidate.candidate]++;
   });
   candidateSummary=" Provisional stitch categories: "+counts.running_candidate+" running, "+
    counts.satin_candidate+" satin, "+counts.fill_candidate+" fill, "+counts.manual_review+
    " need review. No machine approval.";
  }
  // These are validated preview rails/rungs, NOT approved native stitches.
  if(result.quality.autoRecoveredDetails&&window.StitchForgeSatinGeometry){
   let accepted=0,refused=0;
   for(const region of result.regions){
    if(region.stitchCandidate?.candidate!=="satin_candidate"||
       !region.stitchCandidate.proposedRails)continue;
    const geometry=window.StitchForgeSatinGeometry.validateRails(
      region.stitchCandidate.proposedRails,result.stitchScaleMmPerPixel);
    region.satinRungPreview=geometry;
    if(geometry.accepted)accepted++;else refused++;
   }
   candidateSummary+=" Satin rail/rung geometry: "+accepted+" bounded preview(s), "+
    refused+" refused. No machine approval.";
  }
  // End-to-end validation finishes BEFORE mutating the editor.
  const proposed={...result,width:canvas.width,height:canvas.height};
  if(revision!==analysisRevision||context.getImage()!==source)
   throw Error("Artwork or design changed during analysis; stale reconstruction discarded");
  diagnostic.applicationStage='editor_rejected';
  const summary=context.replaceWithAutomaticReconstruction(proposed);
  diagnostic.applicationStage='applied_geometry';
  last=proposed;paint();
  q("#sfAutoDownload").disabled=false;q("#sfAutoUndo").disabled=false;
  const summaryText="Local scan: "+inspection.palette.length+" colour groups; "+
   inspection.detailLevel+" edge detail. Automatically rebuilt "+summary.regions+" image-grounded regions ("+
    result.regions.filter(r=>r.kind==="fill").length+" fills, "+
    result.regions.filter(r=>r.kind==="running").length+" lines; "+
    result.rejected.length+" rejected). "+summary.colors+" proposed colours. Source coverage: "+Math.round(result.quality.coverage*100)+"%."+modelRejectionDetails+
    (result.quality.autoRecoveredDetails?" Locally recovered "+result.quality.autoRecoveredDetails+" unclassified colour details (dashed outlines, geometry only; machine export blocked pending stitch planning)."+candidateSummary:"");
  // The second stage is automatic. Only editable geometric paths and colours
  // leave the browser; no source raster, AI credentials or model proposals.
  // The endpoint returns a ZIP only after native Ink/Stitch + independent audit.
  const machineProject=context.exportMachineProject();
  const machineRevision=JSON.stringify(machineProject),machineGeneration=revision;
  status(summaryText+" Checking independently audited PES/DST engine...");
  try{
   if(!result.quality?.machineEligible)throw Error('Source fidelity check blocked automatic machine export: '+(result.quality?.blockers||['audit_missing']).join(', '));
   if(result.rejected.length||plan.model_rejected_count)throw Error("Incomplete reconstruction: "+(result.rejected.length+(plan.model_rejected_count||0))+" regions were not validated; automatic machine export blocked");
   const machine=await fetch("/api/machine-embroidery",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:machineRevision,cache:"no-store"
   });
   if(!machine.ok){
    let detail;try{detail=await machine.json();}catch{}
    throw Error(detail?.error||"Native engine unavailable (HTTP "+machine.status+")");
   }
   if(machine.headers.get("x-stitch-forge-audit")!=="STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED"||
      !machine.headers.get("content-type")?.startsWith("application/zip"))
    throw Error("Independent stitch-file audit missing");
   const blob=await machine.blob();
   if(blob.size<100||blob.size>3000000)throw Error("Unexpected machine ZIP size");
   // Never silently supply an older file after the user edits the design.
   if(revision!==machineGeneration||JSON.stringify(context.exportMachineProject())!==machineRevision)
    throw Error("Design changed during engine run; stale machine ZIP discarded");
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="stitch-forge-machine-files-UNTESTED.zip";
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
   status(summaryText+" Native Ink/Stitch generated independently decoded PES/DST. ZIP downloaded automatically. These files are NOT physically stitch-tested; inspect and test on fabric before machine use.");
  }catch(engineError){
   status(summaryText+" Editable SVG and Undo remain available. Native PES/DST not generated: "+String(engineError?.message||engineError)+". No substitute machine files were produced.");
  }
 }catch(error){
  status("Reconstruction not applied: "+String(error?.message||error)+". Existing design is unchanged.");
 }finally{running=false;q("#sfAutoRun").disabled=false;}
};
q("#sfAutoDownload").onclick=()=>{
 if(nativeResult){saveBytes(nativeResult.bytes,'stitch-forge-artwork-TRIAL-NOT-APPROVED.zip','application/zip');return;}
 if(!last)return;
 try{
  const svg=context.exportEditableSvg();
  const file=new Blob([svg],{type:"image/svg+xml"});
  const url=URL.createObjectURL(file),link=document.createElement("a");
  link.href=url;link.download="stitch-forge-auto-reconstruction-EXPERIMENTAL.svg";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 }catch(error){status("SVG export unavailable: "+String(error?.message||error));}
};
q('#sfAutoDiagnostic').onclick=()=>{
 if(!diagnostic)return;
 try{
  const text=window.StitchForgeReconstructionDiagnostics.serialiseCapture(diagnostic);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='stitch-forge-reconstruction-diagnostic-PRIVATE.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(error){status('Diagnostic download unavailable: '+error.message);}
};
q('#sfAutoReplay').onclick=()=>{if(!running)q('#sfAutoReplayFile').click();};
q('#sfAutoReplayFile').onchange=async()=>{
 const file=q('#sfAutoReplayFile').files?.[0];q('#sfAutoReplayFile').value='';if(!file||running)return;
 const source=context.getImage(),startRevision=revision;
 if(!source||context.getSourceStatus()!=='original'){status('Upload the same original image before local replay.');return;}
 running=true;q('#sfAutoRun').disabled=true;
 try{
  if(file.size>256000)throw Error('Diagnostic file is too large');
  const diagnostics=window.StitchForgeReconstructionDiagnostics;
  if(!diagnostics)throw Error('Local diagnostic module missing');
  const capture=diagnostics.parseCapture(await file.text()),{canvas,ctx}=await decoded(source,768);
  const replay=await diagnostics.replayCapture(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,capture);
  if(revision!==startRevision||context.getImage()!==source)throw Error('Artwork changed during replay; stale result discarded');
  diagnostic=capture;q('#sfAutoDiagnostic').disabled=false;
  status('Local replay '+(replay.reproduced?'reproduced the saved result':'differs from the saved result; investigate before export')+
   ': '+replay.assessment.retainedRegions+' retained regions, '+(100*(replay.assessment.coverage||0)).toFixed(1)+
   '% source coverage, '+replay.assessment.rejected.length+' rejected regions. No AI request, editor change or machine file.');
 }catch(error){status('Local replay blocked: '+error.message+'. Existing design is unchanged.');}
 finally{running=false;q('#sfAutoRun').disabled=false;}
};
q("#sfAutoUndo").onclick=()=>{
 if(nativeResult){clearNative();q('#sfAutoDownload').disabled=true;q('#sfAutoUndo').disabled=true;status('Native result closed. Earlier editable paths are restored; the downloaded trial remains unapproved.');return;}
 const btn=q("#undoBtn");if(!btn||btn.disabled){status("No reconstruction undo available.");return;}
 btn.click();last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;
 q("#sfAutoUndo").disabled=true;status("Reconstruction undone. Previous editable design restored.");
};
window.addEventListener("stitchforge:design-changed",()=>{
 const hadNative=!!nativeResult||!!nativeAbort;revision++;nativeAbort?.abort();clearNative();
 if(hadNative){q('#sfAutoDownload').disabled=true;q('#sfAutoUndo').disabled=true;status('Design changed. Native generation/result cleared; no stale files will be downloaded.');}
 if(!last)return;
 last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;q("#sfAutoUndo").disabled=true;
 status("Design changed. The previous AI overlay is no longer presented as current geometry; use normal Undo or reconstruct again.");
});
window.addEventListener("stitchforge:image-imported",()=>{
 revision++;nativeAbort?.abort();clearNative();
 diagnostic=null;q('#sfAutoDiagnostic').disabled=true;
 last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;q("#sfAutoUndo").disabled=true;
 status("Artwork ready. Reconstruct automatically when you choose.");
});
})();

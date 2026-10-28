/* Stitch Forge — optional OpenAI-assisted region MAP, not completed digitising.
 * Loaded after the base editor. Reference images are submitted only on user action.
 * Access token is held in the input only: never stored, exported or logged.
 */
(() => {
"use strict";
const get = s => document.querySelector(s);
const editor = window.StitchForgeAIContext;
const tracePanel = get("#tracePanel");
if (!editor || !tracePanel) return;
let analysis = null, selectedId = null, draft = null, draftApplied = false;
const div = document.createElement("section");
div.className = "ai-detail-panel";
div.innerHTML =
  '<div class="ai-detail-head"><strong>AI artwork detail map</strong><small>Experimental · review required</small></div>'+
  '<p class="tiny">Find wing markings, veins, body segments and other visible parts that outline tracing misses. This sends your reference image to OpenAI on your request. It does <b>not</b> create finished embroidery stitches.</p>'+
  '<label class="tiny" for="sfAiToken">Analysis access token (not saved)</label>'+
  '<input id="sfAiToken" type="password" autocomplete="off" placeholder="Private analysis token">'+
  '<div class="ai-actions"><button type="button" class="btn primary" id="sfAiAnalyse">Analyse artwork details</button>'+
  '<button type="button" class="btn" id="sfAiExport" disabled>Download detail report</button></div>'+
  '<div class="ai-actions"><button type="button" class="btn" id="sfAiLoadReport">Use saved AI report</button>'+
  '<input type="file" accept=".json,application/json" id="sfAiReportFile" hidden>'+
  '<button type="button" class="btn" id="sfAiRebuild" disabled>Rebuild draft details</button>'+
  '<button type="button" class="btn primary" id="sfAiApply" disabled>Apply draft to stitches</button></div>'+
  '<div id="sfAiDraftStatus" class="tiny">AI rectangles locate parts; only actual image lines can become draft stitches.</div>'+
  '<div id="sfAiStatus" role="status" class="tiny">The original image stays visible; machine-file exports remain experimental.</div>'+
  '<label class="toggle"><input id="sfAiBoxes" type="checkbox"> Show AI search boxes (not stitches)</label>'+
  '<div id="sfAiResults" class="ai-detail-results"></div>';
tracePanel.appendChild(div);

const styles = document.createElement("style");
styles.textContent = [
".ai-detail-panel{margin-top:14px;padding:14px;border:1px solid #b9d0cb;border-radius:12px;background:#fff}",
".ai-detail-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}",
".ai-detail-head small{color:#58777c}",
".ai-detail-panel input{display:block;min-height:42px;width:100%;margin:7px 0 10px;padding:9px;border:1px solid #a9c3bc;border-radius:8px}",
".ai-actions{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}",
".ai-detail-results{max-height:340px;overflow:auto}",
".ai-detail-item{width:100%;border:1px solid #dce6e2;background:#f6faf9;border-radius:8px;padding:9px;text-align:left;display:flex;gap:8px;margin:6px 0}",
".ai-detail-item.active{outline:2px solid #dd9358}",
".ai-detail-swatch{width:17px;height:17px;flex:none;border:1px solid #999;border-radius:4px}",
".ai-detail-item small{display:block;color:#476568}",
"#sfAiStatus{padding:8px 0;color:#445e63}",
"#sfAiOverlay rect{fill:none;stroke:#c96b37;stroke-width:2.5;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}",
"#sfAiOverlay text{fill:#17373e;stroke:#fff;stroke-width:3;paint-order:stroke;stroke-linejoin:round;font-size:11px;font-weight:bold;pointer-events:none}",
"#sfAiOverlay rect.active{stroke:#f04f18;stroke-width:4}",
"#sfAiDraftPaths polyline{fill:none;stroke:#bd2d71;stroke-width:1.7;vector-effect:non-scaling-stroke;pointer-events:none}",
"#sfAiDraftStatus{border-left:3px solid #bd2d71;padding:6px 10px;background:#fdf2f8;margin:9px 0}"
].join("\n");
document.head.appendChild(styles);

const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
overlay.setAttribute("id", "sfAiOverlay");
overlay.setAttribute("pointer-events", "none");
get("#design").appendChild(overlay);
const draftOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
draftOverlay.setAttribute("id","sfAiDraftPaths");
draftOverlay.setAttribute("pointer-events","none");
get("#design").appendChild(draftOverlay);
const status = text => { get("#sfAiStatus").textContent = text; };
get("#sfAiBoxes").addEventListener("change",paint);
function sourceMessage() { const origin = editor.getSourceStatus?.(); return origin === 'original' ? 'Artwork loaded and ready for analysis.' : origin === 'restored-preview' ? 'Saved moth reference restored and ready for analysis. Re-upload the original for the best detail if needed.' : 'Upload artwork first using Upload artwork / project above.'; }
status(sourceMessage());
function paint() {
 overlay.replaceChildren();
 if (!analysis) return;
 const showAll=get("#sfAiBoxes").checked;
 if(!showAll&&!selectedId)return;
 const bounds = editor.getBounds();
 if (!bounds) return;
 analysis.regions.forEach((r,i) => {
   if(!showAll&&r.id!==selectedId)return;
   const b=r.bbox, x=bounds.x+b.x_min*bounds.w/1000, y=bounds.y+b.y_min*bounds.h/1000;
   const w=(b.x_max-b.x_min)*bounds.w/1000,h=(b.y_max-b.y_min)*bounds.h/1000;
   const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
   for(const [name,val] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(name,String(val));
   if(selectedId===r.id)rect.classList.add("active");
   overlay.appendChild(rect);
   const label=document.createElementNS("http://www.w3.org/2000/svg","text");
   label.setAttribute("x",String(x+2));label.setAttribute("y",String(Math.max(10,y-4)));
   label.textContent=String(i+1);overlay.appendChild(label);
 });
}
function render() {
 const list=get("#sfAiResults");
 list.replaceChildren();
 if (!analysis) return;
 const head=document.createElement("p");head.className="tiny";
 head.textContent=analysis.regions.length+" proposed parts. These boxes are approximate: inspect each against the original.";
 list.appendChild(head);
 analysis.regions.forEach((r,i)=>{
   const b=document.createElement("button");b.type="button";
   b.className="ai-detail-item"+(selectedId===r.id?" active":"");
   const swatch=document.createElement("span");swatch.className="ai-detail-swatch";
   swatch.style.backgroundColor=r.suggested_color;
   const label=document.createElement("span");
   const strong=document.createElement("strong");strong.textContent=(i+1)+". "+r.label;
   const small=document.createElement("small");
   small.textContent=r.category.replaceAll("_"," ")+" · "+r.suggested_stitch+" (proposed) · "+r.confidence+" confidence";
   const note=document.createElement("small");note.textContent=r.notes;
   label.append(strong,small,note);b.append(swatch,label);
   b.onclick=()=>{selectedId=r.id;render();};
   list.appendChild(b);
 });
 const missing=[...analysis.overlooked_details,...analysis.warnings];
 if(missing.length){const p=document.createElement("p");p.className="tiny";p.textContent="Review: "+missing.join(" • ");list.appendChild(p);}
 paint();
}

function setDraftStatus(text){get("#sfAiDraftStatus").textContent=text;}
function clearDraft(){
 draft=null;draftApplied=false;draftOverlay.replaceChildren();
 get("#sfAiApply").disabled=true;get("#sfAiRebuild").disabled=!analysis;
}
function reviewedReport(data){
 if(!data||data.status!=="REGION_PROPOSAL_NOT_DIGITISED"||data.requires_human_review!==true||
    !Array.isArray(data.regions)||data.regions.length<1||data.regions.length>24)throw Error('Not a valid Stitch Forge AI region report');
 for(const region of data.regions){
  const box=region?.bbox;
  if(!box||!['x_min','y_min','x_max','y_max'].every(k=>Number.isInteger(box[k])&&box[k]>=0&&box[k]<=1000)||
     box.x_min>=box.x_max||box.y_min>=box.y_max||
     !['wing_marking','wing_vein','wing','outer','body','antenna','leg','other'].includes(region.category))throw Error('Invalid AI report coordinates');
 }
 return data;
}
async function prepareDraft(){
 clearDraft();
 if(!analysis)return;
 if(!window.StitchForgeDetailGuides)throw Error('Internal detail extractor did not load');
 const src=editor.getImage(),bounds=editor.getBounds();
 if(!src||!bounds||!Number.isFinite(bounds.w)||bounds.w<=0||!Number.isFinite(bounds.h)||bounds.h<=0)
  throw Error('Upload the original artwork to rebuild stitch details');
 const im=new Image();
 await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('Reference image cannot be decoded'));im.src=src;});
 const scale=Math.min(1,512/Math.max(im.naturalWidth,im.naturalHeight));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(48,Math.round(im.naturalWidth*scale));
 canvas.height=Math.max(48,Math.round(im.naturalHeight*scale));
 const context=canvas.getContext('2d',{willReadFrequently:true});
 context.clearRect(0,0,canvas.width,canvas.height);
 context.drawImage(im,0,0,canvas.width,canvas.height);
 draft=window.StitchForgeDetailGuides.buildDraft(context.getImageData(0,0,canvas.width,canvas.height).data,
  canvas.width,canvas.height,analysis.regions,editor.getWidthMm(),{maxGuides:80});
 draftApplied=false;
 get("#sfAiApply").disabled=draft.paths.length===0;
 get("#sfAiRebuild").disabled=false;
 const covered=new Set(draft.paths.map(p=>p.regionId)).size;
 setDraftStatus(draft.paths.length
  ?'Found '+draft.paths.length+' provisional internal running paths in '+covered+' areas. Pink lines follow image pixels, not AI boxes. Review, then tap Apply draft to stitches. Wing fills and satin remain unconverted.'
  :'No reliable internal lines detected. Use the original detailed image or adjust the artwork; no stitch paths were changed.');
 paintDraft();
}
function paintDraft(){
 draftOverlay.replaceChildren();
 const bounds=editor.getBounds();
 if(!draft||!bounds||draftApplied)return;
 for(const p of draft.paths){
  const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  line.setAttribute('points',p.points.map(q=>
   (bounds.x+q[0]*bounds.w/draft.width).toFixed(2)+','+
   (bounds.y+q[1]*bounds.h/draft.height).toFixed(2)).join(' '));
  draftOverlay.appendChild(line);
 }
}
get("#sfAiRebuild").onclick=async()=>{
 try{setDraftStatus('Extracting visible line detail from artwork...');await prepareDraft();}
 catch(error){clearDraft();setDraftStatus(String(error.message||error));}
};
get("#sfAiApply").onclick=()=>{
 if(!draft||!draft.paths.length||draftApplied)return;
 const b=editor.getBounds();
 if(!b){setDraftStatus('Image position unavailable');return;}
 const paths=draft.paths.map(p=>p.points.map(q=>[
  b.x+q[0]*b.w/draft.width,b.y+q[1]*b.h/draft.height
 ]));
 try{
  const out=editor.appendReviewedGuides(paths);
  draftApplied=true;get("#sfAiApply").disabled=true;draftOverlay.replaceChildren();
  setDraftStatus(out.count+' draft running-stitch paths added to the editable design. Use Play stitches to inspect, and Undo to revert. THESE ARE EXPERIMENTAL, NOT APPROVED MACHINE FILES.');
 }catch(error){setDraftStatus('Cannot apply draft: '+String(error.message||error));}
};
get("#sfAiLoadReport").onclick=()=>get("#sfAiReportFile").click();
get("#sfAiReportFile").onchange=async ev=>{
 const file=ev.target.files?.[0];ev.target.value='';
 if(!file)return;
 if(file.size>100000){setDraftStatus('AI report too large');return;}
 try{
  const data=reviewedReport(JSON.parse(await file.text()));
  analysis=data;selectedId=null;clearDraft();render();
  status('Loaded '+data.regions.length+' AI-proposed areas from your report. No new OpenAI call or charge.');
  await prepareDraft();
 }catch(error){setDraftStatus('Report not accepted: '+String(error.message||error));}
};

async function imageForAnalysis(source) {
 const image=new Image();
 await new Promise((resolve,reject)=>{
   image.onload=resolve;image.onerror=()=>reject(Error("Unable to decode reference artwork"));
   image.src=source;
 });
 if(image.naturalWidth*image.naturalHeight>45000000)throw Error("Image resolution too large");
 const max=1000,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
 canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext("2d");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const data=canvas.toDataURL("image/jpeg",.84);
 if(data.length>2100000)throw Error("Image too large for analysis");
 return data;
}
get("#sfAiAnalyse").onclick=async()=>{
 const source=editor.getImage();
 if(!source){status('No reference image is available. Use Upload artwork / project above.');return;}
 const token=get("#sfAiToken").value.trim();
 if(!token){status("Enter your configured private analysis access token.");return;}
 const btn=get("#sfAiAnalyse");btn.disabled=true;
 status("Analysing internal artwork details. No stitches will be changed.");
 try{
   const image=await imageForAnalysis(source);
   const response=await fetch("/api/analyse-embroidery",{
     method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
     body:JSON.stringify({image}),cache:"no-store"
   });
   let result;
   try{result=await response.json();}
   catch{throw Error("Analysis service returned an unreadable response (HTTP "+response.status+").");}
   if(!response.ok)throw Error((result.error||"Image analysis failed")+(result.code?" ["+result.code+"]":""));
   if(result.status!=="REGION_PROPOSAL_NOT_DIGITISED"||!Array.isArray(result.regions))
     throw Error("Invalid region map");
   analysis=reviewedReport(result);selectedId=null;get("#sfAiExport").disabled=false;render();
   status("Identified "+result.regions.length+" regions. Preparing draft lines from original artwork...");
   try{await prepareDraft();}catch(error){setDraftStatus("Could not prepare line draft: "+String(error.message||error));}
   status("AI found "+result.regions.length+" visible parts. Pink lines are only draft running stitches; review before applying.");
 }catch(error){status(String(error.message||error));}
 finally{btn.disabled=false;}
};
get("#sfAiExport").onclick=()=>{
 if(!analysis)return;
 const content=JSON.stringify(analysis,null,2);
 const link=document.createElement("a");
 const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));
 link.href=url;link.download="Stitch-Forge-region-proposal-NOT-DIGITISED.json";link.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
};
window.addEventListener("stitchforge:image-imported",()=>{
 analysis=null;selectedId=null;get("#sfAiExport").disabled=true;
 clearDraft();get("#sfAiResults").replaceChildren();overlay.replaceChildren();
 setDraftStatus("Load a saved AI report or analyse the artwork to build a new draft.");
 status(sourceMessage());
});
})();

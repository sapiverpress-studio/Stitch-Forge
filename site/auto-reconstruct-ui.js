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
 '<div class="ai-detail-head"><strong>Automatic AI embroidery reconstruction</strong><small>Experimental</small></div>',
 '<p class="tiny">Rebuild wings, body sections and visible internal lines from the original artwork. AI proposes the shapes; the program checks fill areas against image pixels. No boundary tracing required.</p>',
 '<label for="sfAutoToken" class="tiny">Private analysis access token (not saved)</label>',
 '<input id="sfAutoToken" type="password" autocomplete="off" placeholder="Your Stitch Forge analysis token">',
 '<div class="ai-actions"><button class="btn primary" id="sfAutoRun" type="button">Reconstruct embroidery automatically</button>',
 '<button class="btn" type="button" id="sfAutoDownload" disabled>Download editable colour SVG</button>',
 '<button class="btn" type="button" id="sfAutoUndo" disabled>Undo reconstruction</button></div>',
 '<label class="toggle"><input id="sfAutoShow" type="checkbox" checked> Show reconstructed coloured regions</label>',
 '<p class="tiny" role="status" id="sfAutoStatus">Upload the original detailed artwork, then press Reconstruct. One analysis request may use OpenAI API credits.</p>',
 '<p class="tiny">After reconstruction, a separately hosted Ink/Stitch worker can automatically create an independently audited PES/DST ZIP when configured. Until then only the editable colour SVG is available. No generated file has been physically stitch-tested or approved for sale.</p>'
].join("");
host.prepend(panel);
const css=document.createElement("style");css.textContent=[
 "#sfAutoPanel{border:2px solid #90b9b1;background:#f8fbfa}",
 "#sfAutoStatus{border-left:3px solid #187a82;background:#edf7f5;padding:10px;margin:12px 0}",
 "#sfAutoOverlay path{stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none}",
 "#sfAutoPanel strong{font-size:1.05em}"
].join("\n");document.head.appendChild(css);
const overlay=document.createElementNS("http://www.w3.org/2000/svg","g");
overlay.setAttribute("id","sfAutoOverlay");
overlay.setAttribute("pointer-events","none");canvasSvg.appendChild(overlay);
let last=null,running=false;
const status=s=>q("#sfAutoStatus").textContent=s;
function paint(){
 overlay.replaceChildren();if(!last||!q("#sfAutoShow").checked)return;
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
  overlay.appendChild(path);
 }
}
q("#sfAutoShow").onchange=paint;
async function decoded(src,maxDim){
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("Cannot decode original artwork"));image.src=src;});
 if(image.naturalWidth*image.naturalHeight>45000000)throw Error("Image resolution too large");
 const scale=Math.min(1,maxDim/Math.max(image.naturalWidth,image.naturalHeight));
 const cvs=document.createElement("canvas");
 cvs.width=Math.max(48,Math.round(image.naturalWidth*scale));
 cvs.height=Math.max(48,Math.round(image.naturalHeight*scale));
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
 if(!window.StitchForgeAutoReconstruct){status("Automatic reconstruction engine missing; no changes made.");return;}
 running=true;q("#sfAutoRun").disabled=true;
 status("OpenAI is proposing visible wing, body and marking shapes. The existing design remains unchanged until geometry passes validation.");
 try{
  const image=await modelImage(source);
  const response=await fetch("/api/reconstruct-embroidery",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
   body:JSON.stringify({image}),cache:"no-store"
  });
  let plan;try{plan=await response.json();}catch{throw Error("Reconstruction service response unreadable (HTTP "+response.status+")");}
  if(!response.ok)throw Error((plan.error||"AI reconstruction failed")+(plan.code?" ["+plan.code+"]":""));
  if(plan.status!=="AI_GEOMETRY_PROPOSAL_NOT_STITCHED")throw Error("Invalid geometry response");
  status("AI returned "+plan.regions.length+" proposed regions. Checking real artwork pixels and preparing closed fills...");
  const {canvas,ctx}=await decoded(source,512);
  const result=window.StitchForgeAutoReconstruct.reconstruct(ctx.getImageData(0,0,canvas.width,canvas.height).data,
     canvas.width,canvas.height,plan);
  // End-to-end validation finishes BEFORE mutating the editor.
  const proposed={...result,width:canvas.width,height:canvas.height};
  const summary=context.replaceWithAutomaticReconstruction(proposed);
  last=proposed;paint();
  q("#sfAutoDownload").disabled=false;q("#sfAutoUndo").disabled=false;
  const summaryText="Automatically rebuilt "+summary.regions+" image-grounded regions ("+
    result.regions.filter(r=>r.kind==="fill").length+" fills, "+
    result.regions.filter(r=>r.kind==="running").length+" lines; "+
    result.rejected.length+" rejected). "+summary.colors+" proposed colours.";
  // The second stage is automatic. Only editable geometric paths and colours
  // leave the browser; no source raster, AI credentials or model proposals.
  // The endpoint returns a ZIP only after native Ink/Stitch + independent audit.
  const machineProject=context.exportMachineProject();
  const machineRevision=JSON.stringify(machineProject);
  status(summaryText+" Checking independently audited PES/DST engine...");
  try{
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
   if(JSON.stringify(context.exportMachineProject())!==machineRevision)
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
q("#sfAutoUndo").onclick=()=>{
 const btn=q("#undoBtn");if(!btn||btn.disabled){status("No reconstruction undo available.");return;}
 btn.click();last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;
 q("#sfAutoUndo").disabled=true;status("Reconstruction undone. Previous editable design restored.");
};
window.addEventListener("stitchforge:design-changed",()=>{
 if(!last)return;
 last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;q("#sfAutoUndo").disabled=true;
 status("Design changed. The previous AI overlay is no longer presented as current geometry; use normal Undo or reconstruct again.");
});
window.addEventListener("stitchforge:image-imported",()=>{
 last=null;overlay.replaceChildren();q("#sfAutoDownload").disabled=true;q("#sfAutoUndo").disabled=true;
 status("Artwork ready. Reconstruct automatically when you choose.");
});
})();

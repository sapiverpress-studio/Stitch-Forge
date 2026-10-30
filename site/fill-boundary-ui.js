/* Human-guided closed-fill boundaries for Stitch Forge.
 * This deliberately does not digitise AI rectangles or claim professional satin.
 */
(()=>{
"use strict";
const $=q=>document.querySelector(q);
const editor=window.StitchForgeAIContext,tracePanel=$("#tracePanel"),svg=$("#design");
if(!editor||!tracePanel||!svg)return;
const panel=document.createElement("section");panel.className="ai-detail-panel";
panel.innerHTML=[
 '<div class="ai-detail-head"><strong>Trace a fill region</strong><small>Manual boundary · experimental</small></div>',
 '<p class="tiny">Select an area in the list above, then tap around its <b>actual visible boundary</b> on the artwork. Add at least three distinct points. The resulting closed region is editable.</p>',
 '<div class="ai-actions"><button type="button" class="btn primary" id="sfFillStart">Start tracing boundary</button>',
 '<button type="button" class="btn" id="sfFillBack" disabled>Undo point</button>',
 '<button type="button" class="btn" id="sfFillClose" disabled>Close & inspect</button>',
 '<button type="button" class="btn primary" id="sfFillApply" disabled>Add as experimental fill</button>',
 '<button type="button" class="btn" id="sfFillCancel" disabled>Cancel trace</button></div>',
 '<p id="sfFillNotice" class="tiny" role="status">Fill contours need your points. A valid boundary is not proof of machine stitch quality.</p>',
 '<p class="tiny">These fills use the current <b>single-colour experimental tatami</b> engine. Proper multi-colour fills, underlay, satin rails, trims and physical stitch tests are still required.</p>'
].join("");
tracePanel.appendChild(panel);
const style=document.createElement("style");style.textContent=[
 "#sfFillGuide path{fill:none;stroke:#047f71;stroke-width:2.4;vector-effect:non-scaling-stroke;pointer-events:none}",
 "#sfFillGuide path.closed{fill:#19ad8640;stroke:#006c63;stroke-width:2.6}",
 "#sfFillGuide circle{fill:#fff;stroke:#006c63;stroke-width:1.8;vector-effect:non-scaling-stroke;pointer-events:none}",
 "#sfFillNotice{background:#eff8f5;border-left:3px solid #148d78;padding:8px 10px;margin:10px 0}"
].join("\n");document.head.appendChild(style);
const guide=document.createElementNS("http://www.w3.org/2000/svg","g");
guide.setAttribute("id","sfFillGuide");guide.setAttribute("pointer-events","none");svg.appendChild(guide);
let mode="idle",nodes=[],validated=null,previousTouch="";
const notice=text=>$("#sfFillNotice").textContent=text;
function refresh(){
 guide.replaceChildren();
 if(nodes.length){
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",nodes.map((p,i)=>(i?"L":"M")+p[0].toFixed(2)+" "+p[1].toFixed(2)).join(" ")+(mode==="preview"?"Z":""));
  if(mode==="preview")path.classList.add("closed");
  guide.appendChild(path);
  for(const p of nodes){const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
   c.setAttribute("cx",String(p[0]));c.setAttribute("cy",String(p[1]));c.setAttribute("r","5");guide.appendChild(c);}
 }
 $("#sfFillStart").disabled=mode!=="idle";
 $("#sfFillBack").disabled=mode!=="drawing"||nodes.length===0;
 $("#sfFillClose").disabled=mode!=="drawing"||nodes.length<3;
 $("#sfFillApply").disabled=mode!=="preview"||!validated;
 $("#sfFillCancel").disabled=mode==="idle";
}
function end(){
 mode="idle";nodes=[];validated=null;svg.style.touchAction=previousTouch;refresh();
}
function eventPoint(e){
 const ctm=svg.getScreenCTM();if(!ctm)throw Error("Drawing coordinates unavailable");
 const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
 const q=p.matrixTransform(ctm.inverse());
 return [Math.round(q.x*100)/100,Math.round(q.y*100)/100];
}
svg.addEventListener("pointerdown",e=>{
 if(mode!=="drawing")return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
  const p=eventPoint(e),bounds=editor.getBounds();
  if(!bounds)throw Error("Upload artwork before tracing");
  if(p[0]<bounds.x||p[0]>bounds.x+bounds.w||p[1]<bounds.y||p[1]>bounds.y+bounds.h)
   throw Error("Tap within the artwork, on the real wing or body edge");
  if(nodes.length&&Math.hypot(p[0]-nodes.at(-1)[0],p[1]-nodes.at(-1)[1])<3)
   throw Error("Point is too close to the previous point");
  if(nodes.length>=120)throw Error("Maximum 120 points");
  nodes.push(p);validated=null;notice(nodes.length+" boundary points. Continue around the visible shape, then tap Close & inspect.");
  refresh();
 }catch(err){notice(err.message);}
},true);
$("#sfFillStart").onclick=()=>{
 if(!editor.getImage()||!editor.getBounds()){notice("Import moth artwork first.");return;}
 mode="drawing";nodes=[];validated=null;previousTouch=svg.style.touchAction;svg.style.touchAction="none";
 const region=window.StitchForgeAIRegions?.selectedRegion?.();
 if($("#sfAiBoxes"))$("#sfAiBoxes").checked=false;
 notice("Tap along the real boundary"+(region?" of "+region.label:"")+". This is manual shape tracing: AI boxes are not stitches.");
 refresh();
};
$("#sfFillBack").onclick=()=>{
 if(mode!=="drawing")return;
 nodes.pop();validated=null;notice("Removed last point. "+nodes.length+" points remain.");refresh();
};
$("#sfFillClose").onclick=()=>{
 if(mode!=="drawing")return;
 try{
  validated=window.StitchForgeFillGeometry.prepare(nodes,editor.getBounds());
  mode="preview";svg.style.touchAction=previousTouch;
  notice("Closed region: "+validated.vertexCount+" points. Check the green boundary follows the actual wing/body before adding. This is not a finished machine fill.");
  refresh();
 }catch(err){validated=null;notice("Cannot close: "+err.message);}
};
$("#sfFillApply").onclick=()=>{
 if(mode!=="preview"||!validated)return;
 try{
  const result=editor.appendReviewedFillRegion(nodes);
  end();
  notice("Added fill region "+(result.index+1)+" as an editable closed path. Select that region to adjust basic tatami settings; use Undo to reverse it. Machine output remains UNVERIFIED.");
 }catch(err){notice("Could not add fill: "+err.message);}
};
$("#sfFillCancel").onclick=()=>{end();notice("Boundary trace discarded; existing design unchanged.");};
window.addEventListener("stitchforge:image-imported",()=>{end();notice("Artwork changed. Start tracing the new image when ready.");});
refresh();
})();

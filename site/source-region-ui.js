/* Local source-region inspection, kept separate from the editable stitch plan.
 * Original pixels stay on this device. Explicit downloads contain private
 * artwork geometry; no automatic persistence, upload, or machine generation.
 */
(()=>{
'use strict';
const api=window.StitchForgeSourceRegionProject,context=window.StitchForgeAIContext;
const host=document.querySelector('#tracePanel'),design=document.querySelector('#design');
if(!api||!context||!host||!design)return;
const panel=document.createElement('section');panel.id='sfSourceRegionPanel';panel.className='ai-detail-panel';
const style=document.createElement('style');
style.textContent='#design.source-inspection #paths,#design.source-inspection #nodes,#design.source-inspection #sfAutoOverlay{display:none}#sfSourceFile[hidden]{display:none!important}';
document.head.appendChild(style);
panel.innerHTML=[
 '<strong>Source regions · local inspection</strong>',
 '<p class="tiny">Inspect an automatic colour partition with holes and separate pieces preserved. This is source geometry; colours and features still need review.</p>',
 '<div class="ai-actions"><button type="button" class="btn" id="sfSourceInspect">Inspect source regions (free)</button>',
 '<button type="button" class="btn" id="sfSourceSave" disabled>Save source-region project</button>',
 '<button type="button" class="btn" id="sfSourceSvg" disabled>Download geometry SVG</button>',
 '<button type="button" class="btn" id="sfSourceCandidates" disabled>Download stitch candidates · unverified</button>',
 '<button type="button" class="btn" id="sfObjectBuild" disabled>Prepare artwork shapes locally</button>',
 '<button type="button" class="btn" id="sfObjectSave" disabled>Save prepared artwork · not stitches</button>',
 '<button type="button" class="btn" id="sfSourceLoad">Open source-region project</button>',
 '<button type="button" class="btn" id="sfSourceClose" disabled>Return to stitch editor</button></div>',
 '<input type="file" id="sfSourceFile" accept="application/json,.json" hidden>',
 '<label class="tiny" for="sfSourceWidth">Full source image width (mm)</label>',
 '<input type="number" id="sfSourceWidth" min="10" max="250" step="1" value="80" inputmode="decimal">',
 '<label class="tiny"><input type="checkbox" id="sfObjectShow" disabled> Show prepared shapes</label>',
 '<p class="tiny" role="status" id="sfSourceStatus">No source-region draft. Upload the original image first. No AI credits are used here.</p>',
 '<p class="tiny">The draft is separate from stitch paths. Playback and machine export are blocked while inspecting it. Saved projects and SVGs contain artwork geometry; keep them private.</p>'
].join('');host.prepend(panel);
const q=s=>panel.querySelector(s),status=text=>q('#sfSourceStatus').textContent=text;
const overlay=document.createElementNS('http://www.w3.org/2000/svg','g');
overlay.id='sfSourceRegionOverlay';overlay.setAttribute('pointer-events','none');design.appendChild(overlay);
let draft=null,objectPlan=null,active=false,busy=false,generation=0;
function paint(){
 overlay.replaceChildren();if(!draft||!active)return;
 const b=context.getBounds();if(!b)return;
 overlay.setAttribute('transform','translate('+b.x+' '+b.y+') scale('+b.w/draft.source.width+' '+b.h/draft.source.height+')');
 for(const region of objectPlan&&q('#sfObjectShow').checked?objectPlan.regions:draft.regions){
  if(!region.topology)continue;
  const d=region.topology.components.flatMap(c=>c.rings.map(r=>r.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+'Z')).join(' ');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',d);path.setAttribute('fill',region.color);path.setAttribute('fill-rule','evenodd');
  path.setAttribute('data-source-region',region.id);path.setAttribute('fill-opacity','.85');overlay.appendChild(path);
 }
}
function describe(){
 const s=draft.summary;
 status('Automatic source partition: '+s.colorGroups+' colour groups, '+s.componentCount+' pieces, '+s.holeCount+
  ' holes; '+s.smallComponents+' small pieces retained for review. '+draft.foregroundPixels+
  ' selected analysis pixels preserved. '+draft.quantisation.pixelsBeyondRgb60+' pixels differ from the proposed palette by RGB distance >60. '+
  draft.physical.imageWidthMm.toFixed(1)+' × '+draft.physical.imageHeightMm.toFixed(1)+
  ' mm across the full image. Semantic reconstruction and stitch planning are unverified.'+
  (draft.graph?' Source graph retains '+s.sourceNodes+' reference pieces and '+s.smallContrastingFeatures+
   ' small contrasting details. '+(s.protectedColourMismatch+s.collapsedProtectedEdges)+' small-detail colour checks need review. Working colours simplify shading; these are not verified thread choices.':'')+
  (draft.graph?.simplification?' Grouped '+draft.graph.simplification.reassignments.length+' tiny possible boundary blends, with at most one analysis pixel ('+
   draft.physical.scaleMmPerPixel.toFixed(3)+' mm) of internal colour-boundary change. All references retained.':'')+
  (draft.approximation?' Preview only: the fine reference graph exceeded its complexity limit. A bounded 12-colour approximation is shown at the same analysis resolution. Small-feature preservation and stitch planning remain unverified; stitch candidates are unavailable.':'')+
  (s.contoursUnavailable?' '+s.contoursUnavailable+' colour masks exceed the contour budget; their pixels remain in the saved project.':''));
}
function clearObjects(){objectPlan=null;q('#sfObjectSave').disabled=true;q('#sfObjectShow').disabled=true;q('#sfObjectShow').checked=false;}
function install(next){
 clearObjects();draft=next;active=true;context.setSourceRegionInspectionActive(true);q('#sfObjectBuild').disabled=false;
 q('#sfSourceSave').disabled=false;q('#sfSourceSvg').disabled=!!draft.summary.contoursUnavailable;
 q('#sfSourceClose').disabled=false;q('#sfSourceWidth').value=draft.physical.imageWidthMm;
 q('#sfSourceCandidates').disabled=!draft.graph;
 paint();describe();
}
async function pixels(){
 const source=context.getImage();
 if(!source||context.getSourceStatus()!=='original')throw Error('Upload the original image; a saved trace preview is insufficient');
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Cannot decode source image'));image.src=source;});
 if(image.naturalWidth*image.naturalHeight>45000000)throw Error('Artwork exceeds 45 megapixels');
 const scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
 if(canvas.width<48||canvas.height<48)throw Error('Source is too narrow for bounded local analysis');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return {source,rgba:ctx.getImageData(0,0,canvas.width,canvas.height).data,w:canvas.width,h:canvas.height,
  originalWidth:image.naturalWidth,originalHeight:image.naturalHeight};
}
async function action(fn){
 if(busy)return;busy=true;const current=++generation;q('#sfSourceInspect').disabled=true;q('#sfSourceLoad').disabled=true;
 status('Reading source pixels locally…');
 try{
  const p=await pixels(),next=await fn(p);
  if(current!==generation||p.source!==context.getImage())throw Error('Artwork changed; stale source draft discarded');
  install(next);
 }catch(error){status(String(error.message||error)+'. Existing stitch paths and previous draft are unchanged.');}
 finally{busy=false;q('#sfSourceInspect').disabled=false;q('#sfSourceLoad').disabled=false;}
}
q('#sfSourceInspect').onclick=()=>action(p=>api.createInspectionDraft(p.rgba,p.w,p.h,{
 imageWidthMm:Number(q('#sfSourceWidth').value),originalWidth:p.originalWidth,originalHeight:p.originalHeight}));
q('#sfSourceWidth').onchange=()=>{
 if(!draft)return;
 try{draft=api.resizeDraft(draft,Number(q('#sfSourceWidth').value));clearObjects();paint();describe();}
 catch(error){q('#sfSourceWidth').value=draft.physical.imageWidthMm;status(error.message+'. Previous physical size retained.');}
};
function download(text,name,type){
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
q('#sfSourceSave').onclick=()=>{try{if(draft)download(api.serialiseDraft(draft),'stitch-forge-source-regions-PRIVATE.json','application/json');}catch(e){status(e.message);}};
q('#sfSourceSvg').onclick=()=>{try{if(draft)download(api.geometrySvg(draft),'stitch-forge-source-geometry-NOT-DIGITISED.svg','image/svg+xml');}catch(e){status(e.message);}};
q('#sfObjectBuild').onclick=async()=>{
 if(!draft||busy)return;const current=draft,start=generation;q('#sfObjectBuild').disabled=true;
 status('Preparing source-bound artwork shapes locally…');
 try{
  const result=await window.StitchForgeSourceObjectPlan.build(current);
  if(generation!==start||draft!==current)throw Error('Artwork or size changed; stale prepared shapes discarded');
  objectPlan=result;q('#sfObjectSave').disabled=false;q('#sfObjectShow').disabled=false;q('#sfObjectShow').checked=true;paint();
  const s=result.summary;status('Prepared '+s.workingParts+' shapes from '+s.sourceParts+' source pieces. '+s.recolouredPixels+
   ' selected pixels change working colour; '+s.protectedParts+' contrasting candidates retained. No pixels omitted. '+
   'Small shading fragments are grouped within '+result.options.maxReachMm+' mm of stable cores. This is artwork preparation, not a stitch plan or machine approval.');
 }catch(error){status(error.message);}
 finally{q('#sfObjectBuild').disabled=!draft;}
};
q('#sfObjectSave').onclick=()=>{try{if(objectPlan){const text=JSON.stringify(objectPlan);if(new TextEncoder().encode(text).length>8000000)throw Error('Prepared artwork exceeds download budget');download(text,'stitch-forge-prepared-artwork-NOT-DIGITISED-PRIVATE.json','application/json');}}catch(error){status(error.message);}};
q('#sfObjectShow').onchange=paint;
q('#sfSourceCandidates').onclick=async()=>{
 if(!draft||busy)return;const current=draft,startGeneration=generation;
 q('#sfSourceCandidates').disabled=true;
 try{
  const candidates=await window.StitchForgeSourceStitchCandidates.buildCandidates(current);
  if(startGeneration!==generation||draft!==current)throw Error('Source or physical size changed; stale candidates discarded');
  download(JSON.stringify(candidates,null,2),'stitch-forge-stitch-candidates-UNVERIFIED-PRIVATE.json','application/json');
  const c=candidates.summary;
  status('Size-based candidates: '+c.fill_candidate+' possible fills, '+c.narrow_detail_review+' narrow details, '+
   c.small_detail_review+' small details, '+c.tiny_blend_review+' tiny blends for review. Nothing omitted. These are estimates; no stitches or machine files were generated.');
 }catch(e){status(e.message);}
 finally{q('#sfSourceCandidates').disabled=!draft?.graph;}
};
q('#sfSourceLoad').onclick=()=>q('#sfSourceFile').click();
q('#sfSourceFile').onchange=()=>{
 const file=q('#sfSourceFile').files?.[0];q('#sfSourceFile').value='';if(!file)return;
 action(async p=>{
  if(file.size>8000000)throw Error('Source-region project is too large');
  const next=api.parseDraft(await file.text());
  await api.assertMatchesSource(next,p.rgba,p.w,p.h);
  return next;
 });
};
q('#sfSourceClose').onclick=()=>{
 active=false;context.setSourceRegionInspectionActive(false);paint();q('#sfSourceClose').disabled=true;
 status('Source inspection closed. The earlier editable stitch plan is active. The saved source draft has no stitch plan.');
};
window.addEventListener('stitchforge:source-inspection-ended',()=>{active=false;paint();q('#sfSourceClose').disabled=true;});
window.addEventListener('stitchforge:image-imported',()=>{
 generation++;draft=null;clearObjects();active=false;context.setSourceRegionInspectionActive(false);overlay.replaceChildren();
 for(const id of ['sfSourceSave','sfSourceSvg','sfSourceClose','sfSourceCandidates','sfObjectBuild'])q('#'+id).disabled=true;
 status('Artwork changed. Inspect the original source pixels locally when ready.');
});
})();

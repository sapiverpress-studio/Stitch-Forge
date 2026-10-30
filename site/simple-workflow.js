/* MD-2.53: Simple upload → Generate → decoded stitch playback → ZIP.
 * Existing verified native pipeline remains authoritative. This is a viewer,
 * not an exporter or alternative machine-file producer.
 */
(()=>{
'use strict';
const $=s=>document.querySelector(s),native=$('#sfAutoRun'),originalInput=$('#importFile');
const context=window.StitchForgeAIContext;
if(!native||!originalInput||!context)return;
const main=document.querySelector('main'),workspace=main?.querySelector('.workspace');
if(!main||!workspace)return;

const app=document.createElement('section');
app.id='sfSimpleFlow';app.setAttribute('aria-label','Automatic embroidery creation');
app.innerHTML=[
 '<header class="sf-simple-head"><h1>Image to embroidery</h1><p>Upload a picture, then press Generate. AI analysis, stitches and a ZIP are handled automatically.</p></header>',
 '<div class="sf-simple-step"><span class="sf-step">1</span><div class="sf-step-body"><button type="button" class="btn primary" id="sfQuickUpload">Upload image</button>',
 '<p class="sf-small" id="sfQuickFilename">Choose a PNG, JPG or WebP image.</p><img id="sfQuickOriginal" alt="Uploaded source artwork" hidden></div></div>',
 '<div class="sf-simple-step"><span class="sf-step">2</span><div class="sf-step-body"><button type="button" class="btn primary" id="sfQuickGenerate" disabled>Generate embroidery</button>',
 '<div id="sfQuickAuth" hidden><label for="sfQuickToken">Private access token — enter once on this device</label>',
 '<input id="sfQuickToken" type="password" autocomplete="off" placeholder="Stitch Forge access token">',
 '<p class="sf-small">Saved in this browser if Remember token is enabled. This is not your OpenAI API key.</p></div>',
 '<p class="sf-small" role="status" aria-live="polite" id="sfQuickStatus">Upload an image to begin.</p></div></div>',
 '<div class="sf-simple-step"><span class="sf-step">3</span><div class="sf-step-body"><h2>Stitch video</h2>',
 '<div id="sfQuickPlayback" class="sf-playback"><p class="sf-small" id="sfQuickEmpty">Actual stitches will animate here after generation.</p>',
 '<canvas id="sfQuickCanvas" aria-label="Animation of independently decoded PES needle stitches" hidden></canvas></div>',
 '<button type="button" class="btn" id="sfQuickReplay" disabled>▶ Replay stitches</button><p class="sf-small">Playback of decoded machine stitches, not a recorded physical sew-out or MP4 file.</p></div></div>',
 '<div class="sf-simple-step"><span class="sf-step">4</span><div class="sf-step-body"><button type="button" class="btn primary" id="sfQuickZip" disabled>Download ZIP</button>',
 '<p class="sf-small">PES, DST and the machine audit. Trial output must be reviewed and physically stitched before use.</p></div></div>'
].join('');
workspace.before(app);
const advanced=document.createElement('details');
advanced.id='sfAdvancedTools';
const summary=document.createElement('summary');summary.textContent='Advanced / manual tools';
advanced.appendChild(summary);workspace.before(advanced);advanced.appendChild(workspace);
const note=main.querySelector('.note');if(note)advanced.appendChild(note);
const oldAccept=originalInput.accept;
const imageAccept='.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
originalInput.accept=imageAccept;
advanced.addEventListener('toggle',()=>{originalInput.accept=advanced.open?oldAccept:imageAccept;});
main.classList.add('sf-simple-mode');
const css=document.createElement('style');css.textContent=[
 '.sf-simple-mode>.intro{display:none}',
 '#sfSimpleFlow{max-width:800px;margin:12px auto 24px;display:flex;flex-direction:column;gap:14px}',
 '.sf-simple-head h1{font-size:clamp(1.6rem,5vw,2.2rem);margin:0 0 4px}',
 '.sf-simple-head p{margin:0;color:#4a666b}',
 '.sf-simple-step{background:#fff;border:1px solid #d5e5e0;border-radius:15px;padding:15px;display:flex;gap:13px;align-items:flex-start}',
 '.sf-step{background:#173d45;color:#fff;border-radius:50%;width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;font-weight:800}',
 '.sf-step-body{min-width:0;width:100%}',
 '.sf-step-body .btn.primary{width:100%;font-weight:700;min-height:48px;font-size:1rem}',
 '.sf-step-body h2{font-size:1.12rem;margin:2px 0 9px}',
 '.sf-small{font-size:12px;color:#47646a;line-height:1.5;margin:7px 0 4px;overflow-wrap:anywhere}',
 '#sfQuickOriginal{display:block;max-height:175px;max-width:100%;object-fit:contain;border-radius:6px;margin:10px auto 0}',
 '#sfQuickOriginal[hidden],#sfQuickCanvas[hidden],#sfQuickAuth[hidden]{display:none!important}',
 '#sfQuickAuth{margin-top:12px;padding:10px;background:#eff5f3;border-radius:9px}',
 '#sfQuickAuth input{width:100%;height:45px;margin-top:7px;padding:10px;border:1px solid #abbfba;border-radius:8px}',
 '#sfQuickStatus{font-weight:600;white-space:pre-wrap}',
 '.sf-playback{border-radius:11px;min-height:170px;background:#f7faf9;border:1px solid #dfe9e6;display:flex;align-items:center;justify-content:center;overflow:hidden}',
 '.sf-playback canvas{display:block;width:auto;height:auto;max-width:100%;max-height:65vh;object-fit:contain}',
 '#sfQuickReplay{margin:10px 0 0;min-height:42px}',
 '#sfAdvancedTools{max-width:1080px;margin:8px auto 20px}',
 '#sfAdvancedTools>summary{padding:12px;cursor:pointer;color:#526a70;font-size:13px}',
 '#sfAdvancedTools .workspace{margin-top:8px}',
 '@media(max-width:560px){.sf-simple-step{padding:12px;gap:10px}#sfSimpleFlow{gap:11px}}'
].join('\n');document.head.appendChild(css);
const upload=$('#sfQuickUpload'),generate=$('#sfQuickGenerate'),zip=$('#sfQuickZip');
const status=$('#sfQuickStatus'),auth=$('#sfQuickAuth'),token=$('#sfQuickToken');
const canvas=$('#sfQuickCanvas'),replay=$('#sfQuickReplay');
const image=$('#sfQuickOriginal'),empty=$('#sfQuickEmpty'),filename=$('#sfQuickFilename');
let preview=null,frame=0,run=0,ready=false,busy=false,hasImage=false,failed=false;
function stop(){run++;if(frame)cancelAnimationFrame(frame);frame=0;}
function reset(text){
 stop();preview=null;ready=false;zip.disabled=true;replay.disabled=true;
 canvas.hidden=true;empty.hidden=false;empty.textContent='Actual stitches will animate here after generation.';
 if(text)status.textContent=text;
}
function tokenAvailable(){return !!($('#sfAutoToken')?.value.trim()||token.value.trim());}
function requestAuth(){auth.hidden=tokenAvailable();}
function drawStart(){
 const p=preview;if(!p)return null;
 const scale=Math.min(820/p.widthMm,720/p.heightMm);
 const w=Math.max(1,Math.round(p.widthMm*scale)),h=Math.max(1,Math.round(p.heightMm*scale));
 canvas.width=w;canvas.height=h;canvas.hidden=false;empty.hidden=true;
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.lineWidth=Math.max(.75,.18*scale);
 ctx.lineCap='round';ctx.lineJoin='round';
 return {ctx,scale};
}
function play(){
 if(!preview||!ready)return;
 stop();let {segments,palette}=preview,index=0;
 const painter=drawStart();if(!painter){status.textContent='Stitch playback unavailable on this browser. ZIP is still available.';return;}
 const {ctx,scale}=painter,version=run,perFrame=Math.max(1,Math.ceil(segments.length/540));
 function tick(){
  if(version!==run)return;
  const until=Math.min(segments.length,index+perFrame);
  for(;index<until;index++){
   const [x1,y1,x2,y2,color]=segments[index];
   ctx.strokeStyle=palette[color];
   ctx.beginPath();ctx.moveTo(x1*scale,y1*scale);ctx.lineTo(x2*scale,y2*scale);ctx.stroke();
  }
  if(index<segments.length)frame=requestAnimationFrame(tick);
  else{frame=0;replay.textContent='↻ Replay stitches';}
 }
 replay.textContent='▶ Replaying stitches…';frame=requestAnimationFrame(tick);
}
upload.addEventListener('click',()=>{
 if(busy)return;
 originalInput.click();
});
originalInput.addEventListener('change',()=>{if(originalInput.files?.length)status.textContent='Loading artwork…';});
window.addEventListener('stitchforge:upload-error',event=>{
 hasImage=false;image.hidden=true;generate.disabled=true;
 reset('Image could not be imported: '+String(event.detail?.message||'Unsupported file'));
 filename.textContent='Choose a PNG, JPG or WebP image.';
});
window.addEventListener('stitchforge:image-imported',()=>{
 const source=context.getImage();
 hasImage=context.getSourceStatus()==='original';
 reset('Artwork loaded. Tap Generate embroidery.');
 image.hidden=!hasImage;if(hasImage)image.src=source;
 filename.textContent=hasImage?'Image uploaded — ready to generate.':'Re-upload the original PNG, JPG or WebP.';
 generate.disabled=!hasImage;requestAuth();
});
window.addEventListener('stitchforge:design-changed',()=>{
 // The old editor may invalidate a previous native result.
 if(ready)reset('Design changed. Generate a new native trial for this image.');
});
generate.addEventListener('click',()=>{
 if(busy||!hasImage)return;
 const underlying=$('#sfAutoToken');if(!underlying)return;
 if(!underlying.value.trim()&&token.value.trim())underlying.value=token.value.trim();
 if(!underlying.value.trim()){
  auth.hidden=false;token.focus();
  status.textContent='Enter your private Stitch Forge access token once, then tap Generate.';
  return;
 }
 // The primary workflow always uses the native machine engine. AI runs by
 // default as previously configured; Advanced may disable paid analysis.
 const mode=$('#sfAutoWorkflow');if(mode&&mode.value!=='native'){mode.value='native';mode.dispatchEvent(new Event('change'));}
 reset('Preparing image…');
 failed=false;busy=true;generate.disabled=true;upload.disabled=true;
 native.click();
 // The source workflow emits completion and failure events. The ZIP is NEVER
 // enabled by a preview, AI proposal or legacy outline export.
});
token.addEventListener('input',()=>{if(token.value.trim())status.textContent='Token entered. Tap Generate embroidery.';});
window.addEventListener('stitchforge:workflow-status',e=>{
 if(!busy||typeof e.detail?.message!=='string')return;
 const message=e.detail.message;
 status.textContent=/analysing visible|with AI|OpenAI/i.test(message)?'Analysing your image with AI…':
  /Preparing|source-bound colour/i.test(message)?'Preparing colours and shapes…':
  /first native|PES|second native|DST|native engine|generat/i.test(message)?'Generating and validating machine stitches…':
  /ZIP|decoded stitches/i.test(message)?'Finishing stitch preview and ZIP…':
  message.length>160?message.slice(0,157)+'…':message;
});
window.addEventListener('stitchforge:native-ready',e=>{
 const p=e.detail?.preview;
 if(!busy||!p||!Array.isArray(p.segments)||!Array.isArray(p.palette))return;
 ready=true;preview=p;zip.disabled=false;replay.disabled=false;
 auth.hidden=true;token.value='';
 const d=e.detail?.report?.decoded?.find(x=>x.format==='pes');
 status.textContent='Embroidery trial ready'+(d?': '+d.needleStitches.toLocaleString('en-GB')+' stitches, '+(d.colourChanges||0)+' colour changes':'')+'. ZIP ready; physical stitch quality not approved.';
 play();
});
window.addEventListener('stitchforge:native-error',e=>{
 failed=true;
 reset('Generation failed: '+String(e.detail?.message||'Native worker could not complete this image'));
 if(/access token|unauthori[sz]ed|401/i.test(status.textContent))auth.hidden=false;
});
window.addEventListener('stitchforge:native-idle',()=>{
 if(busy&&!ready&&!failed)reset('Generation stopped or image changed. Press Generate to retry.');
 busy=false;generate.disabled=!hasImage;upload.disabled=false;
});
replay.addEventListener('click',play);
zip.addEventListener('click',()=>{
 if(ready&&!zip.disabled)$('#sfAutoDownload')?.click();
});
window.addEventListener('beforeunload',stop);
requestAuth();
})();
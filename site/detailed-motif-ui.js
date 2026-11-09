/* Detailed Motif keeps the reviewed image and signed native packet together.
 * The legacy simple/advanced workflow has its own state. */
(() => {
'use strict';
const q=id=>document.getElementById(id);
const analysisSide=480;
const labels={balanced:'Balanced',detail:'Preserve more detail',clean:'Fewer shapes'};
const nextPreset={balanced:'detail',detail:'clean',clean:'balanced'};

function loadImage(source) {
  const image=new Image();
  image.src=source;
  return image.decode().then(()=>image,()=>{throw Error('The image could not be decoded.');});
}

function readFile(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function pixels(image, side) {
  if (image.naturalWidth*image.naturalHeight>45000000)
    throw Error('The image has more than 45 million pixels. Resize it and try again.');
  const scale=Math.min(1,side/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.round(image.naturalWidth*scale),height=Math.round(image.naturalHeight*scale);
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,0,0,width,height);
  return {rgba:ctx.getImageData(0,0,width,height).data,width,height};
}

function canvasImage(canvas, illustration) {
  canvas.width=illustration.width;canvas.height=illustration.height;
  canvas.getContext('2d').putImageData(new ImageData(illustration.rgba,illustration.width,illustration.height),0,0);
}

function download(bytes,name,type='application/octet-stream') {
  const url=URL.createObjectURL(new Blob([bytes],{type}));
  const link=document.createElement('a');
  link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}

async function verifyApproved(result, packed) {
  const api=window.StitchForgeArtworkPipeline, report=result.report;
  const expected=packed.draft.regions.map(r=>r.color).join(',');
  const files=await api.readArchive(result.bytes);
  if (report.sourceBinding?.sourceMeanRgbDistance!==0 ||
      report.sourceBinding.clientProposedPaletteOverridden ||
      result.preview.palette.join(',')!==expected ||
      report.decoded.some(d=>d.requestedColourOrder?.join(',')!==expected))
    throw Error('The native worker changed the approved colours. This preview needs a compatible private worker.');
  if (!Array.isArray(report.structuralAudit)||report.structuralAudit.length!==2||
      report.structuralAudit.some(d=>d.stops!==0||d.changes!==packed.draft.regions.length-1))
    throw Error('The machine files contain an unexpected stop or colour-change sequence.');
  if (report.unresolvedObjects>0)
    throw Error('The native worker could not resolve '+report.unresolvedObjects+' small shapes. Try Fewer shapes or increase the width, then approve the new illustration.');
  for (const d of report.decoded) {
    const wanted=[packed.sizing.estimatedVisibleWidthMm,packed.sizing.estimatedVisibleHeightMm];
    if (d.sha256!==await api.digest(files['artwork-trial.'+d.format]) ||
        !Array.isArray(d.boundsMm) || d.boundsMm.length!==2 ||
        d.boundsMm.some((n,i)=>!Number.isFinite(n)||Math.abs(n-wanted[i])>Math.max(2,wanted[i]*.06)) ||
        !Number.isFinite(d.maxNeedleMoveMm) || d.maxNeedleMoveMm>3.65 ||
        !Number.isFinite(d.maxNeedlesInOneMmSquare)||d.maxNeedlesInOneMmSquare>120 ||
        !packed.draft.regions.every(r=>Number.isFinite(d.coverageProxy?.[r.color]?.fractionNearDecodedPath) &&
          d.coverageProxy[r.color].fractionNearDecodedPath>=.55))
      throw Error(d.format.toUpperCase()+' failed the approved motif’s size, coverage or decoded movement checks.');
  }
  return files;
}

function mount({reset,present}) {
  const api=window.StitchForgeArtworkPipeline, project=window.StitchForgeMotifProject;
  const mode=q('sfQuickArtworkType'), width=q('sfQuickWidth'), generate=q('sfQuickGenerate');
  const upload=q('sfQuickUpload'), original=q('sfQuickOriginal'), filename=q('sfQuickFilename');
  const group=q('sfDetailedControls'), review=q('sfDetailedReview'), status=q('sfQuickStatus');
  const prepare=q('sfDetailedPrepare'), approve=q('sfDetailedApprove'), retry=q('sfDetailedRetry');
  const fileInput=q('sfDetailedImage'), projectInput=q('sfDetailedProjectInput'), save=q('sfDetailedSave');
  const canvas=q('sfDetailedAfter'), token=q('sfQuickToken'), auth=q('sfQuickAuth');
  const name=q('sfQuickProductName'), cancel=q('sfDetailedCancel');
  let source=null, previousLegacy=null, proposal=null, approved=false, result=null, files=null;
  let stamp=0, operation=null, pending=false, attempted=false, preparationFailed=false, preset='balanced';

  const active=()=>mode.value==='detailed';
  const message=text=>{status.textContent=text;};
  const setBusy=value=>{
    pending=value;
    prepare.disabled=value||!source;
    retry.hidden=!attempted;
    retry.disabled=value||!source;
    approve.disabled=value||!proposal;
    upload.disabled=value;
    generate.disabled=value||!approved;
    cancel.hidden=!operation;
  };
  function invalidate(text) {
    stamp++;
    operation?.abort();
    operation=null;
    proposal=null;result=null;files=null;approved=false;
    review.hidden=true;save.disabled=true;
    reset(text);
    setBusy(false);
  }
  function displayOriginal() {
    original.hidden=!source;
    if (source) original.src=source.data;
    filename.textContent=source?source.name:'Choose a PNG, JPG or WebP image.';
  }
  function setSource(newSource,text) {
    source=newSource;
    preset='balanced';attempted=false;preparationFailed=false;
    invalidate(text||'Image loaded. Tap Prepare illustration.');
    displayOriginal();
  }
  function enter() {
    group.hidden=false;save.hidden=false;attempted=false;preparationFailed=false;
    generate.hidden=true;generate.disabled=true;
    displayOriginal();
    invalidate(source?'Image loaded. Tap Prepare illustration.':'Upload a single subject to begin.');
  }
  function leave() {
    group.hidden=true;save.hidden=true;generate.hidden=false;
    invalidate();
    return source?.file!==previousLegacy?source?.file:null;
  }
  function legacy(data,file) {
    if (!data||!file||!/\.(png|jpe?g|webp)$/i.test(file.name)) return;
    previousLegacy=file;
    source={data,name:file.name,file};
  }
  async function installFile(file) {
    if (!file||!active()) return;
    const before=++stamp;
    try {
      if (file.size>project.MAX_IMAGE_BYTES) throw Error('Choose an image below 12 MB.');
      const extension=/\.(png|jpe?g|webp)$/i.exec(file.name)?.[1].toLowerCase();
      if (!extension) throw Error('Choose a PNG, JPG or WebP image.');
      const type='image/'+(extension==='jpg'?'jpeg':extension);
      const data=await readFile(file.slice(0,file.size,type));
      project.imageBytes(data);
      await loadImage(data);
      if (stamp===before&&active()) setSource({data,name:file.name,file});
    } catch(error) {
      if (stamp===before&&active()) message('Upload failed: '+error.message);
    }
  }
  function show(proposed, text) {
    proposal=proposed;approved=false;result=null;files=null;save.disabled=true;
    attempted=true;preparationFailed=false;
    canvasImage(canvas,proposal);
    q('sfDetailedBefore').src=source.data;
    q('sfDetailedPreset').textContent=labels[proposal.preset];
    const chips=proposal.palette.map(colour=>{
      const chip=document.createElement('li'),sample=document.createElement('span');
      sample.style.backgroundColor=colour;
      chip.append(sample,colour);
      return chip;
    });
    q('sfDetailedPalette').replaceChildren(...chips);
    q('sfDetailedNote').textContent=(proposal.quality?.warnings||[]).join(' ');
    review.hidden=false;
    generate.hidden=true;
    message(text);
  }
  async function pack(illustration,widthMm) {
    return api.pack(illustration.rgba,illustration.width,illustration.height,
      {profile:'detailed_motif',imageWidthMm:widthMm,sizeMode:'visible',texturePolicy:'off',
       approvedPalette:illustration.palette,maxWorkingParts:110});
  }
  async function makeIllustration() {
    if (!active()||!source||pending) return;
    attempted=true;preparationFailed=false;
    invalidate('Separating the subject and finding colour shapes and fine marks…');
    generate.hidden=true;
    const current=stamp, widthMm=Number(width.value);
    setBusy(true);
    try {
      const input=await loadImage(source.data);
      if (stamp!==current) return;
      const {rgba,width:w,height:h}=pixels(input,analysisSide);
      const artwork=window.StitchForgeDetailedMotif.prepare(rgba,w,h,{widthMm,preset});
      const packed=await pack(artwork,widthMm);
      if (stamp!==current) return;
      show({...artwork,preset,packed},'Compare the outline and important details, then approve the illustration or try another version.');
    } catch(error) {
      if (stamp===current) {preparationFailed=true;message('Could not prepare this image: '+error.message);}
    } finally {
      if (stamp===current) setBusy(false);
    }
  }
  async function start() {
    if (!approved||!proposal||pending) return;
    const underlying=q('sfAutoToken'), selected=token.value.trim()||underlying.value.trim();
    if (!selected) {
      auth.hidden=false;token.focus();
      message('Enter your private Stitch Forge access token, then tap Generate embroidery.');
      return;
    }
    const tokenStore=window.StitchForgeTokenStore;
    const current=stamp, controller=new AbortController();
    operation=controller;result=null;files=null;save.disabled=true;
    reset('Sending approved colour geometry to the private Ink/Stitch worker…');
    setBusy(true);
    try {
      const generated=await api.generate(proposal.packed,{token:selected,background:true,signal:controller.signal,
        isCurrent:()=>stamp===current,onProgress:text=>{if (stamp===current) message(text);},
        onAccepted:()=>{
          underlying.value=selected;
          if (q('sfRememberToken')?.checked) tokenStore?.save(selected);
          else tokenStore?.forget();
          if (token.value.trim()===selected) token.value='';
          auth.hidden=true;
        }});
      const entries=await verifyApproved(generated,proposal.packed);
      if (stamp!==current) return;
      result=generated;files=entries;save.disabled=false;auth.hidden=true;token.value='';
      const decoded=result.report.decoded.find(item=>item.format==='pes');
      const warnings=[];
      if (decoded.maxNeedlesInOneMmSquare>45) warnings.push('Inspect dense areas in the report.');
      if (decoded.jumps>180) warnings.push('Inspect jump routing before sewing.');
      present(result,'Validated PES and DST. '+decoded.needleStitches.toLocaleString('en-GB')+' stitches, '+
        decoded.boundsMm.map(x=>x.toFixed(1)).join(' × ')+' mm. '+warnings.join(' '));
    } catch(error) {
      if (stamp!==current) return;
      const reasons={
        SOURCE_CONTAINMENT_FAILED:'A decoded needle path left an approved colour shape. Try another illustration version or increase the width.',
        NATIVE_DENSITY_LIMIT:'A decoded area exceeded the local stitch-density limit. Try Fewer shapes or increase the width.',
        NATIVE_LENGTH_LIMIT:'A decoded needle movement exceeded the maximum stitch length. Try another illustration version.',
        GEOMETRY_BUDGET_EXCEEDED:'The approved version has too much geometry for the native worker. Try Fewer shapes.'
      };
      const code=/\[([A-Z_]+)\]/.exec(error.message)?.[1];
      if (error.code==='OWNER_TOKEN_REJECTED') {
        if (tokenStore?.read()===selected) tokenStore.forget();
        for (const field of [token,underlying,q('sfAiToken')]) {
          if (field?.value.trim()===selected) field.value='';
        }
        reset('Token rejected. Enter the Stitch Forge owner token set for this site address, then tap Generate embroidery.');
        auth.hidden=false;token.focus();
      } else {
        reset('Generation stopped: '+(reasons[code]||error.message));
        if (error.code==='OWNER_ACCESS_UNAVAILABLE'||error.code==='ARTWORK_TRIAL_DISABLED') auth.hidden=true;
      }
    } finally {
      if (stamp===current) {operation=null;setBusy(false);}
    }
  }
  async function saveProject() {
    if (!result||!files||!proposal) return;
    const current=stamp;
    save.disabled=true;
    try {
      const bytes=await project.create({name:name.value,source,
        artwork:{...proposal,data:canvas.toDataURL('image/png')},packed:proposal.packed,result});
      if (stamp===current) download(bytes,window.StitchForgeDownloadNaming.slug(name.value)+'.sfmotif','application/json');
    } catch(error) {
      if (stamp===current) message('Could not save the motif: '+error.message);
    } finally {
      if (stamp===current) save.disabled=false;
    }
  }
  async function reopen(file) {
    if (!file) return;
    if (!active()) {mode.value='detailed';mode.dispatchEvent(new Event('change'));}
    invalidate('Checking the saved motif and its original artwork…');
    generate.hidden=true;
    const current=stamp;
    setBusy(true);
    try {
      const saved=await project.open(file);
      const [before,after]=await Promise.all([loadImage(saved.source.data),loadImage(saved.illustration.data)]);
      if (stamp!==current) return;
      if (before.naturalWidth*before.naturalHeight>45000000 || Math.max(after.naturalWidth,after.naturalHeight)>640)
        throw Error('Saved image dimensions exceed the motif limits.');
      const illustration={...pixels(after,640),palette:saved.illustration.palette,preset:saved.illustration.preset};
      const packed=await pack(illustration,saved.illustration.widthMm);
      const geometry=window.StitchForgeSourceRegionProject;
      if (geometry.serialiseDraft(packed.draft)!==geometry.serialiseDraft(saved.savedDraft))
        throw Error('The saved editable geometry differs from the illustration.');
      if (stamp!==current) return;
      const originalBytes=project.imageBytes(saved.source.data);
      source={...saved.source,file:new File([originalBytes.bytes],saved.source.name,{type:'image/'+originalBytes.format})};
      name.value=saved.name;width.value=String(saved.illustration.widthMm);preset=illustration.preset;
      displayOriginal();
      show({...illustration,packed},'Saved motif opened. Approve the illustration and generate to revalidate machine downloads.');
    } catch(error) {
      if (stamp===current) message('Could not open the motif: '+error.message);
    } finally {
      if (stamp===current) setBusy(false);
    }
  }
  function deliver(format) {
    if (!result||!files) return;
    const naming=window.StitchForgeDownloadNaming;
    if (format==='zip') {
      const entries=Object.entries(files);
      entries.push(['approved-illustration.png',project.imageBytes(canvas.toDataURL('image/png')).bytes]);
      entries.push(['editable-colour-regions.json',new TextEncoder().encode(
        window.StitchForgeSourceRegionProject.serialiseDraft(proposal.packed.draft))]);
      download(window.StitchForgeAIContext.packageFiles(entries),naming.filename(name.value,'zip'),'application/zip');
    } else download(files['artwork-trial.'+format],naming.filename(name.value,format));
  }

  fileInput.addEventListener('change',()=>{const file=fileInput.files[0];fileInput.value='';void installFile(file);});
  prepare.addEventListener('click',makeIllustration);
  retry.addEventListener('click',()=>{
    preset=preparationFailed&&preset!=='clean'?'clean':nextPreset[preset];
    void makeIllustration();
  });
  approve.addEventListener('click',()=>{
    if (!proposal||pending) return;
    approved=true;generate.hidden=false;generate.disabled=false;
    message('Illustration approved. Tap Generate embroidery to create and validate the machine files.');
  });
  width.addEventListener('input',()=>{
    if (!active()) return;
    attempted=false;preparationFailed=false;
    invalidate('Width changed. Prepare a new illustration for this size.');
    generate.hidden=true;
  });
  cancel.addEventListener('click',()=>{
    stamp++;operation?.abort();operation=null;setBusy(false);
    message('Stopped waiting. Generate again when you are ready.');
  });
  save.addEventListener('click',saveProject);
  q('sfDetailedOpen').addEventListener('click',()=>projectInput.click());
  projectInput.addEventListener('change',()=>{const file=projectInput.files[0];projectInput.value='';void reopen(file);});
  return {active,enter,leave,legacy,start,deliver,upload:()=>{if (!pending) fileInput.click();}};
}

window.StitchForgeDetailedUI=Object.freeze({mount});
})();

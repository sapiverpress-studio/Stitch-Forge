/* High-quality image-to-image Cuteifier. A paid image edit happens only on the user's
 * explicit Make Cute click. Toggling an outline never calls the server.
 */
(() => {
'use strict';
const q=id=>document.getElementById(id);
const source=q('sourceFile'),generate=q('generate'),download=q('download'),resume=q('resume');
const original=q('original'),result=q('result'),status=q('status'),details=q('details'),placeholder=q('placeholder');
const authPanel=q('authPanel'),access=q('accessToken'),remember=q('rememberToken'),outline=q('blackOutline');
const outputMode=q('outputMode'),caption=q('resultCaption'),outlineOption=q('outlineOption');
const ownerStore=window.StitchForgeTokenStore;
const PENDING_KEY='sapiver.cuteifier.pending-id.v2';
let file=null,image=null,sourceUrl=null,rawPixels=null,rawWidth=0,rawHeight=0,busy=false,sequence=0,jobId='';
let resultMode='cutout',validOutput=false;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function getToken(){return access.value.trim()||ownerStore?.read()||'';}
function showToken(){authPanel.hidden=false;access.focus();}
function busyState(v){
 busy=v;generate.disabled=v||!!jobId||!image;source.disabled=v||!!jobId;
 outputMode.disabled=v||!!jobId;resume.disabled=v;
}
function clearImage(){
 rawPixels=null;validOutput=false;result.hidden=true;placeholder.hidden=false;download.disabled=true;
 outlineOption.hidden=true;details.textContent='';caption.textContent='Cute illustration';
}
function storeJob(id){
 jobId=id;
 try{if(id)sessionStorage.setItem(PENDING_KEY,id);else sessionStorage.removeItem(PENDING_KEY);}catch{}
 resume.hidden=!id;
}
function loadJob(){try{return sessionStorage.getItem(PENDING_KEY)||'';}catch{return '';}}
function validFile(f){
 return !!f&&f.size>0&&f.size<=12*1024*1024&&/\.(png|jpe?g|webp)$/i.test(f.name)&&
 (!f.type||['image/png','image/jpeg','image/webp'].includes(f.type));
}
source.addEventListener('change',async()=>{
 const stamp=++sequence;
 const f=source.files?.[0];file=null;image=null;generate.disabled=true;original.hidden=true;clearImage();
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 if(!f){message('Choose an image to begin.');return;}
 if(!validFile(f)){message('Choose a PNG, JPG or WEBP under 12 MB.',true);return;}
 let url=null;
 try{
  url=URL.createObjectURL(f);const im=new Image();im.src=url;await im.decode();
  if(im.naturalWidth*im.naturalHeight>45000000||im.naturalWidth<48||im.naturalHeight<48)
   throw Error('Image dimensions are unsupported. Try an uncropped image.');
  if(stamp!==sequence){URL.revokeObjectURL(url);return;}
  sourceUrl=url;original.src=url;original.hidden=false;file=f;image=im;
  original.style.aspectRatio=im.naturalWidth+' / '+im.naturalHeight;
  busyState(false);
  message('Image ready. Choose a cutout or full design, then tap Make cute illustration.');
 }catch(error){if(url)URL.revokeObjectURL(url);if(stamp===sequence)message('Could not read the image: '+error.message,true);}
});
function encodeSource(){
 const w=image.naturalWidth,h=image.naturalHeight;
 const scale=Math.min(1,1024/Math.max(w,h));
 const canvas=document.createElement('canvas');canvas.width=Math.max(48,Math.round(w*scale));canvas.height=Math.max(48,Math.round(h*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas is unavailable.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 for(const quality of [0.92,0.8,0.65]){
  const encoded=canvas.toDataURL('image/webp',quality);
  if(encoded.startsWith('data:image/webp;base64,')&&encoded.length<2100000)return encoded;
 }
 throw Error('This artwork is too large to process. Please reduce its dimensions.');
}
async function request(path,token,options={}){
 const response=await fetch(path,{...options,cache:'no-store',
  headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},
  signal:AbortSignal.timeout(20000)});
 if(response.status===401){showToken();throw Error('Your existing access token was rejected. Enter the correct token.');}
 if(!response.ok){
  let error='';try{error=(await response.json()).error||'';}catch{}
  throw Object.assign(Error(error||'Image service error '+response.status),{status:response.status});
 }
 return response;
}
async function generateArt(){
 if(busy||jobId||!image)return;
 const token=getToken();
 if(!token){showToken();message('Enter your existing owner token, then press Make cute illustration.',true);return;}
 let input;
 try{input=encodeSource();}catch(error){message(error.message,true);return;}
 const mode=outputMode.querySelector('input:checked').value;
 const ratio=image.naturalWidth/image.naturalHeight;
 const size=mode==='full-design'&&ratio>1.2?'1536x1024':
  mode==='full-design'&&ratio<1/1.2?'1024x1536':'1024x1024';
 busyState(true);
 message(mode==='full-design'?'Redrawing the complete scene…':'Redrawing your subject as a transparent cutout…');
 try{
  const r=await request('/api/cuteifier-submit',token,{method:'POST',body:JSON.stringify({image:input,mode,size})});
  const obj=await r.json();
  if(r.status!==202||!/^[a-f0-9-]{36}$/i.test(obj.jobId||''))throw Error('The image job did not start correctly.');
  if(remember.checked&&access.value.trim())ownerStore?.save(access.value.trim());
  storeJob(obj.jobId);
  await followJob(obj.jobId,token);
 }catch(error){message('Cuteifier: '+error.message,true);}
 finally{busyState(false);}
}
async function followJob(id,token){
 busyState(true);
 const start=Date.now();
 try{
  for(let i=0;i<100&&Date.now()-start<270000;i++){
   const response=await request('/api/cuteifier-status?id='+encodeURIComponent(id),token);
   const state=await response.json();
   if(state.state==='failed'){storeJob('');throw Error(state.error||'The redraw failed');}
   if(state.state==='done'){
    const picture=await request('/api/cuteifier-result?id='+encodeURIComponent(id),token);
    if(!(picture.headers.get('Content-Type')||'').startsWith('image/webp'))throw Error('The image result was not in the expected format');
    storeJob('');
    const mode=state.mode||'cutout';
    if(!['cutout','full-design'].includes(mode))throw Error('The result has an unsupported output type.');
    await loadOutput(await picture.blob(),mode);
    const label=mode==='cutout'?'Transparent cutout':'Full design';
    message(validOutput?label+' ready. Check the preview, then download the PNG.':
     mode==='cutout'?'The editor returned an image without a usable transparent background. PNG download is paused.':
     'The editor returned transparency in the full design. PNG download is paused.',!validOutput);
    return;
   }
   if(!['running','queued'].includes(state.state))throw Error('Unexpected image job status');
   await sleep(2500);
  }
  throw Error('The redraw may still be running. Use Recover previous generation rather than paying again.');
 }catch(error){
  if([404,410].includes(error.status))storeJob('');
  message('Cuteifier: '+error.message,true);
 }
 finally{busyState(false);}
}
async function loadOutput(blob,mode){
 if(blob.size<100||blob.size>4500000)throw Error('Generated artwork is empty or too large');
 const url=URL.createObjectURL(blob);
 try{
  const im=new Image();im.src=url;await im.decode();
  if(im.naturalWidth<256||im.naturalHeight<256||im.naturalWidth*im.naturalHeight>1600*1600)
   throw Error('Generated artwork has invalid dimensions');
  const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(!window.StitchForgeAlpha?.inspect)throw Error('Transparency validation is unavailable');
  resultMode=mode;
  validOutput=window.StitchForgeAlpha.inspect(rgba.data,canvas.width,canvas.height,mode).valid;
  rawPixels=rgba.data;rawWidth=canvas.width;rawHeight=canvas.height;
  drawResult();
 }finally{URL.revokeObjectURL(url);}
}
function drawResult(){
 if(!rawPixels)return;
 const canOutline=resultMode==='cutout'&&validOutput;
 const withOutline=canOutline&&outline.checked;
 const out=withOutline
  ?window.StitchForgeOptionalOutline.outline(rawPixels,rawWidth,rawHeight,{thickness:5})
  :new Uint8ClampedArray(rawPixels);
 result.width=rawWidth;result.height=rawHeight;
 result.style.aspectRatio=rawWidth+' / '+rawHeight;
 result.getContext('2d').putImageData(new ImageData(out,rawWidth,rawHeight),0,0);
 result.hidden=false;placeholder.hidden=true;download.disabled=!validOutput;outlineOption.hidden=!canOutline;
 caption.textContent=resultMode==='cutout'?'Transparent cutout':'Full design';
 download.textContent=resultMode==='cutout'?'Download transparent PNG':'Download full design PNG';
 details.textContent=rawWidth+' × '+rawHeight+' px'+(withOutline?' • outer black outline':'')+
  (validOutput?'. Download saves the PNG shown here.':'. Check the background in the preview.');
}
generate.addEventListener('click',generateArt);
resume.addEventListener('click',async()=>{
 if(busy)return;
 const id=jobId||loadJob();if(!id)return;
 const token=getToken();if(!token){showToken();message('Enter your token to recover the previous illustration.',true);return;}
 await followJob(id,token);
});
outline.addEventListener('change',()=>{if(rawPixels){drawResult();message('Outline setting updated without another AI generation.');}});
download.addEventListener('click',()=>{
 if(download.disabled||!rawPixels)return;
 const suffix=resultMode==='cutout'?'-cutout.png':'-full-design.png';
 result.toBlob(blob=>{
  if(!blob||blob.type!=='image/png'){message('PNG export failed. Your preview is still available.',true);return;}
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  const safe=(file?.name||'cute-illustration').replace(/\.[^.]+$/,'')
   .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,55)||'cute-illustration';
  link.download=safe+suffix;link.href=url;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('PNG downloaded. It contains the exact illustration shown in the preview.');
 },'image/png');
});
const pending=loadJob();
if(/^[a-f0-9-]{36}$/i.test(pending)){
 storeJob(pending);busyState(false);message('A previous illustration can be recovered without starting another paid edit.');
}
if(getToken())authPanel.hidden=true;
})();

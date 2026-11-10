/* High-quality image-to-image Cuteifier. A paid image edit happens only on the user's
 * explicit Make Cute click. Toggling an outline never calls the server.
 */
(() => {
'use strict';
const q=id=>document.getElementById(id);
const source=q('sourceFile'),generate=q('generate'),download=q('download'),resume=q('resume');
const original=q('original'),result=q('result'),status=q('status'),details=q('details'),placeholder=q('placeholder');
const authPanel=q('authPanel'),access=q('accessToken'),remember=q('rememberToken'),outline=q('blackOutline');
const ownerStore=window.StitchForgeTokenStore;
const PENDING_KEY='sapiver.cuteifier.pending-id.v2';
let file=null,image=null,sourceUrl=null,rawPixels=null,rawWidth=0,rawHeight=0,busy=false,sequence=0,jobId='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function getToken(){return access.value.trim()||ownerStore?.read()||'';}
function showToken(){authPanel.hidden=false;access.focus();}
function busyState(v){busy=v;generate.disabled=v||!image;source.disabled=v;resume.disabled=v;}
function clearImage(){rawPixels=null;result.hidden=true;placeholder.hidden=false;download.disabled=true;details.textContent='';}
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
  generate.disabled=false;
  message('Image ready. Press Make cute illustration to create an illustrated version.');
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
  throw Error(error||'Image service error '+response.status);
 }
 return response;
}
async function generateArt(){
 if(busy||!image)return;
 const token=getToken();
 if(!token){showToken();message('Enter your existing owner token, then press Make cute illustration.',true);return;}
 let input;
 try{input=encodeSource();}catch(error){message(error.message,true);return;}
 const previous=rawPixels;
 busyState(true);
 message('Redrawing your original as a cute illustrated character, keeping its expression and pose…');
 try{
  const r=await request('/api/cuteifier-submit',token,{method:'POST',body:JSON.stringify({image:input})});
  const obj=await r.json();
  if(r.status!==202||!/^[a-f0-9-]{36}$/i.test(obj.jobId||''))throw Error('The image job did not start correctly.');
  if(remember.checked&&access.value.trim())ownerStore?.save(access.value.trim());
  storeJob(obj.jobId);
  await followJob(obj.jobId,token);
 }catch(error){message('Cuteifier: '+error.message,true);}
 finally{busyState(false);if(previous&&!rawPixels){rawPixels=previous;drawResult();}}
}
async function followJob(id,token){
 busyState(true);
 const start=Date.now();
 try{
  for(let i=0;i<100&&Date.now()-start<270000;i++){
   const response=await request('/api/cuteifier-status?id='+encodeURIComponent(id),token);
   const state=await response.json();
   if(state.state==='failed')throw Error(state.error||'The redraw failed');
   if(state.state==='done'){
    const picture=await request('/api/cuteifier-result?id='+encodeURIComponent(id),token);
    if(!(picture.headers.get('Content-Type')||'').startsWith('image/webp'))throw Error('The image result was not in the expected format');
    await loadOutput(await picture.blob());
    storeJob('');
    message('Cute illustration ready. Check the expression, then download the PNG.');
    return;
   }
   if(!['running','queued'].includes(state.state))throw Error('Unexpected image job status');
   await sleep(2500);
  }
  throw Error('The redraw may still be running. Use Recover previous generation rather than paying again.');
 }catch(error){message('Cuteifier: '+error.message,true);}
 finally{busyState(false);}
}
async function loadOutput(blob){
 if(blob.size<100||blob.size>4500000)throw Error('Generated artwork is empty or too large');
 const url=URL.createObjectURL(blob);
 try{
  const im=new Image();im.src=url;await im.decode();
  if(im.naturalWidth<256||im.naturalHeight<256||im.naturalWidth*im.naturalHeight>1600*1600)
   throw Error('Generated artwork has invalid dimensions');
  const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height);
  let opaque=0;
  for(let i=3;i<rgba.data.length;i+=4)if(rgba.data[i]===255)opaque++;
  rawPixels=rgba.data;rawWidth=canvas.width;rawHeight=canvas.height;
  drawResult();
  if(opaque>=canvas.width*canvas.height*.99)
   message('AI generated an opaque background. The image remains downloadable, but it is not transparent. Review before using.',true);
 }finally{URL.revokeObjectURL(url);}
}
function drawResult(){
 if(!rawPixels)return;
 const out=outline.checked
  ?window.StitchForgeOptionalOutline.outline(rawPixels,rawWidth,rawHeight,{thickness:5})
  :new Uint8ClampedArray(rawPixels);
 result.width=rawWidth;result.height=rawHeight;
 result.getContext('2d').putImageData(new ImageData(out,rawWidth,rawHeight),0,0);
 result.hidden=false;placeholder.hidden=true;download.disabled=false;
 details.textContent=rawWidth+' × '+rawHeight+' PNG'+(outline.checked?' • outer black outline':' • original illustrated outline')+
  '. Download saves exactly what is shown here.';
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
 result.toBlob(blob=>{
  if(!blob||blob.type!=='image/png'){message('PNG export failed. Your preview is still available.',true);return;}
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  const safe=(file?.name||'cute-illustration').replace(/\.[^.]+$/,'')
   .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,55)||'cute-illustration';
  link.download=safe+'-cute.png';link.href=url;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('PNG downloaded. It contains the exact illustration shown in the preview.');
 },'image/png');
});
const pending=loadJob();
if(/^[a-f0-9-]{36}$/i.test(pending)){storeJob(pending);message('A previous illustration can be recovered without starting another paid edit.');}
if(getToken())authPanel.hidden=true;
})();
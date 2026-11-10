/* AI Cuteifier. One explicit paid image-edit request per button press.
 * Originals never leave this page before the user starts generation.
 * The website's OpenAI key is never exposed to the browser.
 */
(() => {
'use strict';
const q=id=>document.getElementById(id);
const source=q('sourceFile'),generate=q('generate'),download=q('download'),resume=q('resume');
const original=q('original'),canvas=q('result'),placeholder=q('placeholder');
const status=q('status'),details=q('details'),access=q('accessToken'),authPanel=q('authPanel');
const store=window.StitchForgeTokenStore;
const SESSION_KEY='sapiver.cuteifier.pending-id.v1';
let selected=null,sourceUrl=null,valid=false,busy=false,jobId='',runSerial=0;
const MAX_SOURCE_BYTES=12*1024*1024;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isImage=file=>file&&file.size>0&&file.size<=MAX_SOURCE_BYTES&&
 /\.(png|jpe?g|webp)$/i.test(file.name)&&
 (!file.type||['image/png','image/jpeg','image/webp'].includes(file.type));
function message(value,error=false){status.textContent=value;status.classList.toggle('error',error);}
function savedJob(){try{return sessionStorage.getItem(SESSION_KEY)||'';}catch{return '';}}
function setJob(id){jobId=id;try{if(id)sessionStorage.setItem(SESSION_KEY,id);else sessionStorage.removeItem(SESSION_KEY);}catch{}resume.hidden=!id;}
function token(){return access.value.trim()||store?.read()||'';}
function showAuth(){authPanel.hidden=false;access.focus();}
function controlsBusy(value){busy=value;generate.disabled=value||!selected;resume.disabled=value;source.disabled=value;}
function clearOutput(){valid=false;canvas.hidden=true;placeholder.hidden=false;download.disabled=true;details.textContent='';}
async function get(url,tokenValue,options={}){
 const response=await fetch(url,{
  ...options,cache:'no-store',
  headers:{'Authorization':'Bearer '+tokenValue,...(options.body?{'Content-Type':'application/json'}:{})},
  signal:AbortSignal.timeout(20000)
 });
 if(response.status===401){showAuth();throw Error('Your Stitch Forge owner token was rejected. Enter a valid token and try again.');}
 if(!response.ok){
  let reason='';
  try{reason=(await response.json()).error||'';}catch{}
  throw Error(reason||('Image service returned HTTP '+response.status));
 }
 return response;
}
function setOriginal(file,image,url){
 if(sourceUrl)URL.revokeObjectURL(sourceUrl);
 sourceUrl=url;selected={file,image};original.src=url;original.hidden=false;
 generate.disabled=false;clearOutput();
 authPanel.hidden=!!token();
 message('Image loaded. Press AI Cuteify to create a genuinely redrawn illustration.');
}
source.addEventListener('change',async()=>{
 const seq=++runSerial;selected=null;generate.disabled=true;original.hidden=true;
 clearOutput();
 const file=source.files?.[0];if(!file){message('Choose an image to begin.');return;}
 if(!isImage(file)){message('Choose a PNG, JPG or WebP smaller than 12 MB.',true);return;}
 let url=null;
 try{
  url=URL.createObjectURL(file);
  const image=new Image();image.src=url;
  await image.decode();
  if(image.naturalWidth*image.naturalHeight>45000000)throw Error('Source exceeds 45 million pixels.');
  if(seq!==runSerial){URL.revokeObjectURL(url);return;}
  setOriginal(file,image,url);
 }catch(error){
  if(url)URL.revokeObjectURL(url);
  if(seq===runSerial)message('Cannot open this image: '+error.message,true);
 }
});
function inputDataUrl(image){
 const longest=Math.max(image.naturalWidth,image.naturalHeight);
 const scale=Math.min(1,1024/longest);
 const w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
 if(w<48||h<48)throw Error('The image is too small for a reliable redraw.');
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 g.clearRect(0,0,w,h);g.drawImage(image,0,0,w,h);
 for(const quality of [.88,.76,.64]){
  const encoded=c.toDataURL('image/webp',quality);
  if(encoded.length<=2100000)return encoded;
 }
 throw Error('The uploaded image is too complex to send safely. Resize it before retrying.');
}
function options(){
 return {style:q('simplify').value,colours:Number(q('colours').value),outline:q('outline').value};
}
async function submit(){
 if(!selected||busy)return;
 const owner=token();
 if(!owner){showAuth();message('Enter the existing Stitch Forge owner token to enable AI image editing.',true);return;}
 const image=inputDataUrl(selected.image),request={image,...options()};
 // Deliberate, user-triggered paid invocation; no automatic retries.
 controlsBusy(true);clearOutput();
 message('Sending your artwork to the private AI redraw service…');
 try{
  const response=await get('/api/cuteifier-submit',owner,{method:'POST',body:JSON.stringify(request)});
  if(response.status!==202)throw Error('Unexpected image job response');
  const state=await response.json();
  if(!/^[a-f0-9-]{36}$/i.test(state.jobId||''))throw Error('The image job did not return an identifier.');
  if(q('rememberToken').checked&&access.value.trim())store?.save(access.value.trim());
  setJob(state.jobId);
  await followJob(state.jobId,owner);
 }catch(error){message('AI redraw stopped: '+error.message,true);controlsBusy(false);}
}
async function followJob(id,owner){
 const current=++runSerial;
 controlsBusy(true);
 message('AI is redrawing the subject into a cute, clean illustration. This is not the old colour tracer.');
 const started=Date.now();
 try{
  while(current===runSerial&&Date.now()-started<260000){
   const response=await get('/api/cuteifier-status?id='+encodeURIComponent(id),owner);
   const job=await response.json();
   if(job.state==='failed')throw Error(job.error||'The image model could not complete the request.');
   if(job.state==='done'){
    message('AI redraw finished. Preparing transparent PNG…');
    const resultResponse=await get('/api/cuteifier-result?id='+encodeURIComponent(id),owner);
    const type=resultResponse.headers.get('content-type')||'';
    if(!type.startsWith('image/webp'))throw Error('The AI editor returned an unexpected file type.');
    const blob=await resultResponse.blob();
    await showIllustration(blob);
    setJob('');
    message('Cute illustration ready. Inspect the artwork, then download the transparent PNG for Ember.');
    return;
   }
   if(!['queued','running'].includes(job.state))throw Error('Unexpected image job status');
   await wait(2800);
  }
  throw Error('The job may still be processing. Use Check previous generation rather than paying for a duplicate.');
 }catch(error){
  message('AI redraw: '+error.message,true);
 }finally{controlsBusy(false);}
}
function cornerBackground(p,w,h){
 const idx=[0,w-1,(h-1)*w,(h*w)-1].map(i=>i*4);
 if(idx.some(i=>p[i+3]<220))return null;
 const rgb=[0,1,2].map(c=>idx.reduce((s,i)=>s+p[i+c],0)/4);
 const variance=idx.every(i=>Math.hypot(p[i]-rgb[0],p[i+1]-rgb[1],p[i+2]-rgb[2])<18);
 const nearWhite=rgb.every(x=>x>225);
 return variance&&nearWhite?rgb:null;
}
function ensureTransparency(imageData,w,h){
 const p=imageData.data,n=w*h;
 let transparent=0;for(let i=3;i<p.length;i+=4)if(p[i]<70)transparent++;
 if(transparent>n*.015)return true;
 const target=cornerBackground(p,w,h);
 if(!target)return false;
 const queue=new Int32Array(n),visited=new Uint8Array(n);let total=0;
 const tryPush=i=>{
  if(i<0||i>=n||visited[i])return;
  visited[i]=1;const k=i*4;
  if(Math.hypot(p[k]-target[0],p[k+1]-target[1],p[k+2]-target[2])<=27)queue[total++]=i;
 };
 for(let x=0;x<w;x++){tryPush(x);tryPush((h-1)*w+x);}
 for(let y=0;y<h;y++){tryPush(y*w);tryPush(y*w+w-1);}
 for(let i=0;i<total;i++){
  const at=queue[i],x=at%w,k=at*4;p[k+3]=0;
  if(x)tryPush(at-1);if(x<w-1)tryPush(at+1);
  if(at>=w)tryPush(at-w);if(at+w<n)tryPush(at+w);
 }
 return total>n*.01&&total<n*.97;
}
async function showIllustration(blob){
 if(blob.size<100||blob.size>4500000)throw Error('AI returned an oversized or empty image.');
 const url=URL.createObjectURL(blob);
 try{
  const image=new Image();image.src=url;await image.decode();
  const w=image.naturalWidth,h=image.naturalHeight;
  if(w<256||h<256||w*h>5000000)throw Error('AI returned an unsupported image size.');
  const src=document.createElement('canvas');src.width=w;src.height=h;
  const cg=src.getContext('2d',{willReadFrequently:true});cg.drawImage(image,0,0);
  const data=cg.getImageData(0,0,w,h);
  if(!ensureTransparency(data,w,h))throw Error('The AI result lacks a safely removable background. This image cannot be labelled transparent.');
  cg.putImageData(data,0,0);
  let minX=w,minY=h,maxX=-1,maxY=-1,visible=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;
   if(data.data[i+3]<72)continue;
   visible++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  if(visible<1000||maxX-minX<60||maxY-minY<60)throw Error('The generated subject is missing or too small.');
  const subjW=maxX-minX+1,subjH=maxY-minY+1,scale=Math.min(1620/subjW,1620/subjH);
  const dw=subjW*scale,dh=subjH*scale,dx=(2000-dw)/2,dy=(2000-dh)/2;
  const mask=document.createElement('canvas');mask.width=2000;mask.height=2000;
  const mg=mask.getContext('2d');mg.fillStyle='#000000';mg.fillRect(0,0,2000,2000);
  mg.globalCompositeOperation='destination-in';
  mg.drawImage(src,minX,minY,subjW,subjH,dx,dy,dw,dh);
  const output=canvas.getContext('2d');output.clearRect(0,0,2000,2000);
  output.imageSmoothingEnabled=true;output.imageSmoothingQuality='high';
  const radius={thin:2,medium:5,bold:9}[q('outline').value]||5;
  for(let a=0;a<16;a++){
   const t=2*Math.PI*a/16;
   output.drawImage(mask,Math.round(radius*Math.cos(t)),Math.round(radius*Math.sin(t)));
  }
  output.drawImage(src,minX,minY,subjW,subjH,dx,dy,dw,dh);
  canvas.hidden=false;placeholder.hidden=true;download.disabled=false;valid=true;
  details.textContent='2000 × 2000 PNG • transparent background • AI-redrawn with black outer outline. '+
    'Check that its main colour regions and facial details will work at your chosen Ember stitch size.';
 }finally{URL.revokeObjectURL(url);}
}
generate.addEventListener('click',submit);
resume.addEventListener('click',async()=>{
 const id=jobId||savedJob();if(!id||busy)return;
 const owner=token();if(!owner){showAuth();message('Enter your Stitch Forge token to retrieve the previous paid generation.',true);return;}
 await followJob(id,owner);
});
for(const id of ['simplify','colours','outline']){
 q(id).addEventListener('change',()=>{
  if(!busy&&valid)message('New settings selected. Your previous PNG remains downloadable until you start another AI redraw.');
 });
}
download.addEventListener('click',()=>{
 if(!valid)return;
 canvas.toBlob(blob=>{
  if(!blob||blob.type!=='image/png'){message('The PNG could not be exported. Your generated image is still visible.',true);return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  const safe=(selected?.file.name||'cute-illustration').replace(/\.[^.]+$/,'')
   .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,46)||'cute-illustration';
  a.href=url;a.download=safe+'-cute-for-ember.png';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('Transparent PNG download started. Ember will still need to digitise the stitches.');
 },'image/png');
});
const pending=savedJob();
if(/^[a-f0-9-]{36}$/i.test(pending)){setJob(pending);message('An earlier AI redraw may still be available. Select Check previous generation to retrieve it.');}
})();
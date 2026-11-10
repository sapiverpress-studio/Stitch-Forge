(() => {
'use strict';
const el=id=>document.getElementById(id);
const fileInput=el('sourceFile'),generate=el('generate'),download=el('download');
const original=el('original'),result=el('result'),status=el('status'),details=el('details'),placeholder=el('placeholder');
let selected=null,objectUrl=null,valid=false,serial=0;
const readableBytes=12*1024*1024;
function message(s,error=false){status.textContent=s;status.classList.toggle('error',error);}
function invalidate(){
 serial++;valid=false;download.disabled=true;
 result.hidden=true;placeholder.hidden=false;details.textContent='';
}
function validImage(file){
 return file&&file.size>0&&file.size<=readableBytes&&
  /\.(png|jpe?g|webp)$/i.test(file.name)&&
  (!file.type||['image/png','image/jpeg','image/webp'].includes(file.type));
}
fileInput.addEventListener('change',async()=>{
 invalidate();selected=null;generate.disabled=true;
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 original.hidden=true;const file=fileInput.files?.[0];
 if(!file){message('Choose an image to begin.');return;}
 if(!validImage(file)){message('Choose a PNG, JPG or WEBP under 12 MB.',true);return;}
 const uploadSerial=serial;
 let newUrl=null;
 try{
  newUrl=URL.createObjectURL(file);
  const img=new Image();img.src=newUrl;
  await img.decode();
  if(img.naturalWidth*img.naturalHeight>45000000)throw Error('Source image exceeds 45 million pixels.');
  if(uploadSerial!==serial){URL.revokeObjectURL(newUrl);return;}
  objectUrl=newUrl;original.src=newUrl;original.hidden=false;
  selected={file,image:img};generate.disabled=false;
  message('Image loaded. Choose your settings, then select Simplify and outline.');
 }catch(error){
  if(newUrl)URL.revokeObjectURL(newUrl);
  if(uploadSerial===serial)message('Cannot open image: '+error.message,true);
 }
});
async function run(){
 if(!selected)return;
 const thisRun=++serial;
 generate.disabled=true;download.disabled=true;result.hidden=true;placeholder.hidden=false;valid=false;
 message('Separating the subject, simplifying colours and preparing black outlines…');
 // Let the browser paint the status before CPU-only image processing.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 try{
  const image=selected.image,max=480,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
  const w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
  if(w<48||h<48)throw Error('This image is too narrow; crop to one subject and upload again.');
  const work=document.createElement('canvas');work.width=w;work.height=h;
  const context=work.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Canvas processing is unavailable.');
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.clearRect(0,0,w,h);context.drawImage(image,0,0,w,h);
  const imageData=context.getImageData(0,0,w,h);
  const widthMm=Number(el('stitchWidth').value);
  const prepared=window.StitchForgeDetailedMotif.prepare(imageData.data,w,h,{
   widthMm,preset:el('simplify').value,imageOnly:true
  });
  const outlined=window.StitchForgeEmberOutline.prepare(prepared.rgba,w,h,{
   outline:el('outline').value,detail:el('internal').checked?'major':'outer'
  });
  if(thisRun!==serial)return;
  const temp=document.createElement('canvas');temp.width=w;temp.height=h;
  temp.getContext('2d').putImageData(new ImageData(outlined.rgba,w,h),0,0);
  const bounds=outlined.quality.bounds,subjectW=bounds.maxX-bounds.minX+1,subjectH=bounds.maxY-bounds.minY+1;
  const pad=0.09,scaleFinal=Math.min(2000*(1-2*pad)/subjectW,2000*(1-2*pad)/subjectH);
  const drawW=subjectW*scaleFinal,drawH=subjectH*scaleFinal;
  const c=result.getContext('2d');c.clearRect(0,0,result.width,result.height);
  // Nearest-neighbour output retains exact flat regions and pure black,
  // avoiding new anti-aliased pseudo-colours that confuse some tracing tools.
  c.imageSmoothingEnabled=false;
  c.drawImage(temp,bounds.minX,bounds.minY,subjectW,subjectH,
   (2000-drawW)/2,(2000-drawH)/2,drawW,drawH);
  result.hidden=false;placeholder.hidden=true;valid=true;download.disabled=false;
  const warnings=prepared.quality.warnings||[];
  details.textContent='2000 × 2000 transparent PNG • '+prepared.palette.length+
    ' base colours + black • '+prepared.quality.regions+' colour regions. '+
    (warnings.length?warnings.join(' '):'Check that small features are still recognisable.');
  message('PNG ready. Compare the detail and download the prepared image. It still needs digitising in Ember.');
 }catch(error){
  if(thisRun===serial)message('Preparation stopped: '+error.message,true);
 }finally{
  if(thisRun===serial)generate.disabled=!selected;
 }
}
generate.addEventListener('click',run);
for(const id of ['simplify','outline','stitchWidth','internal']){
 el(id).addEventListener('change',()=>{
  invalidate();
  if(selected)message('Settings changed. Select Simplify and outline to generate an updated PNG.');
 });
}
download.addEventListener('click',()=>{
 if(!valid)return;
 result.toBlob(blob=>{
  if(!blob||blob.type!=='image/png'){message('PNG export failed. Try again.',true);return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  const name=(selected?.file.name||'design').replace(/\.[^.]+$/,'')
   .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,50)||'design';
  a.href=url;a.download=name+'-ember-ready.png';document.body.append(a);
  a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('PNG download started. Import it into Ember and check the stitch construction.');
 },'image/png');
});
})();

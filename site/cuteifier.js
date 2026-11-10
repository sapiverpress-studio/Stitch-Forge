/* Original Detailed Motif simplification algorithm unchanged.
 * Optional OUTER silhouette outline is applied only when selected.
 * Download saves precisely the displayed RGBA canvas, without AI/network calls.
 */
(() => {
'use strict';
const q=id=>document.getElementById(id);
const input=q('sourceFile'),generate=q('generate'),download=q('download');
const original=q('original'),result=q('result'),status=q('status'),placeholder=q('placeholder'),details=q('details');
let selected=null,sourceUrl=null,ready=false,stamp=0;
function message(value,error=false){status.textContent=value;status.classList.toggle('error',error);}
function clear(){ready=false;download.disabled=true;result.hidden=true;placeholder.hidden=false;details.textContent='';}
function allowed(file){return file&&file.size>0&&file.size<=12*1024*1024&&/\.(png|jpe?g|webp)$/i.test(file.name)&&(!file.type||['image/png','image/jpeg','image/webp'].includes(file.type));}
input.addEventListener('change',async()=>{
 const current=++stamp;selected=null;generate.disabled=true;original.hidden=true;clear();
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 const file=input.files?.[0];
 if(!file){message('Choose an image.');return;}
 if(!allowed(file)){message('Choose a PNG, JPG or WEBP below 12 MB.',true);return;}
 let url=null;
 try{
  url=URL.createObjectURL(file);
  const image=new Image();image.src=url;await image.decode();
  if(image.naturalWidth*image.naturalHeight>45000000)throw Error('Image exceeds 45 million pixels.');
  if(stamp!==current){URL.revokeObjectURL(url);return;}
  sourceUrl=url;original.src=url;original.hidden=false;selected={image,file};generate.disabled=false;
  message('Image loaded. Select Prepare illustration.');
 }catch(error){if(url)URL.revokeObjectURL(url);if(stamp===current)message('Cannot open image: '+error.message,true);}
});
async function prepareImage(){
 if(!selected)return;
 const current=++stamp;generate.disabled=true;clear();
 message('Simplifying using the original image-preparation engine…');
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 try{
  const img=selected.image,scale=Math.min(1,480/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.round(img.naturalWidth*scale),h=Math.round(img.naturalHeight*scale);
  if(w<48||h<48)throw Error('The image is too narrow to simplify.');
  const work=document.createElement('canvas');work.width=w;work.height=h;
  const ctx=work.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas unavailable.');
  ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
  const imageData=ctx.getImageData(0,0,w,h);
  const illustration=window.StitchForgeDetailedMotif.prepare(imageData.data,w,h,{
   widthMm:Number(q('stitchWidth').value),preset:q('simplify').value,imageOnly:true
  });
  if(current!==stamp)return;
  const pixels=q('blackOutline').checked
   ? window.StitchForgeOptionalOutline.outline(illustration.rgba,illustration.width,illustration.height)
   : illustration.rgba;
  result.width=illustration.width;result.height=illustration.height;
  result.getContext('2d').putImageData(
   new ImageData(pixels,illustration.width,illustration.height),0,0);
  result.hidden=false;placeholder.hidden=true;ready=true;download.disabled=false;
  details.textContent=illustration.width+' × '+illustration.height+' PNG • '+
   illustration.palette.length+' colours'+(q('blackOutline').checked?' • black outer outline':' • no outline')+
   '. Check the simplified image against the original.';
  message('Simplified illustration ready.');
 }catch(error){if(current===stamp)message('Simplification stopped: '+error.message,true);}
 finally{if(current===stamp)generate.disabled=!selected;}
}
generate.addEventListener('click',prepareImage);
for(const key of ['simplify','stitchWidth','blackOutline']){
 q(key).addEventListener('change',()=>{stamp++;clear();if(selected)message('Settings changed. Select Prepare illustration again.');});
}
download.addEventListener('click',()=>{
 if(!ready)return;
 result.toBlob(blob=>{
  if(!blob||blob.type!=='image/png'){message('PNG download failed. Try again.',true);return;}
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  const name=(selected?.file.name||'artwork').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,55)||'artwork';
  link.download=name+'-simplified.png';link.href=url;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('Simplified PNG download started.');
 },'image/png');
});
})();
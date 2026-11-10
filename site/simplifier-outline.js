/* Optional BLACK OUTER SILHOUETTE only. The source illustration is never modified.
 * Transparent holes and individual colour patches are not outlined.
 */
(function(root){
'use strict';
function outline(rgba,w,h,{thickness=2}={}){
 if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||
   w<16||h<16||w*h>640*640||rgba.length!==4*w*h)throw Error('Invalid artwork dimensions');
 if(!Number.isInteger(thickness)||thickness<1||thickness>5)throw Error('Invalid outline width');
 const n=w*h,exterior=new Uint8Array(n),queue=new Int32Array(n);
 let count=0;
 function add(i){if(i<0||i>=n||exterior[i]||rgba[i*4+3]>=128)return;
  exterior[i]=1;queue[count++]=i;}
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
 for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 for(let k=0;k<count;k++){
  const i=queue[k],x=i%w;
  if(x)add(i-1);if(x<w-1)add(i+1);
  if(i>=w)add(i-w);if(i+w<n)add(i+w);
 }
 const output=new Uint8ClampedArray(rgba),r=thickness;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,at=i*4;
  if(rgba[at+3]<128)continue;
  let isBorder=false;
  for(let dy=-r;dy<=r&&!isBorder;dy++)for(let dx=-r;dx<=r;dx++){
   if(dx*dx+dy*dy>r*r)continue;
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=w||ny>=h){isBorder=true;break;}
   if(exterior[ny*w+nx]){isBorder=true;break;}
  }
  if(isBorder){output[at]=0;output[at+1]=0;output[at+2]=0;}
 }
 return output;
}
const api=Object.freeze({outline});
root.StitchForgeOptionalOutline=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

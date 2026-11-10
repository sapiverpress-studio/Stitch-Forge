/* Flat-colour black-outline preparation for an embroidery editor.
 * Pixel-only operation: no external requests, stitch simulation or invented image details.
 */
(function(root){
'use strict';
const LEVELS=Object.freeze({thin:1,medium:2,bold:4});
function paintBlack(out,at){out[at]=0;out[at+1]=0;out[at+2]=0;out[at+3]=255;}
function isDark(p,at){return (p[at]*.299+p[at+1]*.587+p[at+2]*.114)<72;}
function sqDiff(p,a,b){const x=p[a]-p[b],y=p[a+1]-p[b+1],z=p[a+2]-p[b+2];return x*x+y*y+z*z;}
function prepare(rgba,w,h,{outline='medium',detail='major'}={}){
 if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||
    !Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16||
    w*h>640*640||rgba.length!==w*h*4)throw Error('Invalid flat-colour image.');
 if(!Object.hasOwn(LEVELS,outline))throw Error('Choose a valid outline thickness.');
 if(!['major','outer'].includes(detail))throw Error('Choose outer or major boundaries.');
 const n=w*h,r=LEVELS[outline],out=new Uint8ClampedArray(rgba);
 const bins=new Map();let foreground=0,minX=w,minY=h,maxX=-1,maxY=-1;
 for(let i=0;i<n;i++){
  const at=i*4;if(rgba[at+3]<128)continue;
  foreground++;const x=i%w,y=(i-x)/w;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  const k=(rgba[at]<<16)|(rgba[at+1]<<8)|rgba[at+2];bins.set(k,(bins.get(k)||0)+1);
 }
 if(foreground<100||foreground>n*.995)throw Error('A transparent subject with a visible surrounding margin is required.');
 const minArea=Math.max(15,Math.round(foreground*.012));
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
 let outlined=0,interior=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,at=i*4;if(rgba[at+3]<128)continue;
  const own=(rgba[at]<<16)|(rgba[at+1]<<8)|rgba[at+2];
  let edge=false,inner=false;
  for(const [dx,dy] of dirs){
   for(let step=1;step<=r;step++){
    const xx=x+dx*step,yy=y+dy*step;
    if(xx<0||yy<0||xx>=w||yy>=h||rgba[(yy*w+xx)*4+3]<128){edge=true;break;}
   }
   if(edge)break;
  }
  if(!edge&&detail==='major'&&!isDark(rgba,at)){
   for(const [dx,dy] of dirs.slice(0,4)){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
    const j=(yy*w+xx)*4;if(rgba[j+3]<128)continue;
    const other=(rgba[j]<<16)|(rgba[j+1]<<8)|rgba[j+2];
    if(other!==own&&(bins.get(own)||0)>=minArea&&(bins.get(other)||0)>=minArea&&sqDiff(rgba,at,j)>72*72){
     inner=true;break;
    }
   }
  }
  if(edge||inner||isDark(rgba,at)){
   paintBlack(out,at);outlined++;if(inner)interior++;
  }
 }
 return {rgba:out,width:w,height:h,quality:{
  foregroundPixels:foreground,baseColours:bins.size,outlinePixels:outlined,internalBoundaryPixels:interior,
  bounds:{minX,minY,maxX,maxY},outline,detail,
  semanticRedraw:false,machineFile:false
 }};
}
const api=Object.freeze({prepare});
root.StitchForgeEmberOutline=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

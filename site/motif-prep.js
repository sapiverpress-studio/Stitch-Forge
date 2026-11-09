/* MD-2.77 — small flat-colour motif preparation for the EXISTING native engine.
 * Fully automatic: original pixels -> bounded foreground -> restrained palette
 * -> exact source-owned masks. Does not invent stitches or relax worker audits.
 * Unsuitable images fail closed and can use the unchanged detailed-art trial.
 */
(function(root){
'use strict';
const dep=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const P=dep('StitchForgeSourceRegionProject','./source-region-project.js');
const L=dep('StitchForgeSourceMaskLedger','./source-mask-ledger.js');
const T=dep('StitchForgeSourceTopology','./source-topology.js');
const R=dep('StitchForgeAutoReconstruct','./auto-reconstruct.js');
const LIMIT_COLOURS=6,MAX_COMPONENTS=160,MAX_TINY_COMPONENTS=60;
const rgbHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0').toUpperCase()).join('');
function closest(pixel,palette){
 let winner=0,lowest=Infinity;
 for(let i=0;i<palette.length;i++){
  const c=palette[i],d=(pixel[0]-c[0])**2+(pixel[1]-c[1])**2+(pixel[2]-c[2])**2;
  if(d<lowest){lowest=d;winner=i;}
 }
 return [winner,lowest];
}
async function prepare(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h}={}){
 if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||
    !Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>750000||
    rgba.length!==w*h*4)throw Error('Invalid simple motif source pixels');
 if(!Number.isFinite(imageWidthMm)||imageWidthMm<10||imageWidthMm>250)
  throw Error('Invalid embroidery width');
 const foreground=R.sourceForegroundMask(rgba,w,h),bins=new Map();
 let foregroundPixels=0;
 for(let k=0;k<w*h;k++){
  if(!foreground[k])continue;
  foregroundPixels++;
  const j=4*k,r=rgba[j],g=rgba[j+1],b=rgba[j+2];
  const bucket=((r>>3)<<10)|((g>>3)<<5)|(b>>3);
  let record=bins.get(bucket);
  if(!record){record={n:0,r:0,g:0,b:0};bins.set(bucket,record);}
  record.n++;record.r+=r;record.g+=g;record.b+=b;
 }
 if(foregroundPixels<80||foregroundPixels>w*h*.97)
  throw Error('Simple motif needs a distinct foreground with some blank background');
 const bucketed=[...bins.values()].map(z=>({n:z.n,rgb:[z.r/z.n,z.g/z.n,z.b/z.n]}))
   .sort((a,b)=>b.n-a.n);
 if(!bucketed.length)throw Error('No motif colours could be measured');
 const picked=[bucketed[0].rgb];
 const minSeedPixels=Math.max(12,Math.ceil(foregroundPixels*.0015));
 for(let i=1;i<LIMIT_COLOURS;i++){
  let selected=null,maxScore=0;
  for(const entry of bucketed){
   if(entry.n<minSeedPixels)continue;
   const [,dist]=closest(entry.rgb,picked);
   if(dist<45**2)continue;
   const score=entry.n*dist;
   if(score>maxScore){selected=entry;maxScore=score;}
  }
  if(!selected)break;
  picked.push(selected.rgb);
 }
 // One deterministic assignment, then refine actual thread RGB centres.
 let totals=picked.map(()=>[0,0,0,0]);
 for(const entry of bucketed){
  const [i]=closest(entry.rgb,picked),t=totals[i];
  t[0]+=entry.rgb[0]*entry.n;t[1]+=entry.rgb[1]*entry.n;
  t[2]+=entry.rgb[2]*entry.n;t[3]+=entry.n;
 }
 const colours=totals.filter(t=>t[3]>0).map(t=>t.slice(0,3).map(x=>Math.round(x/t[3])));
 const final=colours.map(rgb=>({color:rgbHex(rgb),rgb})).sort((a,b)=>a.color.localeCompare(b.color));
 if(new Set(final.map(c=>c.color)).size!==final.length)
  throw Error('Automatic motif palette collapsed onto duplicate thread colours');
 const masks=final.map(()=>new Uint8Array(w*h)),hist=new Array(final.length).fill(0);
 let totalError=0,highError=0;
 for(let k=0;k<w*h;k++){
  if(!foreground[k])continue;
  const j=4*k,pixel=[rgba[j],rgba[j+1],rgba[j+2]];
  const [ci,squared]=closest(pixel,final.map(e=>e.rgb));
  const d=Math.sqrt(squared);totalError+=d;
  if(d>55)highError++;
  masks[ci][k]=1;hist[ci]++;
 }
 const meanError=totalError/foregroundPixels;
 if(meanError>27||highError/foregroundPixels>.12)
  throw Error('This image has too much shading or texture for automatic simple-motif digitising; use flatter artwork');
 const sha=await P.fingerprint(rgba,w,h),regions=[];
 let componentCount=0,tinyCount=0;
 for(let i=0;i<final.length;i++){
  if(!hist[i])continue;
  const ledger=L.ledgerFromMask(masks[i],w,h);
  componentCount+=ledger.components.length;
  tinyCount+=ledger.components.filter(c=>c.pixelArea<12).length;
  if(componentCount>MAX_COMPONENTS||tinyCount>MAX_TINY_COMPONENTS)
   throw Error('Automatic motif has too many detached pixel fragments; use cleaner flat-colour artwork');
  const topology=T.contoursFromLedger(ledger);
  regions.push({id:sha.slice(0,12)+'-colour-'+(regions.length+1),
    color:final[i].color,ledger,topology});
 }
 if(!regions.length)throw Error('No visible motif regions available');
 const draft=P.validateDraft({
  schema:'stitch-forge-source-region-project-v1',
  source:{sha256:sha,width:w,height:h,originalWidth,originalHeight},
  physical:{imageWidthMm},
  regions,foregroundPixels,
  quantisation:{pixelsBeyondRgb60:highError,meanRgbDistance:meanError}
 });
 return {draft,quality:{mode:'automatic_flat_motif_source_partition',
  palette:regions.map(x=>x.color),colourCount:regions.length,sourcePixels:foregroundPixels,
  components:componentCount,smallComponents:tinyCount,
  meanRgbError:Number(meanError.toFixed(3)),
  fractionPixelsBeyondRgb55:Number((highError/foregroundPixels).toFixed(5)),
  allForegroundPixelsAccountedFor:true,semanticDetailVerified:false,
  machineFileGenerated:false,physicalSewoutVerified:false}};
}
const api=Object.freeze({prepare});
root.StitchForgeMotifPrep=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

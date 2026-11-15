/* User-selected, local download labels. Source pixels, signed packets,
 * independently verified PES/DST bytes and stitch geometry are unchanged.
 */
(function(root){
'use strict';
function slug(value){
 if(typeof value!=='string')return 'embroidery-design';
 let s=value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 s=s.slice(0,56).replace(/-+$/,'');
 return s||'embroidery-design';
}
function sizedStem(name,width){
 const base=slug(name);
 if(!Number.isFinite(width))return base;
 const suffix='-'+String(width).replace('.','p')+'mm';
 return base.slice(0,56-suffix.length).replace(/-+$/,'')+suffix;
}
function filename(name,extension,width){
 if(!['zip','pes','dst'].includes(extension))throw Error('Unsupported embroidery file extension');
 return sizedStem(name,width)+'-TRIAL-NOT-APPROVED.'+extension;
}
function reportName(name,width){return sizedStem(name,width)+'-machine-report-PRIVATE-NOT-APPROVED.json';}
const api=Object.freeze({slug,filename,reportName});
root.StitchForgeDownloadNaming=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

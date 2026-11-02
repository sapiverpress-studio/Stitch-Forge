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
function filename(name,extension){
 if(!['zip','pes','dst'].includes(extension))throw Error('Unsupported embroidery file extension');
 return slug(name)+'-TRIAL-NOT-APPROVED.'+extension;
}
function reportName(name){return slug(name)+'-machine-report-PRIVATE-NOT-APPROVED.json';}
const api=Object.freeze({slug,filename,reportName});
root.StitchForgeDownloadNaming=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

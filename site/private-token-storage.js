/* Only the owner's Stitch Forge access token is saved locally by opt-in.
 * NOT an OpenAI API key. Storage is browser-profile scoped and same-origin JS
 * can read it; users can clear it on a shared device.
 */
(function(root){
'use strict';
const KEY='sapiver.stitchforge.owner-access-token.v1';
function store(){try{return root.localStorage||null;}catch{return null;}}
const api=Object.freeze({
 key:KEY,
 read(){try{const value=store()?.getItem(KEY);return typeof value==='string'&&value.length<=4096?value:'';}catch{return '';}},
 save(value){if(typeof value!=='string'||!value.trim()||value.length>4096)return false;
  try{const target=store();if(!target)return false;target.setItem(KEY,value.trim());return target.getItem(KEY)===value.trim();}catch{return false;}},
 forget(){try{const target=store();if(!target)return false;target.removeItem(KEY);return target.getItem(KEY)===null;}catch{return false;}}
});
root.StitchForgeTokenStore=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);

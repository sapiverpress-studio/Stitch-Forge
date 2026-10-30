// Local-only original RGBA -> actual app source/object contracts. No service.
const fs=require('node:fs'),path=require('node:path');
const P=require('../site/source-region-project.js'),A=require('../site/source-object-plan.js');
(async()=>{
 const [raw,w,h,mm,out,ow=w,oh=h]=process.argv.slice(2),rgba=new Uint8ClampedArray(fs.readFileSync(raw));
 const draft=await P.createInspectionDraft(rgba,+w,+h,{imageWidthMm:+mm,originalWidth:+ow,originalHeight:+oh}),plan=await A.build(draft);
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'source-draft.json'),P.serialiseDraft(draft));
 fs.writeFileSync(path.join(out,'source-object-plan.json'),JSON.stringify(plan));
 fs.writeFileSync(path.join(out,'prepared-artwork.svg'),A.geometrySvg(plan));
 console.log(JSON.stringify(plan.summary));
})().catch(error=>{console.error(error.message);process.exitCode=1;});

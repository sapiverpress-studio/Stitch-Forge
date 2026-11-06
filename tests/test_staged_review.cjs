'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../site/staged-review.js');

function sample(){
 return {schema:'stitch-forge-offline-stage-review-v1',
  sourcePlanSignature:'a'.repeat(64),sourceSha256:'b'.repeat(64),
  counts:{tatami:3,satin:0,running:2},dataOnly:true,originalImageIncluded:false,machineApproved:false,
  candidates:[{sourceObjectId:'114488-0',method:'curved',color:'#114488',
   estimatedFootprintAreaFraction:.59,sourceGeometryStrictlyContained:true,
   originalWorkingPixelsChanged:false,fabricSewoutVerified:false}]};
}
test('offline review is bound to image and returns only exact source choices',()=>{
 const b=sample();
 assert.equal(R.validate(b),b);
 assert.deepEqual(R.createDecisions(b,['114488-0']),{
  schema:'stitch-forge-offline-stage-decisions-v1',sourcePlanSignature:'a'.repeat(64),
  sourceSha256:'b'.repeat(64),choices:[{sourceObjectId:'114488-0',method:'curved'}]
 });
 assert.deepEqual(R.createDecisions(b,[]).choices,[]);
});
test('untrusted report cannot assert machine approval or original-image payload',()=>{
 for(const [field,value] of [['machineApproved',true],['originalImageIncluded',true],['dataOnly',false],
                             ['sourceSha256','bad'],['schema','wrong']]){
  const b=sample();b[field]=value;
  assert.throws(()=>R.validate(b));
 }
});
test('reject repeated, unsupported, unbounded and tampered candidate selections',()=>{
 const b=sample();
 assert.throws(()=>R.createDecisions(b,['FFFFFF-99']));
 assert.throws(()=>R.createDecisions(b,['114488-0','114488-0']));
 const bad=sample();bad.candidates[0].estimatedFootprintAreaFraction=1.5;
 assert.throws(()=>R.validate(bad));
 bad.candidates[0].estimatedFootprintAreaFraction=.59;
 bad.candidates.push({...bad.candidates[0]});
 assert.throws(()=>R.validate(bad));
});

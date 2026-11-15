const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),naming=require(path.join(__dirname,'../site/download-naming.js'));
test('typed name controls ZIP PES DST and report names',()=>{
 const p='Kingfisher on Ivy';
 assert.equal(naming.filename(p,'zip'),'kingfisher-on-ivy-TRIAL-NOT-APPROVED.zip');
 assert.equal(naming.filename(p,'pes'),'kingfisher-on-ivy-TRIAL-NOT-APPROVED.pes');
 assert.equal(naming.filename(p,'dst'),'kingfisher-on-ivy-TRIAL-NOT-APPROVED.dst');
 assert.equal(naming.reportName(p),'kingfisher-on-ivy-machine-report-PRIVATE-NOT-APPROVED.json');
});
test('names never depend on uploaded filename, never traverse paths and stay bounded',()=>{
 assert.equal(naming.filename('../IMG_8232.png','pes'),'img-8232-png-TRIAL-NOT-APPROVED.pes');
 assert.equal(naming.filename('   ','zip'),'embroidery-design-TRIAL-NOT-APPROVED.zip');
 assert.equal(naming.filename('Crème & Café!','dst'),'creme-cafe-TRIAL-NOT-APPROVED.dst');
 assert.ok(naming.slug('X'.repeat(300)).length<=56);
 assert.throws(()=>naming.filename('Bird','exe'),/Unsupported/);
});
test('size suffixes stay visible and distinct even with a long product name',()=>{
 const name='Red rose with leaves '.repeat(4);
 const medium=naming.filename(name,'pes',67.5),small=naming.filename(name,'pes',45);
 assert.match(medium,/-67p5mm-TRIAL-NOT-APPROVED\.pes$/);
 assert.match(small,/-45mm-TRIAL-NOT-APPROVED\.pes$/);
 assert.notEqual(medium,small);
 assert.match(naming.reportName(name,45),/-45mm-machine-report-PRIVATE-NOT-APPROVED\.json$/);
});

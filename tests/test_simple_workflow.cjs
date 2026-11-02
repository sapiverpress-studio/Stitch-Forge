const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const file=fs.readFileSync(path.join(__dirname,'../site/simple-workflow.js'),'utf8');
const native=fs.readFileSync(path.join(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
function page(owner='saved-owner-token'){
 const nodes=new Map(),listeners=new Map(),frames=new Map();let counter=0,strokes=0;
 class Element {
  constructor(tag='div'){this.tag=tag;this.disabled=false;this.hidden=false;this.value='';this.files=[];this.handlers=new Map();this.classList={add(){},remove(){},toggle(){}};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  setAttribute(){}
  set innerHTML(markup){
   this.markup=markup;
   for(const match of markup.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){
    const node=new Element();node.id=match[1];
    node.disabled=/\sdisabled(?:\s|>)/.test(match[0]);
    node.hidden=/\shidden(?:\s|>)/.test(match[0]);
    node.value=match[0].match(/\svalue="([^"]*)"/)?.[1]||'';
   }
  }
  addEventListener(name,fn){const list=this.handlers.get(name)||[];list.push(fn);this.handlers.set(name,list);}
  dispatchEvent(event){for(const fn of this.handlers.get(event.type)||[])fn(event);}
  click(){this.clicks=(this.clicks||0)+1;for(const fn of this.handlers.get('click')||[])fn();}
  focus(){this.focused=true;}before(){}appendChild(){}
  querySelector(query){return query==='.workspace'?nodes.get('workspace'):query==='.note'?nodes.get('note'):nodes.get(query.slice(1));}
  getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}};}
 }
 for(const id of ['main','workspace','note','sfAutoRun','importFile','sfAutoToken','sfAutoWorkflow','sfAutoDownload','sfAutoPES','sfAutoDST','sfAutoProductName','sfNativeWidth'])new Element().id=id;
 nodes.get('sfNativeWidth').value='80';
 nodes.get('sfAutoToken').value=owner;
 nodes.get('sfAutoWorkflow').value='native';
 const window={StitchForgeAIContext:{getImage:()=> 'data:image/png;base64,fixture',getSourceStatus:()=> 'original'},
  addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
  dispatch(name,detail){for(const fn of listeners.get(name)||[])fn({type:name,detail});}};
 const document={querySelector:name=>name==='main'?nodes.get('main'):nodes.get(name.slice(1)),createElement:name=>new Element(name),head:{appendChild(){}}};
 const requestAnimationFrame=cb=>{frames.set(++counter,cb);return counter;},cancelAnimationFrame=id=>frames.delete(id);
 vm.runInNewContext(file,{window,document,Event:class{constructor(type){this.type=type;}},requestAnimationFrame,cancelAnimationFrame});
 return {get:id=>nodes.get(id),window,strokes:()=>strokes,flush(){let count=0;while(frames.size&&count++<1500){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}assert.ok(count<1500);}};
}
test('product screen has only four stages, with old tools collapsed and Generate initially disabled',()=>{
 const p=page(),markup=p.get('sfSimpleFlow').markup;
 for(const value of ['Upload image','Generate embroidery','Stitch video','Download ZIP'])assert.ok(markup.includes(value));
 assert.ok(p.get('sfAdvancedTools'));assert.equal(p.get('sfQuickGenerate').disabled,true);
 assert.equal(p.get('sfQuickZip').disabled,true);
});
test('upload has no paid API side effect, generate triggers exactly one existing native request',()=>{
 const p=page();p.get('sfQuickUpload').click();assert.equal(p.get('importFile').clicks,1);
 assert.equal(p.get('sfAutoRun').clicks||0,0);
 p.window.dispatch('stitchforge:image-imported');
 assert.equal(p.get('sfQuickGenerate').disabled,false);
 p.get('sfQuickGenerate').click();
 assert.equal(p.get('sfAutoRun').clicks,1);
 assert.equal(p.get('sfQuickZip').disabled,true);
});
test('decoded PES stitches are the only source for visible playback and verified ZIP button',()=>{
 const p=page();p.window.dispatch('stitchforge:image-imported');p.get('sfQuickGenerate').click();
 p.window.dispatch('stitchforge:native-ready',{preview:{widthMm:80,heightMm:60,palette:['#123456'],segments:[[1,2,3,4,0],[3,4,5,6,0]]},
 report:{decoded:[{format:'pes',needleStitches:2,colourChanges:0}]}});
 p.flush();assert.equal(p.strokes(),2);assert.equal(p.get('sfQuickZip').disabled,false);
 p.get('sfQuickZip').click();assert.equal(p.get('sfAutoDownload').clicks,1);
});
test('missing access token blocks generation and shows one-time setup',()=>{
 const p=page('');p.window.dispatch('stitchforge:image-imported');p.get('sfQuickGenerate').click();
 assert.equal(p.get('sfAutoRun').clicks||0,0);assert.equal(p.get('sfQuickAuth').hidden,false);
});
test('failed worker run and failed source upload never expose fabricated PES/DST',()=>{
 const p=page();p.window.dispatch('stitchforge:image-imported');p.get('sfQuickGenerate').click();
 p.window.dispatch('stitchforge:native-error',{message:'geometry refused'});
 p.window.dispatch('stitchforge:native-idle');
 assert.equal(p.get('sfQuickZip').disabled,true);assert.equal(p.get('sfQuickGenerate').disabled,false);
 assert.match(p.get('sfQuickStatus').textContent,/geometry refused/);
 p.window.dispatch('stitchforge:upload-error',{message:'Invalid image'});
 assert.equal(p.get('sfQuickGenerate').disabled,true);
});
test('integration dispatches ready only after native validation; uses original audited ZIP exporter',()=>{
 assert.match(native,/new CustomEvent\('stitchforge:native-ready'/);
 assert.match(native,/new CustomEvent\('stitchforge:native-error'/);
 assert.ok(native.indexOf("const result=await api.generate(packed")<native.indexOf("new CustomEvent('stitchforge:native-ready'"));
 assert.match(native,/saveBytes\(result\.bytes,fileName\('zip'\)/);
 assert.match(html,/\/simple-workflow\.js/);
});

test('simple width control is visible, synchronises into signed native workflow and rejects invalid size',()=>{
 const p=page();p.window.dispatch('stitchforge:image-imported');
 assert.match(p.get('sfSimpleFlow').markup,/Visible embroidery width/);
 assert.equal(p.get('sfQuickWidth').value,'80');
 p.get('sfQuickWidth').value='120';
 p.get('sfQuickGenerate').click();
 assert.equal(p.get('sfNativeWidth').value,'120');
 assert.equal(p.get('sfAutoRun').clicks,1);
 const invalid=page();invalid.window.dispatch('stitchforge:image-imported');
 invalid.get('sfQuickWidth').value='400';
 invalid.get('sfQuickGenerate').click();
 assert.equal(invalid.get('sfAutoRun').clicks||0,0);
 assert.match(invalid.get('sfQuickStatus').textContent,/between 10 and 250 mm/);
});

test('product name is independent of input filename and exposes verified PES/DST',()=>{
 const p=page();
 p.get('importFile').files=[{name:'camera_887.png'}];
 p.window.dispatch('stitchforge:image-imported');
 p.get('sfQuickProductName').value='Kingfisher on Ivy';
 p.get('sfQuickProductName').dispatchEvent({type:'input'});
 assert.equal(p.get('sfAutoProductName').value,'Kingfisher on Ivy');
 p.get('sfQuickGenerate').click();assert.equal(p.get('sfAutoRun').clicks,1);
 p.window.dispatch('stitchforge:native-ready',{
  preview:{widthMm:80,heightMm:60,palette:['#123456'],segments:[[1,2,3,4,0]]},
  report:{decoded:[{format:'pes',needleStitches:1,colourChanges:0}]}
 });
 assert.equal(p.get('sfQuickPES').disabled,false);
 assert.equal(p.get('sfQuickDST').disabled,false);
 p.get('sfQuickPES').click();p.get('sfQuickDST').click();
 assert.equal(p.get('sfAutoPES').clicks,1);
 assert.equal(p.get('sfAutoDST').clicks,1);
 p.window.dispatch('stitchforge:design-changed');
 assert.equal(p.get('sfQuickPES').disabled,true);
 assert.equal(p.get('sfQuickDST').disabled,true);
});
test('new logo and named ZIP helper load before the native editor',()=>{
 assert.match(html,/src="\/assets\/sapiver-press-logo\.webp"/);
 assert.match(html,/<img class="logo"/);
 assert.match(html,/\/download-naming\.js" defer><\/script><script src="\/auto-reconstruct-ui\.js"/);
 assert.match(native,/saveNativeMachineFile\('pes'\)/);
 assert.match(native,/saveNativeMachineFile\('dst'\)/);
});

test('supplied logo is a compact, verified WebP derivative, not a placeholder',()=>{
 const {createHash}=require('node:crypto');
 const logo=fs.readFileSync(path.join(__dirname,'../site/assets/sapiver-press-logo.webp'));
 assert.equal(logo.toString('ascii',0,4),'RIFF');
 assert.equal(logo.toString('ascii',8,12),'WEBP');
 assert.ok(logo.length>=1500&&logo.length<15000);
 const object=Buffer.concat([Buffer.from('blob '+logo.length+String.fromCharCode(0)),logo]);
 assert.equal(createHash('sha1').update(object).digest('hex'),'ba422bf43d23563e48bdd2f92fe827707f01786a');
});

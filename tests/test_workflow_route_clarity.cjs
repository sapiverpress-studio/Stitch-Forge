const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');
const ai=fs.readFileSync(path.join(__dirname,'../site/ai-details.js'),'utf8');

test('raster upload offers a direct native multi-colour route without removing manual tracing',()=>{
 assert.match(index,/id="sfNativeJump"[^>]*>Continue to Generate embroidery/);
 assert.match(index,/id="tracePanel"/);
 assert.match(index,/id="importFile"/);
 assert.match(ui,/q\('#sfNativeJump'\)\?\.addEventListener\('click'/);
 assert.match(ui,/q\('#sfAutoWorkflow'\)\.value='native'/);
 assert.match(ui,/panel\.scrollIntoView/);
 assert.match(ui,/Download PES\/DST trial ZIP/);
});

test('legacy browser exports and simulator are visibly segregated from true native results',()=>{
 assert.match(index,/<h2>Manual outline prototype exports<\/h2>/);
 assert.match(index,/id="zipBtn">↓ Legacy outline ZIP/);
 assert.match(index,/id="dstBtn">↓ Outline DST/);
 assert.match(index,/id="pesBtn">↓ Outline PES/);
 assert.match(index,/id="simHint"><b>Manual outline simulator only/);
 assert.match(index,/if\(rasterSource&&!confirm\('This ZIP contains only the manual single-colour OUTLINE prototype/);
 assert.match(index,/if\(rasterSource&&!confirm\('This is the legacy single-colour OUTLINE export/);
 assert.ok(index.includes("$('#zipBtn').onclick"));
 assert.match(ai,/Add provisional running outlines \(not finished embroidery\)/);
 assert.doesNotMatch(ai,/>Apply draft to stitches</);
});

test('native mode is selected without initiating a paid AI proposal',()=>{
 assert.match(ui,/<option value="native">Automatic AI analysis \+ native PES\/DST/);
 assert.match(ui,/<option value="ai">AI geometry proposal only \(not stitches\)/);
 assert.match(ui,/q\('#sfAutoWorkflow'\)\.dispatchEvent\(new Event\('change'\)\)/);
 assert.match(ui,/Automatic embroidery selected/);
});

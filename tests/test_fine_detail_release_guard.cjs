const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const simple=readFileSync(join(__dirname,'../site/simple-workflow.js'),'utf8');
const native=readFileSync(join(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');

test('Fine Detail release disables the unverified black satin finish but retains standard toggle',()=>{
 assert.match(simple,/fineDetail\?'<label class="toggle sf-satin"><input id="sfQuickSatin" type="checkbox" disabled>/);
 assert.match(simple,/'<label class="toggle sf-satin"><input id="sfQuickSatin" type="checkbox"> Black satin edge<\/label>'/);
 assert.match(simple,/if\(fineDetail\)\{satin\.checked=false;satin\.disabled=true;\}/);
 assert.match(simple,/satin\.disabled=fineDetail/);
 assert.match(simple,/Fin[e]? Detail generates without a satin edge for now\./);
});

test('Native worker packet is protected even if a browser forces the checkbox',()=>{
 assert.match(native,/const blackSatin=!fineDetail&&q\('#sfQuickSatin'\)\?\.checked===true/);
 assert.match(native,/originalPngBytes,blackSatin,fullImage\}\)/);
});

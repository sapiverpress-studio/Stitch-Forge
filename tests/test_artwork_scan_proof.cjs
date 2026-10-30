const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const page=fs.readFileSync('docs/test-evidence/MD-2.37-local-artwork-scan/Artwork_Scan_OFFLINE.html','utf8');
const historicalScannerSha256='409c313eb1707848d677cacd483cd128516e6e06415a380a94b57dda89a23884';

test('historical scan page preserves its pinned MD-2.37 scanner and makes no network requests',()=>{
 const start='<!-- BEGIN_TRACKED_AUTO_RECONSTRUCT_SOURCE -->\n<script>\n';
 const end='\n</script>\n<!-- END_TRACKED_AUTO_RECONSTRUCT_SOURCE -->';
 const a=page.indexOf(start),b=page.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'embedded scanner markers exist');
 const embedded=page.slice(a+start.length,b);
 const digest=crypto.createHash('sha256').update(embedded).digest('hex');
 assert.equal(digest,historicalScannerSha256);
 assert.ok(page.includes(`data-auto-reconstruct-sha256="${digest}"`));
 assert.doesNotMatch(page,/<script[^>]+src=|<link[^>]+href=/i);
 assert.doesNotMatch(page,/fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/);
});

test('offline scan labels show real input, pixel scan and absent geometry/stitch evidence',()=>{
 for(const text of ['Original artwork','What the local scan measured','No regions were produced',
  'No stitch plan or machine file exists','Choose an image from this device',
  'does not reconstruct semantic regions'])assert.ok(page.includes(text),text);
 const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,2);
 for(const match of scripts)new vm.Script(match[1]);
});

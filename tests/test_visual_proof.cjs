'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validateRails} = require('../site/satin-geometry.js');
const dir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'Stitch_Forge_MD-2.34_Visual_Proof_OFFLINE.html'), 'utf8');
const engine = fs.readFileSync(path.join(dir, 'site/satin-geometry.js'), 'utf8');
const railBlock = html.match(/const rails=(\{left:[\s\S]*?\});\s*const physicalScale=\.14;/);
assert.ok(railBlock, 'Fixture and explicit physical scale must remain accessible');
const rails = Function('return (' + railBlock[1] + ')')();
test('offline proof embeds exactly the tracked, unmodified satin geometry module', () => {
 assert.ok(html.includes(engine));
});
test('original synthetic fixture is explicitly disclosed and never claims AI segmentation', () => {
 assert.match(html, /hand-authored control fixture, not AI reconstruction/);
 assert.match(html, /EXPERIMENTAL VISUALISATION/);
 assert.match(html, /Source artwork and its region geometry|source artwork and its region geometry/i);
});
test('fixture rails pass genuine satin geometry validator but not machine approval', () => {
 const r=validateRails(rails,.14);
 assert.equal(r.accepted,true);
 assert.equal(r.machineApproved,false);
 assert.equal(r.geometryOnly,true);
 assert.equal(r.rungs.length,7);
 assert.equal(r.zigzagGuide.length,68);
});
test('reversed fixture rails are refused by real validator', () => {
 const invalid={left:rails.left,right:rails.right.slice().reverse()};
 assert.equal(validateRails(invalid,.14).accepted,false);
});
test('demo makes no network calls and contains no PES/DST export path', () => {
 assert.doesNotMatch(html, /\bfetch\s*\(|\bXMLHttpRequest\b|<script\s+src=|<link\s+[^>]*href=/i);
 assert.doesNotMatch(html, /Blob\s*\(|\bdownload\s*=|\bwrite_pes\b|\bwrite_dst\b/);
 assert.match(html,/generatedMachineFiles:0/);
});

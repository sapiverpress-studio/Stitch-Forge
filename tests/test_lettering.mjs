import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync } from 'fflate';
import { EmbPattern, readDst, readPes, writePes } from '@guillaumemmm/tsembroidery';
import { composeLettering, exportLettering, indexFontPack, readLetteringDesign, stitchDrawing } from '../site/lettering-pattern.mjs';

function glyph(width, height) {
  const pattern = new EmbPattern();
  pattern.addThread({ hex: '#417992' });
  pattern.moveAbs(0, 0);
  pattern.stitchAbs(0, 0);
  pattern.stitchAbs(width, height);
  pattern.end();
  return writePes(pattern);
}

const archive = zipSync({
  'Pack/Nano/Test font/0.25/Au.pes': glyph(20, 50),
  'Pack/Nano/Test font/0.25/a.pes': glyph(15, 30),
  'Pack/Nano/Test font/0.25/3 .pes': glyph(15, 50),
  'Pack/Nano/Test font/0.5/AU.pes': glyph(40, 100),
  'Pack/Nano/Test font/0.5/a.pes': glyph(30, 60),
  'Pack/Nano/Test font/0.5/preview.png': new Uint8Array(20),
  '../Ignored/0.5/A.pes': glyph(10, 20)
});

test('font ZIP lists supplied sizes and resolves explicit capitals independently of lowercase', () => {
  const [font, extra] = indexFontPack(archive);
  assert.equal(extra, undefined);
  assert.equal(font.name, 'Test font');
  assert.deepEqual(font.sizes.map(size => size.mm), [6.35, 12.7]);
  assert.equal(font.sizes[0].glyphs.get('A').path.split('/').at(-1), 'Au.pes');
  assert.equal(font.sizes[0].glyphs.get('a').path.split('/').at(-1), 'a.pes');
  assert.ok(font.sizes[0].glyphs.has('3'));
  assert.equal(font.sizes[1].glyphs.get('A').path.split('/').at(-1), 'AU.pes');
  assert.throws(() => indexFontPack(zipSync({ 'Pack/readme.txt': new Uint8Array(20) })), /No PES or DST letters/);
});

test('supplied letter sizes retain their own geometry and recolouring retains stitch positions', () => {
  const [small, large] = indexFontPack(archive)[0].sizes;
  const first = composeLettering(archive, small, 'Aa', { colour: '#091b49', spacingMm: 1 });
  const second = composeLettering(archive, large, 'Aa', { colour: '#d8739e', spacingMm: 1 });
  const recoloured = composeLettering(archive, small, 'Aa', { colour: '#d8739e', spacingMm: 1 });
  assert.deepEqual(first.runs, recoloured.runs);
  assert.equal(first.pattern.threadlist[0].hexColor(), '#091b49');
  assert.equal(recoloured.pattern.threadlist[0].hexColor(), '#d8739e');
  assert.deepEqual([first.widthMm, first.heightMm, second.widthMm, second.heightMm], [4.5, 5, 8, 10]);
  assert.equal(first.runs[0].filter(([x, y, toX, toY]) => x === toX && y === toY).length, 2);
  assert.throws(() => composeLettering(archive, small, 'Ab', { colour: '#091b49', spacingMm: 1 }), /do not have: b/);
});

test('paired machine files retain lettering, motif stops and thread order', () => {
  const size = indexFontPack(archive)[0].sizes[0];
  const motif = readLetteringDesign(glyph(30, 40), 'pes');
  const { pattern, count, runs } = composeLettering(archive, size, 'Aa', { colour: '#d8739e', spacingMm: 1, motif });
  const pes = readPes(exportLettering(pattern, 'pes'));
  const dst = readDst(exportLettering(pattern, 'dst'));
  assert.deepEqual(pes.threadlist.map(thread => thread.hexColor()), ['#d8739e', '#417992']);
  assert.equal(pes.countColorChanges(), 1);
  assert.equal(dst.countColorChanges(), 1);
  assert.equal(stitchDrawing(pes).count, count);
  assert.deepEqual(stitchDrawing(pes).runs, runs);
  assert.deepEqual(stitchDrawing(dst).runs, runs);
  assert.throws(() => readLetteringDesign(new Uint8Array(600), 'pes'), /header is invalid/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { EmbConstant, EmbPattern, readDst, readPes, writeDst, writePes } from '@guillaumemmm/tsembroidery';
import { zipSync } from 'fflate';
import { composeBoard, fitsCentredHoop, fitsHoop, layerGeometry, readMotif, threadColours } from '../src/design.mjs';
import { composeLettering, exportLettering, indexFontPack, stitchDrawing } from '../src/stitch-codec.mjs';
import frameLibrary from '../src/frame-library.json' with { type: 'json' };

function design(colours = ['#417992']) {
  const pattern = new EmbPattern();
  for (const [index, hex] of colours.entries()) {
    pattern.addThread({ hex });
    if (index) pattern.colorChange();
    pattern.moveAbs(index * 12, 0);
    pattern.stitchAbs(index * 12, 0);
    pattern.stitchAbs(index * 12 + 24, 31);
  }
  pattern.end();
  return pattern;
}

const glyph = writePes(design());
const fonts = zipSync({ 'Test font/0.25/Au.pes': glyph, 'Test font/0.25/a.pes': glyph });
const size = indexFontPack(fonts)[0].sizes[0];
const dimensions = { width: 100, height: 100 };

test('letter spacing changes the gap without changing the supplied stitches', () => {
  const close = composeLettering(fonts, size, 'Aa', { colour: '#417992', spacingMm: -.5 });
  const apart = composeLettering(fonts, size, 'Aa', { colour: '#417992', spacingMm: 2.5 });
  const width = box => box.right - box.left;
  assert.equal(close.drawing.count, apart.drawing.count);
  assert.equal(width(apart.drawing.bounds) - width(close.drawing.bounds), 30);
  assert.throws(() => composeLettering(fonts, size, 'Ab', { colour: '#417992', spacingMm: 1 }), /do not have: b/);
});

test('top and bottom arcs turn complete letters around their baseline and retain stitch lengths', () => {
  const marker = new EmbPattern();
  marker.addThread({ hex: '#417992' });
  marker.moveAbs(-12, -31);
  marker.stitchAbs(-12, -31);
  marker.stitchAbs(12, -31);
  marker.stitchAbs(0, 0);
  marker.end();
  const pack = zipSync({ 'Marker/0.25/Au.pes': writePes(marker) });
  const supplied = indexFontPack(pack)[0].sizes[0];
  const settings = { colour: '#417992', spacingMm: 3, radiusMm: 10 };
  const straight = composeLettering(pack, supplied, 'AAA', settings).drawing.runs[0];
  const top = composeLettering(pack, supplied, 'AAA', { ...settings, layout: 'top' }).drawing.runs[0];
  const bottom = composeLettering(pack, supplied, 'AAA', { ...settings, layout: 'bottom' }).drawing.runs[0];

  assert.equal(top.length, straight.length);
  assert.equal(bottom.length, straight.length);
  assert.ok(top[2][3] > top[5][3] && top[8][3] > top[5][3]);
  assert.ok(bottom[2][3] < bottom[5][3] && bottom[8][3] < bottom[5][3]);
  assert.ok(top[1][3] < top[1][1] && top[7][3] > top[7][1]);
  assert.ok(bottom[1][3] > bottom[1][1] && bottom[7][3] < bottom[7][1]);
  const length = ([a, b, c, d]) => Math.hypot(c - a, d - b);
  for (const arc of [top, bottom]) {
    for (const [index, segment] of arc.entries()) {
      assert.ok(Math.abs(length(segment) - length(straight[index])) < 1.5);
    }
  }
});

test('curved lettering checks the radius and exports both directions alongside a motif', () => {
  const settings = { colour: '#417992', spacingMm: 2, radiusMm: 12 };
  assert.throws(() => composeLettering(fonts, size, 'AAAAA', { ...settings, layout: 'top', radiusMm: 5 }), /Increase the radius/);
  const top = { source: composeLettering(fonts, size, 'Aa A', { ...settings, layout: 'top' }), x: 0, y: -15, angle: 0 };
  const bottom = { source: composeLettering(fonts, size, 'Aaa', { ...settings, layout: 'bottom' }), x: 0, y: 15, angle: 0 };
  const motif = { source: readMotif(writePes(design(['#c96932'])), 'centre.pes'), x: 0, y: 0, angle: 0 };
  const pattern = composeBoard([top, motif, bottom], dimensions);
  const expected = stitchDrawing(pattern).runs;
  assert.deepEqual(stitchDrawing(readPes(exportLettering(pattern, 'pes'))).runs, expected);
  assert.deepEqual(stitchDrawing(readDst(exportLettering(pattern, 'dst'))).runs, expected);
});

test('a Stitch Forge download opens its PES at the supplied size and colour order', () => {
  const original = design(['#c96932', '#83566f']);
  const archive = zipSync({
    'artwork-trial.pes': writePes(original), 'artwork-trial.dst': writeDst(original),
    'native-artwork-input.svg': new Uint8Array([1]), 'READ_ME.txt': new Uint8Array([1])
  });
  const motif = readMotif(archive, 'stitch-forge.zip');
  assert.equal(motif.format, 'pes');
  assert.deepEqual(motif.drawing.runs, stitchDrawing(original).runs);
  assert.deepEqual(motif.pattern.threadlist.map(thread => thread.hexColor()), ['#c96932', '#83566f']);
  assert.equal(readMotif(zipSync({ 'design.dst': writeDst(original) }), 'dst-only.zip').format, 'dst');
  assert.throws(() => readMotif(zipSync({ 'a.pes': glyph, 'b.pes': glyph }), 'multiple.zip'), /several designs/);
  assert.throws(() => readMotif(zipSync({ 'preview.jpg': glyph }), 'empty.zip'), /No supported PES or DST/);
});

test('hoop placement, rotation and motif colours survive both combined exports', () => {
  const text = { source: composeLettering(fonts, size, 'Aa', { colour: '#123456', spacingMm: 1.1 }), colour: '#234875', x: -17.3, y: 5.8, angle: 0 };
  const motif = { source: readMotif(writePes(design(['#c96932', '#83566f'])), 'motif.pes'), x: 11.7, y: -12.3, angle: 37 };
  const geometry = layerGeometry(motif);
  assert.equal(fitsHoop(geometry.bounds, dimensions), true);
  assert.throws(() => composeBoard([text, { ...motif, x: 51 }], dimensions), /inside the selected hoop/);
  const combined = composeBoard([text, motif], dimensions);
  const expected = [...layerGeometry(text).runs, ...geometry.runs];
  const pes = readPes(exportLettering(combined, 'pes'));
  const dst = readDst(exportLettering(combined, 'dst'));
  assert.deepEqual(stitchDrawing(pes).runs, expected);
  assert.deepEqual(stitchDrawing(dst).runs, expected);
  assert.deepEqual(pes.threadlist.map(thread => thread.hexColor()), ['#234875', '#c96932', '#83566f']);
  assert.equal(dst.countColorChanges(), 2);
});

test('text layers using the same thread keep one colour block and their own positions', () => {
  const first = { source: readMotif(glyph, 'test.pes'), x: -10, y: 0, angle: 0 };
  const second = { ...first, x: 11, y: 8 };
  const design = composeBoard([first, second], dimensions);
  assert.equal(design.countColorChanges(), 0);
  const reopened = readPes(exportLettering(design, 'pes'));
  assert.deepEqual(stitchDrawing(reopened).runs[0], [...layerGeometry(first).runs[0], ...layerGeometry(second).runs[0]]);
});

test('matching thread overrides keep stitch blocks and intentional stops', () => {
  const original = new EmbPattern();
  original.addThread({ hex: '#123456' });
  original.stitchAbs(0, 0);
  original.stitchAbs(10, 10);
  original.stop();
  original.stitchAbs(11, 13);
  original.stitchAbs(12, 15);
  original.colorChange();
  original.addThread({ hex: '#aabbcc' });
  original.stitchAbs(12, 15);
  original.stitchAbs(14, 17);
  original.end();

  const source = readMotif(writePes(original), 'motif.pes');
  const layer = { source, x: 0, y: 0, angle: 0, threadOverrides: ['#334455', '#334455'] };
  const board = composeBoard([layer], dimensions);
  const pes = readPes(exportLettering(board, 'pes'));
  const dst = readDst(exportLettering(board, 'dst'));
  assert.deepEqual(threadColours({ source }), ['#123456', '#aabbcc']);
  assert.deepEqual(pes.threadlist.map(thread => thread.hexColor()), layer.threadOverrides);
  assert.equal(pes.countStitchCommands(EmbConstant.STOP), 1);
  assert.equal(pes.countColorChanges(), 1);
  assert.equal(dst.countColorChanges(), 2);
});

test('all supplier frame sizes obey the hoop limits and export with rotated placement and curved lettering', async () => {
  const source = composeLettering(fonts, size, 'Aa', {
    colour: '#234875', spacingMm: 1, layout: 'top', radiusMm: 15
  });
  const text = { source, x: 0, y: -12, angle: 0 };
  const largeHoop = { width: 130, height: 180 };
  assert.equal(frameLibrary.length, 5);
  for (const frame of frameLibrary) {
    assert.deepEqual(frame.sizes, [2.5, 3, 3.5, 4, 4.5, 5]);
    for (const size of frame.sizes) {
      const asset = `licensed/${frame.id}-${size}.pes`;
      const bytes = await readFile(new URL(`../dist/client/frames/${asset}`, import.meta.url));
      const frameSource = readMotif(bytes, asset);
      const { left, right, top, bottom } = frameSource.drawing.bounds;
      const width = (right - left) / 10, height = (bottom - top) / 10;
      const centred = { source: frameSource, x: 0, y: 0, angle: 0 };
      assert.equal(fitsCentredHoop(width, height, dimensions), size <= 3.5, asset);
      assert.equal(fitsHoop(layerGeometry(centred).bounds, dimensions), size <= 3.5, asset);
      assert.equal(fitsHoop(layerGeometry(centred).bounds, largeHoop), true, asset);
      const shape = { ...centred, x: 3, y: -2, angle: 37 };
      const design = composeBoard([shape, text], { width: 220, height: 220 });
      for (const [format, read] of [['pes', readPes], ['dst', readDst]]) {
        const output = read(exportLettering(design, format));
        assert.equal(stitchDrawing(output).count, source.drawing.count + shape.source.drawing.count, asset);
      }
    }
  }
});

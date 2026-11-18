import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { unzipSync, zipSync } from 'fflate';
import { composeLettering, indexFontPack } from '../src/stitch-codec.mjs';

const filename = process.argv[2];
if (!filename) throw Error('Pass the local owner font ZIP to install.');
const bytes = await readFile(filename);
const fonts = indexFontPack(bytes);
const glyphs = new Map(fonts.flatMap(font => font.sizes.flatMap(size =>
  [...size.glyphs.values()].map(glyph => [glyph.path, glyph.bytes])
)));
const total = [...glyphs.values()].reduce((sum, length) => sum + length, 0);
if (total > 160 * 1024 * 1024) throw Error('The expanded font pack exceeds 160 MB.');
const letters = unzipSync(bytes, { filter: entry => glyphs.has(entry.name) });
for (const [path, size] of glyphs) {
  if (letters[path]?.length !== size) throw Error('The pack contains an incomplete letter file.');
}
await mkdir('dist/client/fonts', { recursive: true });
const catalog = [], previews = [];
for (const font of fonts) {
  const id = `f-${createHash('sha256').update(font.name).digest('hex').slice(0, 12)}`;
  const entry = { id, name: font.name, preview: `fonts/${id}.webp`, sizes: [] };
  const previewSize = font.sizes[Math.max(0, font.sizes.length - 2)];
  for (const size of font.sizes) {
    const code = Math.round(size.mm * 100);
    const filename = `${id}-${code}.zip`;
    const files = Object.fromEntries([...size.glyphs.values()].map(glyph => [glyph.path, letters[glyph.path]]));
    const data = zipSync(files, { level: 6 });
    await writeFile(`dist/client/fonts/${filename}`, data);
    entry.sizes.push({ mm: size.mm, label: size.label, path: `fonts/${filename}` });
    if (size === previewSize) {
      const sample = [...'ABC'].filter(character => size.glyphs.has(character)).join('') || [...size.glyphs.keys()].slice(0, 3).join('');
      const { drawing } = composeLettering(data, size, sample, { colour: '#1b6661', spacingMm: 0.8 });
      previews.push({ id, bounds: drawing.bounds, segments: drawing.runs.flat() });
    }
  }
  catalog.push(entry);
}
const result = spawnSync('python', ['tools/font-previews.py'], { input: JSON.stringify(previews), stdio: ['pipe', 'inherit', 'inherit'] });
if (result.error || result.status !== 0) throw result.error ?? Error('Font previews failed to render.');
await writeFile('dist/client/fonts/catalog.json', JSON.stringify(catalog));
console.log(`Installed ${catalog.length} fonts, ${catalog.reduce((sum, font) => sum + font.sizes.length, 0)} supplied sizes and ${glyphs.size} stitch files.`);

import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import frameLibrary from '../src/frame-library.json' with { type: 'json' };
import { readMotif, threadColours } from '../src/design.mjs';

async function frameVariant(asset) {
  const filename = path.basename(asset);
  const source = readMotif(await readFile(`dist/client/${asset}`), filename);
  const { drawing } = source;
  const { left, right, top, bottom } = drawing.bounds;
  const scale = 244 / Math.max(right - left, bottom - top, 1);
  const x = value => 127 + Math.round((value - (left + right) / 2) * scale);
  const y = value => 127 + Math.round((value - (top + bottom) / 2) * scale);
  const points = [];
  for (const [index, run] of drawing.runs.entries()) {
    const step = Math.max(1, Math.ceil(run.length / 360));
    for (let i = 0; i < run.length; i += step) {
      const [ax, ay, bx, by] = run[i];
      points.push(index, x(ax), y(ay), x(bx), y(by));
    }
  }
  return {
    path: `./${asset}`, format: source.format,
    width: (right - left) / 10, height: (bottom - top) / 10,
    preview: Buffer.from(points).toString('base64'), colours: threadColours({ source })
  };
}

const frameCatalog = await Promise.all(frameLibrary.map(async ({ sizes, ...frame }) => {
  const variants = await Promise.all(sizes.map(async size => ({
    id: `${frame.id}-${size}`,
    label: `${size}″`,
    ...await frameVariant(`frames/licensed/${frame.id}-${size}.pes`)
  })));
  return { ...frame, variants };
}));
await writeFile('dist/client/frames/catalog.json', JSON.stringify(frameCatalog));

const result = await build({
  entryPoints: ['src/editor.mjs'],
  outfile: 'dist/client/editor.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['chrome109', 'firefox115', 'safari16.4'],
  legalComments: 'inline',
  metafile: true
});

const packages = new Set();
for (const output of Object.values(result.metafile.outputs)) {
  for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
    const dependency = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input)?.[1];
    if (dependency && bytesInOutput) packages.add(dependency);
  }
}
const notices = [];
for (const name of [...packages].sort()) {
  const directory = path.join('..', 'node_modules', name);
  const { version } = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const licence = await readFile(path.join(directory, 'LICENSE'), 'utf8');
  notices.push(`${name} ${version}\n\n${licence.trim()}`);
}
await writeFile('dist/client/software-licences.txt', `${notices.join('\n\n---\n\n')}\n`);

await build({
  entryPoints: ['src/motif-worker.mjs'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'inline'
});

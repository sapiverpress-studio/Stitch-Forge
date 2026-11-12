const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { buildSync } = require('esbuild');

const root = resolve(__dirname, '..');
const build = buildSync({
  absWorkingDir: root,
  entryPoints: ['site/lettering.mjs'],
  outfile: 'site/lettering.bundle.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
  metafile: true
});

const bundled = new Set();
for (const output of Object.values(build.metafile.outputs)) {
  for (const [path, { bytesInOutput }] of Object.entries(output.inputs)) {
    const match = /^node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path);
    if (match && bytesInOutput) bundled.add(match[1]);
  }
}
const notices = [...bundled].sort().map(name => {
  const directory = resolve(root, 'node_modules', name);
  const { version } = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  return `${name} ${version}\n\n${readFileSync(resolve(directory, 'LICENSE'), 'utf8').trim()}`;
});
writeFileSync(resolve(root, 'site/lettering-licences.txt'), notices.join('\n\n---\n\n') + '\n');

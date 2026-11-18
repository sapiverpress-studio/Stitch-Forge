import { cp, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareEditorAssets } from './design-editor-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editor = path.join(root, 'editor');
const count = await prepareEditorAssets(root);
const built = spawnSync(process.execPath, ['tools/build.mjs'], { cwd: editor, stdio: 'inherit' });
if (built.status !== 0) throw Error('Design Editor build failed.');
const tests = (await readdir(path.join(editor, 'tests'))).filter(name => name.endsWith('.mjs')).map(name => path.join('editor/tests', name));
const checked = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (checked.status !== 0) throw Error('Design Editor checks failed.');
const output = path.join(root, 'site/design-editor');
await mkdir(output, { recursive: true });
await cp(path.join(editor, 'dist/client'), output, { recursive: true });
console.log(`Design Editor built with ${count} verified private assets.`);

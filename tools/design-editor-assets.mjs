import { createDecipheriv, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';

const sha256 = value => createHash('sha256').update(value).digest('hex');

export function decodeEditorAssets(manifest, parts, key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw Error('The private Design Editor asset key is missing.');
  if (manifest.version !== 1 || manifest.parts.length !== parts.length || manifest.files.length > 400) throw Error('The editor asset manifest is invalid.');
  const expected = new Map();
  let total = 0;
  for (const file of manifest.files) {
    if (!/^(?:fonts|frames|motif-history|assets)\/[A-Za-z0-9_./-]+$/.test(file.path) || file.path.split('/').includes('..') || expected.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('The editor asset path or size is invalid.');
    total += file.bytes;
    expected.set(file.path, file);
  }
  if (total > 128 * 1024 * 1024) throw Error('The editor asset pack is too large.');
  const buffers = parts.map((part, index) => {
    const file = manifest.parts[index];
    if (part.byteLength !== file.bytes || sha256(part) !== file.sha256) throw Error('The private editor asset pack is incomplete.');
    return part;
  });
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(manifest.nonce, 'hex'));
  cipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  let archive;
  try { archive = Buffer.concat([cipher.update(Buffer.concat(buffers)), cipher.final()]); }
  catch { throw Error('The private editor asset pack could not be authenticated.'); }
  if (sha256(archive) !== manifest.archiveSha256) throw Error('The private editor asset archive does not match.');
  let count = 0;
  const files = unzipSync(archive, { filter(entry) {
    const file = expected.get(entry.name);
    if (++count > expected.size || !file || entry.originalSize !== file.bytes) throw Error('The editor archive contains an unexpected asset.');
    return true;
  } });
  if (Object.keys(files).length !== expected.size) throw Error('The editor archive is missing an asset.');
  for (const [name, file] of expected) {
    if (files[name]?.byteLength !== file.bytes || sha256(files[name]) !== file.sha256) throw Error('An editor asset failed its integrity check.');
  }
  return files;
}

export async function prepareEditorAssets(root, key = process.env.STITCH_FORGE_EDITOR_ASSET_KEY) {
  const directory = path.join(root, 'editor/private-assets');
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const parts = await Promise.all(manifest.parts.map(file => {
    if (!/^part-\d{3}\.bin$/.test(file.path)) throw Error('Invalid private editor asset part.');
    return readFile(path.join(directory, file.path));
  }));
  const files = decodeEditorAssets(manifest, parts, key);
  const output = path.join(root, 'editor/dist/client');
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return Object.keys(files).length;
}

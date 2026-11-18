import assert from 'node:assert/strict';
import { createCipheriv, createHash } from 'node:crypto';
import test from 'node:test';
import { EmbPattern, writePes } from '@guillaumemmm/tsembroidery';
import { zipSync } from 'fflate';
import { createDesignEditor } from '../netlify/functions/design-editor.mjs';
import { createMotifLibrary } from '../netlify/functions/motif-library.mjs';
import { decodeEditorAssets } from '../tools/design-editor-assets.mjs';

const origin = 'https://sapiver-stitchforge.netlify.app';
const context = { site: { id: 'cec158af-c6ae-4bec-ad1f-2f7c54f156fe' }, deploy: { context: 'production' } };
const secret = 's'.repeat(43);
const env = name => name === 'STITCH_FORGE_MOTIFS_SERVICE_KEY' ? secret : '';
const hash = value => createHash('sha256').update(value).digest('hex');
const emptyHistory = { batch: 'a'.repeat(64), items: [] };
const shape = new EmbPattern();
shape.addThread({ hex: '#367f82' });
shape.moveAbs(0, 0); shape.stitchAbs(0, 0); shape.stitchAbs(24, 34); shape.end();
const pes = writePes(shape), id = hash(pes);

function setup(history = emptyHistory) {
  const files = new Map();
  const store = {
    async getMetadata(key) { return files.has(key) ? { metadata: files.get(key).metadata } : null; },
    async get(key) { return files.get(key)?.bytes ?? null; },
    async list({ prefix }) { return { blobs: [...files.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; },
    async set(key, bytes, { metadata, onlyIfNew } = {}) {
      if (onlyIfNew && files.has(key)) return { modified: false };
      files.set(key, { bytes, metadata }); return { modified: true };
    }
  };
  const library = createMotifLibrary({ stores: () => store, env, now: () => 1794484800000 });
  const handler = createDesignEditor({ library, env, history, readHistory: async input => { assert.equal(input, id); return pes; } });
  const call = (query, { method = 'GET', headers = {}, body, ctx = context } = {}) => handler(new Request(`${origin}/api/design-editor/motifs?${query}`, { method, headers, body }), ctx);
  return { call, files, library };
}

test('Design Editor rejects unknown runtime, preview writes and cross-origin requests', async () => {
  const { call, files } = setup();
  assert.equal((await call('op=list', { ctx: null })).status, 403);
  assert.equal((await call('op=list', { ctx: { site: { id: 'another-site' }, deploy: { context: 'production' } } })).status, 403);
  assert.equal((await call('op=list', { ctx: { ...context, deploy: { context: 'deploy-preview' } } })).status, 503);
  for (const headers of [{}, { Origin: 'https://example.test' }, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await call('op=import&format=pes', { method: 'POST', headers, body: pes })).status, 403);
  }
  assert.equal(files.size, 0);
});

test('Design Editor shares the existing motif store and returns original PES bytes without trusting client credentials', async () => {
  const { call } = setup();
  const imported = await call('op=import&format=pes', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer untrusted', 'X-Motif-Name': 'A%20motif', 'oai-authenticated-user-email': 'someone@example.test' }, body: pes });
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).id, id);
  const list = await (await call('op=list&view=all')).json();
  assert.equal(list.items[0].name, 'A motif');
  assert.equal(list.historyPending, false);
  const response = await call('op=read&id=' + id);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), pes);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('Design Editor history restoration preserves existing names and deduplicates original content', async () => {
  const history = { batch: 'b'.repeat(64), items: [{ id, name: 'Older recovered name', date: 1794400000000 }] };
  const { call, files, library } = setup(history);
  await library(new Request(`${origin}/api/motif-library?op=import&format=pes`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'X-Motif-Name': 'Existing%20name' }, body: pes }), context);
  for (let i = 0; i < 2; i++) {
    const listing = await (await call('op=list&view=all')).json();
    assert.equal(listing.historyPending, false);
    assert.equal(listing.items.length, 1);
    assert.equal(listing.items[0].name, 'Existing name');
  }
  assert.equal([...files.keys()].filter(key => key.startsWith('files/')).length, 1);
  assert.equal([...files.keys()].filter(key => key.startsWith('listing/')).length, 1);
});

test('Design Editor reports incomplete history without marking it complete', async () => {
  const { call, files } = setup({ batch: 'c'.repeat(64), items: [{ id: 'd'.repeat(64), name: 'Missing', date: 1794400000000 }] });
  const listing = await (await call('op=list&view=all')).json();
  assert.equal(listing.historyPending, true);
  assert.equal(files.has('history/' + 'c'.repeat(64)), false);
});

test('Design Editor pairing remains compatible with the digitiser browser', async () => {
  const { call, library } = setup();
  const result = await call('op=connect', { method: 'POST', headers: { Origin: origin } });
  const link = new URL((await result.json()).url);
  assert.equal(link.origin, origin);
  assert.equal(link.pathname, '/');
  const response = await library(new Request(`${origin}/api/motif-library?op=link`, { method: 'POST', headers: { Origin: origin }, body: link.hash.slice('#motif-link='.length) }), context);
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
});

test('private assets authenticate before extraction and reject changed ciphertext, wrong keys and traversal', () => {
  const key = '1'.repeat(64), nonce = Buffer.alloc(12, 2), content = new Uint8Array([1, 2, 3]);
  const archive = zipSync({ 'fonts/sample.zip': content });
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
  const bytes = Buffer.concat([cipher.update(archive), cipher.final()]);
  const manifest = { version: 1, nonce: nonce.toString('hex'), tag: cipher.getAuthTag().toString('hex'), archiveSha256: hash(archive), parts: [{ bytes: bytes.length, sha256: hash(bytes) }], files: [{ path: 'fonts/sample.zip', bytes: content.length, sha256: hash(content) }] };
  assert.deepEqual(decodeEditorAssets(manifest, [bytes], key)['fonts/sample.zip'], content);
  assert.throws(() => decodeEditorAssets(manifest, [bytes], '2'.repeat(64)), /authenticated/);
  const changed = Buffer.from(bytes); changed[0] ^= 1;
  assert.throws(() => decodeEditorAssets(manifest, [changed], key), /incomplete/);
  assert.throws(() => decodeEditorAssets({ ...manifest, files: [{ ...manifest.files[0], path: 'fonts/../../outside' }] }, [bytes], key), /path/);
  assert.throws(() => decodeEditorAssets(manifest, [bytes], ''), /key is missing/);
});

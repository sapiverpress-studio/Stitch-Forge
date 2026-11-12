import assert from 'node:assert/strict';
import test from 'node:test';
import { EmbPattern, writeDst, writePes } from '@guillaumemmm/tsembroidery';
import { zipSync } from 'fflate';
import { createMotifLibrary } from '../netlify/functions/motif-library.mjs';

const origin = 'https://sapiver-stitchforge.netlify.app';
const key = 's'.repeat(43);
const now = 1794484800000;
const pattern = new EmbPattern();
pattern.addThread({ hex: '#367f82' });
pattern.moveAbs(0, 0);
pattern.stitchAbs(0, 0);
pattern.stitchAbs(24, 34);
pattern.end();
const pes = writePes(pattern);
const archive = zipSync({
  'artwork-trial.pes': pes,
  'artwork-trial.dst': writeDst(pattern),
  'machine-report.json': new Uint8Array([123, 125]),
  'decoded-preview.json': new Uint8Array([123, 125])
});

function setup() {
  const files = new Map();
  const store = {
    async getMetadata(id) { return files.has(id) ? { metadata: files.get(id).metadata } : null; },
    async get(id) { return files.get(id)?.bytes ?? null; },
    async list({ prefix }) { return { blobs: [...files.keys()].filter(id => id.startsWith(prefix)).map(id => ({ key: id })) }; },
    async set(id, bytes, { metadata, onlyIfNew } = {}) {
      if (onlyIfNew && files.has(id)) return { modified: false };
      files.set(id, { bytes, metadata });
      return { modified: true };
    }
  };
  let time = now;
  const handler = createMotifLibrary({ stores: () => store, env: name => name === 'STITCH_FORGE_MOTIFS_SERVICE_KEY' ? key : '', now: () => time });
  const call = (op, { method = 'GET', admin = false, browser = false, cookie, body, name, headers = {}, context } = {}) =>
    handler(new Request(`${origin}/api/motif-library?op=${op}`, { method, body, headers: {
      ...(admin ? { Authorization: `Bearer ${key}` } : {}),
      ...(browser ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(name ? { 'X-Motif-Name': encodeURIComponent(name) } : {}),
      ...headers
    } }), context);
  const mint = async () => (await (await call('pair', { method: 'POST', admin: true })).json()).code;
  const link = async () => (await call('link', { method: 'POST', browser: true, body: await mint() })).headers.get('set-cookie').split(';')[0];
  return { call, mint, link, files, advance: ms => { time += ms; } };
}

test('only a same-origin browser can redeem a one-time owner pairing code', async () => {
  const { call, mint, advance } = setup();
  assert.equal((await call('pair', { method: 'POST' })).status, 401);
  const code = await mint();
  assert.equal((await call('link', { method: 'POST', body: code, headers: { Origin: 'https://example.test' } })).status, 403);
  const [first, second] = await Promise.all([1, 2].map(() => call('link', { method: 'POST', browser: true, body: code })));
  assert.deepEqual([first.status, second.status].sort(), [204, 409]);
  const cookie = (first.status === 204 ? first : second).headers.get('set-cookie');
  assert.match(cookie, /Path=\/; Secure; HttpOnly; SameSite=Strict/);
  assert.equal((await (await call('connection', { cookie: cookie.split(';')[0] })).json()).linked, true);
  const expiring = await mint();
  advance(600001);
  assert.equal((await call('link', { method: 'POST', browser: true, body: expiring })).status, 400);
});

test('audited generation saves privately, deduplicates, and reads the original PES bytes', async () => {
  const { call, link, files } = setup();
  const cookie = await link();
  assert.equal((await call('save', { method: 'POST', browser: true, body: archive })).status, 401);
  assert.equal((await call('save', { method: 'POST', browser: true, cookie, body: new Uint8Array(130) })).status, 422);
  const saved = await call('save', { method: 'POST', browser: true, cookie, body: archive, name: 'Violet iris' });
  assert.equal(saved.status, 200);
  const motif = await saved.json();
  assert.equal(motif.format, 'pes');
  assert.deepEqual([motif.width, motif.height], [2.4, 3.4]);
  const repeat = await call('save', { method: 'POST', browser: true, cookie, body: archive, name: 'Duplicate' });
  assert.equal((await repeat.json()).id, motif.id);
  assert.equal([...files.keys()].filter(id => id.startsWith('listing/')).length, 1);
  assert.equal((await call('list', { cookie })).status, 401);
  assert.equal((await call('read&id=' + motif.id, { cookie })).status, 401);
  const listing = await (await call('list&view=all&q=violet', { admin: true })).json();
  assert.equal(listing.items[0].name, 'Violet iris');
  assert.deepEqual((await (await call('list&view=all&q=duplicate', { admin: true })).json()).items, []);
  const read = await call('read&id=' + motif.id, { admin: true });
  assert.deepEqual(new Uint8Array(await read.arrayBuffer()), pes);
});

test('history and file import are restricted to the editor and disabled in previews', async () => {
  const { call } = setup();
  const batch = 'a'.repeat(64);
  assert.equal((await call('import&format=pes', { method: 'POST', browser: true, body: pes })).status, 401);
  const imported = await call('import&format=pes', {
    method: 'POST', admin: true, body: pes, name: 'Earlier design', headers: { 'X-Motif-Date': '1794400000000' }
  });
  assert.equal((await imported.json()).createdAt, 1794400000000);
  await call('history&batch=' + batch, { method: 'POST', admin: true });
  assert.equal((await (await call('history&batch=' + batch, { admin: true })).json()).saved, true);
  assert.equal((await call('list', { admin: true, context: { deploy: { context: 'deploy-preview' } } })).status, 503);
});

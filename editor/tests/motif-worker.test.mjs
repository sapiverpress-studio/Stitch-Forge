import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditorWorker } from '../src/motif-worker.mjs';

const origin = 'https://editor.example.test';
const owner = 'owner@example.test';
const key = 's'.repeat(43);
const headers = { 'oai-authenticated-user-id': 'owner-id', 'oai-authenticated-user-email': owner };
const env = { STITCH_FORGE_MOTIFS_OWNER: owner, STITCH_FORGE_MOTIFS_SERVICE_KEY: key };
const response = value => Response.json(value);
const request = (query, options) => new Request(`${origin}/api/motifs?${query}`, options);

test('the editor keeps its library behind owner identity and same-origin writes', async () => {
  const worker = createEditorWorker({ fetchImpl: () => { throw Error('Unauthorized request went upstream'); } });
  assert.equal((await worker.fetch(request('op=list'), env)).status, 403);
  assert.equal((await worker.fetch(request('op=list', { headers: { ...headers, 'oai-authenticated-user-email': 'someone@example.test' } }), env)).status, 403);
  assert.equal((await worker.fetch(request('op=connect', { method: 'POST', headers: { ...headers, Origin: 'https://another.example.test' } }), env)).status, 403);
});

test('the owner receives a short-lived connection link with the code in the fragment', async () => {
  const code = `${'a'.repeat(43)}.1794484800000.${'b'.repeat(43)}`;
  const worker = createEditorWorker({
    fetchImpl(url, options) {
      assert.equal(url.origin, 'https://sapiver-stitchforge.netlify.app');
      assert.equal(url.searchParams.get('op'), 'pair');
      assert.equal(options.headers.Authorization, `Bearer ${key}`);
      assert.equal(options.redirect, 'manual');
      return response({ code });
    }
  });
  const result = await worker.fetch(request('op=connect', { method: 'POST', headers: { ...headers, Origin: origin } }), env);
  assert.equal(result.status, 200);
  assert.equal(new URL((await result.json()).url).hash, '#motif-link=' + code);
});

test('the private library request stops at an upstream redirect', async () => {
  let calls = 0;
  const worker = createEditorWorker({
    fetchImpl(url, options) {
      calls++;
      assert.equal(url.origin, 'https://sapiver-stitchforge.netlify.app');
      assert.equal(options.redirect, 'manual');
      return Response.redirect('https://another.example.test/elsewhere', 307);
    }
  });
  const result = await worker.fetch(request('op=import&format=pes', {
    method: 'POST', headers: { ...headers, Origin: origin }, body: new Uint8Array([1, 2, 3])
  }), env);
  assert.equal(result.status, 503);
  assert.equal(result.headers.has('Location'), false);
  assert.equal(calls, 1);
});

test('the restored history is seeded once and subsequent lists read the durable library', async () => {
  const id = 'a'.repeat(64);
  let saved = false, imports = 0;
  const worker = createEditorWorker({
    archive: { batch: 'b'.repeat(64), items: [{ id, name: 'Iris', date: 1794400000000, path: '/motif-history/iris.pes' }] },
    async fetchImpl(url, options) {
      assert.equal(options.headers.Authorization, `Bearer ${key}`);
      const op = url.searchParams.get('op');
      if (op === 'history') {
        if (options.method === 'POST') saved = true;
        return response({ saved });
      }
      if (op === 'import') {
        assert.equal(options.headers['X-Motif-Name'], 'Iris');
        imports++;
        return response({ id });
      }
      return response({ items: [{ id }], next: null });
    }
  });
  const configured = { ...env, ASSETS: { fetch: () => new Response(new Uint8Array([1, 2, 3])) } };
  for (let i = 0; i < 2; i++) {
    const result = await worker.fetch(request('op=list', { headers }), configured);
    assert.deepEqual(await result.json(), { items: [{ id }], next: null, historyPending: false });
  }
  assert.equal(imports, 1);
});

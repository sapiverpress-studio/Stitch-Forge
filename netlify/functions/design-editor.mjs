import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import archive from '../../editor/src/motif-history.json' with { type: 'json' };
import { createMotifLibrary } from './motif-library.mjs';
import { getEnv, HEADERS, json } from './lib/artwork-jobs.mjs';

const SITE_ID = 'cec158af-c6ae-4bec-ad1f-2f7c54f156fe';
const MAX_FILE = 4 * 1024 * 1024;

// The existing Netlify site's ALL-deploy password gate protects this API and
// every font/frame URL. Never deploy this page/API on an unprotected site.
export function createDesignEditor({ library = createMotifLibrary(), env = getEnv, history = archive,
  readHistory = id => readFile(path.resolve('site/design-editor/motif-history', `${id}.pes`)) } = {}) {
  let restoring;

  async function invoke(request, context, params, options = {}) {
    const url = new URL('/api/motif-library', request.url);
    url.search = new URLSearchParams(params);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${env('STITCH_FORGE_MOTIFS_SERVICE_KEY')}`);
    return library(new Request(url, { method: options.method ?? 'GET', headers, body: options.body }), context);
  }

  async function restore(request, context) {
    if (!history.items.length) return;
    if (restoring) return restoring;
    restoring = (async () => {
      const params = { op: 'history', batch: history.batch };
      const status = await invoke(request, context, params);
      if (!status.ok) throw Error();
      if ((await status.json()).saved) return;
      for (let i = 0; i < history.items.length; i += 4) {
        const results = await Promise.allSettled(history.items.slice(i, i + 4).map(async item => {
          if (!/^[a-f0-9]{64}$/.test(item.id)) throw Error();
          const bytes = await readHistory(item.id);
          if (createHash('sha256').update(bytes).digest('hex') !== item.id) throw Error();
          const response = await invoke(request, context, { op: 'import', format: 'pes' }, {
            method: 'POST', headers: { 'X-Motif-Name': encodeURIComponent(item.name), 'X-Motif-Date': String(item.date) }, body: bytes
          });
          if (!response.ok || (await response.json()).id !== item.id) throw Error();
        }));
        if (results.some(result => result.status === 'rejected')) throw Error();
      }
      if (!(await invoke(request, context, params, { method: 'POST' })).ok) throw Error();
    })();
    try { await restoring; } finally { restoring = null; }
  }

  return async (request, context) => {
    // Context is supplied by Netlify, never by browser identity headers.
    if (context?.site?.id !== SITE_ID) return json(403, { error: 'Open Design Editor on Stitch Forge.' });
    if (context?.deploy?.context !== 'production') return json(503, { error: 'My Motifs is available on the main Stitch Forge site.' });
    if (!/^[A-Za-z0-9_-]{43}$/.test(env('STITCH_FORGE_MOTIFS_SERVICE_KEY') ?? '')) return json(503, { error: 'My Motifs is temporarily unavailable.' });
    const url = new URL(request.url);
    if ((request.headers.has('origin') && request.headers.get('origin') !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: 'Open My Motifs in Design Editor.' });
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return json(403, { error: 'Open My Motifs in Design Editor.' });
    const op = url.searchParams.get('op') ?? 'list';
    try {
      if (request.method === 'GET' && op === 'list') {
        let historyPending = false;
        try { await restore(request, context); } catch { historyPending = true; }
        const response = await invoke(request, context, { op, view: url.searchParams.get('view') ?? 'recent', q: url.searchParams.get('q') ?? '', offset: url.searchParams.get('offset') ?? '0' });
        if (!response.ok) throw Error();
        return json(200, { ...await response.json(), historyPending });
      }
      if (request.method === 'GET' && op === 'read') {
        const id = url.searchParams.get('id') ?? '';
        if (!/^[a-f0-9]{64}$/.test(id)) return json(404, { error: 'Motif not found.' });
        const response = await invoke(request, context, { op, id });
        return new Response(response.body, { status: response.status, headers: { ...HEADERS, 'Content-Type': response.ok ? 'application/octet-stream' : 'application/json' } });
      }
      if (request.method === 'POST' && op === 'connect') {
        const response = await invoke(request, context, { op: 'pair' }, { method: 'POST' });
        if (!response.ok) throw Error();
        const { code } = await response.json();
        if (!/^[A-Za-z0-9_-]{43}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(code)) throw Error();
        const destination = new URL('/', request.url);
        destination.hash = `motif-link=${code}`;
        return json(200, { url: destination.href });
      }
      if (request.method === 'POST' && op === 'import') {
        const format = url.searchParams.get('format');
        if (!['pes', 'dst'].includes(format)) return json(400, { error: 'Choose a PES or DST file.' });
        if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE) return json(413, { error: 'This stitch file is too large.' });
        const bytes = await request.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_FILE) return json(413, { error: 'This stitch file is empty or too large.' });
        const response = await invoke(request, context, { op, format }, { method: 'POST', headers: { 'X-Motif-Name': (request.headers.get('x-motif-name') ?? '').slice(0, 1500) }, body: bytes });
        return new Response(response.body, { status: response.status, headers: { ...HEADERS, 'Content-Type': 'application/json' } });
      }
      return json(404, { error: 'My Motifs action not found.' });
    } catch { return json(503, { error: 'My Motifs could not connect. Try again.' }); }
  };
}

export default createDesignEditor();
export const config = { path: '/api/design-editor/motifs' };

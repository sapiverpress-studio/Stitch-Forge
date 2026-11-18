import history from './motif-history.json' with { type: 'json' };

const STITCH_FORGE = 'https://sapiver-stitchforge.netlify.app';
const MAX_FILE = 4 * 1024 * 1024;
const CODE = /^[A-Za-z0-9_-]{43}\.\d{13}\.[A-Za-z0-9_-]{43}$/;
const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers: noStore });

function isOwner(request, env) {
  const owner = env.STITCH_FORGE_MOTIFS_OWNER?.trim().toLowerCase();
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return !!owner && !!request.headers.get('oai-authenticated-user-id') && email === owner;
}

export function createEditorWorker({ fetchImpl = fetch, archive = history } = {}) {
  let restoring;

  async function send(env, params, options = {}) {
    const url = new URL('/api/motif-library', STITCH_FORGE);
    url.search = new URLSearchParams(params);
    const response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: { ...options.headers, Authorization: `Bearer ${env.STITCH_FORGE_MOTIFS_SERVICE_KEY}` },
      body: options.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000)
    });
    // Workers supports manual redirects. Keep the service credential on the original host.
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw Error('The motif library returned a redirect.');
    }
    return response;
  }

  async function restoreHistory(request, env) {
    if (!archive.items.length) return;
    if (restoring) return restoring;
    restoring = (async () => {
      const args = { op: 'history', batch: archive.batch };
      const status = await send(env, args);
      if (!status.ok) throw Error('Motif history status is unavailable.');
      if ((await status.json()).saved) return;
      for (let i = 0; i < archive.items.length; i += 4) {
        const results = await Promise.allSettled(archive.items.slice(i, i + 4).map(async item => {
          const asset = await env.ASSETS.fetch(new Request(new URL(item.path, request.url)));
          if (!asset.ok) throw Error('A saved motif could not be opened.');
          const response = await send(env, { op: 'import', format: 'pes' }, {
            method: 'POST',
            headers: { 'X-Motif-Name': encodeURIComponent(item.name), 'X-Motif-Date': String(item.date) },
            body: await asset.arrayBuffer()
          });
          if (!response.ok || (await response.json()).id !== item.id) throw Error('A saved motif could not be restored.');
        }));
        if (results.some(result => result.status === 'rejected')) throw Error('Some saved motifs could not be restored.');
      }
      if (!(await send(env, args, { method: 'POST' })).ok) throw Error('Motif history could not be marked complete.');
    })();
    try { await restoring; } finally { restoring = null; }
  }

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname !== '/api/motifs') return env.ASSETS.fetch(request);
      if (!isOwner(request, env)) return json({ error: 'Design Editor owner sign-in required.' }, 403);
      if (!/^[A-Za-z0-9_-]{43}$/.test(env.STITCH_FORGE_MOTIFS_SERVICE_KEY ?? '')) {
        return json({ error: 'My Motifs is temporarily unavailable.' }, 503);
      }
      const op = url.searchParams.get('op') ?? 'list';
      if (request.method === 'POST' && request.headers.get('origin') !== url.origin) {
        return json({ error: 'Open My Motifs in Design Editor.' }, 403);
      }

      try {
        if (op === 'list' && request.method === 'GET') {
          let historyPending = false;
          try { await restoreHistory(request, env); } catch { historyPending = true; }
          const response = await send(env, {
            op, view: url.searchParams.get('view') ?? 'recent', q: url.searchParams.get('q') ?? '',
            offset: url.searchParams.get('offset') ?? '0'
          });
          if (!response.ok) throw Error();
          return json({ ...await response.json(), historyPending });
        }
        if (op === 'read' && request.method === 'GET') {
          const id = url.searchParams.get('id') ?? '';
          if (!/^[a-f0-9]{64}$/.test(id)) return json({ error: 'Motif not found.' }, 404);
          const response = await send(env, { op, id });
          return new Response(response.body, { status: response.status, headers: {
            ...noStore, 'Content-Type': response.ok ? 'application/octet-stream' : 'application/json'
          } });
        }
        if (op === 'connect' && request.method === 'POST') {
          const response = await send(env, { op: 'pair' }, { method: 'POST' });
          if (!response.ok) throw Error();
          const { code } = await response.json();
          if (!CODE.test(code)) throw Error();
          return json({ url: `${STITCH_FORGE}/#motif-link=${code}` });
        }
        if (op === 'import' && request.method === 'POST') {
          const format = url.searchParams.get('format');
          if (!['pes', 'dst'].includes(format)) return json({ error: 'Choose a PES or DST file.' }, 400);
          if (Number(request.headers.get('content-length') || 0) > MAX_FILE) return json({ error: 'This stitch file is too large.' }, 413);
          const bytes = await request.arrayBuffer();
          if (!bytes.byteLength || bytes.byteLength > MAX_FILE) return json({ error: 'This stitch file is empty or too large.' }, 413);
          const response = await send(env, { op, format }, {
            method: 'POST',
            headers: { 'X-Motif-Name': (request.headers.get('x-motif-name') ?? '').slice(0, 1500) },
            body: bytes
          });
          return new Response(response.body, { status: response.status, headers: { ...noStore, 'Content-Type': 'application/json' } });
        }
        return json({ error: 'My Motifs action not found.' }, 404);
      } catch {
        return json({ error: 'My Motifs could not connect. Try again.' }, 503);
      }
    }
  };
}

export default createEditorWorker();

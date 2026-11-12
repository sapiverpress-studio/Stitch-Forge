import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { unzipSync } from 'fflate';
import { readLetteringDesign, MAX_DESIGN_BYTES } from '../../site/lettering-pattern.mjs';
import { getEnv, json, HEADERS } from './lib/artwork-jobs.mjs';
import { readNativeArchive } from './lib/native-archive.mjs';

const STORE = 'stitch-forge-private-motifs-v1';
const COOKIE = '__Host-stitch-forge-motifs';
const PAIR_MS = 10 * 60 * 1000;
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_ZIP = 3000000;
const KEY = /^[A-Za-z0-9_-]{43}$/;
const ID = /^[a-f0-9]{64}$/;
const TOKEN = /^([A-Za-z0-9_-]{43})\.(\d{13})\.([A-Za-z0-9_-]{43})$/;
const palette = ['#297782', '#b24f35', '#69578e', '#537446', '#a16e20', '#324d71'];

const hash = value => createHash('sha256').update(value).digest('hex');
const mac = (secret, purpose, value) => createHmac('sha256', secret).update(`stitch-forge-motifs/${purpose}/${value}`).digest('base64url');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function issue(secret, purpose, deadline) {
  const value = `${randomBytes(32).toString('base64url')}.${deadline}`;
  return `${value}.${mac(secret, purpose, value)}`;
}

function validToken(secret, purpose, value, now, maxAge) {
  const parts = TOKEN.exec(value ?? '');
  if (!parts || Number(parts[2]) <= now || Number(parts[2]) > now + maxAge) return false;
  return equal(parts[3], mac(secret, purpose, `${parts[1]}.${parts[2]}`));
}

function connectionCookie(value, age) {
  return `${COOKIE}=${value}; Max-Age=${Math.floor(age / 1000)}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

function browserOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin ||
    (!origin || origin === 'null') && request.headers.get('sec-fetch-site') === 'same-origin';
}

async function boundedBytes(request, limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw Error('Motif file is too large.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > limit) throw Error('Motif file is empty or too large.');
  return bytes;
}

function motifName(request) {
  let input = '';
  try { input = decodeURIComponent(request.headers.get('x-motif-name') ?? ''); } catch {}
  return [...input.normalize('NFC').replace(/[\p{Cc}\p{Cf}\/\\]/gu, '').trim()].slice(0, 64).join('') || 'Embroidery design';
}

function preferredLegacyFile(zip) {
  const candidates = [];
  let count = 0;
  unzipSync(zip, { filter(entry) {
    if (++count > 64) throw Error('Too many files in the machine ZIP.');
    const kind = /^[a-z0-9_.-]+\.(pes|dst)$/i.exec(entry.name)?.[1]?.toLowerCase();
    if (kind && entry.originalSize >= 515 && entry.originalSize <= MAX_DESIGN_BYTES && [0, 8].includes(entry.compression)) {
      candidates.push({ kind, name: entry.name, size: entry.originalSize });
    }
    return false;
  } });
  const pes = candidates.filter(file => file.kind === 'pes');
  const files = pes.length ? pes : candidates;
  if (files.length !== 1) throw Error('The machine ZIP must contain one design.');
  const file = files[0];
  const bytes = unzipSync(zip, { filter: entry => entry.name === file.name })[file.name];
  if (bytes?.length !== file.size) throw Error('The machine ZIP contains an incomplete design.');
  return { bytes, format: file.kind };
}

function readPreview(source, format) {
  const { drawing, pattern } = source;
  const { left, right, top, bottom } = drawing.bounds;
  const scale = 244 / Math.max(right - left, bottom - top, 1);
  const x = point => 5 + Math.round((point - (left + right) / 2) * scale + 122);
  const y = point => 5 + Math.round((point - (top + bottom) / 2) * scale + 122);
  const colours = drawing.runs.slice(0, 12).map((_, i) =>
    format === 'pes' && pattern.threadlist[i] ? pattern.threadlist[i].hexColor() : palette[i % palette.length]);
  const skip = Math.max(1, Math.ceil(drawing.count / 145));
  const points = [];
  let index = 0;
  for (const [i, segments] of drawing.runs.entries()) {
    for (const [ax, ay, bx, by] of segments) {
      if (index++ % skip === 0) points.push(i % colours.length, x(ax), y(ay), x(bx), y(by));
    }
  }
  return {
    width: (right - left) / 10, height: (bottom - top) / 10,
    preview: Buffer.from(points).toString('base64'), colours
  };
}

async function save(store, bytes, format, name, createdAt) {
  const id = hash(bytes);
  const key = `files/${id}`;
  let metadata = (await store.getMetadata(key))?.metadata;
  if (!metadata) {
    const source = readLetteringDesign(bytes, format);
    const record = { id, name, format, createdAt, ...readPreview(source, format) };
    const result = await store.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
      metadata: record, onlyIfNew: true
    });
    metadata = result.modified ? record : (await store.getMetadata(key))?.metadata;
  }
  if (!metadata) throw Error('Motif record could not be loaded after saving.');
  const nameKey = Buffer.from(metadata.name).toString('base64url');
  await store.set(`listing/${String(metadata.createdAt).padStart(13, '0')}/${id}/${nameKey}`, '1', { onlyIfNew: true });
  return metadata;
}

async function list(store, url) {
  const recent = url.searchParams.get('view') !== 'all';
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 64);
  const offset = recent ? 0 : Math.max(0, Math.min(100_000, Math.trunc(Number(url.searchParams.get('offset'))) || 0));
  const limit = recent ? 12 : 24;
  const { blobs } = await store.list({ prefix: 'listing/' });
  const hits = [];
  for (const entry of blobs) {
    const match = /^listing\/(\d{13})\/([a-f0-9]{64})\/([A-Za-z0-9_-]+)$/.exec(entry.key);
    if (match && (!search || Buffer.from(match[3], 'base64url').toString('utf8').toLowerCase().includes(search))) hits.push(match);
  }
  hits.sort((a, b) => Number(b[1]) - Number(a[1]) || a[2].localeCompare(b[2]));
  const selected = await Promise.all(hits.slice(offset, offset + limit).map(hit => store.getMetadata(`files/${hit[2]}`)));
  return { items: selected.filter(Boolean).map(value => value.metadata), next: !recent && offset + limit < hits.length ? offset + limit : null };
}

export function createMotifLibrary({ stores = () => getStore({ name: STORE, consistency: 'strong' }), env = getEnv, now = Date.now } = {}) {
  return async function handler(request, context) {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') ?? 'connection';
    const secret = env('STITCH_FORGE_MOTIFS_SERVICE_KEY') ?? '';
    const enabled = KEY.test(secret) && (!context?.deploy?.context || context.deploy.context === 'production');
    const time = now();
    const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const linked = enabled && validToken(secret, 'browser', cookie, time, SESSION_MS);

    if (request.method === 'GET' && op === 'connection') return json(200, { available: enabled, linked });
    if (!enabled) return json(503, { error: 'My Motifs is unavailable.' });
    const client = ['link', 'disconnect', 'save', 'save-legacy'].includes(op);
    if (client && (request.method !== 'POST' || !browserOrigin(request))) return json(403, { error: 'Use Stitch Forge to connect.' });
    if (!client && !equal(request.headers.get('authorization'), `Bearer ${secret}`)) return json(401, { error: 'Design Editor sign-in required.' });

    try {
      const store = stores();
      if (request.method === 'POST' && op === 'pair') {
        return json(200, { code: issue(secret, 'pair', time + PAIR_MS) });
      }
      if (op === 'link') {
        const code = new TextDecoder().decode(await boundedBytes(request, 180));
        if (!validToken(secret, 'pair', code, time, PAIR_MS)) return json(400, { error: 'Get a fresh link from Design Editor.' });
        const result = await store.set(`paired/${hash(code)}`, '1', { onlyIfNew: true });
        if (!result.modified) return json(409, { error: 'This link was already used. Get a fresh link from Design Editor.' });
        return new Response(null, { status: 204, headers: { ...HEADERS, 'Set-Cookie': connectionCookie(issue(secret, 'browser', time + SESSION_MS), SESSION_MS) } });
      }
      if (op === 'disconnect') {
        return new Response(null, { status: 204, headers: { ...HEADERS, 'Set-Cookie': connectionCookie('', 0) } });
      }
      if (op === 'save' || op === 'save-legacy') {
        if (!linked) return json(401, { error: 'Connect this browser to My Motifs.' });
        const archive = await boundedBytes(request, MAX_ZIP);
        let machine;
        try {
          machine = op === 'save' ? { bytes: readNativeArchive(archive)['artwork-trial.pes'], format: 'pes' } : preferredLegacyFile(archive);
        } catch { return json(422, { error: 'The embroidery ZIP could not be saved.' }); }
        return json(200, await save(store, machine.bytes, machine.format, motifName(request), time));
      }
      if (request.method === 'POST' && op === 'import') {
        const format = url.searchParams.get('format');
        if (format !== 'pes' && format !== 'dst') return json(400, { error: 'Choose a PES or DST file.' });
        const bytes = await boundedBytes(request, MAX_DESIGN_BYTES);
        try { readLetteringDesign(bytes, format); } catch { return json(422, { error: 'This stitch file could not be read.' }); }
        const original = Number(request.headers.get('x-motif-date'));
        const date = Number.isSafeInteger(original) && original > 0 && original <= time ? original : time;
        return json(200, await save(store, bytes, format, motifName(request), date));
      }
      if (request.method === 'GET' && op === 'list') return json(200, await list(store, url));
      if (request.method === 'GET' && op === 'read') {
        const id = url.searchParams.get('id') ?? '';
        if (!ID.test(id)) return json(404, { error: 'Motif not found.' });
        const bytes = await store.get(`files/${id}`, { type: 'arrayBuffer' });
        return bytes ? new Response(bytes, { headers: { ...HEADERS, 'Content-Type': 'application/octet-stream' } }) : json(404, { error: 'Motif not found.' });
      }
      if (op === 'history' && ID.test(url.searchParams.get('batch') ?? '')) {
        const path = `history/${url.searchParams.get('batch')}`;
        if (request.method === 'GET') return json(200, { saved: !!await store.getMetadata(path) });
        if (request.method === 'POST') {
          await store.set(path, '1', { onlyIfNew: true });
          return json(200, { saved: true });
        }
      }
      return json(404, { error: 'My Motifs action not found.' });
    } catch {
      return json(503, { error: 'My Motifs could not finish the request. Try again.' });
    }
  };
}

export default createMotifLibrary();
export const config = { path: '/api/motif-library' };

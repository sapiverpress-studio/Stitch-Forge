import { fitsCentredHoop, MAX_IMPORT_BYTES, selectMotifFile } from './design.mjs';

const DIGITISER = location.origin;
const byId = id => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function request(op, params = {}, options = {}) {
  const query = new URLSearchParams({ op, ...params });
  const response = await fetch(`/api/design-editor/motifs?${query}`, { cache: 'no-store', referrerPolicy: 'same-origin', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Error(body.error || 'My Motifs is unavailable. Try again.');
  }
  return response;
}

function drawPreview(canvas, motif) {
  const drawing = canvas.getContext('2d');
  drawing.clearRect(0, 0, canvas.width, canvas.height);
  const sample = Uint8Array.from(atob(motif.preview ?? ''), character => character.charCodeAt(0));
  const colours = motif.colours ?? [];
  drawing.lineWidth = 1.25;
  drawing.lineCap = 'round';
  for (let i = 0; i + 4 < sample.length; i += 5) {
    drawing.strokeStyle = colours[sample[i]] ?? '#215e55';
    drawing.beginPath();
    drawing.moveTo(50 + sample[i + 1] * .47, sample[i + 2] * .47);
    drawing.lineTo(50 + sample[i + 3] * .47 + .05, sample[i + 4] * .47);
    drawing.stroke();
  }
}

function previewFor(motif) {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 120;
  canvas.setAttribute('aria-hidden', 'true');
  drawPreview(canvas, motif);
  return canvas;
}

export function mountMotifLibrary(insert) {
  const dialog = byId('motifLibrary');
  const status = byId('motifLibraryStatus');
  const results = byId('savedMotifs');
  const search = byId('motifSearch');
  const more = byId('moreMotifs');
  const recent = byId('motifRecent');
  const all = byId('motifAll');
  const files = byId('motifFiles');
  const importButton = byId('importMotifs');
  const connect = byId('connectMotifs');
  const nextLink = byId('continueMotifLink');
  let view = 'recent', next = null, sequence = 0, timer;

  function cardFor(motif) {
    const card = document.createElement('article');
    card.className = 'saved-motif';
    const title = document.createElement('strong');
    title.textContent = motif.name;
    const info = document.createElement('span');
    info.className = 'hint';
    info.textContent = `${motif.width} × ${motif.height} mm · ${dateFormat.format(motif.createdAt)}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Insert';
    button.setAttribute('aria-label', `Insert ${motif.name}`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = `Opening ${motif.name}…`;
      try {
        const response = await request('read', { id: motif.id });
        insert(new Uint8Array(await response.arrayBuffer()), `${motif.name}.${motif.format}`);
        dialog.close();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    card.append(previewFor(motif), title, info, button);
    return card;
  }

  async function load(offset = 0) {
    const key = ++sequence;
    more.hidden = true;
    if (!offset) results.replaceChildren();
    status.textContent = 'Loading saved motifs…';
    try {
      const response = await request('list', { view, q: view === 'all' ? search.value.trim() : '', offset });
      const listing = await response.json();
      if (key !== sequence) return;
      results.append(...listing.items.map(cardFor));
      next = listing.next;
      more.hidden = next === null;
      status.textContent = listing.historyPending ? 'Some earlier designs are still being restored.' :
        results.childElementCount ? '' : search.value.trim() && view === 'all' ? 'No motifs match this search.' : 'Your saved motifs will appear here.';
    } catch (error) {
      if (key === sequence) status.textContent = error.message;
    }
  }

  function setView(value) {
    clearTimeout(timer);
    view = value;
    recent.setAttribute('aria-pressed', String(value === 'recent'));
    all.setAttribute('aria-pressed', String(value === 'all'));
    byId('motifSearchRow').hidden = value !== 'all';
    load();
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    setView('recent');
  }

  byId('openMotifs').addEventListener('click', open);
  byId('closeMotifs').addEventListener('click', () => dialog.close());
  recent.addEventListener('click', () => setView('recent'));
  all.addEventListener('click', () => setView('all'));
  more.addEventListener('click', () => { if (next !== null) load(next); });
  search.addEventListener('input', () => {
    clearTimeout(timer);
    sequence++;
    results.replaceChildren();
    more.hidden = true;
    status.textContent = 'Searching saved motifs…';
    timer = setTimeout(() => load(), 180);
  });

  connect.addEventListener('click', async () => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    nextLink.hidden = true;
    connect.disabled = true;
    try {
      const response = await request('connect', {}, { method: 'POST' });
      const link = new URL((await response.json()).url);
      if (link.origin !== DIGITISER || link.pathname !== '/' || !link.hash.startsWith('#motif-link=')) throw Error('The connection link is invalid.');
      if (tab && !tab.closed) tab.location.replace(link.href);
      else { nextLink.href = link.href; nextLink.hidden = false; }
      status.textContent = 'Finish the connection in Stitch Forge.';
    } catch (error) {
      tab?.close();
      status.textContent = error.message;
    } finally {
      connect.disabled = false;
    }
  });

  importButton.addEventListener('click', () => files.click());
  files.addEventListener('change', async () => {
    const selected = Array.from(files.files);
    files.value = '';
    if (!selected.length) return;
    importButton.disabled = true;
    const saved = new Set(), errors = [];
    for (const [index, file] of selected.entries()) {
      status.textContent = `Importing ${index + 1} of ${selected.length}…`;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw Error('This file is too large.');
        const selectedFile = selectMotifFile(new Uint8Array(await file.arrayBuffer()), file.name);
        const name = file.name.replace(/\.(zip|pes|dst)$/i, '').replace(/-TRIAL-NOT-APPROVED/i, '');
        const response = await request('import', { format: selectedFile.format }, {
          method: 'POST', headers: { 'X-Motif-Name': encodeURIComponent([...name].slice(0, 64).join('')) }, body: selectedFile.bytes
        });
        saved.add((await response.json()).id);
      } catch (error) { errors.push({ name: file.name, message: error.message }); }
    }
    await load();
    status.textContent = `${saved.size} motif${saved.size === 1 ? '' : 's'} ready.${errors.length ? ` ${errors[0].name} could not be imported. ${errors[0].message}${errors.length > 1 ? ` ${errors.length - 1} additional files failed.` : ''}` : ''}`;
    importButton.disabled = false;
  });

  if (new URLSearchParams(location.search).get('motifs') === 'connect') open();
}

export function mountFrameLibrary(insert, getHoop) {
  const dialog = byId('frameLibrary');
  const status = byId('frameLibraryStatus');
  const cards = byId('frameCards');
  const updateCards = [];
  let loading = false;
  let inserting = null;

  function frameCard({ variants, ...frame }) {
    const sizePicker = document.createElement('select');
    sizePicker.setAttribute('aria-label', `Size for ${frame.name}`);
    for (const variant of variants) {
      const option = document.createElement('option');
      option.value = variant.id;
      sizePicker.append(option);
    }
    const selectedSize = () => variants[sizePicker.selectedIndex];
    const card = document.createElement('article');
    card.className = 'saved-motif';
    const preview = previewFor(selectedSize());
    const title = document.createElement('strong');
    title.textContent = frame.name;
    const info = document.createElement('span');
    info.className = 'hint';
    info.setAttribute('aria-live', 'polite');
    const credit = document.createElement('span');
    credit.className = 'hint';
    const source = document.createElement('a');
    source.href = frame.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = frame.author;
    credit.append(source, ` · ${frame.licence}`);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Insert';
    const selectionName = variant => `${frame.name} (${variant.label})`;
    const tooLarge = (variant, hoop) => !fitsCentredHoop(variant.width, variant.height, hoop);
    function updateSelection(hoop) {
      const variant = selectedSize();
      const fit = tooLarge(variant, hoop) ? ' · Needs a larger hoop' : '';
      info.textContent = `${variant.width} × ${variant.height} mm${fit}`;
      button.setAttribute('aria-label', `Insert ${selectionName(variant)}`);
    }
    function updateHoop() {
      const hoop = getHoop();
      variants.forEach((variant, index) => {
        sizePicker.options[index].textContent = tooLarge(variant, hoop) ? `${variant.label} · Too large` : variant.label;
      });
      updateSelection(hoop);
    }
    updateCards.push(updateHoop);
    updateHoop();
    sizePicker.addEventListener('change', () => {
      drawPreview(preview, selectedSize());
      updateSelection(getHoop());
    });
    button.addEventListener('click', async () => {
      if (inserting) return;
      const variant = selectedSize();
      const name = selectionName(variant);
      const request = new AbortController();
      inserting = request;
      button.disabled = true;
      sizePicker.disabled = true;
      status.textContent = `Opening ${name}…`;
      try {
        const response = await fetch(variant.path, { signal: request.signal });
        if (!response.ok) throw Error('This design could not be opened. Try again.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (request.signal.aborted) return;
        insert(bytes, { name, format: variant.format });
        dialog.close();
      } catch (error) {
        if (!request.signal.aborted) status.textContent = error.message;
      } finally {
        if (inserting === request) inserting = null;
        button.disabled = false;
        sizePicker.disabled = false;
      }
    });
    card.append(preview, title, sizePicker, info, credit, button);
    return card;
  }

  byId('openFrames').addEventListener('click', async () => {
    dialog.showModal();
    if (cards.childElementCount) {
      updateCards.forEach(update => update());
      return;
    }
    if (loading) return;
    loading = true;
    status.textContent = 'Loading frames and shapes…';
    try {
      const response = await fetch('./frames/catalog.json', { cache: 'no-cache' });
      if (!response.ok) throw Error('Frames and shapes could not load. Reopen this panel to try again.');
      cards.replaceChildren(...(await response.json()).map(frameCard));
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loading = false;
    }
  });
  byId('closeFrames').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    inserting?.abort();
    inserting = null;
    if (cards.childElementCount) status.textContent = '';
  });
}

import {
  composeLettering, exportLettering, indexFontPack, MAX_DESIGN_BYTES, MAX_FONT_PACK_BYTES, readLetteringDesign
} from './lettering-pattern.mjs';

const byId = id => document.getElementById(id);
const packInput = byId('fontPack');
const familyInput = byId('fontFamily');
const sizeInput = byId('fontSize');
const nameInput = byId('letteringText');
const colourInput = byId('threadColour');
const motifInput = byId('motifFile');
const removePack = byId('removePack');
const removeMotif = byId('removeMotif');
const canvas = byId('letteringCanvas');
const downloadButtons = [byId('downloadPes'), byId('downloadDst')];

let library = null;
let motif = null;
let preview = null;
let refreshTimer;

function showStatus(id, message, error = false) {
  const element = byId(id);
  element.textContent = message;
  element.dataset.error = String(error);
}

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sapiver-stitch-forge-lettering', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Browser storage is busy.'));
  });
}

async function useLibrary(mode, operation) {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('library', mode);
      const request = operation(transaction.objectStore('library'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? Error('Browser storage did not finish.'));
    });
  } finally {
    db.close();
  }
}

function usePack(bytes, fonts, saved) {
  library = { bytes, fonts, saved };
  familyInput.replaceChildren(...fonts.map((font, i) => new Option(font.name, String(i))));
  const mixedCase = fonts.findIndex(font => font.sizes[0]?.glyphs.has('a'));
  familyInput.selectedIndex = Math.max(0, mixedCase);
  byId('letteringControls').disabled = false;
  removePack.hidden = false;
  byId('packAction').textContent = 'Replace font ZIP';
  const variants = fonts.reduce((total, font) => total + font.sizes.length, 0);
  const persistence = saved ? 'Saved on this browser.' : 'Available for this session.';
  showStatus('packStatus', `${fonts.length} fonts · ${variants} font and size choices. ${persistence}`);
  chooseFamily();
}

function chooseFamily() {
  if (!library) return;
  const font = library.fonts[Number(familyInput.value)];
  sizeInput.replaceChildren(...font.sizes.map((size, i) => new Option(size.label, String(i))));
  queuePreview();
}

function draw() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context || !preview) return;
  const { left, right, top, bottom } = preview.bounds;
  const scale = Math.min(width * 0.86 / Math.max(1, right - left), height * 0.78 / Math.max(1, bottom - top));
  context.translate(width / 2 - (left + right) * scale / 2, height / 2 - (top + bottom) * scale / 2);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineWidth = Math.max(1, ratio / scale);
  const threads = preview.pattern.threadlist;
  preview.runs.forEach((run, index) => {
    context.strokeStyle = threads[index].hexColor();
    context.beginPath();
    for (const [x, y, toX, toY] of run) {
      context.moveTo(x, y);
      context.lineTo(toX, toY);
    }
    context.stroke();
  });
}

function updateThreads() {
  const list = byId('threadOrder');
  list.replaceChildren();
  list.hidden = !preview;
  for (const [i, thread] of (preview?.pattern.threadlist ?? []).entries()) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = thread.hexColor();
    item.append(swatch, `${i + 1}. ${thread.description || 'Thread'} ${thread.hexColor().toUpperCase()}`);
    list.append(item);
  }
}

function updatePreview() {
  preview = null;
  const text = nameInput.value.trim();
  byId('threadHex').textContent = colourInput.value.toUpperCase();
  byId('stitchStats').textContent = '';
  try {
    if (!library || !text) {
      showStatus('previewStatus', library ? 'Type a name or short phrase.' : 'Import your font ZIP to start.');
      return;
    }
    const font = library.fonts[Number(familyInput.value)];
    const size = font.sizes[Number(sizeInput.value)];
    preview = composeLettering(library.bytes, size, byId('useCapitals').checked ? text.toUpperCase() : text, {
      colour: colourInput.value,
      spacingMm: byId('letterSpacing').valueAsNumber,
      motif
    });
    const { widthMm, heightMm, count } = preview;
    byId('stitchStats').textContent = `${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm · ${count.toLocaleString('en-GB')} stitches`;
    const hoopWidth = byId('hoopWidth').valueAsNumber;
    const hoopHeight = byId('hoopHeight').valueAsNumber;
    const validHoop = [hoopWidth, hoopHeight].every(mm => Number.isFinite(mm) && mm >= 10 && mm <= 500);
    const fits = validHoop && widthMm <= hoopWidth && heightMm <= hoopHeight;
    if (!fits) {
      showStatus('previewStatus', validHoop ? 'This design exceeds your hoop. Check the hoop size or choose smaller lettering.' : 'Enter the usable width and height of your hoop.', true);
      return;
    }
    showStatus('previewStatus', motif?.format === 'dst'
      ? 'Fits the selected hoop. The DST design colours are preview colours. Follow the thread order.'
      : 'Fits the selected hoop.');
    downloadButtons.forEach(button => { button.disabled = false; });
  } catch (error) {
    showStatus('previewStatus', error.message || 'The lettering could not be previewed.', true);
  } finally {
    updateThreads();
    draw();
  }
}

function queuePreview() {
  clearTimeout(refreshTimer);
  downloadButtons.forEach(button => { button.disabled = true; });
  refreshTimer = setTimeout(updatePreview, 65);
}

function download(format) {
  if (!preview) return;
  try {
    const bytes = exportLettering(preview.pattern, format);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = window.StitchForgeDownloadNaming.filename(nameInput.value, format);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    showStatus('previewStatus', format === 'dst' ? 'DST file checked. Follow the thread order shown here.' : 'PES file checked and ready for a trial stitch-out.');
  } catch (error) {
    showStatus('previewStatus', error.message || 'The machine file could not be exported.', true);
  }
}

packInput.addEventListener('change', async () => {
  const file = packInput.files?.[0];
  packInput.value = '';
  if (!file) return;
  packInput.disabled = removePack.disabled = true;
  showStatus('packStatus', 'Reading font sizes and letters…');
  try {
    if (file.size > MAX_FONT_PACK_BYTES) throw Error('Choose a font ZIP up to 100 MB.');
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const fonts = indexFontPack(bytes);
    let saved = false;
    try {
      await useLibrary('readwrite', store => store.put(buffer, 'font-pack'));
      saved = true;
    } catch {
      // Private browsing or a full storage quota can still use the file for this session.
    }
    usePack(bytes, fonts, saved);
  } catch (error) {
    showStatus('packStatus', error.message || 'The ZIP could not be imported.', true);
  } finally {
    packInput.disabled = removePack.disabled = false;
  }
});

removePack.addEventListener('click', async () => {
  if (!window.confirm('Remove the font pack from this browser?')) return;
  packInput.disabled = removePack.disabled = true;
  try {
    if (library?.saved) await useLibrary('readwrite', store => store.delete('font-pack'));
    library = null;
    familyInput.replaceChildren(new Option('Import a font ZIP'));
    sizeInput.replaceChildren(new Option('Choose a font'));
    byId('letteringControls').disabled = true;
    removePack.hidden = true;
    byId('packAction').textContent = 'Import font ZIP';
    showStatus('packStatus', 'Import your font ZIP. The pack is stored in this browser.');
    queuePreview();
  } catch {
    showStatus('packStatus', 'The browser could not clear the saved pack.', true);
  } finally {
    packInput.disabled = removePack.disabled = false;
  }
});

motifInput.addEventListener('change', async () => {
  const file = motifInput.files?.[0];
  motifInput.value = '';
  if (!file) return;
  motifInput.disabled = removeMotif.disabled = true;
  try {
    const format = /\.(pes|dst)$/i.exec(file.name)?.[1].toLowerCase();
    if (!format || file.size > MAX_DESIGN_BYTES) throw Error('Choose a PES or DST design up to 4 MB.');
    motif = readLetteringDesign(new Uint8Array(await file.arrayBuffer()), format);
    showStatus('motifStatus', `${file.name} added.`);
    removeMotif.hidden = false;
    queuePreview();
  } catch (error) {
    showStatus('motifStatus', error.message || 'The design could not be opened.', true);
  } finally {
    motifInput.disabled = removeMotif.disabled = false;
  }
});

removeMotif.addEventListener('click', () => {
  motif = null;
  showStatus('motifStatus', '');
  removeMotif.hidden = true;
  queuePreview();
});

familyInput.addEventListener('change', chooseFamily);
for (const id of ['fontSize', 'letteringText', 'useCapitals', 'threadColour', 'hoopWidth', 'hoopHeight', 'letterSpacing']) {
  byId(id).addEventListener('input', queuePreview);
}
downloadButtons[0].addEventListener('click', () => download('pes'));
downloadButtons[1].addEventListener('click', () => download('dst'));
window.addEventListener('resize', draw);

try {
  const buffer = await useLibrary('readonly', store => store.get('font-pack'));
  if (buffer) {
    const bytes = new Uint8Array(buffer);
    usePack(bytes, indexFontPack(bytes), true);
  } else {
    showStatus('packStatus', 'Import your font ZIP. The pack is stored in this browser.');
  }
} catch {
  showStatus('packStatus', 'Import a font ZIP to start this session. The saved pack could not be opened.', true);
} finally {
  packInput.disabled = false;
}

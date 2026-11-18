import { composeLettering, exportLettering, indexFontPack } from './stitch-codec.mjs';
import { composeBoard, fitsCentredHoop, fitsHoop, MAX_IMPORT_BYTES, readMotif, threadColours } from './design.mjs';
import { HoopGrid } from './hoop-grid.mjs';
import { mountFrameLibrary, mountMotifLibrary } from './motif-panel.mjs';

const ids = [
  'fullscreenToggle', 'addLettering', 'addMotif', 'motifInput', 'hoop', 'customHoop', 'hoopWidth', 'hoopHeight', 'snap', 'notice',
  'boardDimensions', 'zoomOut', 'zoomFit', 'zoomIn', 'designCanvas', 'boardHint', 'designMeasurements', 'hoopStatus',
  'rotationHandle', 'openThreadColours', 'threadDialog', 'threadLayerName', 'threadColourOptions', 'closeThreadColours',
  'exportPes', 'exportDst', 'useFittingHoop', 'layerList', 'moveEarlier', 'moveLater', 'removeLayer', 'noSelection',
  'textControls', 'fontCount', 'letteringText', 'openFonts', 'fontSize', 'letterSpacing', 'threadColour',
  'letteringPath', 'curveRadiusField', 'curveRadius',
  'colourValue', 'useCapitals', 'layerError', 'motifControls', 'motifFormat', 'motifInfo', 'motifThreads',
  'placementControls', 'centreLayer', 'positionX', 'positionY', 'positionAngle', 'fontDialog', 'galleryCount',
  'closeFonts', 'fontSearch', 'fontGallery'
];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const fontsById = new Map();
const fontAssets = new Map();
const layers = [];
const maxLayers = 24;
const roundMm = value => Math.round(value * 10) / 10;
const sizeText = value => `${value.width} × ${value.height} mm`;
const labelFor = layer => layer.type === 'text' ? layer.text.trim() || 'New lettering' : layer.name;
const hoopPresets = Array.from(ui.hoop.options).filter(option => option.value !== 'custom').map(option => {
  const [width, height] = option.value.split(',').map(Number);
  return { width, height, value: option.value };
});
let selected = null;
let hoop = { width: 100, height: 100 };
let importInProgress = false;
let exporting = false;
let fontLoadError = '';

const grid = new HoopGrid(ui.designCanvas, {
  handle: ui.rotationHandle,
  select: selectLayer,
  move(layer, x, y) {
    layer.x = roundMm(x);
    layer.y = roundMm(y);
    if (layer === selected) renderPlacement();
    renderBoard();
  },
  rotate(layer, angle) {
    layer.angle = angle;
    if (layer === selected) ui.positionAngle.value = angle;
    renderBoard();
  },
  snap: () => ui.snap.checked
});

function notice(message = '', tone = 'error') {
  ui.notice.hidden = !message;
  ui.notice.textContent = message;
  ui.notice.dataset.tone = tone;
}

function renderBoard() {
  const stats = grid.setDesign(layers, selected, hoop);
  const pending = layers.some(layer => layer.type === 'text' && layer.text.trim() && !layer.source);
  const text = stats ? `${stats.width.toFixed(1)} × ${stats.height.toFixed(1)} mm · ${stats.count.toLocaleString()} stitches` : 'No stitches yet';
  if (ui.designMeasurements.textContent !== text) ui.designMeasurements.textContent = text;
  const oversized = stats?.outside && !fitsCentredHoop(stats.width, stats.height, hoop);
  let status = '';
  if (oversized) status = `Design is too large for the ${sizeText(hoop)} hoop.`;
  else if (stats?.outside) status = 'Move design inside hoop';
  else if (pending) status = 'Check lettering';
  else if (stats) status = 'Fits selected hoop';
  if (ui.hoopStatus.textContent !== status) ui.hoopStatus.textContent = status;
  ui.hoopStatus.dataset.outside = String(!!stats?.outside);
  const fittingHoop = oversized ? hoopPresets.find(preset => fitsHoop(stats.bounds, preset)) : null;
  ui.useFittingHoop.hidden = !fittingHoop;
  if (fittingHoop && ui.useFittingHoop.value !== fittingHoop.value) {
    ui.useFittingHoop.value = fittingHoop.value;
    ui.useFittingHoop.textContent = `Use ${sizeText(fittingHoop)} hoop`;
  }
  ui.boardHint.hidden = !!stats;
  ui.openThreadColours.disabled = !selected?.source;
  ui.exportPes.disabled = ui.exportDst.disabled = !stats || stats.outside || pending || exporting;
  ui.zoomOut.disabled = ui.zoomFit.disabled = grid.zoom === 1;
  ui.zoomIn.disabled = grid.zoom === 4;
}

function renderLayers() {
  const items = layers.map((layer, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(layer === selected));
    const order = document.createElement('span');
    order.className = 'measure';
    order.textContent = `${index + 1}.`;
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = labelFor(layer);
    name.title = labelFor(layer);
    const kind = document.createElement('span');
    kind.className = 'layer-kind';
    kind.textContent = layer.type === 'text' ? 'Text' : layer.frame ? 'Frame' : 'Motif';
    button.append(order, name, kind);
    button.addEventListener('click', () => selectLayer(layer));
    li.append(button);
    return li;
  });
  ui.layerList.replaceChildren(...items);
  const index = layers.indexOf(selected);
  ui.moveEarlier.disabled = index <= 0;
  ui.moveLater.disabled = index < 0 || index === layers.length - 1;
  ui.removeLayer.disabled = index < 0;
  ui.addLettering.disabled = layers.length >= maxLayers;
  ui.addMotif.disabled = importInProgress || layers.length >= maxLayers;
}

function renderPlacement() {
  ui.placementControls.hidden = !selected;
  if (!selected) return;
  ui.positionX.value = selected.x;
  ui.positionY.value = selected.y;
  ui.positionAngle.value = selected.angle;
}

function renderFont() {
  const font = selected?.font;
  ui.fontCount.textContent = fontsById.size ? `${fontsById.size} installed fonts` : fontLoadError ? 'Fonts unavailable' : 'Loading fonts…';
  ui.openFonts.textContent = font?.name ?? (fontLoadError ? 'Fonts unavailable' : 'Loading…');
  ui.openFonts.title = font?.name ?? '';
  ui.openFonts.setAttribute('aria-label', font ? `Font, ${font.name}` : 'Font');
  ui.openFonts.disabled = !font;
  ui.fontSize.replaceChildren(...(font?.sizes.map(size => new Option(size.label, size.mm)) ?? []));
  ui.fontSize.disabled = !font;
  if (font) ui.fontSize.value = selected.size.mm;
}

function renderLayerError(layer) {
  if (layer !== selected) return;
  const message = layer.error || fontLoadError;
  ui.layerError.textContent = message;
  ui.layerError.hidden = !message;
}

function renderMotifThreads(layer) {
  const colours = threadColours(layer);
  ui.motifThreads.replaceChildren(...colours.map((colour, index) => {
    const chip = document.createElement('span');
    chip.className = 'thread-swatch';
    chip.style.backgroundColor = colour;
    chip.title = `Thread ${index + 1} ${colour.toUpperCase()}`;
    return chip;
  }));
}

function renderInspector() {
  ui.noSelection.hidden = !!selected;
  ui.textControls.hidden = selected?.type !== 'text';
  ui.motifControls.hidden = selected?.type !== 'motif';
  renderPlacement();
  if (selected?.type === 'text') {
    ui.letteringText.value = selected.text;
    ui.letterSpacing.value = selected.spacing;
    ui.letteringPath.value = selected.layout;
    ui.curveRadiusField.hidden = selected.layout === 'straight';
    ui.curveRadius.value = selected.radius;
    ui.threadColour.value = selected.colour;
    ui.colourValue.textContent = selected.colour.toUpperCase();
    ui.useCapitals.checked = selected.capitals;
    renderFont();
    renderLayerError(selected);
  }
  if (selected?.type === 'motif') {
    const { format, drawing } = selected.source;
    const box = drawing.bounds;
    const count = drawing.runs.length;
    ui.motifFormat.textContent = format.toUpperCase();
    ui.motifInfo.textContent = `${((box.right - box.left) / 10).toFixed(1)} × ${((box.bottom - box.top) / 10).toFixed(1)} mm · ${count} thread block${count === 1 ? '' : 's'}${format === 'dst' ? ' · preview colours' : ''}`;
    renderMotifThreads(selected);
  }
}

function selectLayer(layer) {
  if (selected === layer) return;
  if (ui.threadDialog.open) ui.threadDialog.close();
  selected = layer;
  renderLayers();
  renderInspector();
  renderBoard();
}

function changeThreadColour(layer, index, colour) {
  if (layer.type === 'text') {
    layer.colour = colour;
    ui.threadColour.value = colour;
    ui.colourValue.textContent = colour.toUpperCase();
  } else {
    layer.threadOverrides ??= [];
    layer.threadOverrides[index] = colour;
    renderMotifThreads(layer);
  }
  renderBoard();
}

function openThreadColours() {
  if (ui.threadDialog.open) {
    ui.threadDialog.close();
    return;
  }
  const layer = selected;
  if (!layer?.source) return;
  ui.threadLayerName.textContent = labelFor(layer);
  ui.threadColourOptions.replaceChildren(...threadColours(layer).map((colour, index) => {
    const row = document.createElement('div');
    row.className = 'thread-colour-row';
    const label = document.createElement('label');
    label.htmlFor = `layer-thread-${index}`;
    label.textContent = `Thread ${index + 1}`;
    if (layer.type === 'text') label.textContent = 'Lettering colour';
    if (layer.frame && index === 2) label.textContent = 'Border (thread 3)';
    const input = document.createElement('input');
    input.type = 'color';
    input.id = label.htmlFor;
    input.value = colour;
    const value = document.createElement('span');
    value.className = 'measure';
    value.textContent = colour.toUpperCase();
    input.addEventListener('input', () => {
      value.textContent = input.value.toUpperCase();
      changeThreadColour(layer, index, input.value);
    });
    row.append(label, input, value);
    return row;
  }));
  ui.threadDialog.show();
  ui.openThreadColours.setAttribute('aria-expanded', 'true');
}

function setFont(layer, font) {
  const desired = layer.size?.mm ?? 12.7;
  layer.font = font;
  layer.size = font.sizes.reduce((closest, size) => Math.abs(size.mm - desired) < Math.abs(closest.mm - desired) ? size : closest);
}

function getVariant(variant) {
  if (!fontAssets.has(variant.path)) {
    const pending = fetch(variant.path).then(async response => {
      if (!response.ok) throw Error('This font size could not load. Try selecting it again.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const fonts = indexFontPack(bytes);
      const size = fonts[0]?.sizes[0];
      if (fonts.length !== 1 || fonts[0].sizes.length !== 1 || size?.mm !== variant.mm) throw Error('This installed font size is incomplete.');
      return { bytes, size };
    }).catch(error => {
      fontAssets.delete(variant.path);
      throw error;
    });
    if (fontAssets.size >= 16) fontAssets.delete(fontAssets.keys().next().value);
    fontAssets.set(variant.path, pending);
  }
  return fontAssets.get(variant.path);
}

function refreshLettering(layer) {
  clearTimeout(layer.timer);
  const revision = ++layer.revision;
  layer.source = null;
  layer.error = '';
  renderLayerError(layer);
  renderBoard();
  if (!layer.size || !layer.text.trim()) return;
  layer.timer = setTimeout(async () => {
    try {
      const { bytes, size } = await getVariant(layer.size);
      if (revision !== layer.revision) return;
      const text = layer.capitals ? layer.text.toUpperCase() : layer.text;
      layer.source = composeLettering(bytes, size, text, {
        colour: layer.colour, spacingMm: layer.spacing, layout: layer.layout, radiusMm: layer.radius
      });
    } catch (error) {
      if (revision !== layer.revision) return;
      layer.error = error.message;
    }
    renderLayerError(layer);
    renderBoard();
  }, 110);
}

function insertLayer(layer, focus = false) {
  layers.push(layer);
  selectLayer(layer);
  if (focus) ui.letteringText.focus();
}

function addLettering(focus = true) {
  const empty = focus && layers.find(layer => layer.type === 'text' && !layer.text.trim());
  if (empty) {
    selectLayer(empty);
    ui.letteringText.focus();
    return;
  }
  if (layers.length >= maxLayers) return;
  const nextY = selected ? Math.min(hoop.height / 2 - 5, selected.y + 12) : 0;
  const layer = {
    type: 'text', text: '', source: null, error: '', spacing: .8, colour: selected?.colour ?? '#1b6661',
    layout: 'straight', radius: 35, capitals: false, x: 0, y: roundMm(nextY), angle: 0, revision: 0
  };
  const defaultFont = selected?.font ?? fontsById.values().next().value;
  if (defaultFont) setFont(layer, defaultFont);
  insertLayer(layer, focus);
}

function numberInput(element, apply) {
  element.addEventListener('input', () => {
    const value = element.valueAsNumber;
    if (!Number.isFinite(value) || value < Number(element.min) || value > Number(element.max)) return;
    apply(value);
  });
}

function changeHoop() {
  const custom = ui.hoop.value === 'custom';
  ui.customHoop.hidden = !custom;
  const [width, height] = custom ? [ui.hoopWidth.valueAsNumber, ui.hoopHeight.valueAsNumber] : ui.hoop.value.split(',').map(Number);
  if (![width, height].every(value => Number.isInteger(value) && value >= 30 && value <= 500)) return;
  hoop = { width, height };
  ui.boardDimensions.textContent = sizeText(hoop);
  grid.setZoom(1);
  renderBoard();
}

function reorder(offset) {
  const index = layers.indexOf(selected);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= layers.length) return;
  layers.splice(index, 1);
  layers.splice(target, 0, selected);
  renderLayers();
  renderBoard();
}

function renderGallery() {
  const query = ui.fontSearch.value.trim().toLowerCase();
  const results = [...fontsById.values()].filter(font => font.name.toLowerCase().includes(query));
  ui.galleryCount.textContent = results.length ? `${results.length} font${results.length === 1 ? '' : 's'}` : 'No fonts match';
  ui.fontGallery.replaceChildren(...results.map(font => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'font-card';
    button.setAttribute('aria-pressed', String(font === selected?.font));
    const preview = document.createElement('img');
    preview.alt = '';
    preview.loading = 'lazy';
    preview.decoding = 'async';
    preview.src = font.preview;
    const name = document.createElement('span');
    name.textContent = font.name;
    button.append(preview, name);
    button.addEventListener('click', () => {
      if (selected?.type !== 'text') return;
      setFont(selected, font);
      renderFont();
      refreshLettering(selected);
      ui.fontDialog.close();
    });
    return button;
  }));
}

function exportDesign(format) {
  try {
    notice();
    const active = layers.filter(layer => layer.source);
    if (layers.some(layer => layer.type === 'text' && layer.text.trim() && !layer.source)) throw Error('Check the lettering layer before exporting.');
    const pattern = composeBoard(active, hoop);
    const bytes = exportLettering(pattern, format);
    const title = active.find(layer => layer.type === 'text')?.text ?? active[0]?.name ?? 'stitch-forge-design';
    const basename = title.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48).toLowerCase() || 'stitch-forge-design';
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = `${basename}.${format}`;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notice(`${format.toUpperCase()} file checked and downloaded.`, 'success');
  } catch (error) {
    notice(error.message);
  } finally {
    exporting = false;
    renderBoard();
  }
}

function setFullscreenLayout(active) {
  document.body.classList.toggle('workspace-fullscreen', active);
  ui.fullscreenToggle.textContent = active ? 'Exit full screen' : 'Full screen';
}

const fullscreenTarget = document.documentElement;
ui.fullscreenToggle.addEventListener('click', async () => {
  const active = document.body.classList.contains('workspace-fullscreen');
  setFullscreenLayout(!active);
  if (active) {
    if (document.fullscreenElement === fullscreenTarget) {
      try {
        await document.exitFullscreen();
      } catch {
        setFullscreenLayout(document.fullscreenElement === fullscreenTarget);
      }
    }
  } else if (document.fullscreenEnabled) {
    try {
      await fullscreenTarget.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Embedded views can still use the full area of their viewport.
    }
  }
});
document.addEventListener('fullscreenchange', () => {
  setFullscreenLayout(document.fullscreenElement === fullscreenTarget);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]:not(#threadDialog)')) return;
  if (ui.threadDialog.open) {
    ui.threadDialog.close();
    ui.openThreadColours.focus({ preventScroll: true });
    event.preventDefault();
  } else if (!document.fullscreenElement && document.body.classList.contains('workspace-fullscreen')) setFullscreenLayout(false);
});

ui.addLettering.addEventListener('click', () => addLettering());
ui.openThreadColours.addEventListener('click', openThreadColours);
ui.closeThreadColours.addEventListener('click', () => {
  ui.threadDialog.close();
  ui.openThreadColours.focus({ preventScroll: true });
});
ui.threadDialog.addEventListener('close', () => {
  ui.openThreadColours.setAttribute('aria-expanded', String(ui.threadDialog.open));
});
function insertMotif(source, filename, frame = false) {
  if (layers.length >= maxLayers) throw Error('Remove a layer before inserting another motif.');
  const name = filename.replace(/\.(pes|dst|zip)$/i, '').slice(0, 120);
  const box = source.drawing.bounds;
  const height = (box.bottom - box.top) / 10;
  const below = selected?.source ? selected.y + (selected.source.drawing.bounds.bottom - selected.source.drawing.bounds.top) / 20 + height / 2 + 4 : 0;
  const y = !frame && below + height / 2 <= hoop.height / 2 ? roundMm(below) : 0;
  const layer = { type: 'motif', name, source, x: 0, y, angle: 0, frame };
  if (frame) {
    layers.unshift(layer);
    selectLayer(layer);
  } else {
    insertLayer(layer);
  }
}

ui.addMotif.addEventListener('click', () => ui.motifInput.click());
ui.motifInput.addEventListener('change', async () => {
  const [file] = ui.motifInput.files;
  ui.motifInput.value = '';
  if (!file || importInProgress || layers.length >= maxLayers) return;
  importInProgress = true;
  renderLayers();
  notice();
  try {
    if (file.size > MAX_IMPORT_BYTES) throw Error('Choose a Stitch Forge design ZIP up to 40 MB.');
    insertMotif(readMotif(new Uint8Array(await file.arrayBuffer()), file.name), file.name);
  } catch (error) {
    notice(error.message);
  } finally {
    importInProgress = false;
    renderLayers();
  }
});
ui.hoop.addEventListener('change', changeHoop);
ui.useFittingHoop.addEventListener('click', () => {
  ui.hoop.value = ui.useFittingHoop.value;
  changeHoop();
  ui.hoop.focus();
});
numberInput(ui.hoopWidth, changeHoop);
numberInput(ui.hoopHeight, changeHoop);
for (const [button, value] of [[ui.zoomOut, () => grid.zoom / 1.35], [ui.zoomFit, () => 1], [ui.zoomIn, () => grid.zoom * 1.35]]) {
  button.addEventListener('click', () => { grid.setZoom(value()); renderBoard(); });
}
ui.moveEarlier.addEventListener('click', () => reorder(-1));
ui.moveLater.addEventListener('click', () => reorder(1));
ui.removeLayer.addEventListener('click', () => {
  const index = layers.indexOf(selected);
  if (index < 0) return;
  clearTimeout(selected.timer);
  selected.revision++;
  layers.splice(index, 1);
  selectLayer(layers[Math.min(index, layers.length - 1)] ?? null);
});
ui.letteringText.addEventListener('input', () => {
  if (selected?.type !== 'text') return;
  selected.text = ui.letteringText.value;
  renderLayers();
  refreshLettering(selected);
});
ui.openFonts.addEventListener('click', () => {
  ui.fontSearch.value = '';
  renderGallery();
  ui.fontDialog.showModal();
  ui.fontSearch.focus();
});
ui.closeFonts.addEventListener('click', () => ui.fontDialog.close());
ui.fontSearch.addEventListener('input', renderGallery);
ui.fontSize.addEventListener('change', () => {
  if (selected?.type !== 'text') return;
  selected.size = selected.font.sizes.find(size => size.mm === Number(ui.fontSize.value));
  refreshLettering(selected);
});
numberInput(ui.letterSpacing, value => {
  if (selected?.type !== 'text') return;
  selected.spacing = roundMm(value);
  refreshLettering(selected);
});
ui.letterSpacing.addEventListener('blur', () => {
  if (selected?.type === 'text') ui.letterSpacing.value = selected.spacing;
});
ui.letteringPath.addEventListener('change', () => {
  if (selected?.type !== 'text') return;
  selected.layout = ui.letteringPath.value;
  ui.curveRadiusField.hidden = selected.layout === 'straight';
  refreshLettering(selected);
});
numberInput(ui.curveRadius, value => {
  if (selected?.type !== 'text') return;
  selected.radius = roundMm(value);
  refreshLettering(selected);
});
ui.curveRadius.addEventListener('blur', () => {
  if (selected?.type === 'text') ui.curveRadius.value = selected.radius;
});
ui.threadColour.addEventListener('input', () => {
  if (selected?.type !== 'text') return;
  changeThreadColour(selected, 0, ui.threadColour.value);
});
ui.useCapitals.addEventListener('change', () => {
  if (selected?.type !== 'text') return;
  selected.capitals = ui.useCapitals.checked;
  refreshLettering(selected);
});
for (const [input, key] of [[ui.positionX, 'x'], [ui.positionY, 'y'], [ui.positionAngle, 'angle']]) {
  numberInput(input, value => {
    if (!selected) return;
    selected[key] = key === 'angle' ? Math.round(value) : roundMm(value);
    renderBoard();
  });
  input.addEventListener('blur', renderPlacement);
}
ui.centreLayer.addEventListener('click', () => {
  if (!selected) return;
  selected.x = selected.y = 0;
  renderPlacement();
  renderBoard();
});
for (const [button, format] of [[ui.exportPes, 'pes'], [ui.exportDst, 'dst']]) {
  button.addEventListener('click', () => {
    if (exporting) return;
    exporting = true;
    renderBoard();
    setTimeout(() => exportDesign(format), 0);
  });
}

addLettering(false);
mountMotifLibrary((bytes, filename) => insertMotif(readMotif(bytes, filename), filename));
mountFrameLibrary((bytes, frame) => {
  const filename = `${frame.name}.${frame.format}`;
  insertMotif(readMotif(bytes, filename), filename, true);
}, () => hoop);
fetch('./fonts/catalog.json').then(async response => {
  if (!response.ok) throw Error('Font catalogue failed to load.');
  const fonts = await response.json();
  if (!fonts.length) throw Error('Font catalogue is empty.');
  for (const font of fonts) fontsById.set(font.id, font);
  for (const layer of layers) {
    if (layer.type !== 'text') continue;
    setFont(layer, fonts[0]);
    refreshLettering(layer);
  }
  if (selected?.type === 'text') renderFont();
}).catch(() => {
  fontLoadError = 'The installed fonts could not load. Reload the editor to try again.';
  if (selected?.type === 'text') renderInspector();
});

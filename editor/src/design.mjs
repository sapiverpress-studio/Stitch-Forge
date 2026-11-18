import { EmbConstant, EmbPattern } from '@guillaumemmm/tsembroidery';
import { unzipSync } from 'fflate';
import { appendDesign, MAX_COMMANDS, MAX_DESIGN_BYTES, readLetteringDesign, stitchDrawing } from './stitch-codec.mjs';

export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
const DST_COLOURS = ['#297782', '#b24f35', '#69578e', '#537446', '#a16e20', '#324d71'];

export function selectMotifFile(bytes, filename) {
  const format = /\.(pes|dst|zip)$/i.exec(filename)?.[1]?.toLowerCase();
  if (!format || bytes.length > MAX_IMPORT_BYTES) throw Error('Choose a Stitch Forge ZIP, PES or DST file up to 40 MB.');
  if (format !== 'zip') {
    if (bytes.length > MAX_DESIGN_BYTES) throw Error('Choose a PES or DST file up to 4 MB.');
    return { bytes, format };
  }

  const candidates = [];
  let entries = 0;
  try {
    unzipSync(bytes, { filter(entry) {
      if (++entries > 2048) throw Error('The ZIP has too many entries.');
      const parts = entry.name.split(/[\\/]/);
      const name = parts.at(-1);
      const kind = /\.(pes|dst)$/i.exec(name)?.[1]?.toLowerCase();
      if (kind && !parts.some(part => part === '..' || part === '__MACOSX') && !name.startsWith('._') &&
          entry.originalSize >= 515 && entry.originalSize <= MAX_DESIGN_BYTES && [0, 8].includes(entry.compression)) {
        candidates.push({ path: entry.name, kind, size: entry.originalSize });
      }
      return false;
    } });
  } catch {
    throw Error('This ZIP could not be read. Use the original Stitch Forge download or its PES or DST file.');
  }
  const pes = candidates.filter(file => file.kind === 'pes');
  const dst = candidates.filter(file => file.kind === 'dst');
  const preferred = pes.length ? pes : dst;
  if (!preferred.length) throw Error('No supported PES or DST design was found in the ZIP.');
  if (preferred.length > 1) throw Error('This ZIP contains several designs. Select the individual PES or DST you want to insert.');
  const file = preferred[0];
  const entry = unzipSync(bytes, { filter: candidate => candidate.name === file.path })[file.path];
  if (entry?.length !== file.size) throw Error('The design file in this ZIP is incomplete.');
  return { bytes: entry, format: file.kind };
}

export function readMotif(bytes, filename) {
  const file = selectMotifFile(bytes, filename);
  return readLetteringDesign(file.bytes, file.format);
}

export function threadColours(layer) {
  const { pattern, drawing, format } = layer.source;
  return drawing.runs.map((_, index) => {
    const colour = layer.threadOverrides?.[index] ?? layer.colour ?? (format === 'pes' ? pattern.threadlist[index]?.hexColor() : null);
    return (colour || DST_COLOURS[index % DST_COLOURS.length]).toLowerCase();
  });
}

function emptyBounds() {
  return { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
}

function includePoint(bounds, x, y) {
  bounds.left = Math.min(bounds.left, x);
  bounds.right = Math.max(bounds.right, x);
  bounds.top = Math.min(bounds.top, y);
  bounds.bottom = Math.max(bounds.bottom, y);
}

export function layerGeometry(layer) {
  const { drawing } = layer.source;
  const { left, right, top, bottom } = drawing.bounds;
  const centreX = (left + right) / 2;
  const centreY = (top + bottom) / 2;
  const radians = layer.angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const x = Math.round(layer.x * 10), y = Math.round(layer.y * 10);
  const place = (a, b) => {
    const dx = a - centreX, dy = b - centreY;
    return [x + Math.round(dx * cos - dy * sin), y + Math.round(dx * sin + dy * cos)];
  };
  const bounds = emptyBounds();
  const runs = drawing.runs.map(run => run.map(([ax, ay, bx, by]) => {
    const [sx, sy] = place(ax, ay), [tx, ty] = place(bx, by);
    includePoint(bounds, sx, sy);
    includePoint(bounds, tx, ty);
    return [sx, sy, tx, ty];
  }));
  return { runs, bounds, place, count: drawing.count };
}

export function fitsHoop(bounds, hoop) {
  return bounds.left >= -hoop.width * 5 && bounds.right <= hoop.width * 5 &&
    bounds.top >= -hoop.height * 5 && bounds.bottom <= hoop.height * 5;
}

export function fitsCentredHoop(width, height, hoop) {
  // The centred edges land on whole 0.1 mm stitch coordinates.
  return Math.ceil(Math.round(width * 10) / 2) <= hoop.width * 5 &&
    Math.ceil(Math.round(height * 10) / 2) <= hoop.height * 5;
}

export function composeBoard(layers, hoop) {
  if (!layers.length) throw Error('Add lettering or a design first.');
  const total = layers.reduce((count, layer) => count + layer.source.pattern.stitches.length + 3, 1);
  if (total > MAX_COMMANDS) throw Error('The combined design contains too many machine commands.');
  const pattern = new EmbPattern();
  pattern.metadata('name', 'Stitch Forge design');
  let lastColour;
  for (const [index, layer] of layers.entries()) {
    const geometry = layerGeometry(layer);
    if (!fitsHoop(geometry.bounds, hoop)) throw Error('Move the layers inside the selected hoop before exporting.');
    const colours = threadColours(layer);
    if (pattern.stitches.length) {
      pattern.trim();
      if (lastColour !== colours[0]) pattern.colorChange();
    }
    const start = lastColour === colours[0] ? 1 : 0;
    for (const hex of colours.slice(start)) {
      // Distinguish adjacent matching colours from an actual PES stop while reusing entries elsewhere.
      const repeated = hex === lastColour && !pattern.threadlist.at(-1)?.description;
      pattern.addThread(repeated ? { hex, description: 'Thread change' } : { hex });
      lastColour = hex;
    }
    appendDesign(pattern, layer.source, geometry.place, { skipTerminalTravel: index < layers.length - 1 });
  }
  pattern.end();
  const drawing = stitchDrawing(pattern);
  if (!drawing.count || !fitsHoop(drawing.bounds, hoop)) throw Error('The design is empty or extends past the hoop.');
  return pattern;
}

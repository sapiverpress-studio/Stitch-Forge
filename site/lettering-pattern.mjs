import { EmbConstant, EmbPattern, readDst, readPes, writeDst, writePes } from '@guillaumemmm/tsembroidery';
import { unzipSync } from 'fflate';

const { STITCH, JUMP, TRIM, STOP, END, COLOR_CHANGE, COMMAND_MASK } = EmbConstant;
const SUPPORTED_COMMANDS = new Set([STITCH, JUMP, TRIM, STOP, END, COLOR_CHANGE]);
const FORMATS = { pes: { read: readPes, write: writePes }, dst: { read: readDst, write: writeDst } };
const MAX_GLYPH_BYTES = 500_000;
const MAX_COMMANDS = 200_000;
const textDecoder = new TextDecoder();

export const MAX_FONT_PACK_BYTES = 100 * 1024 * 1024;
export const MAX_DESIGN_BYTES = 4 * 1024 * 1024;

function readSize(folder) {
  const match = /^(\d+(?:\.\d+)?|\.\d+)\s*(mm|in(?:ch(?:es)?)?|["″])?$/i.exec(folder.trim());
  if (!match) return null;
  const size = Number(match[1]);
  const metric = match[2]?.toLowerCase() === 'mm';
  const mm = Math.round(size * (metric ? 1 : 25.4) * 100) / 100;
  if (mm <= 0 || mm > 500) return null;
  return { mm, label: metric ? `${mm} mm` : `${size}″ (${mm} mm)` };
}

function readGlyph(filename) {
  const match = /^(.*)\.(pes|dst)$/i.exec(filename);
  if (!match) return null;
  const label = match[1].trim().normalize('NFC');
  const suffix = /^([a-z])([ul])$/i.exec(label);
  const character = suffix
    ? (suffix[2].toLowerCase() === 'u' ? suffix[1].toUpperCase() : suffix[1].toLowerCase())
    : label;
  if ([...character].length !== 1 || /[\s\p{Cc}]/u.test(character)) return null;
  const format = match[2].toLowerCase();
  return { character, format, priority: (format === 'pes' ? 2 : 0) + (suffix ? 1 : 0) };
}

export function indexFontPack(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > MAX_FONT_PACK_BYTES) {
    throw Error('Choose a font ZIP up to 100 MB.');
  }
  const fonts = new Map();
  let count = 0;
  unzipSync(bytes, { filter(entry) {
    if (++count > 60_000) throw Error('This font ZIP contains too many files.');
    const parts = entry.name.split(/[\\/]/);
    if (parts.length < 3 || parts.some(part => !part || part === '..' || part === '__MACOSX')) return false;
    const [name, sizeFolder, filename] = parts.slice(-3);
    const size = readSize(sizeFolder);
    const glyph = readGlyph(filename);
    if (!size || !glyph || name.length > 100 || /\p{Cc}/u.test(name)) return false;
    if (entry.originalSize < 12 || entry.originalSize > MAX_GLYPH_BYTES || ![0, 8].includes(entry.compression)) {
      throw Error('A character file is too large or uses an unsupported ZIP format.');
    }
    if (!fonts.has(name)) fonts.set(name, new Map());
    const sizes = fonts.get(name);
    if (!sizes.has(size.mm)) sizes.set(size.mm, { ...size, glyphs: new Map() });
    const glyphs = sizes.get(size.mm).glyphs;
    const previous = glyphs.get(glyph.character);
    if (!previous || glyph.priority > previous.priority) {
      glyphs.set(glyph.character, { ...glyph, path: entry.name, bytes: entry.originalSize });
    }
    return false;
  } });
  if (!fonts.size) throw Error('No PES or DST letters were found in font and size folders.');
  return Array.from(fonts, ([name, sizes]) => ({
    name,
    sizes: [...sizes.values()].sort((a, b) => a.mm - b.mm)
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function readLetteringDesign(bytes, format) {
  if (!(bytes instanceof Uint8Array) || !Object.hasOwn(FORMATS, format) || bytes.length > MAX_DESIGN_BYTES) {
    throw Error('Choose a PES or DST design up to 4 MB.');
  }
  const header = textDecoder.decode(bytes.subarray(0, 8));
  if (format === 'pes') {
    if (bytes.length < 550 || !/^#PES\d{4}$/.test(header)) throw Error('The PES file header is invalid.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pec = view.getUint32(8, true);
    if (pec < 12 || pec + 529 > bytes.length || textDecoder.decode(bytes.subarray(pec, pec + 3)) !== 'LA:') {
      throw Error('The PES stitch block is missing.');
    }
  } else if (bytes.length < 515 || !header.startsWith('LA:')) {
    throw Error('The DST file header is invalid.');
  }
  const pattern = FORMATS[format].read(bytes);
  const { stitches } = pattern;
  if (stitches.length > MAX_COMMANDS || (stitches.at(-1)?.[2] & COMMAND_MASK) !== END) {
    throw Error('The stitch file is incomplete or too large.');
  }
  for (const [x, y, command] of stitches) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || Math.max(Math.abs(x), Math.abs(y)) > 10_000 ||
        !SUPPORTED_COMMANDS.has(command & COMMAND_MASK)) {
      throw Error('The file contains unsupported machine commands or coordinates.');
    }
  }
  const drawing = stitchDrawing(pattern);
  if (!drawing.count) throw Error('The file contains no needle stitches.');
  return { pattern, drawing, format };
}

export function stitchDrawing(pattern) {
  const runs = [[]];
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let previous = null;
  let count = 0;
  for (const [x, y, flags] of pattern.stitches) {
    const command = flags & COMMAND_MASK;
    if (command === STITCH) {
      const [fromX, fromY] = previous ?? [x, y];
      runs.at(-1).push([fromX, fromY, x, y]);
      bounds.left = Math.min(bounds.left, x, fromX);
      bounds.top = Math.min(bounds.top, y, fromY);
      bounds.right = Math.max(bounds.right, x, fromX);
      bounds.bottom = Math.max(bounds.bottom, y, fromY);
      count++;
      previous = [x, y];
    } else {
      if (command === COLOR_CHANGE) runs.push([]);
      if (command === JUMP || command === TRIM || command === COLOR_CHANGE) previous = null;
    }
  }
  return { runs, bounds, count };
}

function appendPlacement(target, { source, x, y }, xCentre, yCentre) {
  const dx = x - xCentre, dy = y - yCentre;
  const stitches = source.pattern.stitches;
  const start = stitches.findIndex((stitch) => (stitch[2] & COMMAND_MASK) === STITCH);
  const [entryX, entryY] = stitches[Math.max(start - 1, 0)];
  target.moveAbs(entryX + dx, entryY + dy);
  // Keep deliberate stops before the first stitch as well as commands within the design.
  for (const [, , flags] of stitches.slice(0, start)) {
    const command = flags & COMMAND_MASK;
    if (command === COLOR_CHANGE || command === STOP) target.addStitchAbsolute(command, entryX + dx, entryY + dy);
  }
  for (const [px, py, flags] of stitches.slice(start, -1)) {
    target.addStitchAbsolute(flags & COMMAND_MASK, px + dx, py + dy);
  }
}

export function composeLettering(bytes, size, text, { colour, spacingMm, motif = null }) {
  const characters = [...text.trim().normalize('NFC')];
  if (!characters.length || characters.length > 48) throw Error('Type a name or phrase up to 48 characters.');
  if (!/^#[\da-f]{6}$/i.test(colour) || !Number.isFinite(spacingMm) || spacingMm < 0 || spacingMm > 10) {
    throw Error('Choose a thread colour and a letter spacing between 0 and 10 mm.');
  }
  const required = new Set(characters.filter(char => char !== ' '));
  const missing = [...required].filter(char => !size.glyphs.has(char));
  if (missing.length) throw Error(`This font and size do not have: ${missing.join(', ')}.`);
  const reference = ['x', 'e', 'a', 'o'].find(char => size.glyphs.has(char));
  if (reference && characters.some(char => 'gjpqy'.includes(char))) required.add(reference);
  const requested = new Map([...required].map(char => {
    const glyph = size.glyphs.get(char);
    return [glyph.path, glyph];
  }));
  const entries = unzipSync(bytes, { filter: entry => requested.has(entry.name) });
  const letters = new Map();
  for (const [path, glyph] of requested) {
    if (entries[path]?.length !== glyph.bytes) throw Error('A character file in the ZIP is incomplete.');
    const letter = readLetteringDesign(entries[path], glyph.format);
    if (letter.pattern.threadlist.length > 1 || letter.drawing.runs.length > 1) {
      throw Error(`The character ${glyph.character} uses multiple thread colours.`);
    }
    letters.set(glyph.character, letter);
  }
  const boxHeight = ({ top, bottom }) => bottom - top;
  const xHeight = letters.has(reference) ? boxHeight(letters.get(reference).drawing.bounds) : 0;
  const placements = [];
  const gap = Math.round(spacingMm * 10);
  let cursor = 0, letterBottom = 0;
  for (const char of characters) {
    if (char === ' ') {
      cursor += Math.round(size.mm * 4);
      continue;
    }
    const source = letters.get(char);
    const { left, right, top, bottom } = source.drawing.bounds;
    let baseline = 0;
    if (xHeight && 'gpqy'.includes(char)) baseline = Math.max(0, Math.min(Math.round(xHeight / 2), bottom - top - xHeight));
    if (xHeight && char === 'j') baseline = Math.round(xHeight / 3);
    if (char === ',' || char === ';') baseline = Math.round(size.mm);
    if (char === "'" || char === '’' || char === '"') baseline = bottom - top - Math.round(size.mm * 10);
    placements.push({ source, x: cursor - left, y: baseline - bottom });
    letterBottom = Math.max(letterBottom, baseline);
    cursor += right - left + gap;
  }
  if (motif) {
    const { left, right, top } = motif.drawing.bounds;
    placements.push({ source: motif, x: Math.round((cursor - gap - (right - left)) / 2) - left, y: letterBottom + 40 - top });
  }
  if (placements.reduce((total, placement) => total + placement.source.pattern.stitches.length + 2, 1) > MAX_COMMANDS) {
    throw Error('The combined design contains too many machine commands.');
  }
  const dimensions = placements.map(({ source: { drawing: { bounds } }, x, y }) => ({
    left: bounds.left + x, top: bounds.top + y, right: bounds.right + x, bottom: bounds.bottom + y
  }));
  const xCentre = Math.round((Math.min(...dimensions.map(d => d.left)) + Math.max(...dimensions.map(d => d.right))) / 2);
  const yCentre = Math.round((Math.min(...dimensions.map(d => d.top)) + Math.max(...dimensions.map(d => d.bottom))) / 2);
  const pattern = new EmbPattern();
  pattern.metadata('name', characters.join('').slice(0, 48));
  pattern.addThread({ hex: colour, description: 'Lettering' });
  for (const placement of placements) {
    if (pattern.stitches.length) pattern.trim();
    if (placement.source === motif) {
      const [lastX, lastY] = pattern.stitches.at(-1);
      pattern.addStitchAbsolute(COLOR_CHANGE, lastX, lastY);
      for (let i = 0; i < motif.drawing.runs.length; i++) {
        const thread = motif.format === 'pes' ? motif.pattern.threadlist[i] : null;
        const fallback = ['#237d86', '#ba5f3e', '#67478e', '#47774a', '#cd8a32'];
        pattern.addThread({ hex: thread?.hexColor() ?? fallback[i % fallback.length], description: `Design thread ${i + 1}` });
      }
    }
    appendPlacement(pattern, placement, xCentre, yCentre);
  }
  pattern.end();
  const drawing = stitchDrawing(pattern);
  return {
    pattern, ...drawing,
    widthMm: (drawing.bounds.right - drawing.bounds.left) / 10,
    heightMm: (drawing.bounds.bottom - drawing.bounds.top) / 10
  };
}

export function exportLettering(pattern, format) {
  if (!Object.hasOwn(FORMATS, format)) throw Error('Choose PES or DST.');
  const { write, read } = FORMATS[format];
  const bytes = write(pattern);
  const reopened = read(bytes);
  const expected = stitchDrawing(pattern).runs.flat(), actual = stitchDrawing(reopened).runs.flat();
  const countStops = design => design.countStitchCommands(STOP) + design.countStitchCommands(COLOR_CHANGE);
  const colours = design => design.threadlist.map(thread => thread.hexColor()).join(',');
  if (expected.length !== actual.length || countStops(pattern) !== countStops(reopened) ||
      (format === 'pes' && colours(pattern) !== colours(reopened)) ||
      actual.some((segment, i) => segment.some((coordinate, axis) => coordinate !== expected[i][axis]))) {
    throw Error(`The ${format.toUpperCase()} file changed the planned stitches during export.`);
  }
  return bytes;
}

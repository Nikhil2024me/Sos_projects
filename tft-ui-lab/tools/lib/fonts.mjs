import fs from 'node:fs';
import path from 'node:path';

export const FONT_FILES = {
  sans9: 'FreeSans9pt7b.h',
  sans12: 'FreeSans12pt7b.h',
  sansBold9: 'FreeSansBold9pt7b.h',
  sansBold12: 'FreeSansBold12pt7b.h',
  sansBold18: 'FreeSansBold18pt7b.h',
  sansBold24: 'FreeSansBold24pt7b.h',
  mono9: 'FreeMono9pt7b.h',
  monoBold9: 'FreeMonoBold9pt7b.h',
  monoBold12: 'FreeMonoBold12pt7b.h',
  monoBold18: 'FreeMonoBold18pt7b.h',
};

function arrayBlock(source, name, kind = 'uint8_t') {
  const re = new RegExp(
    `const\\s+${kind}\\s+${name}\\s*\\[\\]\\s+PROGMEM\\s*=\\s*\\{([\\s\\S]*?)\\};`,
    'm'
  );
  const match = source.match(re);
  if (!match) throw new Error(`Could not find ${name} in font header`);
  return match[1];
}

export function parseFont(source, fileName) {
  const base = fileName.replace(/\.h$/, '');
  const bitmapBlock = arrayBlock(source, `${base}Bitmaps`);
  const bitmap = Buffer.from(
    [...bitmapBlock.matchAll(/0x([0-9a-fA-F]{2})/g)].map((m) => parseInt(m[1], 16))
  );

  const glyphBlock = arrayBlock(source, `${base}Glyphs`, 'GFXglyph');
  const glyphs = [...glyphBlock.matchAll(
    /\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\}/g
  )].map((m) => ({
    offset: Number(m[1]),
    width: Number(m[2]),
    height: Number(m[3]),
    xAdvance: Number(m[4]),
    xOffset: Number(m[5]),
    yOffset: Number(m[6]),
  }));

  const fontStruct = source.match(
    new RegExp(`const\\s+GFXfont\\s+${base}\\s+PROGMEM\\s*=\\s*\\{([\\s\\S]*?)\\};`, 'm')
  );
  if (!fontStruct) throw new Error(`Could not find GFXfont ${base}`);
  const values = [...fontStruct[1].matchAll(/0x[0-9a-fA-F]+|\b\d+\b/g)].map((m) =>
    m[0].startsWith('0x') ? parseInt(m[0], 16) : Number(m[0])
  );
  // The initializer also contains the bitmap and glyph array names; filter to the last 3 numbers.
  const tail = values.slice(-3);
  const [first, last, yAdvance] = tail;

  const printable = glyphs.filter((g) => g.width > 0 && g.height > 0);
  const ascent = Math.max(...printable.map((g) => -g.yOffset));
  const descent = Math.max(...printable.map((g) => g.yOffset + g.height));
  const height = ascent + descent;

  return {
    id: base,
    first,
    last,
    yAdvance,
    ascent,
    descent,
    height,
    bitmap: bitmap.toString('base64'),
    glyphs: glyphs.map((g, i) => ({ code: first + i, ...g })),
  };
}

export function loadFonts(fontDir) {
  const out = {};
  for (const [id, file] of Object.entries(FONT_FILES)) {
    const full = path.join(fontDir, file);
    out[id] = parseFont(fs.readFileSync(full, 'utf8'), file);
  }
  return out;
}

export function glyphMap(font) {
  const map = new Map();
  for (const g of font.glyphs) map.set(g.code, g);
  return map;
}

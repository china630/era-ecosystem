/**
 * Writes 16/32 toolbar PNGs (filled circle). Run from this folder:
 *   node icons/write-lamp-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

const COLORS = {
  gray: [107, 114, 128],
  green: [22, 163, 74],
  yellow: [202, 138, 4],
  red: [220, 38, 38],
};

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function circlePng(size, r, g, b) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = (size - 1) / 2;
  const rad = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cx);
      const i = y * stride + 1 + x * 4;
      let a = 0;
      if (d <= rad - 0.55) a = 255;
      else if (d <= rad + 0.55) a = Math.round((255 * (rad + 0.55 - d)) / 1.1);
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(DIR, { recursive: true });
for (const [name, rgb] of Object.entries(COLORS)) {
  for (const size of [16, 32]) {
    const file = join(DIR, `lamp-${name}-${size}.png`);
    writeFileSync(file, circlePng(size, ...rgb));
  }
}
console.log("wrote lamp icons in", DIR);

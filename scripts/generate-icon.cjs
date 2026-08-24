const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SIZE = 128;
const CENTER = SIZE / 2;
const RADIUS = 46;
const EDGE_W = 0.06;

const BG_TOP = [30, 34, 52];
const BG_BOTTOM = [15, 17, 26];
const DIA_TOPLEFT = [167, 139, 250];
const DIA_BOTTOMRIGHT = [34, 211, 238];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function buildPixels() {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let offset = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[offset++] = 0;
    const bgT = y / (SIZE - 1);
    const bg = mix(BG_TOP, BG_BOTTOM, bgT);
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CENTER;
      const dy = y - CENTER;
      const t = (Math.abs(dx) + Math.abs(dy)) / RADIUS;
      let r = bg[0];
      let g = bg[1];
      let b = bg[2];
      let a = 255;
      if (t < 1) {
        const coverage =
          t <= 1 - EDGE_W ? 1 : Math.max(0, Math.min(1, (1 - t) / EDGE_W));
        const gradT = Math.max(0, Math.min(1, (dx + dy + 2 * RADIUS) / (4 * RADIUS)));
        const dia = mix(DIA_TOPLEFT, DIA_BOTTOMRIGHT, gradT);
        r = Math.round(lerp(bg[0], dia[0], coverage));
        g = Math.round(lerp(bg[1], dia[1], coverage));
        b = Math.round(lerp(bg[2], dia[2], coverage));
      }
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  return raw;
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function main() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(buildPixels(), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  const outDir = path.join(__dirname, "..", "media");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "icon.png");
  fs.writeFileSync(outFile, png);
  console.log(`Icon written to ${outFile} (${png.length} bytes)`);
}

main();

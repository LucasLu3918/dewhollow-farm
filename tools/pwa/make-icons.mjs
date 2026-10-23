// 產生 PWA 圖示（純程式繪製，沒有外部素材、沒有新依賴）。用法：node tools/pwa/make-icons.mjs
// 圖案：草地底色、升起的太陽、一排幼苗與土丘。所有內容都在中央圓（半徑 0.4）以內，因此 maskable 版本也不會被裁掉重要部分。
// 輸出：public/assets/icons/icon-192.png、icon-512.png、icon-maskable-512.png（登錄於 content/assets.json，來源「程式產生」）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../../public/assets/icons/', import.meta.url));

const GRASS = [0x7f, 0xae, 0x6b];
const SUN = [0xfd, 0xfb, 0x73];
const SOIL = [0x5e, 0x43, 0x30];
const STEM = [0x2f, 0x5a, 0x36];
const LEAF = [0x9b, 0xe0, 0x7a];

/** 回傳 [r,g,b]，座標 u,v 在 0..1 之間（左上為 0,0）。後畫的覆蓋先畫的。 */
function colorAt(u, v) {
  if (inCircle(u, v, 0.5, 0.3, 0.12)) return SUN;
  if (inEllipse(u, v, 0.5, 0.72, 0.26, 0.1)) return SOIL;
  for (const x of [0.38, 0.5, 0.62]) {
    if (u >= x - 0.015 && u <= x + 0.015 && v >= 0.5 && v <= 0.72) return STEM;
    if (inCircle(u, v, x, 0.5, 0.055)) return LEAF;
  }
  return GRASS;
}

function inCircle(u, v, cx, cy, r) {
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

function inEllipse(u, v, cx, cy, rx, ry) {
  return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
}

/** 先以 64×64 像素畫布繪製，再用最近鄰放大，保留硬邊像素風格。 */
function render(size) {
  const logicalSize = 64;
  const scale = size / logicalSize;
  if (!Number.isInteger(scale)) throw new Error(`圖示尺寸 ${size} 必須是 64 的整數倍`);
  const logical = Buffer.alloc(logicalSize * logicalSize * 4);
  for (let y = 0; y < logicalSize; y++) {
    for (let x = 0; x < logicalSize; x++) {
      const [r, g, b] = colorAt((x + 0.5) / logicalSize, (y + 0.5) / logicalSize);
      const i = (y * logicalSize + x) * 4;
      logical[i] = r;
      logical[i + 1] = g;
      logical[i + 2] = b;
      logical[i + 3] = 255;
    }
  }
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const logicalX = Math.floor(x / scale);
      const logicalY = Math.floor(y / scale);
      const source = (logicalY * logicalSize + logicalX) * 4;
      const i = (y * size + x) * 4;
      logical.copy(rgba, i, source, source + 4);
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // 過濾方式：無
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 每通道 8 位元
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  writeFileSync(`${OUT_DIR}${name}`, encodePng(size, render(size)));
  console.log(`已產生 public/assets/icons/${name}（${size}×${size}）`);
}

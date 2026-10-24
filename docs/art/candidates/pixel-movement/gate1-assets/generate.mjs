#!/usr/bin/env node
/**
 * Reproducible, hand-authored native-grid Gate 1 candidate sprites.
 * This script writes only beside itself. It does not touch production assets.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = dirname(fileURLToPath(import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const palettes = {
  a16: {
    ink: '#493d3c', outline: '#625044', hair: '#684631', hairLight: '#986044', skin: '#f1c99b',
    skinShade: '#d99470', shirt: '#68a69a', shirtShade: '#477b76', pants: '#566d85', pantsShade: '#394f66',
    boot: '#674737', gold: '#e3ae52', grass: '#82ad70', grassShade: '#638d5b', grassLight: '#a4c77c',
    soil: '#79563f', soilShade: '#543f35', soilLight: '#a57b55', path: '#c5a678', pathShade: '#a1835e',
    cat: '#36343b', catShade: '#55505a', catLight: '#8a7071', eye: '#efd778', white: '#f5e8ca',
    mars: '#b67a4e', marsShade: '#85543d', marsLight: '#dda56d', pink: '#d98579',
  },
  b32: {
    ink: '#3c3436', outline: '#59463d', hair: '#67432f', hairLight: '#996342', skin: '#f2c99e',
    skinShade: '#d99672', shirt: '#70aaa0', shirtLight: '#9ac9b2', shirtShade: '#477a76',
    pants: '#526d87', pantsLight: '#7891a4', pantsShade: '#354c64', boot: '#654537', bootLight: '#9a6848',
    gold: '#e8b653', grass: '#80ad6e', grassShade: '#608857', grassLight: '#a6c982', grassDeep: '#52774e',
    soil: '#785640', soilShade: '#523c32', soilLight: '#a77e59', soilDeep: '#674834',
    path: '#c6a879', pathShade: '#a0835f', pathLight: '#e0c491', pathDeep: '#90724f',
    cat: '#36343b', catShade: '#514d57', catLight: '#827079', eye: '#f0d672', white: '#f5e9cf',
    mars: '#b7794c', marsShade: '#7d4d39', marsLight: '#dda46b', marsCream: '#efd3a0', pink: '#d98579',
  },
};

function canvas(w, h, palette) {
  const pixels = new Uint8Array(w * h);
  const c = {
    w, h, pixels, palette,
    dot(x, y, color) {
      x = Math.floor(x); y = Math.floor(y);
      if (x >= 0 && y >= 0 && x < w && y < h) {
        pixels[y * w + x] = typeof color === 'number' ? color : Object.keys(this.palette).indexOf(color) + 1;
      }
    },
    rect(x, y, rw, rh, color) {
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) this.dot(xx, yy, color);
    },
    ellipse(cx, cy, rx, ry, color) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.dot(x, y, color);
        }
      }
    },
    line(x1, y1, x2, y2, color) {
      const dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1;
      const dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        this.dot(x1, y1, color);
        if (x1 === x2 && y1 === y2) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x1 += sx; }
        if (e2 <= dx) { err += dx; y1 += sy; }
      }
    },
    get(x, y) { return pixels[y * w + x]; },
  };
  return c;
}

function grass16() {
  const c = canvas(16, 16, palettes.a16); c.rect(0, 0, 16, 16, 'grass');
  c.dot(3, 4, 'grassLight'); c.dot(4, 4, 'grassLight'); c.dot(10, 3, 'grassShade');
  c.dot(12, 9, 'grassLight'); c.dot(11, 10, 'grassShade'); c.dot(5, 12, 'grassShade');
  c.dot(7, 6, 'grassLight'); c.dot(8, 7, 'grassShade'); c.dot(2, 9, 'grassShade');
  c.dot(14, 13, 'grassLight'); c.dot(6, 2, 'grassShade');
  return c;
}
function grass32() {
  const c = canvas(32, 32, palettes.b32); c.rect(0, 0, 32, 32, 'grass');
  c.rect(4, 5, 3, 2, 'grassShade'); c.rect(5, 4, 2, 1, 'grassLight');
  c.rect(20, 3, 2, 3, 'grassDeep'); c.rect(21, 3, 2, 1, 'grassLight');
  c.rect(11, 13, 2, 2, 'grassLight'); c.rect(13, 14, 2, 1, 'grassShade');
  c.rect(25, 19, 3, 2, 'grassShade'); c.rect(24, 18, 2, 1, 'grassLight');
  c.rect(7, 25, 3, 2, 'grassDeep'); c.rect(8, 24, 2, 1, 'grassLight');
  c.rect(17, 28, 2, 2, 'grassLight'); c.rect(18, 27, 2, 1, 'grassShade');
  c.dot(15, 7, 'grassDeep'); c.dot(29, 11, 'grassLight'); c.dot(2, 17, 'grassLight');
  return c;
}
function field16() {
  const c = canvas(16, 16, palettes.a16); c.rect(0, 0, 16, 16, 'soil');
  c.line(0, 4, 15, 4, 'soilShade'); c.line(0, 5, 15, 5, 'soilLight');
  c.line(0, 10, 15, 10, 'soilShade'); c.line(0, 11, 15, 11, 'soilLight');
  c.dot(3, 2, 'soilLight'); c.dot(11, 8, 'soilShade'); c.dot(6, 14, 'soilLight');
  return c;
}
function field32() {
  const c = canvas(32, 32, palettes.b32); c.rect(0, 0, 32, 32, 'soil');
  for (const y of [5, 13, 21, 29]) {
    c.line(0, y, 31, y, 'soilDeep'); c.line(0, y + 1, 31, y + 1, 'soilShade');
    c.line(0, y + 2, 31, y + 2, 'soilLight');
  }
  c.rect(4, 2, 3, 1, 'soilLight'); c.rect(21, 8, 4, 1, 'soilDeep');
  c.rect(12, 17, 3, 1, 'soilLight'); c.rect(25, 26, 4, 1, 'soilDeep');
  return c;
}
function path16() {
  const c = canvas(16, 16, palettes.a16); c.rect(0, 0, 16, 16, 'path');
  c.dot(2, 3, 'pathShade'); c.dot(3, 3, 'pathShade'); c.dot(11, 2, 'pathShade');
  c.dot(8, 7, 'pathShade'); c.dot(9, 7, 'pathShade'); c.dot(4, 11, 'white');
  c.dot(13, 13, 'pathShade'); c.dot(2, 14, 'pathShade');
  return c;
}
function path32() {
  const c = canvas(32, 32, palettes.b32); c.rect(0, 0, 32, 32, 'path');
  c.rect(3, 4, 3, 2, 'pathShade'); c.rect(4, 3, 2, 1, 'pathDeep');
  c.rect(19, 2, 4, 2, 'pathLight'); c.rect(21, 4, 2, 1, 'pathShade');
  c.rect(10, 12, 3, 2, 'pathDeep'); c.rect(11, 11, 2, 1, 'pathShade');
  c.rect(25, 17, 4, 2, 'pathLight'); c.rect(26, 19, 2, 1, 'pathShade');
  c.rect(5, 24, 3, 2, 'pathShade'); c.rect(4, 25, 1, 2, 'pathDeep');
  c.rect(17, 28, 4, 2, 'pathLight'); c.rect(18, 27, 2, 1, 'pathShade');
  return c;
}

function player16(walk = false) {
  const c = canvas(16, 24, palettes.a16);
  // Hair, face and a small brim form a readable front-facing farmer silhouette.
  c.ellipse(8, 7, 4, 4, 'outline'); c.ellipse(8, 6, 3, 3, 'hair');
  c.rect(5, 7, 6, 3, 'skin'); c.dot(6, 8, 'ink'); c.dot(9, 8, 'ink'); c.dot(7, 9, 'skinShade');
  c.rect(4, 4, 8, 1, 'gold'); c.dot(11, 5, 'gold');
  c.rect(5, 11, 6, 6, 'outline'); c.rect(6, 11, 4, 5, 'shirt');
  c.rect(6, 13, 4, 3, 'pants'); c.dot(7, 13, 'gold'); c.dot(8, 13, 'gold');
  c.rect(3, 12, 2, 5, 'skin'); c.rect(11, 12, 2, 5, 'skinShade');
  if (walk) {
    c.rect(5, 17, 3, 5, 'pantsShade'); c.rect(8, 17, 3, 5, 'pants');
    c.rect(3, 21, 5, 2, 'boot'); c.rect(9, 21, 4, 2, 'boot');
  } else {
    c.rect(5, 17, 3, 5, 'pantsShade'); c.rect(8, 17, 3, 5, 'pants');
    c.rect(4, 21, 4, 2, 'boot'); c.rect(8, 21, 4, 2, 'boot');
  }
  c.dot(5, 15, 'gold'); c.dot(10, 15, 'shirtShade');
  return c;
}
function player32(walk = false) {
  const c = canvas(32, 48, palettes.b32);
  c.ellipse(16, 12, 8, 9, 'outline'); c.ellipse(16, 11, 7, 8, 'hair');
  c.ellipse(16, 13, 5, 5, 'skin'); c.rect(10, 7, 12, 4, 'hair');
  c.rect(10, 13, 12, 5, 'skin'); c.rect(12, 14, 2, 2, 'ink'); c.rect(18, 14, 2, 2, 'ink');
  c.rect(15, 16, 2, 1, 'skinShade'); c.rect(11, 18, 10, 2, 'hairLight');
  c.rect(8, 8, 16, 2, 'gold'); c.rect(11, 6, 10, 2, 'gold'); c.rect(22, 9, 3, 1, 'gold');
  c.rect(10, 20, 12, 12, 'outline'); c.rect(11, 20, 10, 10, 'shirt');
  c.rect(12, 23, 8, 7, 'pants'); c.rect(14, 22, 4, 1, 'gold');
  c.rect(7, 22, 4, 9, 'skin'); c.rect(21, 22, 4, 9, 'skinShade');
  c.rect(8, 30, 5, 3, 'shirtShade'); c.rect(19, 30, 5, 3, 'shirtShade');
  c.rect(11, 32, 4, 10, 'pantsShade'); c.rect(17, 32, 4, 10, 'pants');
  if (walk) {
    c.rect(8, 40, 9, 4, 'boot'); c.rect(18, 40, 8, 4, 'boot');
    c.rect(6, 43, 10, 2, 'bootLight'); c.rect(19, 43, 8, 2, 'bootLight');
  } else {
    c.rect(10, 40, 5, 4, 'boot'); c.rect(17, 40, 5, 4, 'boot');
    c.rect(9, 43, 7, 2, 'bootLight'); c.rect(16, 43, 7, 2, 'bootLight');
  }
  c.rect(9, 25, 2, 4, 'gold'); c.rect(21, 25, 2, 4, 'shirtLight');
  return c;
}

function cat16() {
  const c = canvas(16, 16, palettes.a16);
  c.line(3, 9, 2, 6, 'cat'); c.dot(2, 5, 'cat'); c.dot(3, 6, 'catShade');
  c.ellipse(7, 10, 4, 3, 'cat'); c.ellipse(11, 8, 3, 3, 'catShade');
  c.dot(9, 5, 'cat'); c.dot(10, 4, 'cat'); c.dot(12, 5, 'cat'); c.dot(13, 6, 'cat');
  c.dot(12, 8, 'eye'); c.dot(14, 9, 'white');
  c.rect(4, 12, 2, 2, 'cat'); c.rect(9, 12, 2, 2, 'cat'); c.rect(12, 11, 2, 2, 'cat');
  return c;
}
function cat32() {
  const c = canvas(32, 32, palettes.b32);
  c.line(8, 20, 5, 15, 'cat'); c.line(5, 15, 6, 11, 'catShade'); c.dot(6, 10, 'cat');
  c.ellipse(15, 21, 9, 6, 'cat'); c.ellipse(23, 17, 6, 6, 'catShade');
  c.ellipse(23, 18, 4, 4, 'cat');
  c.line(19, 14, 18, 9, 'cat'); c.line(18, 9, 21, 12, 'cat');
  c.line(25, 12, 27, 8, 'cat'); c.line(27, 8, 29, 13, 'cat');
  c.dot(25, 17, 'eye'); c.rect(28, 18, 2, 1, 'pink');
  c.rect(9, 25, 4, 4, 'catShade'); c.rect(17, 25, 4, 4, 'catShade');
  c.rect(23, 23, 3, 5, 'cat'); c.rect(27, 24, 3, 4, 'cat');
  c.dot(14, 19, 'catLight'); c.dot(15, 18, 'catLight');
  return c;
}

function mars16() {
  const c = canvas(16, 16, palettes.a16);
  c.ellipse(7, 10, 4, 3, 'mars'); c.ellipse(11, 8, 3, 3, 'marsLight');
  c.line(12, 6, 11, 3, 'mars'); c.line(11, 3, 13, 5, 'pink');
  c.line(14, 6, 14, 3, 'marsShade'); c.dot(14, 3, 'pink');
  c.dot(12, 8, 'ink'); c.dot(13, 9, 'marsCream'); c.dot(5, 9, 'marsLight');
  c.rect(4, 12, 2, 2, 'marsShade'); c.rect(9, 12, 2, 2, 'marsShade'); c.rect(12, 11, 2, 2, 'marsShade');
  c.line(4, 10, 2, 8, 'marsShade'); c.dot(2, 8, 'marsShade');
  return c;
}
function mars32() {
  const c = canvas(32, 32, palettes.b32);
  c.ellipse(14, 20, 9, 6, 'marsShade'); c.ellipse(15, 19, 8, 5, 'mars');
  c.ellipse(23, 17, 6, 5, 'mars'); c.ellipse(24, 18, 4, 3, 'marsCream');
  c.line(25, 13, 23, 7, 'marsShade'); c.line(23, 7, 27, 12, 'mars');
  c.line(29, 13, 29, 7, 'marsShade'); c.line(29, 7, 31, 13, 'mars');
  c.rect(24, 9, 2, 2, 'pink'); c.rect(29, 9, 2, 2, 'pink');
  c.rect(26, 16, 2, 2, 'ink'); c.rect(27, 20, 3, 1, 'marsShade');
  c.rect(8, 24, 5, 5, 'marsShade'); c.rect(16, 24, 5, 5, 'marsShade');
  c.rect(23, 22, 4, 6, 'marsShade'); c.rect(27, 23, 4, 5, 'marsShade');
  c.line(7, 19, 3, 16, 'marsShade'); c.line(3, 16, 2, 13, 'mars');
  c.rect(12, 17, 2, 1, 'marsLight'); c.rect(14, 16, 2, 1, 'marsLight');
  c.dot(22, 15, 'marsLight');
  return c;
}

function tree16() {
  const c = canvas(16, 16, palettes.a16); c.ellipse(8, 6, 6, 5, 'grassShade');
  c.ellipse(6, 5, 3, 3, 'grassLight'); c.ellipse(10, 7, 3, 3, 'grass');
  c.rect(7, 9, 3, 6, 'soilShade'); c.dot(8, 10, 'soilLight'); return c;
}
function tree32() {
  const c = canvas(32, 32, palettes.b32); c.ellipse(16, 12, 12, 10, 'grassDeep');
  c.ellipse(12, 10, 7, 7, 'grassShade'); c.ellipse(13, 8, 5, 4, 'grassLight');
  c.ellipse(21, 13, 7, 6, 'grass'); c.rect(13, 19, 7, 11, 'soilShade');
  c.rect(14, 20, 2, 7, 'soilLight'); c.rect(18, 24, 2, 5, 'soilDeep');
  c.rect(7, 11, 2, 3, 'grassLight'); c.rect(23, 9, 2, 3, 'grassShade'); return c;
}
function crop16(stage) {
  const c = canvas(16, 16, palettes.a16);
  if (stage === 'seed') { c.dot(7, 12, 'gold'); c.dot(8, 12, 'soilLight'); }
  if (stage === 'sprout') { c.line(8, 13, 8, 8, 'grassShade'); c.line(8, 9, 5, 7, 'grassLight'); c.line(8, 10, 11, 7, 'grass'); }
  if (stage === 'mature') {
    c.line(8, 13, 8, 6, 'grassShade'); c.ellipse(5, 7, 3, 2, 'grassLight'); c.ellipse(11, 6, 3, 2, 'grass');
    c.ellipse(8, 10, 3, 4, 'gold'); c.dot(7, 9, 'pathLight'); c.dot(9, 12, 'pathShade');
  }
  return c;
}
function crop32(stage) {
  const c = canvas(32, 32, palettes.b32);
  if (stage === 'seed') { c.ellipse(15, 25, 3, 2, 'soilLight'); c.dot(16, 24, 'gold'); }
  if (stage === 'sprout') {
    c.line(16, 27, 16, 15, 'grassDeep'); c.line(16, 19, 10, 14, 'grassLight');
    c.line(16, 17, 22, 12, 'grass'); c.rect(9, 13, 3, 2, 'grassLight'); c.rect(21, 11, 3, 2, 'grassLight');
  }
  if (stage === 'mature') {
    c.line(16, 27, 16, 11, 'grassDeep'); c.ellipse(10, 13, 6, 3, 'grassLight'); c.ellipse(22, 11, 6, 3, 'grass');
    c.ellipse(16, 20, 6, 8, 'gold'); c.ellipse(14, 18, 2, 3, 'pathLight'); c.rect(18, 22, 2, 3, 'pathShade');
    c.rect(8, 12, 3, 2, 'grassLight'); c.rect(22, 10, 3, 2, 'grassLight');
  }
  return c;
}
function house16() {
  const c = canvas(16, 16, palettes.a16); c.rect(0, 0, 16, 16, 'soilLight');
  c.rect(0, 0, 16, 4, 'hair'); c.rect(1, 1, 5, 1, 'hairLight'); c.rect(3, 5, 4, 5, 'white');
  c.rect(4, 6, 2, 3, 'shirtShade'); c.rect(10, 5, 4, 7, 'soilShade'); c.dot(12, 8, 'gold');
  c.line(0, 14, 15, 14, 'outline'); return c;
}
function house32() {
  const c = canvas(32, 32, palettes.b32); c.rect(0, 0, 32, 32, 'soilLight');
  c.rect(0, 0, 32, 7, 'hair'); c.rect(3, 1, 12, 2, 'hairLight'); c.rect(21, 2, 8, 2, 'outline');
  c.rect(4, 9, 9, 11, 'white'); c.rect(7, 11, 4, 7, 'shirtShade');
  c.rect(19, 9, 9, 17, 'soilShade'); c.rect(22, 12, 3, 10, 'soilDeep'); c.dot(26, 17, 'gold');
  c.rect(0, 25, 32, 3, 'outline'); c.rect(0, 28, 32, 4, 'soilShade'); return c;
}
function fence16() {
  const c = canvas(16, 16, palettes.a16); c.rect(0, 5, 16, 2, 'soilLight'); c.rect(0, 11, 16, 2, 'soilLight');
  c.rect(2, 3, 2, 11, 'soilShade'); c.rect(11, 3, 2, 11, 'soilShade'); c.dot(3, 3, 'white'); c.dot(12, 3, 'white'); return c;
}
function fence32() {
  const c = canvas(32, 32, palettes.b32); c.rect(0, 10, 32, 4, 'soilLight'); c.rect(0, 22, 32, 4, 'soilLight');
  c.rect(4, 6, 4, 22, 'soilShade'); c.rect(23, 6, 4, 22, 'soilShade');
  c.rect(4, 6, 4, 3, 'pathLight'); c.rect(23, 6, 4, 3, 'pathLight'); return c;
}
function tool16() {
  const c = canvas(16, 16, palettes.a16); c.line(4, 13, 11, 4, 'soilShade'); c.line(5, 14, 12, 5, 'soilLight');
  c.rect(9, 3, 5, 2, 'outline'); c.dot(13, 5, 'soilLight'); return c;
}
function tool32() {
  const c = canvas(32, 32, palettes.b32); c.line(8, 27, 22, 6, 'soilShade'); c.line(10, 28, 24, 7, 'soilLight');
  c.rect(19, 4, 9, 4, 'outline'); c.rect(21, 3, 5, 2, 'pathLight'); c.rect(24, 8, 5, 3, 'soilLight'); return c;
}
function shadow16() { const c = canvas(16, 8, palettes.a16); c.ellipse(8, 4, 6, 2, 'soilShade'); return c; }
function shadow32() { const c = canvas(32, 12, palettes.b32); c.ellipse(16, 6, 12, 4, 'soilDeep'); c.ellipse(16, 6, 7, 2, 'soilShade'); return c; }

function pngBytes(c) {
  const rgba = Object.fromEntries(Object.entries(c.palette).map(([k, hex]) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [k, [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]];
  }));
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    const row = y * (c.w * 4 + 1); raw[row] = 0;
    for (let x = 0; x < c.w; x++) {
      const key = [...Object.keys(c.palette)][c.get(x, y) - 1];
      const color = key ? rgba[key] : [0, 0, 0, 0];
      const at = row + 1 + x * 4;
      raw[at] = color[0]; raw[at + 1] = color[1]; raw[at + 2] = color[2];
      raw[at + 3] = key === 'shadow' ? 148 : color[3];
    }
  }
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let v = n; for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1); crcTable[n] = v >>> 0; }
  const crc32 = (buf) => { let crc = 0xffffffff; for (const byte of buf) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const name = Buffer.from(type); const body = Buffer.concat([name, data]); const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), data.length + 8); return out;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const entries = [
  ['grass', grass16, grass32, 'tile', [8,15], [16,31]],
  ['tilled', field16, field32, 'tile', [8,15], [16,31]],
  ['road', path16, path32, 'tile', [8,15], [16,31]],
  ['tree', tree16, tree32, 'tile', [8,15], [16,31]],
  ['cropSeed', () => crop16('seed'), () => crop32('seed'), 'tileOverlay', [8,15], [16,31]],
  ['cropSprout', () => crop16('sprout'), () => crop32('sprout'), 'tileOverlay', [8,15], [16,31]],
  ['cropMature', () => crop16('mature'), () => crop32('mature'), 'tileOverlay', [8,15], [16,31]],
  ['houseEdge', house16, house32, 'tile', [8,15], [16,31]],
  ['fence', fence16, fence32, 'tileOverlay', [8,15], [16,31]],
  ['playerIdle', player16, player32, 'character', [8,23], [16,47]],
  ['playerWalk', () => player16(true), () => player32(true), 'character', [8,23], [16,47]],
  ['cat', cat16, cat32, 'pet', [8,14], [16,28]],
  ['quokka', mars16, mars32, 'pet', [8,14], [16,28]],
  ['tool', tool16, tool32, 'object', [8,15], [16,31]],
  ['shadow', shadow16, shadow32, 'shadow', [8,7], [16,11]],
];
const specs = [
  { candidate: '8bit', id: 'gate1-a-native16', label: '8-bit 時代風格／原生 16×16 網格', grid: 16, palette: palettes.a16 },
  { candidate: '16bit', id: 'gate1-b-native32', label: '16-bit 時代風格／原生 32×32 網格', grid: 32, palette: palettes.b32 },
];

async function main() {
  const scriptHash = sha256(await readFile(fileURLToPath(import.meta.url)));
  const candidates = [];
  for (const spec of specs) {
    const cellW = spec.grid, cellH = spec.grid === 16 ? 24 : 48;
    const columns = 4, rows = Math.ceil(entries.length / columns);
    const atlas = canvas(columns * cellW, rows * cellH, {});
    const frames = {};
    for (let i = 0; i < entries.length; i++) {
      const [key, drawA, drawB, kind, anchorA, anchorB] = entries[i];
      const sprite = (spec.grid === 16 ? drawA : drawB)();
      const col = i % columns, row = Math.floor(i / columns), x = col * cellW, y = row * cellH;
      for (let sy = 0; sy < sprite.h; sy++) for (let sx = 0; sx < sprite.w; sx++) atlas.dot(x + sx, y + sy, sprite.get(sx, sy));
      frames[key] = { x, y, width: sprite.w, height: sprite.h, nativeWidth: sprite.w, nativeHeight: sprite.h,
        tileWidth: spec.grid, tileHeight: spec.grid, kind,
        footAnchor: { x: spec.grid === 16 ? anchorA[0] : anchorB[0], y: spec.grid === 16 ? anchorA[1] : anchorB[1] },
        sha256: sha256(pngBytes(sprite)) };
    }
    // Atlas pixel indices are palette-local. Keep the atlas palette, then encode as RGBA PNG.
    atlas.palette = spec.palette;
    const atlasName = `${spec.candidate}.png`, atlasBytes = pngBytes(atlas);
    await writeFile(join(OUT, atlasName), atlasBytes);
    candidates.push({ id: spec.candidate, candidateId: spec.id, label: spec.label, status: 'candidate', approved: false,
      tileSize: spec.grid, atlas: atlasName, atlasWidth: atlas.w, atlasHeight: atlas.h, frames,
      sha256: sha256(atlasBytes) });
  }
  await writeFile(join(OUT, 'palette.json'), `${JSON.stringify({ status: 'candidate', palettes }, null, 2)}\n`);
  const manifest = {
    schemaVersion: 1,
    title: 'Dewhollow Farm Gate 1 native pixel-grid prototypes',
    status: 'candidate',
    approved: false,
    source: { method: 'hand-authored integer pixel primitives in generate.mjs; no source image scaling', generator: 'generate.mjs', generatorSha256: scriptHash },
    paletteFile: 'palette.json',
    candidates,
    limitations: [
      'These are static candidate studies, not approved or production game assets.',
      'playerWalk is one static pose study, not an animation strip; no four-direction motion set is included.',
      'No rendered 12×10 in-game scene, viewport/DPR matrix, motion video or real-device review is included.',
      'The B player is one 32×48 down-facing idle sample; A uses the 16×24 outline option from the plan.',
    ],
  };
  await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${candidates.length} candidate atlases; ${entries.length * candidates.length} frame PNG digests; generator SHA-256 ${scriptHash}`);
}

await main();

#!/usr/bin/env node
/** Deterministic, hand-authored Pixel32 interior candidate atlas. Candidate only. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';

const OUT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const ATLAS = 512;
const C = {
  outline: '#382E2D', ink: '#493936', shade: '#566B68', shadeDeep: '#48362F',
  wall: '#C79B67', wallLight: '#E0B982', wallShade: '#A97852', base: '#6E503E',
  plank: '#AF8258', plankAlt: '#A97B53', plankLight: '#C59663', plankHi: '#DBAC72', plankDark: '#80583F',
  cream: '#F3DEB7', linen: '#EAD9BB', sage: '#748B65', sageLight: '#A5B184',
  green: '#647C55', greenDark: '#425743', rust: '#A65F49', rustLight: '#D18A60',
  blue: '#73979A', blueLight: '#B4D1C4', glass: '#A8C7B6', gold: '#E9C276',
  stone: '#A5A18A', stoneDark: '#686B5D', pot: '#AC684F', soil: '#5B4638',
  rug: '#8D644E', rugLight: '#D6B77C', rugDark: '#5B4D48', white: '#F2E8D4',
};

function makeCanvas(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  return {
    width, height, rgba,
    dot(x, y, color, alpha = 255) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      const n = Number.parseInt(color.slice(1), 16);
      rgba[i] = n >> 16; rgba[i + 1] = (n >> 8) & 255; rgba[i + 2] = n & 255; rgba[i + 3] = alpha;
    },
    rect(x, y, w, h, color) { for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) this.dot(px, py, color); },
    ellipse(cx, cy, rx, ry, color) {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        if (x * x * ry * ry + y * y * rx * rx <= rx * rx * ry * ry) this.dot(cx + x, cy + y, color);
      }
    },
    line(x0, y0, x1, y1, color) {
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) { this.dot(x0, y0, color); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    },
  };
}

function blit(target, source, ox, oy) {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (!source.rgba[i + 3]) continue;
      const hex = `#${source.rgba[i].toString(16).padStart(2, '0')}${source.rgba[i + 1].toString(16).padStart(2, '0')}${source.rgba[i + 2].toString(16).padStart(2, '0')}`;
      target.dot(ox + x, oy + y, hex, source.rgba[i + 3]);
    }
  }
}

function floorTile(variant) {
  const c = makeCanvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, variant % 2 ? C.plank : C.plankAlt);
  // Long boards meet at the tile edge; the outermost pixels stay uniform for seamless wrapping.
  c.rect(1, 8, 30, 1, C.plankDark); c.rect(1, 19, 30, 1, C.plankDark); c.rect(1, 30, 30, 1, C.plankDark);
  c.rect(2, 3, 27, 2, variant % 2 ? C.plankLight : C.plankHi);
  c.rect(3, 11, 25, 2, C.plankLight); c.rect(2, 22, 27, 2, C.plankLight);
  const knots = [
    [[7, 6, 2, 1], [21, 15, 3, 1], [13, 27, 2, 1]],
    [[23, 6, 2, 1], [8, 15, 3, 1], [20, 27, 2, 1]],
    [[15, 6, 3, 1], [25, 15, 2, 1], [5, 27, 3, 1]],
    [[5, 6, 2, 1], [17, 15, 3, 1], [25, 27, 2, 1]],
  ][variant];
  for (const [x, y, w, h] of knots) c.rect(x, y, w, h, C.plankDark);
  return c;
}

function wallPanel(variant = 0, course = 'middle') {
  const c = makeCanvas(TILE, TILE);
  c.rect(0, 0, 32, 32, C.wall);
  c.rect(1, 1, 30, 19, variant % 2 ? C.wall : C.wallLight);
  for (const x of [0, 15, 31]) { c.rect(x, 1, 1, 19, C.wallShade); if (x < 31) c.rect(x + 1, 2, 1, 17, C.wallLight); }
  if (course === 'top') {
    c.rect(0, 0, 32, 4, C.base); c.rect(0, 4, 32, 2, C.plankHi); c.rect(1, 6, 30, 2, C.wallShade);
  } else if (course === 'bottom') {
    c.rect(0, 19, 32, 2, C.wallShade); c.rect(0, 21, 32, 2, C.cream);
    c.rect(0, 23, 32, 8, C.base); c.rect(1, 24, 30, 1, C.plankLight); c.rect(0, 31, 32, 1, C.outline);
  } else {
    c.rect(0, 20, 32, 2, C.wallShade); c.rect(0, 22, 32, 2, C.cream);
    c.rect(0, 24, 32, 7, C.base); c.rect(1, 25, 30, 1, C.plankLight); c.rect(0, 31, 32, 1, C.outline);
  }
  c.rect(4, 5 + (variant % 3) * 2, 5, 1, C.wallShade); c.rect(21, 11, 4, 1, C.wallShade);
  return c;
}

function wallCorner(side) {
  const c = wallPanel(side.includes('right') ? 1 : 0);
  if (side.includes('left')) { c.rect(0, 0, 4, 24, C.base); c.rect(4, 1, 2, 22, C.wallShade); c.rect(4, 23, 3, 8, C.plankDark); }
  else { c.rect(28, 0, 4, 24, C.base); c.rect(26, 1, 2, 22, C.wallShade); c.rect(25, 23, 3, 8, C.plankDark); }
  return c;
}

function windowFrame() {
  const c = makeCanvas(64, 64);
  c.rect(4, 7, 56, 48, C.outline); c.rect(6, 9, 52, 43, C.plankDark);
  c.rect(9, 12, 46, 34, C.blue); c.rect(11, 14, 20, 14, C.blueLight); c.rect(34, 14, 18, 14, C.glass);
  c.rect(11, 31, 20, 12, C.glass); c.rect(34, 31, 18, 12, C.blueLight);
  c.rect(31, 12, 3, 34, C.plankLight); c.rect(9, 28, 46, 3, C.plankLight);
  c.rect(4, 5, 56, 4, C.plankLight); c.rect(2, 4, 60, 3, C.plankHi);
  c.rect(3, 52, 58, 4, C.plankDark); c.rect(0, 56, 64, 5, C.plankLight);
  c.rect(5, 61, 54, 2, C.shadeDeep); c.rect(7, 10, 50, 1, C.cream);
  return c;
}

function doorFrame() {
  const c = makeCanvas(32, 64);
  c.rect(2, 2, 28, 61, C.outline); c.rect(4, 4, 24, 59, C.plankDark);
  c.rect(6, 6, 20, 53, C.plank); c.rect(7, 7, 17, 49, C.plankLight);
  c.rect(9, 10, 14, 19, C.plankDark); c.rect(11, 12, 10, 15, C.plank);
  c.rect(9, 33, 14, 20, C.plankDark); c.rect(11, 35, 10, 16, C.plank);
  c.rect(18, 37, 2, 2, C.gold); c.rect(5, 59, 22, 4, C.shadeDeep);
  c.rect(4, 5, 2, 52, C.plankHi); c.rect(27, 5, 1, 53, C.outline);
  return c;
}

function threshold() {
  const c = makeCanvas(64, 32);
  c.ellipse(32, 23, 28, 6, C.shadeDeep); c.rect(4, 13, 56, 15, C.plankDark);
  c.rect(2, 11, 60, 4, C.plankHi); c.rect(5, 15, 54, 3, C.plankLight);
  c.rect(8, 19, 48, 2, C.plank); c.rect(4, 27, 56, 3, C.outline);
  c.rect(12, 15, 3, 2, C.cream); c.rect(46, 15, 3, 2, C.cream);
  return c;
}

function bed() {
  const c = makeCanvas(64, 64);
  c.ellipse(32, 57, 27, 5, C.shadeDeep);
  c.rect(5, 15, 54, 43, C.outline); c.rect(7, 17, 50, 38, C.plankDark);
  c.rect(9, 19, 46, 33, C.linen); c.rect(9, 20, 46, 8, C.white);
  c.rect(12, 22, 17, 7, C.cream); c.rect(13, 21, 15, 2, C.white);
  c.rect(8, 30, 48, 20, C.sage); c.rect(9, 31, 46, 3, C.sageLight);
  c.line(11, 48, 27, 34, C.green); c.line(15, 51, 32, 36, C.greenDark);
  c.rect(7, 10, 50, 8, C.plankLight); c.rect(8, 7, 48, 6, C.plankHi);
  c.rect(8, 53, 5, 9, C.plankDark); c.rect(51, 53, 5, 9, C.plankDark);
  c.rect(9, 61, 4, 2, C.outline); c.rect(51, 61, 4, 2, C.outline);
  c.rect(5, 14, 54, 2, C.plankHi); c.rect(56, 19, 2, 33, C.plank);
  return c;
}

function bedsideTable() {
  const c = makeCanvas(32, 64);
  c.ellipse(16, 56, 12, 4, C.shadeDeep); c.rect(4, 16, 24, 37, C.outline);
  c.rect(6, 18, 20, 32, C.plank); c.rect(5, 15, 22, 6, C.plankHi);
  c.rect(7, 23, 18, 11, C.plankLight); c.rect(7, 37, 18, 10, C.plankDark);
  c.rect(14, 28, 4, 2, C.gold); c.rect(14, 41, 4, 2, C.gold);
  c.rect(7, 50, 3, 8, C.plankDark); c.rect(22, 50, 3, 8, C.plankDark);
  c.rect(8, 58, 3, 2, C.outline); c.rect(21, 58, 3, 2, C.outline);
  c.rect(10, 12, 11, 4, C.green); c.rect(13, 8, 5, 5, C.greenDark); c.rect(14, 7, 2, 3, C.sageLight);
  return c;
}

function kitchenCounter() {
  const c = makeCanvas(96, 64);
  c.ellipse(48, 58, 43, 5, C.shadeDeep);
  c.rect(4, 20, 88, 38, C.outline); c.rect(7, 23, 82, 33, C.plankDark);
  c.rect(8, 27, 80, 26, C.plank); c.rect(8, 38, 80, 2, C.plankDark);
  for (const x of [11, 38, 66]) {
    c.rect(x, 29, 22, 8, C.plankLight); c.rect(x + 2, 31, 18, 4, C.plankHi);
    c.rect(x + 9, 32, 4, 2, C.gold); c.rect(x + 2, 42, 18, 9, C.plankDark);
  }
  c.rect(2, 17, 92, 7, C.outline); c.rect(3, 15, 90, 6, C.plankLight);
  c.rect(5, 13, 85, 3, C.plankHi); c.rect(8, 14, 76, 1, C.cream);
  c.rect(11, 55, 7, 7, C.plankDark); c.rect(78, 55, 7, 7, C.plankDark);
  c.rect(12, 61, 6, 2, C.outline); c.rect(78, 61, 6, 2, C.outline);
  c.rect(4, 22, 88, 2, C.cream);
  return c;
}

function stove() {
  const c = makeCanvas(32, 32);
  c.ellipse(16, 26, 14, 4, C.shadeDeep);
  c.rect(2, 6, 28, 21, C.outline); c.rect(4, 8, 24, 18, C.rust);
  c.rect(5, 10, 22, 12, C.ink); c.rect(6, 11, 20, 9, C.shadeDeep);
  for (const [x, y] of [[11, 14], [21, 14]]) {
    c.ellipse(x, y, 4, 3, C.outline); c.ellipse(x, y, 3, 2, C.rugDark);
    c.ellipse(x - 1, y - 1, 1, 1, C.shade);
  }
  c.rect(3, 4, 26, 4, C.plankHi); c.rect(4, 5, 23, 1, C.cream);
  c.rect(7, 22, 3, 2, C.gold); c.rect(22, 22, 3, 2, C.gold);
  return c;
}

function workbench() {
  const c = makeCanvas(64, 64);
  c.ellipse(32, 58, 28, 5, C.shadeDeep);
  c.rect(5, 25, 54, 10, C.outline); c.rect(7, 24, 50, 7, C.plankLight);
  c.rect(8, 25, 45, 2, C.plankHi); c.rect(10, 31, 44, 3, C.plankDark);
  c.rect(10, 34, 6, 21, C.plankDark); c.rect(48, 34, 6, 21, C.plankDark);
  c.rect(8, 52, 10, 4, C.plankDark); c.rect(46, 52, 10, 4, C.plankDark);
  c.rect(13, 16, 18, 8, C.ink); c.rect(15, 18, 14, 4, C.shade);
  c.rect(16, 14, 3, 2, C.gold); c.rect(22, 14, 3, 2, C.rustLight);
  c.rect(37, 19, 12, 5, C.rust); c.rect(39, 16, 8, 3, C.rustLight);
  c.rect(35, 22, 17, 3, C.outline); c.rect(8, 35, 48, 2, C.plankLight);
  c.rect(11, 55, 4, 6, C.outline); c.rect(49, 55, 4, 6, C.outline);
  return c;
}

function cabinet() {
  const c = makeCanvas(64, 64);
  c.ellipse(32, 58, 27, 5, C.shadeDeep);
  c.rect(7, 10, 50, 49, C.outline); c.rect(10, 13, 44, 42, C.plankDark);
  c.rect(12, 15, 19, 37, C.plank); c.rect(33, 15, 19, 37, C.plankLight);
  c.rect(14, 18, 15, 31, C.plankLight); c.rect(35, 18, 15, 31, C.plank);
  c.rect(29, 27, 3, 4, C.gold); c.rect(33, 27, 3, 4, C.gold);
  c.rect(8, 8, 48, 5, C.plankHi); c.rect(10, 55, 6, 6, C.plankDark); c.rect(48, 55, 6, 6, C.plankDark);
  c.rect(9, 61, 6, 2, C.outline); c.rect(49, 61, 6, 2, C.outline);
  c.rect(12, 16, 18, 2, C.cream); c.rect(34, 16, 18, 2, C.cream);
  return c;
}

function petBed() {
  const c = makeCanvas(64, 32);
  c.ellipse(32, 25, 27, 6, C.shadeDeep); c.ellipse(32, 20, 25, 9, C.outline);
  c.ellipse(32, 18, 23, 8, C.rust); c.ellipse(32, 17, 19, 6, C.rustLight);
  c.ellipse(32, 17, 12, 4, C.cream); c.rect(16, 15, 3, 2, C.gold);
  c.ellipse(11, 17, 5, 4, C.rust); c.ellipse(53, 17, 5, 4, C.rust);
  c.rect(13, 25, 38, 2, C.plankDark);
  return c;
}

function rug() {
  const c = makeCanvas(96, 64);
  c.ellipse(48, 33, 45, 26, C.outline); c.ellipse(48, 32, 42, 23, C.rugDark);
  c.ellipse(48, 31, 38, 20, C.rug); c.ellipse(48, 31, 31, 14, C.rugLight);
  c.ellipse(48, 31, 26, 10, C.rug);
  for (const x of [17, 30, 43, 56, 69, 78]) { c.rect(x, 16, 2, 2, C.gold); c.rect(x, 45, 2, 2, C.gold); }
  c.line(27, 31, 41, 22, C.rugLight); c.line(41, 22, 54, 31, C.rugLight); c.line(54, 31, 41, 40, C.rugLight); c.line(41, 40, 27, 31, C.rugLight);
  c.rect(2, 31, 3, 2, C.rugLight); c.rect(91, 31, 3, 2, C.rugLight);
  return c;
}

function shelf() {
  const c = makeCanvas(64, 32);
  c.rect(5, 6, 54, 7, C.outline); c.rect(7, 5, 50, 5, C.plankLight); c.rect(8, 6, 46, 2, C.plankHi);
  c.rect(10, 13, 4, 15, C.plankDark); c.rect(50, 13, 4, 15, C.plankDark);
  c.rect(12, 18, 12, 8, C.greenDark); c.rect(14, 15, 8, 6, C.green); c.rect(15, 13, 3, 4, C.sageLight);
  c.rect(29, 14, 12, 12, C.rust); c.rect(31, 11, 8, 4, C.rustLight); c.rect(30, 24, 11, 2, C.outline);
  c.rect(43, 16, 6, 9, C.blue); c.rect(44, 14, 4, 3, C.blueLight);
  c.rect(7, 10, 50, 2, C.plankDark);
  return c;
}

const frames = [];
const atlas = makeCanvas(ATLAS, ATLAS);
const occupied = Array.from({ length: 16 }, () => Array(16).fill(false));
function place(id, image, { kind = 'object', role = 'furniture', layer = 'object', tileable = false, footprintTiles = null, anchor = null, tags = [] } = {}) {
  const wCells = image.width / TILE;
  const hCells = image.height / TILE;
  if (!Number.isInteger(wCells) || !Number.isInteger(hCells)) throw new Error(`${id} dimensions must align to ${TILE}px`);
  let sxCell = -1, syCell = -1;
  search: for (let y = 0; y <= 16 - hCells; y++) for (let x = 0; x <= 16 - wCells; x++) {
    let free = true;
    for (let dy = 0; dy < hCells && free; dy++) for (let dx = 0; dx < wCells; dx++) if (occupied[y + dy][x + dx]) { free = false; break; }
    if (free) { sxCell = x; syCell = y; break search; }
  }
  if (sxCell < 0) throw new Error(`Atlas full while placing ${id}`);
  for (let dy = 0; dy < hCells; dy++) for (let dx = 0; dx < wCells; dx++) occupied[syCell + dy][sxCell + dx] = true;
  const x = sxCell * TILE, y = syCell * TILE;
  blit(atlas, image, x, y);
  const rect = { x, y, width: image.width, height: image.height };
  const foot = anchor ?? { x: Math.floor(image.width / 2), y: image.height - 1 };
  frames.push({ id, rect, nativeWidth: image.width, nativeHeight: image.height, kind, role, layer, tileable, footAnchor: foot, pivot: foot, footprintTiles, tags, approved: false });
}

for (let i = 0; i < 4; i++) place(`floor-${'abcd'[i]}`, floorTile(i), { kind: 'tile', role: 'ground-tile', layer: 'ground', tileable: true, footprintTiles: [1, 1], tags: ['floor', 'plank'] });
place('wall-middle', wallPanel(0), { kind: 'tile', role: 'wall-tile', layer: 'back-wall', footprintTiles: [1, 1], tags: ['wall', 'plank'] });
place('wall-left-corner', wallCorner('left'), { kind: 'tile', role: 'wall-tile', layer: 'back-wall', footprintTiles: [1, 1], tags: ['wall', 'corner'] });
place('wall-right-corner', wallCorner('right'), { kind: 'tile', role: 'wall-tile', layer: 'back-wall', footprintTiles: [1, 1], tags: ['wall', 'corner'] });
place('wall-top', wallPanel(1, 'top'), { kind: 'tile', role: 'wall-tile', layer: 'back-wall', footprintTiles: [1, 1], tags: ['wall', 'top-cap'] });
place('wall-bottom', wallPanel(0, 'bottom'), { kind: 'tile', role: 'wall-tile', layer: 'back-wall', footprintTiles: [1, 1], tags: ['wall', 'baseboard'] });
place('wall-window', windowFrame(), { kind: 'wall-prop', role: 'wall-overlay', layer: 'back-wall', footprintTiles: [2, 2], anchor: { x: 32, y: 62 }, tags: ['window', 'glass', 'warm-light'] });
place('door-leaf', doorFrame(), { kind: 'wall-prop', role: 'wall-overlay', layer: 'back-wall', footprintTiles: [1, 2], anchor: { x: 16, y: 62 }, tags: ['door', 'entry'] });
place('door-threshold', threshold(), { kind: 'threshold', role: 'ground-overlay', layer: 'ground-object', footprintTiles: [2, 1], anchor: { x: 32, y: 29 }, tags: ['doorway', 'walkable'] });
place('bed', bed(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [2, 2], anchor: { x: 32, y: 62 }, tags: ['bed', 'sleep'] });
place('bedside-table', bedsideTable(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [1, 2], anchor: { x: 16, y: 59 }, tags: ['table', 'plant'] });
place('kitchen-counter', kitchenCounter(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [3, 2], anchor: { x: 48, y: 62 }, tags: ['kitchen', 'counter'] });
place('stove', stove(), { kind: 'furniture-overlay', role: 'fixture-overlay', layer: 'object-detail', footprintTiles: [1, 1], anchor: { x: 16, y: 31 }, tags: ['stove', 'kitchen', 'counter-top'] });
place('workbench', workbench(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [2, 2], anchor: { x: 32, y: 60 }, tags: ['workbench', 'storage'] });
place('storage', cabinet(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [2, 2], anchor: { x: 32, y: 62 }, tags: ['storage', 'cabinet'] });
place('pet-bed', petBed(), { kind: 'furniture', role: 'furniture', layer: 'object', footprintTiles: [2, 1], anchor: { x: 32, y: 26 }, tags: ['pet-bed', 'cat'] });
place('rug', rug(), { kind: 'rug', role: 'ground-overlay', layer: 'ground-object', footprintTiles: [3, 2], anchor: { x: 48, y: 47 }, tags: ['rug', 'living-area'] });
place('wall-shelf', shelf(), { kind: 'wall-prop', role: 'wall-overlay', layer: 'back-wall', footprintTiles: [2, 1], anchor: { x: 32, y: 27 }, tags: ['shelf', 'plant', 'pot'] });

function crc32(buffer) {
  const table = crc32.table ??= Uint32Array.from({ length: 256 }, (_, n) => { let v = n; for (let i = 0; i < 8; i++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
  let crc = 0xffffffff;
  for (const b of buffer) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), data.length + 8);
  return out;
}
function pngBytes(c) {
  const stride = c.width * 4;
  const raw = Buffer.alloc((stride + 1) * c.height);
  for (let y = 0; y < c.height; y++) Buffer.from(c.rgba.buffer, c.rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(c.width, 0); ihdr.writeUInt32BE(c.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const idat = (awaitZlib(raw));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}
function awaitZlib(input) {
  // Fixed strategy and level make regeneration byte-identical on supported Node runtimes.
  return zlib.deflateSync(input, { level: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY });
}

function validate() {
  const ids = new Set();
  for (const f of frames) {
    if (ids.has(f.id)) throw new Error(`Duplicate frame id ${f.id}`); ids.add(f.id);
    const { x, y, width, height } = f.rect;
    if (![x, y, width, height, f.footAnchor.x, f.footAnchor.y].every(Number.isInteger)) throw new Error(`Noninteger frame metadata: ${f.id}`);
    if (x % TILE || y % TILE || width % TILE || height % TILE || x + width > ATLAS || y + height > ATLAS) throw new Error(`Misaligned or out-of-bounds frame: ${f.id}`);
    if (f.footAnchor.x < 0 || f.footAnchor.x >= width || f.footAnchor.y < 0 || f.footAnchor.y >= height) throw new Error(`Invalid foot anchor: ${f.id}`);
    if (!f.role || !Array.isArray(f.footprintTiles) || f.footprintTiles.some((value) => !Number.isInteger(value) || value < 1) || f.approved !== false) throw new Error(`Incomplete candidate frame metadata: ${f.id}`);
  }
  for (const f of frames.filter((frame) => frame.tileable)) {
    const { x, y } = f.rect;
    for (let i = 0; i < TILE; i++) {
      const top = ((y * ATLAS + x + i) * 4), bottom = (((y + TILE - 1) * ATLAS + x + i) * 4);
      const left = (((y + i) * ATLAS + x) * 4), right = (((y + i) * ATLAS + x + TILE - 1) * 4);
      for (let k = 0; k < 4; k++) {
        if (atlas.rgba[top + k] !== atlas.rgba[bottom + k] || atlas.rgba[left + k] !== atlas.rgba[right + k]) throw new Error(`Nonseamless tile: ${f.id}`);
      }
    }
  }
}

async function main() {
  validate();
  const atlasBytes = pngBytes(atlas);
  const sourceBytes = await import('node:fs/promises').then(({ readFile }) => readFile(fileURLToPath(import.meta.url)));
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    schemaVersion: 1,
    title: 'Dewhollow World v2 Pixel32 farmhouse interior candidate',
    status: 'candidate', approved: false,
    source: { method: 'hand-authored integer pixel primitives; deterministic PNG encoding', generator: 'generate.mjs', generatorSha256: sha(sourceBytes) },
    pixelContract: { nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index' },
    palette: C,
    atlas: { file: 'atlas.png', width: ATLAS, height: ATLAS, sha256: sha(atlasBytes) },
    layoutSuggestion: {
      map: 'house (legacy 10x7 MapDef; data unchanged)',
      centralWalkway: 'reserve x=4..5 from y=2..5; entrance approach x=4..5,y=5..6; rugs are ground-only and walkable',
      placements: [
        { frame: 'wall-top', anchorTile: { x: 0, y: 0 }, layer: 'back-wall' },
        { frame: 'wall-window', anchorTile: { x: 2, y: 0 }, layer: 'back-wall' },
        { frame: 'wall-shelf', anchorTile: { x: 8, y: 0 }, layer: 'back-wall' },
        { frame: 'bed', anchorTile: { x: 2, y: 3 }, layer: 'object' },
        { frame: 'bedside-table', anchorTile: { x: 0, y: 3 }, layer: 'object' },
        { frame: 'kitchen-counter', anchorTile: { x: 8, y: 3 }, layer: 'object' },
        { frame: 'stove', anchorTile: { x: 8, y: 2 }, layer: 'object-detail' },
        { frame: 'workbench', anchorTile: { x: 2, y: 5 }, layer: 'object' },
        { frame: 'storage', anchorTile: { x: 9, y: 5 }, layer: 'object' },
        { frame: 'pet-bed', anchorTile: { x: 7, y: 5 }, layer: 'object' },
        { frame: 'rug', anchorTile: { x: 5, y: 5 }, layer: 'ground-object' },
        { frame: 'door-leaf', anchorTile: { x: 4, y: 5 }, layer: 'back-wall' },
        { frame: 'door-threshold', anchorTile: { x: 4, y: 6 }, layer: 'ground-object' },
      ],
    },
    frames,
    limitations: [
      'Candidate art study only. It does not replace house MapDef, collision, interaction, save data, production assets, or content/assets.json.',
      'The suggested placements require MapScene review; the 10x7 legacy room limits furniture spacing and is not a final redesigned layout.',
      'All objects are code-authored pixel candidates; anchors and footprints are metadata hints and need rendered human review.',
      'Frames marked tileable use exact repeated border pixels; visual suitability, composition, and mobile readability are not machine-verified.',
    ],
  };
  await mkdir(resolve(OUT), { recursive: true });
  await writeFile(resolve(OUT, 'atlas.png'), atlasBytes);
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${frames.length} candidate frames; ${ATLAS}x${ATLAS} RGBA atlas; SHA-256 ${sha(atlasBytes)}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

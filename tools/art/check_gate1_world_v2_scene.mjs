#!/usr/bin/env node
/** Check candidate-only world-v2 farm/house atlases, digests, bounds, and required frames. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE = 'docs/art/candidates/pixel-movement/gate1-world-v2-scene';
const required = {
  farm: [
    'grass-base', 'grass-variant', 'path-center', 'path-edge', 'soil-dry', 'soil-wet',
    'house-exterior', 'house-front', 'tree-canopy', 'shipping-crate', 'stone-wall',
    'fence-horizontal', 'fence-vertical', 'fence-north-east', 'fence-north-west', 'fence-south-east', 'fence-south-west',
  ],
  house: [
    'floor-a', 'floor-b', 'wall-middle', 'wall-left-corner', 'wall-right-corner',
    'wall-top', 'wall-bottom', 'wall-window', 'door-threshold', 'rug', 'bed',
    'kitchen-counter', 'workbench', 'storage', 'pet-bed',
  ],
};

function fail(message) { throw new Error(`Gate 1 world-v2 scene candidate: ${message}`); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function checkAtlas(group) {
  const base = resolve(ROOT, CANDIDATE, group);
  const manifest = JSON.parse(await readFile(resolve(base, 'manifest.json'), 'utf8'));
  if (manifest.status !== 'candidate' || manifest.approved !== false) fail(`${group} must remain unapproved candidate art`);
  if (manifest.pixelContract?.nativeTileSize !== 32 || manifest.pixelContract?.displayScale !== 2
    || manifest.pixelContract?.sampling !== 'nearest-neighbor') fail(`${group} violates the Pixel32/2x nearest contract`);
  const generator = await readFile(resolve(base, manifest.source?.generator ?? 'generate.mjs'));
  if (sha256(generator) !== manifest.source?.generatorSha256) fail(`${group} generator digest does not match manifest`);
  const atlas = await readFile(resolve(base, manifest.atlas?.file ?? 'atlas.png'));
  if (sha256(atlas) !== manifest.atlas?.sha256) fail(`${group} atlas digest does not match manifest`);
  if (atlas.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || atlas.readUInt32BE(16) !== manifest.atlas.width
    || atlas.readUInt32BE(20) !== manifest.atlas.height) fail(`${group} PNG signature or dimensions do not match manifest`);

  const sourceFrames = manifest.frames;
  const frames = Array.isArray(sourceFrames)
    ? sourceFrames.map((frame) => [frame.id, { ...frame.rect, approved: frame.approved }])
    : Object.entries(sourceFrames ?? {});
  if (!frames.length) fail(`${group} has no frames`);
  const byId = new Map();
  for (const [id, frame] of frames) {
    if (typeof id !== 'string' || byId.has(id)) fail(`${group} frame IDs must be unique strings`);
    if (!frame || frame.approved !== false) fail(`${group}/${id} is not explicitly unapproved`);
    for (const key of ['x', 'y', 'width', 'height']) if (!Number.isInteger(frame[key])) fail(`${group}/${id} has non-integer ${key}`);
    if (frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0
      || frame.x + frame.width > manifest.atlas.width || frame.y + frame.height > manifest.atlas.height) fail(`${group}/${id} exceeds atlas bounds`);
    byId.set(id, frame);
  }
  for (const id of required[group]) if (!byId.has(id)) fail(`${group} is missing required frame ${id}`);
  if (group === 'house') {
    const map = JSON.parse(await readFile(resolve(ROOT, 'content/maps/house.json'), 'utf8'));
    const placements = manifest.layoutSuggestion?.placements;
    if (!Array.isArray(placements) || !placements.length) fail('house has no visual placement suggestions');
    for (const placement of placements) {
      const anchor = placement?.anchorTile;
      if (!byId.has(placement?.frame)) fail(`house layout references missing frame ${placement?.frame}`);
      if (!Number.isInteger(anchor?.x) || !Number.isInteger(anchor?.y)
        || anchor.x < 0 || anchor.y < 0 || anchor.x >= map.width || anchor.y >= map.height) {
        fail(`house layout anchor for ${placement?.frame} is outside the legacy house MapDef`);
      }
    }
  }
  console.log(`${group}: ${byId.size} unapproved frames; ${manifest.atlas.width}x${manifest.atlas.height}; SHA-256 ${manifest.atlas.sha256}`);
}

async function checkEvidence() {
  const base = resolve(ROOT, CANDIDATE);
  const evidence = JSON.parse(await readFile(resolve(base, 'evidence.json'), 'utf8'));
  if (evidence.status !== 'candidate' || evidence.approved !== false) fail('evidence must remain unapproved candidate evidence');
  if (evidence.capture?.testResult !== 'passed' || !evidence.capture?.capturedAt || !evidence.capture?.sourceRevision) fail('capture provenance is incomplete');
  for (const group of ['farm', 'house']) {
    const manifestBytes = await readFile(resolve(base, group, 'manifest.json'));
    const atlasEvidence = evidence.atlases?.[group];
    if (atlasEvidence?.approved !== false
      || sha256(manifestBytes) !== atlasEvidence.manifestSha256
      || atlasEvidence.sha256 !== JSON.parse(manifestBytes.toString('utf8')).atlas.sha256) fail(`${group} evidence digests are stale`);
  }
  const screenshots = evidence.screenshots;
  const requiredScreenshots = ['farm-desktop.png', 'farm-mobile.png', 'house-desktop.png', 'house-mobile.png'];
  if (!screenshots || requiredScreenshots.some((name) => !screenshots[name])) fail('evidence is missing one of the four rendered scenes');
  for (const name of requiredScreenshots) {
    const capture = screenshots[name];
    const bytes = await readFile(resolve(base, capture.path));
    if (sha256(bytes) !== capture.sha256
      || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.readUInt32BE(16) !== capture.artifactSize?.width
      || bytes.readUInt32BE(20) !== capture.artifactSize?.height) fail(`${name} evidence hash or dimensions are stale`);
    const viewport = capture.browserViewport;
    if (!Number.isInteger(viewport?.width) || viewport.width <= 0
      || !Number.isInteger(viewport?.height) || viewport.height <= 0) fail(`${name} browser viewport provenance is invalid`);
  }
  console.log(`evidence: ${requiredScreenshots.length} screenshots hash-bound; visual review remains pending`);
}

await checkAtlas('farm');
await checkAtlas('house');
await checkEvidence();

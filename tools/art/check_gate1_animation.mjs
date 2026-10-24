#!/usr/bin/env node
/** Read-only integrity and reproducibility check for candidate-only animation assets. */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation');
const GENERATOR = resolve(dirname(fileURLToPath(import.meta.url)), 'generate_gate1_animation.mjs');
const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_SHEET_BYTES = 1024 * 1024;
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'contact-a', 'passing', 'contact-b'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function boundedFile(path, label, maxBytes) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`${label} must be a regular file`);
  if (info.size > maxBytes) throw new Error(`${label} exceeds the ${maxBytes}-byte file limit`);
  return readFile(path);
}

function exactKeys(object, keys) {
  return Object.keys(object ?? {}).sort().join(',') === [...keys].sort().join(',');
}

function validateShape(manifest, generatorHash, sheetBytes) {
  if (!exactKeys(manifest, ['schemaVersion', 'title', 'status', 'approved', 'source', 'pixelContract', 'atlas', 'directions', 'frames', 'clips', 'toolFeedback', 'limitations'])) {
    throw new Error('manifest has missing or unexpected fields');
  }
  if (manifest.schemaVersion !== 1 || manifest.status !== 'candidate' || manifest.approved !== false) {
    throw new Error('manifest must stay schemaVersion=1, status=candidate, approved=false');
  }
  if (!exactKeys(manifest.source, ['method', 'generator', 'generatorSha256']) || manifest.source.generator !== 'tools/art/generate_gate1_animation.mjs' || manifest.source.generatorSha256 !== generatorHash) {
    throw new Error('manifest generator source or digest does not match');
  }
  if (!exactKeys(manifest.pixelContract, ['frameWidth', 'frameHeight', 'columns', 'rows', 'sampling', 'origin', 'rectConvention'])
    || manifest.pixelContract.frameWidth !== 32 || manifest.pixelContract.frameHeight !== 48
    || manifest.pixelContract.columns !== 4 || manifest.pixelContract.rows !== 4
    || manifest.pixelContract.sampling !== 'nearest-neighbor' || manifest.pixelContract.origin !== 'top-left'
    || manifest.pixelContract.rectConvention !== 'half-open') {
    throw new Error('pixelContract must describe a 4x4 nearest-neighbor 32x48 sheet');
  }
  if (manifest.atlas?.file !== 'player-4dir.png' || manifest.atlas.width !== 128 || manifest.atlas.height !== 192 || manifest.atlas.sha256 !== sha256(sheetBytes)) {
    throw new Error('atlas filename, dimensions, or sha256 does not match');
  }
  if (JSON.stringify(manifest.directions) !== JSON.stringify(DIRECTIONS)) throw new Error('directions must be down, up, left, right');
  const expectedFrames = DIRECTIONS.flatMap((direction, row) => POSES.map((pose, column) => ({
    key: `${direction}-${pose}`, x: column * 32, y: row * 48, direction, pose,
  })));
  if (Object.keys(manifest.frames ?? {}).sort().join(',') !== expectedFrames.map((frame) => frame.key).sort().join(',')) {
    throw new Error('all 16 direction/pose frames are required');
  }
  for (const expected of expectedFrames) {
    const frame = manifest.frames[expected.key];
    if (!exactKeys(frame, ['x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'footAnchor', 'pivot', 'direction', 'pose', 'sha256'])) {
      throw new Error(`${expected.key} has missing or unexpected fields`);
    }
    if (frame.x !== expected.x || frame.y !== expected.y || frame.width !== 32 || frame.height !== 48
      || frame.nativeWidth !== 32 || frame.nativeHeight !== 48 || frame.direction !== expected.direction || frame.pose !== expected.pose) {
      throw new Error(`${expected.key} has an invalid rectangle or identity`);
    }
    if (!exactKeys(frame.footAnchor, ['x', 'y']) || frame.footAnchor.x !== 16 || frame.footAnchor.y !== 47
      || JSON.stringify(frame.pivot) !== JSON.stringify(frame.footAnchor)) {
      throw new Error(`${expected.key} footAnchor and pivot must both equal (16,47)`);
    }
    if (!/^[a-f0-9]{64}$/.test(frame.sha256)) throw new Error(`${expected.key} has an invalid frame digest`);
  }
  if (!exactKeys(manifest.clips, ['idle', 'walk'])
    || manifest.clips.idle.loop !== true || manifest.clips.idle.frames.length !== 4
    || manifest.clips.walk.loop !== true || manifest.clips.walk.frameDurationMs !== 55 || manifest.clips.walk.frames.length !== 16) {
    throw new Error('idle and four-direction walk clips must be complete and loop at 55ms per frame');
  }
  const validKeys = new Set(Object.keys(manifest.frames));
  if ([...manifest.clips.idle.frames, ...manifest.clips.walk.frames].some((key) => !validKeys.has(key))) throw new Error('clip refers to an unknown frame');
  if (!exactKeys(manifest.toolFeedback, ['frameSource', 'impactAt', 'reducedMotionScale', 'status'])
    || manifest.toolFeedback.frameSource !== '../16bit.png#tool'
    || manifest.toolFeedback.impactAt !== 0.55 || manifest.toolFeedback.reducedMotionScale !== 0.4
    || manifest.toolFeedback.status !== 'candidate-preview-only') {
    throw new Error('tool feedback must remain an isolated candidate preview');
  }
}

export async function validateCandidateAnimation(directory = ROOT) {
  const errors = [];
  let manifest;
  let manifestBytes;
  let sheetBytes;
  let generatorBytes;
  try {
    manifestBytes = await boundedFile(resolve(directory, 'manifest.json'), 'manifest.json', MAX_MANIFEST_BYTES);
    manifest = JSON.parse(manifestBytes.toString('utf8'));
    sheetBytes = await boundedFile(resolve(directory, 'player-4dir.png'), 'player-4dir.png', MAX_SHEET_BYTES);
    generatorBytes = await boundedFile(GENERATOR, 'generate_gate1_animation.mjs', 128 * 1024);
    validateShape(manifest, sha256(generatorBytes), sheetBytes);
  } catch (error) {
    return [`${error instanceof Error ? error.message : String(error)}`];
  }

  const temp = await mkdtemp(resolve(tmpdir(), 'dewhollow-animation-check-'));
  try {
    const generated = spawnSync(process.execPath, [GENERATOR, '--out-dir', temp], {
      cwd: temp, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true,
    });
    if (generated.error || generated.status !== 0) {
      errors.push(`candidate generator could not reproduce outputs: ${generated.error?.message ?? generated.stderr?.trim() ?? `exit ${generated.status}`}`);
    } else {
      const generatedManifest = JSON.parse((await boundedFile(resolve(temp, 'manifest.json'), 'generated manifest.json', MAX_MANIFEST_BYTES)).toString('utf8'));
      const generatedSheet = await boundedFile(resolve(temp, 'player-4dir.png'), 'generated player-4dir.png', MAX_SHEET_BYTES);
      if (JSON.stringify(generatedManifest) !== JSON.stringify(manifest)) errors.push('manifest.json does not reproduce from the bound generator');
      if (!generatedSheet.equals(sheetBytes)) errors.push('player-4dir.png does not reproduce from the bound generator');
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  return errors;
}

try {
  const errors = await validateCandidateAnimation();
  if (errors.length) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('PASS: candidate-only four-direction 32x48 animation sheet, clips, anchors and generator output validated.');
  }
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

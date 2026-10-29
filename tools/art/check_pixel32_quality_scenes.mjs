import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps';
const mapIds = [
  'farm', 'village', 'plaza', 'forest', 'lake', 'house', 'house-wing', 'house-full',
  'mine-entrance', 'coop', 'pasture', 'cowbarn',
];
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

for (const mapId of mapIds) {
  const folder = join(root, mapId);
  const metadata = JSON.parse(readFileSync(join(folder, 'candidate.json'), 'utf8'));
  const imageFile = metadata.source?.file ?? metadata.image ?? metadata.file ?? metadata.scene ?? 'scene.png';
  const expectedHash = metadata.source?.sha256 ?? metadata.sha256;
  const expectedDimensions = metadata.dimensions ?? metadata.dimensions_px;
  if (metadata.status !== 'candidate' || metadata.approved !== false) {
    throw new Error(`${mapId}: exact scene must remain an unapproved candidate`);
  }
  if (typeof imageFile !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(imageFile)) {
    throw new Error(`${mapId}: unsafe or missing PNG filename`);
  }
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new Error(`${mapId}: invalid SHA-256 metadata`);
  }
  const bytes = readFileSync(join(folder, imageFile));
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${mapId}: candidate file is not a valid PNG`);
  }
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash.toLowerCase()) throw new Error(`${mapId}: PNG SHA-256 mismatch`);
  const actualWidth = bytes.readUInt32BE(16);
  const actualHeight = bytes.readUInt32BE(20);
  if (!expectedDimensions || actualWidth !== expectedDimensions.width || actualHeight !== expectedDimensions.height) {
    throw new Error(`${mapId}: declared image dimensions do not match PNG IHDR (${actualWidth}x${actualHeight})`);
  }
}

console.log(`PASS: ${mapIds.length} unapproved Pixel32 map candidate PNGs match their exact SHA-256 and IHDR dimensions.`);

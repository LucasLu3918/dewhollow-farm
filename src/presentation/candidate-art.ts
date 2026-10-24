import type { RenderProfileId } from './pixel-viewport/profiles';

export const CANDIDATE_ATLAS_TEXTURE = 'gate1-candidate-atlas';
export const CANDIDATE_MANIFEST_CACHE_KEY = 'gate1-candidate-manifest';

export type CandidateId = '8bit' | '16bit';
export type CandidateCropStage = 'seed' | 'sprout' | 'mature';

export interface CandidateArtFrame {
  atlas: typeof CANDIDATE_ATLAS_TEXTURE;
  frame: string;
  scale: number;
  candidate: CandidateId;
}

const CANDIDATE_FRAME_BY_ASSET: Readonly<Record<string, string>> = {
  'tile.grass': 'grass',
  'tile.field': 'tilled',
  'tile.path': 'road',
  'tile.tree': 'tree',
  'tile.wall': 'houseEdge',
  'tile.fence': 'fence',
};

const CROP_FRAME_BY_STAGE: Readonly<Record<CandidateCropStage, string>> = {
  seed: 'cropSeed',
  sprout: 'cropSprout',
  mature: 'cropMature',
};

export function candidateForProfile(profile: RenderProfileId): CandidateId | null {
  if (profile === 'pixel16') return '8bit';
  if (profile === 'pixel32') return '16bit';
  return null;
}

/** Resolve only manifest-backed candidate coverage; null keeps the formal asset path. */
export function resolveCandidateArt(
  profile: RenderProfileId,
  assetId: string,
  cropStage: CandidateCropStage = 'mature',
): CandidateArtFrame | null {
  const candidate = candidateForProfile(profile);
  if (!candidate) return null;

  const frame = assetId.startsWith('crop.')
    ? CROP_FRAME_BY_STAGE[cropStage]
    : CANDIDATE_FRAME_BY_ASSET[assetId];
  if (!frame) return null;

  return {
    atlas: CANDIDATE_ATLAS_TEXTURE,
    frame,
    scale: candidate === '8bit' ? 4 : 2,
    candidate,
  };
}

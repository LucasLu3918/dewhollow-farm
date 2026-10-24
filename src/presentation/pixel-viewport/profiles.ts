export type RenderProfileId = 'legacy' | 'pixel32' | 'pixel16';

export interface RenderProfile {
  id: RenderProfileId;
  /** Rendered pixels per world tile. World tile coordinates remain unchanged. */
  tilePixels: number;
  /** The existing production profile remains the default until a visual gate approves a candidate. */
  default: boolean;
  /** Candidate profiles are intended for isolated QA and A/B evaluation. */
  qaOnly: boolean;
}

export const RENDER_PROFILES: Readonly<Record<RenderProfileId, RenderProfile>> = {
  legacy: { id: 'legacy', tilePixels: 64, default: true, qaOnly: false },
  pixel32: { id: 'pixel32', tilePixels: 32, default: false, qaOnly: true },
  pixel16: { id: 'pixel16', tilePixels: 16, default: false, qaOnly: true },
};

/** Resolve an experiment profile without changing production defaults for unknown input. */
export function renderProfileFor(id: string | null | undefined, allowQaProfiles = false): RenderProfile {
  return allowQaProfiles && (id === 'pixel32' || id === 'pixel16')
    ? RENDER_PROFILES[id]
    : RENDER_PROFILES.legacy;
}

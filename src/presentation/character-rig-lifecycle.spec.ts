import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Geom: { Rectangle: { Union: vi.fn() } } } }));
import { CharacterRig } from './character-rig';
import { REST_POSE } from './walk-pose';

function rigWithLifecycleState(state: Record<string, unknown> = {}): CharacterRig {
  const rig = Object.create(CharacterRig.prototype) as CharacterRig;
  const image = { setVisible: vi.fn() };
  const upper = { setPosition: vi.fn(), setScale: vi.fn() };
  const body = { setPosition: vi.fn(), setRotation: vi.fn(), setScale: vi.fn() };
  Object.assign(rig as unknown as Record<string, unknown>, {
    scene: { tweens: { killTweensOf: vi.fn() } },
    rig: { kind: 'single', textureSize: { width: 16, height: 16 } },
    root: { destroy: vi.fn() },
    body,
    pieces: { upper },
    params: {},
    view: 'down',
    textureKey: 'fixture',
    baseScale: 1,
    pose: REST_POSE,
    step: 0,
    stillMs: 0,
    toolImages: new Map(),
    toolState: null,
    ...state,
  });
  return rig;
}

describe('CharacterRig shutdown lifecycle', () => {
  it('applies an undispatched active impact and settles its completion before destroying the root', async () => {
    const impact = vi.fn();
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const stopTween = vi.fn();
    const character = rigWithLifecycleState({
      action: {
        tween: { stop: stopTween },
        image: { setVisible: vi.fn() },
        fired: false,
        onImpact: impact,
        onComplete: resolveCompletion,
      },
    });

    character.destroy();
    await expect(completion).resolves.toBeUndefined();
    expect(impact).toHaveBeenCalledOnce();
    expect(stopTween).toHaveBeenCalledOnce();
    expect((character.root as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalledWith(true);
  });

  it('applies and settles an already queued action while stopping its walk tween', async () => {
    const impact = vi.fn();
    const complete = vi.fn();
    const stopWalk = vi.fn();
    const character = rigWithLifecycleState({
      walk: { stop: stopWalk },
      queued: { onImpact: impact, onComplete: complete },
    });

    character.destroy();

    expect(impact).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(stopWalk).toHaveBeenCalledOnce();
    expect((character.root as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalledWith(true);
  });

  it('does not repeat an impact already dispatched before shutdown', () => {
    const impact = vi.fn();
    const character = rigWithLifecycleState({
      action: {
        tween: { stop: vi.fn() },
        image: { setVisible: vi.fn() },
        fired: true,
        onImpact: impact,
        onComplete: vi.fn(),
      },
    });

    character.destroy();

    expect(impact).not.toHaveBeenCalled();
  });

  it('settles an active swing on scene shutdown without invoking presentation impact', async () => {
    const impact = vi.fn(() => { throw new Error('display list is already closed'); });
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const stopTween = vi.fn();
    const character = rigWithLifecycleState({
      action: {
        tween: { stop: stopTween },
        image: { setVisible: vi.fn() },
        fired: false,
        onImpact: impact,
        onComplete: resolveCompletion,
      },
    });

    character.shutdown();

    await expect(completion).resolves.toBeUndefined();
    expect(impact).not.toHaveBeenCalled();
    expect(stopTween).toHaveBeenCalledOnce();
  });

  it('settles a queued swing on scene shutdown without applying its impact', async () => {
    const impact = vi.fn(() => { throw new Error('display list is already closed'); });
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const stopWalk = vi.fn();
    const character = rigWithLifecycleState({
      walk: { stop: stopWalk },
      queued: { onImpact: impact, onComplete: resolveCompletion },
    });

    character.shutdown();

    await expect(completion).resolves.toBeUndefined();
    expect(impact).not.toHaveBeenCalled();
    expect(stopWalk).toHaveBeenCalledOnce();
  });

  it('settles the active completion even if queued cleanup throws', async () => {
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const character = rigWithLifecycleState({
      action: {
        tween: { stop: vi.fn() },
        image: { setVisible: vi.fn() },
        fired: false,
        onImpact: vi.fn(),
        onComplete: resolveCompletion,
      },
      queued: { onImpact: vi.fn(), onComplete: () => { throw new Error('cleanup failed'); } },
    });

    expect(() => character.shutdown()).toThrow('cleanup failed');
    await expect(completion).resolves.toBeUndefined();
  });
});

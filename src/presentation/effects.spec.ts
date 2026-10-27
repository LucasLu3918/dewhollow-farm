import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { playActionEffect } from './effects';

interface FakeParticle {
  destroyed: boolean;
  destroyCount: number;
  setDepth(): FakeParticle;
  setScale(): FakeParticle;
  destroy(): void;
}

interface FakeTweenConfig {
  targets: FakeParticle;
  onComplete?: () => void;
  onStop?: () => void;
}

function fakeScene() {
  const particles: FakeParticle[] = [];
  const completions: (() => void)[] = [];
  const stops: (() => void)[] = [];
  const tweenConfigs: FakeTweenConfig[] = [];
  const create = (): FakeParticle => {
    const particle: FakeParticle = {
      destroyed: false,
      destroyCount: 0,
      setDepth: () => particle,
      setScale: () => particle,
      destroy: () => {
        particle.destroyed = true;
        particle.destroyCount += 1;
      },
    };
    particles.push(particle);
    return particle;
  };
  const stopMatching = (targets: FakeParticle | FakeParticle[]) => {
    const selected = Array.isArray(targets) ? targets : [targets];
    tweenConfigs.filter((config) => selected.includes(config.targets)).forEach((config) => config.onStop?.());
  };
  const scene = {
    add: {
      circle: vi.fn(create),
      ellipse: vi.fn(create),
      star: vi.fn(create),
      text: vi.fn(create),
    },
    tweens: {
      add: vi.fn((config: FakeTweenConfig) => {
        tweenConfigs.push(config);
        if (config.onComplete) completions.push(config.onComplete);
        if (config.onStop) stops.push(config.onStop);
      }),
      killTweensOf: vi.fn(stopMatching),
      killAll: vi.fn(() => tweenConfigs.forEach((config) => config.onStop?.())),
    },
  } as unknown as Phaser.Scene;
  return { scene, particles, completions, stops };
}

describe('action particle feedback', () => {
  it('uses a distinct six-shape ripple for a fishing action', () => {
    const { scene, particles, completions } = fakeScene();

    playActionEffect(scene, 'fish', 4, 5);

    expect(scene.add.ellipse).toHaveBeenCalledTimes(2);
    expect(scene.add.circle).toHaveBeenCalledTimes(4);
    expect(particles).toHaveLength(6);
    expect(completions).toHaveLength(6);
  });

  it('caps transient action particles per scene and releases slots after completion', () => {
    const { scene, particles, completions } = fakeScene();

    for (let i = 0; i < 20; i += 1) playActionEffect(scene, 'fish', 4, 5);
    expect(particles).toHaveLength(64);
    expect(particles.filter((particle) => !particle.destroyed)).toHaveLength(64);

    completions.forEach((complete) => complete());
    playActionEffect(scene, 'fish', 4, 5);
    expect(particles).toHaveLength(70);
    expect(particles.filter((particle) => !particle.destroyed)).toHaveLength(6);
  });

  it('destroys and releases particles when tweens are stopped or killed', () => {
    const { scene, particles, completions, stops } = fakeScene();
    playActionEffect(scene, 'fish', 4, 5);
    playActionEffect(scene, 'fish', 4, 5);

    scene.tweens.killTweensOf(particles.slice(0, 2));
    expect(particles.slice(0, 2).every((particle) => particle.destroyed)).toBe(true);
    expect(stops).toHaveLength(12);
    playActionEffect(scene, 'fish', 4, 5);
    expect(particles).toHaveLength(18);

    scene.tweens.killAll();
    completions.forEach((complete) => complete());
    expect(particles.every((particle) => particle.destroyCount === 1)).toBe(true);

    playActionEffect(scene, 'fish', 4, 5);
    expect(particles).toHaveLength(24);
    expect(particles.filter((particle) => !particle.destroyed)).toHaveLength(6);
  });

  it('keeps the particle budget independent between scenes', () => {
    const first = fakeScene();
    const second = fakeScene();

    for (let i = 0; i < 20; i += 1) playActionEffect(first.scene, 'fish', 4, 5);
    playActionEffect(second.scene, 'fish', 4, 5);

    expect(first.particles).toHaveLength(64);
    expect(second.particles).toHaveLength(6);
  });

  it('creates no transient particles when the particle setting is off', () => {
    const { scene, particles } = fakeScene();

    playActionEffect(scene, 'fish', 4, 5, false);

    expect(particles).toHaveLength(0);
    expect(scene.tweens.add).not.toHaveBeenCalled();
  });
});

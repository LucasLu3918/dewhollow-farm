import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { playActionEffect } from './effects';

interface FakeParticle {
  destroyed: boolean;
  setDepth(): FakeParticle;
  setScale(): FakeParticle;
  destroy(): void;
}

function fakeScene() {
  const particles: FakeParticle[] = [];
  const completions: (() => void)[] = [];
  const create = (): FakeParticle => {
    const particle: FakeParticle = {
      destroyed: false,
      setDepth: () => particle,
      setScale: () => particle,
      destroy: () => { particle.destroyed = true; },
    };
    particles.push(particle);
    return particle;
  };
  const scene = {
    add: {
      circle: vi.fn(create),
      ellipse: vi.fn(create),
      star: vi.fn(create),
      text: vi.fn(create),
    },
    tweens: {
      add: vi.fn((config: { onComplete?: () => void }) => {
        if (config.onComplete) completions.push(config.onComplete);
      }),
    },
  } as unknown as Phaser.Scene;
  return { scene, particles, completions };
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

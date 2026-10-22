import { describe, expect, it, vi } from 'vitest';
import { ContinuousFarmActions, farmActionTarget, type FarmActionOutcome, type FarmActionTarget } from './continuous-farm-actions';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ContinuousFarmActions', () => {
  it('only permits till, water, and plant interaction labels with a real plot key', () => {
    expect(farmActionTarget('till', '4,5')).toEqual({ key: '4,5', action: 'till' });
    expect(farmActionTarget('water', '4,5')).toEqual({ key: '4,5', action: 'water' });
    expect(farmActionTarget('plant', '4,5')).toEqual({ key: '4,5', action: 'plant' });
    for (const label of ['harvest', 'fertilize', 'alreadyTilled', 'nothing', 'talk']) {
      expect(farmActionTarget(label, '4,5')).toBeNull();
    }
    expect(farmActionTarget('till', undefined)).toBeNull();
  });

  it('dispatches one original action at a time, waits for animation completion, and deduplicates a successful tile/action', async () => {
    const target: FarmActionTarget = { key: '4,5', action: 'water' };
    const completion = deferred<FarmActionOutcome>();
    const execute = vi.fn(() => completion.promise);
    const runner = new ContinuousFarmActions({
      enabled: () => true,
      context: () => 'can:turnip',
      candidate: () => target,
      execute,
    });

    runner.start();
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.isRunning).toBe(true);

    completion.resolve({ success: true, key: target.key, action: target.action });
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.isRunning).toBe(false);
  });

  it('does not dispatch a different adjacent target until the prior action animation resolves', async () => {
    let target: FarmActionTarget = { key: '4,5', action: 'water' };
    const first = deferred<FarmActionOutcome>();
    const second = deferred<FarmActionOutcome>();
    const execute = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const runner = new ContinuousFarmActions({
      enabled: () => true,
      context: () => 'can:turnip',
      candidate: () => target,
      execute,
    });

    runner.start();
    await flush();
    target = { key: '4,6', action: 'water' };
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);

    first.resolve({ success: true, key: '4,5', action: 'water' });
    await flush();
    expect(execute).toHaveBeenCalledTimes(2);
    runner.stop();
    second.resolve({ success: true, key: '4,6', action: 'water' });
    await flush();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('stops after a refused or mismatched result and never queues another command', async () => {
    const execute = vi.fn().mockResolvedValue({ success: false, key: '4,5', action: 'till' });
    const runner = new ContinuousFarmActions({
      enabled: () => true,
      context: () => 'hoe:none',
      candidate: () => ({ key: '4,5', action: 'till' }),
      execute,
    });

    runner.start();
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.isRunning).toBe(false);
  });

  it('cancellation while an action is in flight prevents every not-yet-dispatched action', async () => {
    const completion = deferred<FarmActionOutcome>();
    const execute = vi.fn(() => completion.promise);
    const runner = new ContinuousFarmActions({
      enabled: () => true,
      context: () => 'seedbag:turnip',
      candidate: () => ({ key: '4,5', action: 'plant' }),
      execute,
    });

    runner.start();
    await flush();
    runner.stop();
    completion.resolve({ success: true, key: '4,5', action: 'plant' });
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.isRunning).toBe(false);
  });

  it('stops before another dispatch when the tool or selected seed context changes', async () => {
    let currentContext = 'seedbag:turnip';
    const completion = deferred<FarmActionOutcome>();
    const execute = vi.fn(() => completion.promise);
    const runner = new ContinuousFarmActions({
      enabled: () => true,
      context: () => currentContext,
      candidate: () => ({ key: '4,5', action: 'plant' }),
      execute,
    });

    runner.start();
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    currentContext = 'seedbag:moon-bean';
    completion.resolve({ success: true, key: '4,5', action: 'plant' });
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.isRunning).toBe(false);
  });

  it('does not start when disabled or there is no currently valid adjacent farm action', async () => {
    const execute = vi.fn();
    const runner = new ContinuousFarmActions({
      enabled: () => false,
      context: () => 'hoe:none',
      candidate: () => null,
      execute,
    });

    runner.start();
    await flush();
    expect(execute).not.toHaveBeenCalled();
    expect(runner.isRunning).toBe(false);
  });
});

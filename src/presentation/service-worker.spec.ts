import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, type ServiceWorkerHost } from './service-worker';

type Listener = () => void;

/** 假的 service worker 註冊環境：可控制是否有等待中的新版本、是否有控制者，並可手動觸發事件。 */
function fakeEnvironment(options: { controlled: boolean; waiting: boolean }) {
  const registrationListeners = new Map<string, Listener[]>();
  const containerListeners = new Map<string, Listener[]>();
  const postMessage = vi.fn();
  const waitingWorker = { state: 'installed', postMessage };
  const registration = {
    waiting: options.waiting ? waitingWorker : null,
    installing: null as { state: string; addEventListener: (type: string, fn: Listener) => void } | null,
    addEventListener: (type: string, fn: Listener) => {
      registrationListeners.set(type, [...(registrationListeners.get(type) ?? []), fn]);
    },
  };
  const container = {
    controller: options.controlled ? {} : null,
    register: vi.fn(async () => registration),
    addEventListener: (type: string, fn: Listener) => {
      containerListeners.set(type, [...(containerListeners.get(type) ?? []), fn]);
    },
  };
  const flush = vi.fn(async () => undefined);
  const reload = vi.fn();
  const host: ServiceWorkerHost = {
    container: container as unknown as ServiceWorkerContainer,
    flush,
    reload,
  };
  const fire = (map: Map<string, Listener[]>, type: string) => {
    for (const fn of map.get(type) ?? []) fn();
  };
  return {
    host,
    container,
    registration,
    postMessage,
    flush,
    reload,
    fireContainer: (type: string) => fire(containerListeners, type),
    fireRegistration: (type: string) => fire(registrationListeners, type),
  };
}

describe('registerServiceWorker', () => {
  it('以指定的網址與範圍註冊，並關閉 HTTP 快取對 sw.js 的影響', async () => {
    const env = fakeEnvironment({ controlled: false, waiting: false });
    await registerServiceWorker(env.host, '/sw.js', '/', () => undefined);
    expect(env.container.register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('第一次安裝（沒有控制者）時不打擾玩家', async () => {
    const env = fakeEnvironment({ controlled: false, waiting: true });
    const onReady = vi.fn();
    await registerServiceWorker(env.host, '/sw.js', '/', onReady);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('已有等待中的新版本時，通知畫面有更新可用一次', async () => {
    const env = fakeEnvironment({ controlled: true, waiting: true });
    const onReady = vi.fn();
    await registerServiceWorker(env.host, '/sw.js', '/', onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('沒有等待中的版本時不提示', async () => {
    const env = fakeEnvironment({ controlled: true, waiting: false });
    const onReady = vi.fn();
    await registerServiceWorker(env.host, '/sw.js', '/', onReady);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('新版本在背景安裝完成（updatefound → installed）時也會提示', async () => {
    const env = fakeEnvironment({ controlled: true, waiting: false });
    const onReady = vi.fn();
    await registerServiceWorker(env.host, '/sw.js', '/', onReady);
    const installing = { state: 'installing', addEventListener: vi.fn() as (type: string, fn: Listener) => void };
    let stateChange: Listener | undefined;
    installing.addEventListener = (_type, fn) => {
      stateChange = fn;
    };
    env.registration.installing = installing;
    env.fireRegistration('updatefound');
    expect(onReady).not.toHaveBeenCalled();
    installing.state = 'installed';
    env.registration.waiting = { state: 'installed', postMessage: env.postMessage } as never;
    stateChange?.();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('玩家按更新：先存檔，再要等待中的版本啟用，控制權交接後才重新整理', async () => {
    const env = fakeEnvironment({ controlled: true, waiting: true });
    let apply: (() => Promise<void>) | undefined;
    await registerServiceWorker(env.host, '/sw.js', '/', (fn) => {
      apply = fn;
    });
    const order: string[] = [];
    env.flush.mockImplementation(async () => {
      order.push('flush');
    });
    env.postMessage.mockImplementation(() => {
      order.push('skip');
      // 瀏覽器在新版本接管時會觸發 controllerchange
      env.fireContainer('controllerchange');
    });
    env.reload.mockImplementation(() => order.push('reload'));
    await apply?.();
    expect(env.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(order).toEqual(['flush', 'skip', 'reload']);
  });
});

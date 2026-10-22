/**
 * 註冊 service worker（離線可玩）與更新提示。
 *
 * 新版本不會自動取代正在玩的遊戲：安裝完成後會等待，畫面出現「有新版本」按鈕；
 * 玩家按下後先存檔，再請等待中的版本接手並重新整理。
 */

export interface ServiceWorkerHost {
  container: ServiceWorkerContainer;
  /** 重新整理前先存檔（沒有進行中的遊戲時什麼也不做）。 */
  flush: () => Promise<void>;
  reload: () => void;
}

export async function registerServiceWorker(
  host: ServiceWorkerHost,
  url: string,
  scope: string,
  onUpdateReady: (apply: () => Promise<void>) => void,
): Promise<void> {
  const registration = await host.container.register(url, { scope, updateViaCache: 'none' });

  const apply = async (): Promise<void> => {
    const waiting = registration.waiting;
    if (!waiting) return;
    await host.flush();
    // 新版本接管（controllerchange）後才重新整理，避免還沒換完就讀到舊的快取。
    host.container.addEventListener('controllerchange', () => host.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  // 只有「已經有控制者」的情況才是更新：第一次安裝不需要提示。
  const notifyIfUpdateWaiting = (): void => {
    if (registration.waiting && host.container.controller) onUpdateReady(apply);
  };

  notifyIfUpdateWaiting();
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') notifyIfUpdateWaiting();
    });
  });
}

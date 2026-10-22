import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderServiceWorker } from './precache.mjs';

/**
 * 在 Node 裡執行真正的 service worker 樣板（不靠瀏覽器）：假的 self、caches、fetch。
 * 這樣離線時的行為（快取優先、導覽網路優先並回退到快取、更新不自動生效）都有測試守著。
 */

const ORIGIN = 'https://game.test';
const CACHE = 'dewhollow-farm-v0.1.0-abcdef12';
const OLD_CACHE = 'dewhollow-farm-v0.0.9-00000000';
const PRECACHE = ['/', '/index.html', '/assets/index-abc123.js', '/manifest.webmanifest'];

class FakeRequest {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
  readonly cache: string | undefined;
  constructor(input: string | URL | FakeRequest, init: { method?: string; mode?: string; cache?: string } = {}) {
    this.url = new URL(input instanceof FakeRequest ? input.url : String(input), `${ORIGIN}/`).href;
    this.method = init.method ?? 'GET';
    this.mode = init.mode ?? 'no-cors';
    this.cache = init.cache;
  }
}

class FakeResponse {
  readonly status: number;
  readonly type = 'basic';
  readonly body: string;
  constructor(body: string, status = 200) {
    this.body = body;
    this.status = status;
  }
  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }
  clone(): FakeResponse {
    return new FakeResponse(this.body, this.status);
  }
}

type Handler = (event: Record<string, unknown>) => void;

function keyOf(input: string | { url: string }): string {
  return typeof input === 'string' ? new URL(input, `${ORIGIN}/`).href : input.url;
}

type Fetcher = (request: FakeRequest) => Promise<FakeResponse>;

class FakeCache {
  readonly entries = new Map<string, FakeResponse>();
  constructor(private readonly fetcher: Fetcher = async () => new FakeResponse('ok')) {}
  /** 與瀏覽器相同：任一個網址失敗，整批就失敗，且不寫入任何東西。 */
  async addAll(requests: FakeRequest[]): Promise<void> {
    const fetched: Array<[string, FakeResponse]> = [];
    for (const request of requests) {
      const response = await this.fetcher(request);
      if (!response.ok) throw new TypeError(`addAll 失敗：${request.url}`);
      fetched.push([request.url, response]);
    }
    for (const [key, response] of fetched) this.entries.set(key, response);
  }
  async put(input: string | { url: string }, response: FakeResponse): Promise<void> {
    this.entries.set(keyOf(input), response);
  }
  async match(input: string | { url: string }, options: { ignoreSearch?: boolean } = {}): Promise<FakeResponse | undefined> {
    const key = keyOf(input);
    const exact = this.entries.get(key);
    if (exact || !options.ignoreSearch) return exact;
    const path = key.split('?')[0];
    for (const [stored, response] of this.entries) {
      if (stored.split('?')[0] === path) return response;
    }
    return undefined;
  }
}

interface Harness {
  listeners: Map<string, Handler>;
  self: { skipWaiting: ReturnType<typeof vi.fn>; clients: { claim: ReturnType<typeof vi.fn> } };
  caches: Map<string, FakeCache>;
  fetch: ReturnType<typeof vi.fn>;
}

function boot(network: (request: FakeRequest) => FakeResponse | Promise<FakeResponse> | 'offline'): Harness {
  const listeners = new Map<string, Handler>();
  const caches = new Map<string, FakeCache>();
  const self = {
    location: { href: `${ORIGIN}/sw.js`, origin: ORIGIN },
    registration: { scope: `${ORIGIN}/` },
    addEventListener: (type: string, handler: Handler) => listeners.set(type, handler),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  const fetchFn = vi.fn(async (input: FakeRequest) => {
    const result = await network(input);
    if (result === 'offline') throw new TypeError('Failed to fetch');
    return result;
  });
  const cacheStorage = {
    open: async (name: string) => {
      let cache = caches.get(name);
      if (!cache) {
        cache = new FakeCache(fetchFn);
        caches.set(name, cache);
      }
      return cache;
    },
    keys: async () => [...caches.keys()],
    delete: async (name: string) => caches.delete(name),
  };
  const source = renderServiceWorker(readFileSync(new URL('./service-worker.template.js', import.meta.url), 'utf8'), {
    cacheName: CACHE,
    urls: PRECACHE,
  });
  // 樣板是經典腳本（非模組），以 Function 在假的全域環境執行。
  new Function('self', 'caches', 'fetch', 'Response', 'Request', 'URL', source)(
    self,
    cacheStorage,
    fetchFn,
    FakeResponse,
    FakeRequest,
    URL,
  );
  return { listeners, self, caches, fetch: fetchFn };
}

function event(extra: Record<string, unknown> = {}) {
  const e: Record<string, unknown> & { waited?: Promise<unknown>; responded?: Promise<unknown>; respondCalled: boolean } = {
    respondCalled: false,
    waitUntil(promise: Promise<unknown>) {
      e.waited = promise;
    },
    respondWith(promise: Promise<unknown>) {
      e.respondCalled = true;
      e.responded = promise;
    },
    ...extra,
  };
  return e;
}

async function install(h: Harness): Promise<void> {
  const e = event();
  h.listeners.get('install')?.(e);
  await e.waited;
}

describe('service worker: 安裝與預快取', () => {
  it('安裝時把所有預快取網址存進目前版本的快取（不會漏掉 index.html 與建置產物）', async () => {
    const h = boot(() => new FakeResponse('ok'));
    await install(h);
    const cache = h.caches.get(CACHE);
    expect(cache).toBeDefined();
    for (const url of PRECACHE) expect([...(cache?.entries.keys() ?? [])]).toContain(keyOf(url));
  });

  it('安裝時不自動 skipWaiting：新版本要等玩家按下更新，才會取代正在進行的遊戲', async () => {
    const h = boot(() => new FakeResponse('ok'));
    await install(h);
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('收到 SKIP_WAITING 訊息才 skipWaiting', () => {
    const h = boot(() => new FakeResponse('ok'));
    h.listeners.get('message')?.(event({ data: { type: 'OTHER' } }));
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    h.listeners.get('message')?.(event({ data: { type: 'SKIP_WAITING' } }));
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('預快取任一檔案失敗時安裝失敗，不留下缺檔的快取', async () => {
    const h = boot((request) => (request.url.endsWith('/assets/index-abc123.js') ? new FakeResponse('no', 404) : new FakeResponse('ok')));
    const e = event();
    h.listeners.get('install')?.(e);
    await expect(e.waited).rejects.toThrow();
  });
});

describe('service worker: 啟動時清掉舊版快取', () => {
  it('只刪除本遊戲的舊版快取，保留目前版本與其他網站的快取', async () => {
    const h = boot(() => new FakeResponse('ok'));
    h.caches.set(OLD_CACHE, new FakeCache());
    h.caches.set(CACHE, new FakeCache());
    h.caches.set('other-app-v1', new FakeCache());
    const e = event();
    h.listeners.get('activate')?.(e);
    await e.waited;
    expect([...h.caches.keys()].sort()).toEqual([CACHE, 'other-app-v1'].sort());
    expect(h.self.clients.claim).toHaveBeenCalled();
  });
});

describe('service worker: 讀取策略', () => {
  it('建置產物與素材走快取優先：快取有就不打網路', async () => {
    const h = boot(() => new FakeResponse('precached'));
    await install(h);
    h.fetch.mockClear();
    const e = event({ request: new FakeRequest('/assets/index-abc123.js') });
    h.listeners.get('fetch')?.(e);
    const response = (await e.responded) as FakeResponse;
    expect(response.body).toBe('precached');
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('快取沒有的同源 GET 會抓網路並存進快取', async () => {
    const h = boot(() => new FakeResponse('fresh'));
    await install(h);
    const e = event({ request: new FakeRequest('/assets/characters/cat-2x.png') });
    h.listeners.get('fetch')?.(e);
    await e.responded;
    expect(h.caches.get(CACHE)?.entries.has(keyOf('/assets/characters/cat-2x.png'))).toBe(true);
  });

  it('導覽請求網路優先：在線上拿到的是最新的 index.html，並更新快取', async () => {
    const h = boot(() => new FakeResponse('<html>new</html>'));
    await install(h);
    const e = event({ request: new FakeRequest(`${ORIGIN}/?slot=slot-2`, { mode: 'navigate' }) });
    h.listeners.get('fetch')?.(e);
    const response = (await e.responded) as FakeResponse;
    expect(response.body).toBe('<html>new</html>');
    expect(h.caches.get(CACHE)?.entries.get(keyOf('/index.html'))?.body).toBe('<html>new</html>');
  });

  it('離線時導覽請求回退到快取的 index.html（即使網址帶著存檔槽參數）', async () => {
    let online = true;
    const h = boot(() => {
      if (!online) return 'offline';
      return new FakeResponse('<html>shell</html>');
    });
    await install(h);
    online = false;
    const e = event({ request: new FakeRequest(`${ORIGIN}/?slot=slot-3`, { mode: 'navigate' }) });
    h.listeners.get('fetch')?.(e);
    const response = (await e.responded) as FakeResponse;
    expect(response.body).toBe('<html>shell</html>');
  });

  it('離線時沒有快取的資源會讓請求失敗（不會回傳假資料）', async () => {
    let online = true;
    const h = boot(() => (online ? new FakeResponse('ok') : 'offline'));
    await install(h);
    online = false;
    const e = event({ request: new FakeRequest('/assets/not-cached.js') });
    h.listeners.get('fetch')?.(e);
    await expect(e.responded).rejects.toThrow('Failed to fetch');
  });

  it('非 GET 與跨網站的請求不攔截', () => {
    const h = boot(() => new FakeResponse('ok'));
    const post = event({ request: new FakeRequest('/save', { method: 'POST' }) });
    h.listeners.get('fetch')?.(post);
    expect(post.respondCalled).toBe(false);
    const cross = event({ request: new FakeRequest('https://cdn.example.test/lib.js') });
    h.listeners.get('fetch')?.(cross);
    expect(cross.respondCalled).toBe(false);
  });
});

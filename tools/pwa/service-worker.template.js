/*
 * 晨露農場的 service worker 樣板（由 tools/pwa/vite-plugin.mjs 在建置時填入占位符）。
 *
 * 策略：
 * - 安裝：把建置產物、素材與 index.html 預快取（用 cache: "reload" 避開 HTTP 快取的舊檔）。
 * - 導覽請求（頁面本身）：網路優先，成功就更新快取的 index.html；離線時回退到快取的 index.html。
 * - 其他同源 GET（含檔名帶雜湊的建置產物與素材）：快取優先，沒有才抓網路並存起來。
 * - 不自動 skipWaiting：新版本安裝後等待，玩家在遊戲內按下「更新」（送出 SKIP_WAITING）才啟用，
 *   避免遊戲中途被換掉而打斷存檔。
 * - 啟用時只刪除本遊戲舊版本的快取。
 */

const CACHE_NAME = __CACHE_NAME__;
const PRECACHE_URLS = __PRECACHE_URLS__;
const CACHE_PREFIX = "dewhollow-farm-";

const SHELL_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new Request(new URL(url, self.location.href), { cache: "reload" }))),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(SHELL_URL));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

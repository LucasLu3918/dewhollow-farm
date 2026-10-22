import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheNameFor, precacheUrls, renderServiceWorker } from './precache.mjs';

const TEMPLATE_PATH = new URL('./service-worker.template.js', import.meta.url);

describe('cacheNameFor', () => {
  it('包含版本號與 index.html 的雜湊，同樣內容得到同樣名字', () => {
    const name = cacheNameFor('0.1.0', '<html>a</html>');
    expect(name).toMatch(/^dewhollow-farm-v0\.1\.0-[0-9a-f]{8}$/);
    expect(cacheNameFor('0.1.0', '<html>a</html>')).toBe(name);
  });

  it('index.html 內容改變（例如 JS 檔名的雜湊變了）時快取名字也會改變', () => {
    expect(cacheNameFor('0.1.0', '<html>a</html>')).not.toBe(cacheNameFor('0.1.0', '<html>b</html>'));
  });
});

describe('precacheUrls', () => {
  const files = ['index.html', 'assets/index-abc123.js', 'assets/index-def456.css', 'manifest.webmanifest', 'assets/characters/cat-2x.png', 'sw.js', 'assets/index-abc123.js.map'];

  it('列出 index.html、目錄入口與所有建置產物與 public 檔案，排除 sw.js 與 source map', () => {
    const urls = precacheUrls(files, '/');
    expect(urls).toContain('/');
    expect(urls).toContain('/index.html');
    expect(urls).toContain('/assets/index-abc123.js');
    expect(urls).toContain('/assets/index-def456.css');
    expect(urls).toContain('/manifest.webmanifest');
    expect(urls).toContain('/assets/characters/cat-2x.png');
    expect(urls).not.toContain('/sw.js');
    expect(urls.some((u) => u.endsWith('.map'))).toBe(false);
  });

  it('結果排序且不重複', () => {
    const urls = precacheUrls([...files, 'index.html'], '/');
    expect(new Set(urls).size).toBe(urls.length);
    expect([...urls].sort()).toEqual(urls);
  });

  it('子路徑部署時所有網址都帶上 base', () => {
    const urls = precacheUrls(files, '/dewhollow/');
    expect(urls).toContain('/dewhollow/');
    expect(urls).toContain('/dewhollow/index.html');
    expect(urls).toContain('/dewhollow/assets/index-abc123.js');
    expect(urls.every((u) => u.startsWith('/dewhollow/'))).toBe(true);
  });
});

describe('renderServiceWorker', () => {
  const template = 'const CACHE_NAME = __CACHE_NAME__;\nconst PRECACHE_URLS = __PRECACHE_URLS__;\n';

  it('把快取名字與預快取清單以 JSON 寫入樣板', () => {
    const out = renderServiceWorker(template, { cacheName: 'dewhollow-farm-v0.1.0-abcdef12', urls: ['/', '/index.html'] });
    expect(out).toContain('const CACHE_NAME = "dewhollow-farm-v0.1.0-abcdef12";');
    expect(out).toContain('const PRECACHE_URLS = ["/","/index.html"];');
    expect(out).not.toContain('__CACHE_NAME__');
    expect(out).not.toContain('__PRECACHE_URLS__');
  });

  it('樣板缺少任一個占位符時拒絕產生，避免輸出壞掉的 sw.js', () => {
    expect(() => renderServiceWorker('const CACHE_NAME = __CACHE_NAME__;', { cacheName: 'x', urls: [] })).toThrow('__PRECACHE_URLS__');
  });

  it('真正的 service worker 樣板含有占位符，且沒有寫死任何網址', () => {
    const source = readFileSync(TEMPLATE_PATH, 'utf8');
    expect(source).toContain('__CACHE_NAME__');
    expect(source).toContain('__PRECACHE_URLS__');
    expect(source).not.toMatch(/https?:\/\//);
  });
});

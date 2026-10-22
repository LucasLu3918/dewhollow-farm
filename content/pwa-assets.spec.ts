import { describe, expect, it } from 'vitest';
import assets from './assets.json';
import pkg from '../package.json';

/**
 * 上線相關的檔案登錄（M7）：manifest 欄位、圖示有來源、public/ 沒有未登錄的檔案、
 * 授權清單涵蓋所有素材與依賴、private/ 不進版本庫。
 */

const publicFiles = Object.keys(import.meta.glob('/public/**/*')).map((p) => p.replace(/^\/public\//, ''));
const manifestText = Object.values(import.meta.glob('/public/manifest.webmanifest', { query: '?raw', import: 'default', eager: true }))[0] as string;
const manifest = JSON.parse(manifestText) as {
  name: string;
  short_name: string;
  lang: string;
  dir?: string;
  display: string;
  start_url: string;
  scope: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};
const licenses = Object.values(import.meta.glob('/docs/LICENSES.md', { query: '?raw', import: 'default', eager: true }))[0] as string | undefined;
const gitignore = Object.values(import.meta.glob('/.gitignore', { query: '?raw', import: 'default', eager: true }))[0] as string;
const indexHtml = Object.values(import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true }))[0] as string;

/** 不需要登錄為素材的 public/ 檔案（只有 manifest 本身）。 */
const UNREGISTERED_ALLOWED = new Set(['manifest.webmanifest']);

describe('web app manifest', () => {
  it('名稱、語言、顯示模式與起始網址正確', () => {
    expect(manifest.name).toBe('晨露農場');
    expect(manifest.short_name).toBe('晨露');
    expect(manifest.lang).toBe('zh-TW');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('主題色與背景色是合法的十六進位顏色', () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('有 192 與 512 的 PNG 圖示，其中一張可作為 maskable', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of manifest.icons) expect(icon.type).toBe('image/png');
    expect(manifest.icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
  });

  it('每個圖示檔都存在於 public/，並且在 content/assets.json 登錄為程式產生', () => {
    const byFile = new Map(assets.assets.filter((a) => 'file' in a).map((a) => [a.file as string, a]));
    for (const icon of manifest.icons) {
      const file = icon.src;
      expect(publicFiles, file).toContain(file);
      expect(byFile.get(file)?.source, file).toMatch(/^程式產生/);
    }
  });

  it('index.html 連結到 manifest、設定主題色，並提供 apple-touch-icon', () => {
    expect(indexHtml).toContain('rel="manifest"');
    expect(indexHtml).toContain('name="theme-color"');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
  });
});

describe('素材與 public/ 的登錄', () => {
  it('content/assets.json 的每個素材都有非空的 source', () => {
    for (const asset of assets.assets) {
      expect(asset.source.trim(), asset.id).not.toBe('');
    }
  });

  it('public/ 裡每個檔案都登錄在 assets.json（或在允許清單中）', () => {
    const registered = new Set(assets.assets.flatMap((a) => ('file' in a && a.file ? [`${a.file}`] : [])));
    const unregistered = publicFiles.filter((file) => !registered.has(file) && !UNREGISTERED_ALLOWED.has(file));
    expect(unregistered).toEqual([]);
  });

  it('不忽略 private/ 的 .gitignore 規則不存在（private/ 必須被忽略）', () => {
    expect(gitignore.split('\n').map((line) => line.trim())).toContain('private/');
  });

  it('沒有任何 private/ 的檔案被放進 public/', () => {
    expect(publicFiles.filter((file) => file.startsWith('private/'))).toEqual([]);
  });
});

describe('授權清單（docs/LICENSES.md）', () => {
  it('文件存在', () => {
    expect(licenses).toBeDefined();
  });

  it('涵蓋每一個素材 id', () => {
    for (const asset of assets.assets) {
      expect(licenses ?? '', asset.id).toContain(asset.id);
    }
  });

  it('涵蓋 package.json 裡每一個直接依賴', () => {
    const names = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
    for (const name of names) {
      expect(licenses ?? '', name).toContain(name);
    }
  });
});

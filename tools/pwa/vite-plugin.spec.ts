import { describe, expect, it } from 'vitest';
import { normalizeBase } from './vite-plugin.mjs';

describe('normalizeBase（VITE_BASE）', () => {
  it('沒有設定時是網站根目錄 /', () => {
    expect(normalizeBase(undefined)).toBe('/');
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('   ')).toBe('/');
  });

  it('子路徑會補上開頭與結尾的斜線', () => {
    expect(normalizeBase('dewhollow')).toBe('/dewhollow/');
    expect(normalizeBase('/dewhollow')).toBe('/dewhollow/');
    expect(normalizeBase('/dewhollow/')).toBe('/dewhollow/');
  });

  it('完整網址（例如 CDN）保留網域，並補上結尾斜線', () => {
    expect(normalizeBase('https://games.example.test/dewhollow')).toBe('https://games.example.test/dewhollow/');
  });
});

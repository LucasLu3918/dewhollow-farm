import type { Plugin } from 'vite';

/** 把 VITE_BASE 整理成以 / 開頭、結尾的 base；未設定時為 /。 */
export function normalizeBase(raw: string | undefined): string;

/** 建置時產生 dist/sw.js 的外掛（見 vite-plugin.mjs）。 */
export function serviceWorkerPlugin(options: { version: string }): Plugin;

import { defineConfig, loadEnv } from 'vite';
import pkg from './package.json' with { type: 'json' };
import { normalizeBase, serviceWorkerPlugin } from './tools/pwa/vite-plugin.mjs';

// base 預設為 /；部署到子路徑時設定環境變數 VITE_BASE（例如 VITE_BASE=/dewhollow/），見 docs/DEPLOY.md。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: normalizeBase(env.VITE_BASE),
    server: { port: 5173, strictPort: true, host: '127.0.0.1' },
    preview: { port: 4173, strictPort: true, host: '127.0.0.1' },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
      // 第三方套件各自成檔：引擎與資料庫套件很少變，遊戲程式更新時玩家只需重抓遊戲本體（快取較有效）。
      // 注意：這不會減少首次載入的位元組，三者在開機時都需要。
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ },
              { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
              { name: 'dexie', test: /node_modules[\\/]dexie[\\/]/ },
            ],
          },
        },
      },
    },
    plugins: [serviceWorkerPlugin({ version: pkg.version })],
  };
});

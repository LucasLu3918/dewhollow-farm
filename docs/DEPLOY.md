# 部署說明

本文件說明怎麼把晨露農場發布成靜態網站（D3 已決定：靜態託管＋PWA）。**主機的選擇與網域由使用者決定**，這裡不替你選定；下面列的主機只是能夠託管靜態檔的例子。

## 1. 建置

```bash
npm ci
npm run check      # 型別檢查、單元測試、建置，最後檢查首次載入大小與 PWA 產物（npm run budget）
```

輸出目錄是 **`dist/`**，裡面全部是靜態檔（HTML、JS、CSS、PNG、`manifest.webmanifest`、`sw.js`）。不需要伺服器端程式。

發布前建議再跑一次端到端測試（需要另外啟動預覽伺服器，見下方「離線驗證」）：

```bash
npm run test:e2e
```

## 2. 子路徑（base）

預設 `base` 是 `/`，網站放在網域根目錄時什麼都不用設定。

若網站放在子路徑（例如 `https://example.test/dewhollow/`），建置時設定環境變數 `VITE_BASE`：

```bash
VITE_BASE=/dewhollow/ npm run build
```

`VITE_BASE` 會被 `vite.config.ts` 讀取並補上開頭與結尾的 `/`；`sw.js` 的預快取清單也會跟著帶上子路徑。`VITE_BASE` 改了就要重新建置。

## 3. 伺服器設定

| 項目 | 建議 |
| --- | --- |
| `.js` | `Content-Type: text/javascript` |
| `.css` | `text/css` |
| `.webmanifest` | `application/manifest+json`（不設也多半能用，但建議正確設定） |
| `.png` | `image/png` |
| `index.html`、`sw.js`、`manifest.webmanifest` | `Cache-Control: no-cache`，每次都向伺服器確認（更新才能被發現） |
| `/assets/*`（檔名含雜湊） | `Cache-Control: public, max-age=31536000, immutable` |

`sw.js` 必須放在 `base` 的根目錄（它的 scope 就是 `base`），不能放進子資料夾。

**HTTPS**：Service worker 只在 HTTPS 或 `localhost` 下運作。沒有 HTTPS 時遊戲仍可玩，只是不能離線、不能安裝。

**SPA 回退**：不需要。遊戲只有一個頁面，存檔槽、語言等狀態都用網址參數（`?slot=slot-2`）或瀏覽器儲存處理，靜態伺服器忽略查詢字串即可。沒有 `404.html` 也沒有關係；若主機預設的 404 頁面不好看，可以自行加一個 `public/404.html`（記得登錄到授權清單的檢查範圍，見 `content/pwa-assets.spec.ts`）。

## 4. PWA 行為

- 首次造訪時 `sw.js` 會預快取 `index.html`、所有 JS／CSS 與 `public/` 內的素材，之後離線也能開啟與遊玩。
- 導覽請求（頁面本身）網路優先，離線時回退到快取；建置產物快取優先。
- **更新不會自動發生**：新版本安裝後會等待，遊戲狀態列出現「有新版本，重新整理即可更新」按鈕。玩家按下後，遊戲會先存檔，再套用新版本並重新整理，避免中途打斷存檔。
- 版本號顯示在狀態列（來源是 `package.json`），說明頁的更新日誌來自 `content/changelog.json`。

## 5. 發布新版本的步驟

1. 改 `package.json` 的 `version`（例如 `0.1.0` → `0.2.0`）。
2. 在 `content/changelog.json` 的最前面加一筆，版本號、日期（YYYY-MM-DD）、標題與條目要與 `package.json` 一致（`content/changelog.spec.ts` 會檢查）。
3. 若新增或替換了素材、或更動依賴，執行 `npm run licenses` 更新 `docs/LICENSES.md`，並確認 `content/assets.json` 的 `source` 已填寫。
4. `npm run check`（必須全綠），必要時 `npm run sim`。
5. 部署 `dist/`。
6. 部署後驗證：開啟網站，狀態列版本號應為新版本；`/manifest.webmanifest` 與 `/sw.js` 可以打開。

版本號只在 `package.json` 改一處；`src/version.ts` 會讀取它。存檔版本（`SAVE_SCHEMA_VERSION`）與版本號是兩件事，改版本號不需要改存檔版本。

## 6. 離線驗證（部署前後各做一次）

```bash
npm run build
npm run preview          # 4173 埠，service worker 只在正式建置註冊
```

1. 用 Chrome 開啟 `http://127.0.0.1:4173/`（或部署網址），玩一下後重新整理兩次（第一次讓 service worker 接管）。
2. 開發者工具 → Network → 勾選 Offline，重新整理。遊戲應該能開啟，既有存檔也能讀取。
3. 端到端測試（可選）：`PWA_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/pwa.spec.ts`。

## 7. 首次載入預算

`npm run budget`（已包含在 `npm run check`）會計算首次載入的檔案大小（原始位元組與 gzip），預算是 8 MB（原始位元組）。目前約 2.0 MB 原始、約 590 KB gzip，其中 Phaser 引擎約 1.37 MB 原始（357 KB gzip），是最大的一塊。

## 8. 隱私

遊戲不載入任何第三方腳本、字型或分析工具，存檔只存在玩家的瀏覽器（IndexedDB）。部署時請不要加入第三方追蹤碼，否則說明頁的隱私說明就不再正確。

## 9. 待使用者決定

- 主機：Cloudflare Pages、GitHub Pages，或其他靜態主機（見 DECISIONS.md 的 D3）。
- 網域與是否使用子路徑（決定 `VITE_BASE`）。
- 是否要公開發布前，請作者或法律顧問再次確認授權清單（`docs/LICENSES.md`）與 ORIGINALITY.md。

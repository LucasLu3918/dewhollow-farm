---
name: verify-dewhollow
description: "Drive the real 晨露農場 (Dewhollow Farm) game in Chromium the way a player does, and capture screenshots plus a JSON report as proof. Use when you need to prove a gameplay, save, camera, map, or settings change works in the running app, not just in unit tests. Covers farm loop, camera and maps, settings and key rebinding, and save slots."
---

# verify-dewhollow

晨露農場是 Phaser 網頁遊戲，唯一的入口是瀏覽器。這個 skill 用 Playwright Chromium 開啟開發伺服器，照玩家的按鍵操作，並把每一步的截圖與存檔內容寫成證據。

單元測試（`npm test`）只看規則；這裡看的是「真的在 app 裡跑得通」。改了 UI、輸入、存檔、地圖或鏡頭時，用這個 skill 留下證明。

## Launch

開發伺服器必須用 **開發模式**（`npm run dev`，預設 `http://127.0.0.1:5173`）。`window.__dewhollow`（場景與鏡頭的讀取點）只在開發模式存在，正式建置（`dist/`、`npm run preview`）沒有它，驅動器會失敗。

在 Claude Code 中優先用 `.claude/launch.json` 的 `dewhollow-dev` 設定啟動（`preview_start` with `name: "dewhollow-dev"`，埠號 5173）。若要用其他埠，先設定 `VERIFY_URL`。

就緒的判斷：頁面出現 `#game canvas`，而且 `window.__dewhollow.mapId()` 不是空字串。HUD 文字「第 1 天」寫在 `index.html`，不代表場景已建立，不能單獨用來判斷就緒。

首次執行前若沒有 `node_modules/`，先跑 `npm ci`。Chromium 若沒安裝，跑 `npx playwright install chromium`。

## Doctor

唯讀檢查，任何東西看起來不對時先跑它：

```bash
node .claude/skills/verify-dewhollow/scripts/verify.mjs doctor
```

通過的條件：伺服器回應 200、頁面載入、場景就緒、地圖是 `farm`。失敗時 exit code 為 1，並在 `test-results/verify/doctor-*/report.json` 寫出原因。

## Drive

目前提供的驅動劇本：

| 劇本 | 指令 | 覆蓋的功能 |
| --- | --- | --- |
| `farm-loop` | `node .claude/skills/verify-dewhollow/scripts/verify.mjs farm-loop` | 開墾、播種、澆水、手動存檔、重新整理後接續、睡覺進入第 2 天、第 2 天存檔保留 |

其他功能的操作方式見 [features/README.md](features/README.md)。要驗證的功能若沒有對應劇本，請依該 feature 檔的 **Driving it with Playwright** 寫一個新的 `.mjs`，放在 `scripts/` 下，沿用 `verify.mjs` 的 `shot`、`readSave` 與 `report.json` 寫法。

按鍵的慣例：

- 用 `page.keyboard.press(key)` 一次按一個鍵，不要用座標點擊。
- 每次按鍵後等待 HUD 文字或 `#hud-log` 出現預期的訊息，再按下一個。玩家站定前按鍵會被丟掉。
- 讀檔（重新整理）後，要等「已讀取存檔」出現，而且 `window.__dewhollow.mapId()` 不是空字串，才能按鍵。

## Evidence

每次執行會建立 `test-results/verify/<劇本>-<時間戳>/`：

- `NN-<步驟>.png`：每一步的全頁截圖。
- `failure.png`：失敗時的截圖（若頁面還能截）。
- `report.json`：`mode`、`baseURL`、`status`（`PASS` 或 `FAIL`）、`failure`，以及每一步的名稱、時間與當時的數值。

證明的標準（來自 create-verification-skill）：

- 走真的玩家路徑：按鍵與 UI，不呼叫內部 setter，也不用只給測試用的端點。
- 記錄動作與結果狀態，不只記錄最後一張截圖。
- 副作用要驗證：例如手動存檔後，IndexedDB `saves` 的 `slot-1` 要真的有內容（`readSave`），不只看到「已存檔」文字。
- 截圖要打開來看過，不能只憑 exit code 宣稱通過。

## Cleanup

驅動器自己開的 browser 與 context 會在 `finally` 關閉。它每次都用全新的 context，所以 IndexedDB 不會殘留上一次的存檔。

清理只做兩件事：

1. 關閉驅動器開的瀏覽器（自動完成）。
2. 若是你用 `preview_start` 啟動的開發伺服器，驗證完成後用 `preview_stop` 停掉它（用 `serverId`，不要用程序名稱 kill）。

證據目錄不會被清理，它是要保留的成果，已列在 `.gitignore`（`test-results/`）。

## Helpers

- `scripts/verify.mjs`：唯一的驅動器，支援 `doctor` 與 `farm-loop`。只讀 `VERIFY_URL`（預設 `http://127.0.0.1:5173`），證據寫入 `test-results/verify/`。
- 與 `tests/e2e/` 的關係：那裡是 Playwright 規格（`npm run test:e2e`，會同時啟動 5173 與 4173 兩個伺服器）。本 skill 的驅動器只用單一開發伺服器，並留下截圖，適合用來「看見」變更。完整回歸仍用 `npm run test:e2e`，這是 AGENTS.md 的完成前驗證要求。

## 未完成的部分

`tests/e2e/` 裡有些規格檔的註解寫著「本檔尚未執行」（例如 `accessibility.spec.ts`、`collection.spec.ts`、`autumn-winter.spec.ts`）。這些功能目前**沒有經過驗證**，不要因為檔案存在就宣稱它們通過。

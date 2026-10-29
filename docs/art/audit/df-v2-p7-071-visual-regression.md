# DF-V2-071｜P5/P6 視覺回歸與 viewport／DPR 證據索引

> **範圍：**整理現有視覺 snapshot diff、響應式 E2E、P6 DEV 候選矩陣及錯誤追查方式。本文不新增／更新任何正式視覺 baseline，也不代表 P6 候選素材已核准或完成 Gate。

## 怎麼重跑

Playwright 設定預設啟動隔離的 Vite dev server 與 build preview（`127.0.0.1:5173`／`4173`）。若要沿用已啟動的測試伺服器，設定 `E2E_BASE_URL`、`PWA_BASE_URL`，並確認 preview 是目前分支建置。

```bash
# 已核准的正式視覺 snapshots：做像素差異比對，不更新 baseline
npm run test:e2e -- tests/e2e/map-world-validation.spec.ts tests/e2e/companions.spec.ts --workers=1

# 手機、平板、方向切換與面板 viewport 穩定性
npm run test:e2e -- tests/e2e/mobile-acceptance-gaps.spec.ts tests/e2e/mobile-panel-viewport-stability.spec.ts tests/e2e/responsive-layout.spec.ts --workers=1

# P6 房屋／樹冠候選：5 種 viewport × Chromium DPR 1／2／3
npm run test:e2e -- tests/e2e/gate1-mapscene-pixel32-overlay-runtime-matrix.spec.ts --workers=1

# P6 互動物件候選：5 種 viewport × Chromium DPR 1／2／3
npm run test:e2e -- tests/e2e/gate1-mapscene-pixel32-interactables-viewport-matrix.spec.ts --workers=1

# P6 室內、湖岸與季節候選 gate／回歸測試
npm run test:e2e -- tests/e2e/indoor-scene-candidate-preview.spec.ts tests/e2e/lake-shore-candidate-preview.spec.ts tests/e2e/season-weather-candidate-preview.spec.ts --workers=1
```

要在測試失敗時保留追查資料，可在命令尾端加 `--trace=on --video=on`；Playwright trace、影片及 HTML 結果在 `test-results/`、`playwright-report/`（依目前設定與執行器而定）。既有 `playwright.config.ts` 預設使用 `trace: 'retain-on-failure'`。只以實際產生的 artifact 回報錯誤，不把未重現的歷史失敗寫成現行問題。

### 證據矩陣

| 面向 | 可重跑測試／證據 | 比對類型與涵蓋 | 狀態／限制 |
|---|---|---|---|
| 正式 runtime 地圖視覺 | [`map-world-validation.spec.ts`](../../../tests/e2e/map-world-validation.spec.ts) 與 [`map-world-validation snapshots`](../../../tests/e2e/map-world-validation.spec.ts-snapshots/) | Playwright `toHaveScreenshot` 像素差異；農場四季、成熟田地、湖岸釣魚、礦口、森林遮擋 | 這些是 repo 內現存的測試 snapshot 基線；本任務未更新它們。若要改變期望畫面，應先確認差異原因，再由測試變更審查明確批准更新。 |
| 夥伴正式視覺 | [`companions.spec.ts`](../../../tests/e2e/companions.spec.ts) 與 [`companions snapshots`](../../../tests/e2e/companions.spec.ts-snapshots/) | 正式黑貓農場、黑貓與矮袋鼠村莊的 `toHaveScreenshot` 像素差異 | 只覆蓋兩張已核准視覺 snapshot；不代表候選動物素材審核。 |
| 手機／平板／方向變更 | [`mobile-acceptance-gaps.spec.ts`](../../../tests/e2e/mobile-acceptance-gaps.spec.ts)、[`mobile-panel-viewport-stability.spec.ts`](../../../tests/e2e/mobile-panel-viewport-stability.spec.ts)、[`responsive-layout.spec.ts`](../../../tests/e2e/responsive-layout.spec.ts) | viewport 內布局、觸控面板、手機方向、安全區與遊戲畫面穩定性；部分測試附截圖 | 主要是幾何、可見性及狀態斷言，不等同全畫面像素 diff。平板／手機仍是 Chromium 模擬。 |
| P6 房屋／樹冠 DEV overlay 候選 | [`overlay matrix E2E`](../../../tests/e2e/gate1-mapscene-pixel32-overlay-runtime-matrix.spec.ts)、[報告](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix.zh-TW.md)、[15 張圖與 metadata](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix/) | 5 個 viewport × DPR 1／2／3，共 15 張截圖；記錄候選載入、畫面診斷與 PNG SHA-256 | **候選、`approved:false`。**SHA-256 是檔案完整性檢查，不是和正式 baseline 的 pixel diff。截圖為 Chromium CSS 尺寸，DPR 僅為瀏覽器模擬。 |
| P6 互動物件 DEV 候選 | [`interactables matrix E2E`](../../../tests/e2e/gate1-mapscene-pixel32-interactables-viewport-matrix.spec.ts)、[報告與截圖](../candidates/pixel-movement/gate1-mapscene-pixel32-interactables-viewport-matrix.zh-TW.md) | 同為 5 個 viewport × DPR 1／2／3；檢查未核准互動物件候選載入與 viewport 呈現 | **候選、未核准。**矩陣截圖不替代像素基線比對或人工藝術品質 Gate。 |
| P6 室內／湖岸／四季候選 | [`indoor-scene-candidate-preview.spec.ts`](../../../tests/e2e/indoor-scene-candidate-preview.spec.ts)、[`lake-shore-candidate-preview.spec.ts`](../../../tests/e2e/lake-shore-candidate-preview.spec.ts)、[`season-weather-candidate-preview.spec.ts`](../../../tests/e2e/season-weather-candidate-preview.spec.ts)；[P6-064 地圖截圖索引](../reports/p6-064-map-coverage/README.md) | 精確 DEV gate、viewport fit、遊戲狀態不變、季節／光照情境及地圖載入／碰撞截圖 | 候選素材保持候選狀態；P6-064 圖是桌面 Chromium map coverage 證據，不是正式 baseline、手機／DPR 矩陣或藝術簽核。 |

## 已有錄影與錯誤重現

- Playwright 全域設定在失敗時保留 trace；需要檢查 DOM、請求、console、操作時間線時，用相同 spec、fixture 與 viewport 重跑並加 `--trace=on --video=on`。報告保留原始錯誤與 trace，避免只摘錄摘要。
- 部分針對移動／農務／寵物的 spec 已啟用影片；[`world-v2-roundtrip-smoke.spec.ts`](../../../tests/e2e/world-v2-roundtrip-smoke.spec.ts) 也處理 round-trip 錄影。一般全套 E2E 不保證每個測試都產生影片。
- 若需要穩定重現，先以單一 worker 執行最窄的失敗 spec；先保留 trace／影片，再擴大到整個 suite。不要用更新 snapshots 的選項掩蓋差異。

## 本輪序列回歸紀錄

- 主 agent 序列執行 movement、reduced-motion animation、viewport cycle、viewport message 四個 spec：**23/24 通過**。唯一失敗是 `viewport-cycle-stability.spec.ts` 的桌面 1920×1080 DPR 2 案例在 `context.close` 複製 Playwright `.network`／trace artifact 時發生 `ENOENT`；遊戲斷言沒有回報失敗。
- 同一案例以單一 spec／grep 隔離重跑：**1/1 通過，7.6 秒**。這只能說該次 artifact cleanup 失敗沒有重現；整個 24 案例 suite 並未全數重跑通過。
- 相關測試：[viewport cycle stability](../../../tests/e2e/viewport-cycle-stability.spec.ts)、[viewport message stability](../../../tests/e2e/viewport-message-stability.spec.ts)、[movement A/B](../../../tests/e2e/gate1-mapscene-pixel32-movement-ab.spec.ts)、[animation](../../../tests/e2e/ship-animation.spec.ts)。

## 尚未驗收

- DPR 1／2／3 是 Playwright Chromium emulation；不代表原生 iOS Safari、Android Chrome、硬體像素 raster 或真機效能。
- P6 DEV 候選截圖並未與已核准正式 baseline 做全矩陣 pixel diff；只有既有 snapshot 覆蓋範圍會執行 `toHaveScreenshot` 差異比較。
- 沒有一支錄影覆蓋所有 P5/P6 主要玩法。需完整短片或真機錄影時，須另行安排具體場景與設備；目前不能將工具模擬寫成已驗收。
- 本索引不取代人工素材簽核、P6 Gate 或 P7 總驗收。

# VF-00 Fresh Read 與 baseline

日期：2026-10-26（UTC）  
基準：`main`／`origin/main`，commit `c6e77435f10b3bd63b8fd7bb2dfa4dc1fedb2f7b`。工作分支 `codex/dewhollow-visual-inventory` 建立時與此 SHA 相同，起始工作樹乾淨。

## 專案現況

- 使用既有 TypeScript、Phaser 4、Vite、Dexie／IndexedDB、Zod、Vitest 與 Playwright；本次未換引擎、框架或存檔格式。
- `AGENTS.md` 要求 `domain → application → infrastructure → presentation` 單向分層；遊戲數值與文字由 `content/` 載入，正式素材需登錄來源並經核准。
- `src/domain/inventory.ts` 已提供容量與按物品／品質分堆的背包規則；`src/domain/items.ts` 定義 13 種 `ItemKind`。出貨價格規則已由 `src/domain/pricing.ts` 提供。
- 既有工具／種子選擇器、收藏與成就面板、共用 modal 與觸控控制已存在；尚無完整背包總覽及任意物品詳情視窗。手機可使用背包內持有的種子，但不是一般物品清單。
- 美術已有正式核准素材與 candidate-only Gate 1 Pixel32 資產；此任務不代表核准 candidate，也不會以候選替換正式素材。
- 計畫表 VF-00 至 VF-16 在原文件均標為待執行；本報告只完成新計畫的 baseline，不把既有類似功能當成新計畫已驗收。

## Baseline 驗證

| 指令 | 結果 |
| --- | --- |
| `npm run check` | 通過；6 個素材 Gate、TypeScript、162 個測試檔（1,643 passed、1 skipped）、production build 與 bundle budget 均成功。build 總量 2.808 MB，低於 8 MB 預算。 |
| `npm run test:e2e` | 通過；Chromium 251/251，耗時 4.2 分鐘。軟體繪圖 canary 使用 Playwright `test.fail()` 標示為預期失敗，整體退出碼為 0。 |

自動化使用 Playwright Chromium 與隔離 browser context，並非 iOS／Android 真機驗收。測試中的存檔資料是測試上下文所建，未使用使用者存檔。

## 可重現畫面

以下 PNG 來自本次 baseline E2E；村莊圖是 repo 內核准的固定 Playwright snapshot。SHA-256 可用 `shasum -a 256` 重算。

| 畫面 | viewport／檔案 | SHA-256 |
| --- | --- | --- |
| 農場直式 | 390×844，[`farm-390x844.png`](./visual-inventory-baseline/farm-390x844.png) | `436cd451e969a6cb3fd5958e6a381e164719fc9dd9074ee105555bf4a0bdefcd` |
| 農場橫式 | 844×390，[`farm-844x390.png`](./visual-inventory-baseline/farm-844x390.png) | `641f3d6a3c8588787ba337b3821083b0e1083bb803c645d8a6c581767c74ddd9` |
| 村莊 | 926×694，[`village-926x694.png`](./visual-inventory-baseline/village-926x694.png) | `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8` |

## 目前確認的限制

- 沒有背包總覽可供檢視所有已持有物品、品質、數量與詳情。
- 橫式手機畫面中的遊戲 canvas 較窄；VF-01 會量測畫面配置並提出具體問題，不先假定 CSS 或 camera 根因。
- 自動化和截圖只代表桌面 Chromium 模擬，不等同真機觸控命中率、安全區或中階裝置效能。
- 正式美術方向仍受 `docs/ART_STYLE.md` Golden Reference 與既有素材核准流程約束；視覺候選須由使用者對確切版本明確核准後才可整合。

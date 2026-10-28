# DF-V2-073｜總驗收與發布摘要

**狀態：PARTIAL — 尚未達 `LOCAL_COMPLETE`，暫不發布／合併。** 本報告區分已實作、已通過的本機自動檢查，以及仍需人工素材簽核、真機測試與完整 CI 的項目；不把候選方向確認當成精確素材核准。

## 已完成的範圍

| 任務 | 結果 | 可追溯證據 |
|---|---|---|
| P6-061 湖岸候選 | DEV 候選已修訂並獲准作為後續 Gate 方向；`approved:false` | Atlas SHA-256 `7d33b58230b73611df76be70aae39c719377240a1897316c9354c414cdd92035`；`docs/art/candidates/pixel-movement/p6-lake-shore/manifest.json` |
| P6-064 地圖覆蓋 | 12/12 authored maps、22 個 portal cells 有 runtime coverage；桌面 Chromium 證據 | [`P6-064 report`](../reports/p6-064-map-coverage/README.md) |
| P7-070 載入與預快取容量 | 報告完成；沒有加入未經裝置量測支持的載入架構改造 | [`DF-V2-070 report`](../../performance/DF-V2-070-capacity-report.md)；最新建置首載 3,317,628 raw／1,750,546 gzip bytes；Service Worker 完整預快取 15,958,918 raw bytes、逐檔 gzip 估算 14,159,866 bytes |
| P7-071 視覺回歸證據索引 | 已整理既有正式 snapshots、手機／平板 viewport 與 P6 DEV 候選測試；不更新 baseline | [`DF-V2-071 index`](df-v2-p7-071-visual-regression.md) |
| P7-072 v23 離線存檔恢復 | v23 fixture 遷移後可在 service worker 控制下離線讀取、保存與重載；focused E2E 及本輪全套案例通過 | `tests/e2e/pwa-v23-offline-recovery.spec.ts` |
| P7-073 測試穩定性 | 修正寵物 sampler 初始 idle 誤判、全年睡眠 E2E timeout、movement A/B recorder 啟動競態、viewport cycle 測試分級，以及旋轉後觸控尺寸量測時序；只改測試 | commits `ae20e00`, `b9299d0`；本輪 focused inventory 測試 5/5、10-cycle smoke 90/90、100-cycle stress 900/900 通過 |

其他已交付 P1–P6 切片含 viewport／地圖視覺 adapter、室內 zoom、農地與作物候選、工具回饋、角色與寵物動畫、手機 HUD／背包／面板、候選世界場景與季節呈現。詳細證據見各任務報告、測試與 commit history；這不代表整體美術 Gate 或真機 Gate 已通過。

## 驗證結果

- `npm run check` 通過：7 組素材檢查、TypeScript、185 個 Vitest 檔案（1,788 passed／1 skipped）、production build，以及 8 MB 首載預算（實測 3.318 MB）。
- 最新完整 `npm run test:e2e -- --workers=1` **376/376 通過，耗時 37.8 分鐘**。前一次重跑曾有 1 項觸控高度量測在旋轉後短暫讀到 40px（門檻 44px）；獨立執行 6 次皆通過。測試現等待版面量測達穩定 44px，再檢查既有門檻；旋轉案例重複 5 次與其後完整 E2E 均通過。
- `viewport-cycle-stability.spec.ts`：必要 E2E 保留 10-cycle smoke，完整執行取得 **90 個量測樣本**；另外透過 `npm run test:e2e:stress` 執行 **100 cycles／900 個樣本，1/1 通過，耗時 21.1 分鐘**，配置 35 分鐘 timeout。分級僅改測試入口／timeout，不改遊戲 runtime 或驗收斷言。
- P6-063 四季候選測試在較早一次長套件曾等候 `#game canvas` timeout，獨立重跑 1/1 通過；最新完整 E2E 再次通過。最新全套中 movement A/B、候選寵物跟隨、全年睡眠與 PWA 離線恢復均通過。

## 尚未關閉的 Gate 與風險

1. **精確素材簽核仍待辦。** 使用者核准的是候選方向與進入後續階段，並未核准下列 exact PNG 作正式素材。相關 manifests 目前保持 `approved:false`：

   | 候選 | Atlas SHA-256 |
   |---|---|
   | P2 world-v2 farm | `cf4688263b8ebcf665aa59d52115d31057aea798740941f1a2c6e0fc3ce90ccc` |
   | P2 world-v2 house | `cbf374f7df1f3adc9af03878188ee78d397ce86da127300e12447cefd0a583c2` |
   | P3 house interior | `28d397a2f6c9933f3c2e749f1cf9a0b3b676ba109bc7aa18b4c386e2e5acc0c7` |
   | P6 village/plaza | `df7129020acfaa2be890a2e71bafb57a066f6be3e330253ad6c643e70c4bb0dc` |
   | P6 farm interiors | `3ef026ace8df27e034b274e95f658ceae9503e74408ced1e041c3251db138337` |
   | P6 mine | `2e38bb3442df09bdc2002498ed895bc70126c9c12e3f0d33cdf0f814f90f0b49` |
   | P6 seasons/weather | `45e8aacdd37d8f3ca5223d0783bffca11d99d34a42605c2729a35a680f32be56` |
   | P6 lake shore | `7d33b58230b73611df76be70aae39c719377240a1897316c9354c414cdd92035` |

2. **真機驗收待辦。** iOS／Android viewport、安全區、觸控命中率與性能沒有實機證據；Playwright DPR／touch 僅是 Chromium 模擬。P7-070 實機啟動、FPS、記憶體及網路／快取量測標記 `DEVICE_PENDING`。
3. **素材權利／來源證據不完整。** 部分候選 manifest 的生成器、來源或授權證明仍需逐項核實；checker 通過不能代替權利審查。
4. **CI Required Check 尚待 PR。** 本機完整 E2E 與 100-cycle stress 已全數通過，但 PR 尚未建立，`end-to-end (Chromium)` 與其他 Required Checks 尚無實際狀態。
5. **Impact Graph 覆蓋仍局部。** 本輪依使用者核准範圍人工查核相關 viewport、候選載入與測試 consumers；不能宣稱全 repository consumer graph 完整。

## 發布狀態與 PR 摘要

- AIPS `publish doctor` 已確認 repository/auth 可用，`main` branch protection 有效，Required Checks 為 `typecheck, unit tests, build` 與 `end-to-end (Chromium)`。目前沒有 PR，故 PR checks 尚無實際狀態。
- 只讀 `publish diagnose` 對一般分支名 push 命令回報 `PUSH_SOURCE_NOT_EXACT_SHA`；安全下一步是先解除測試／Gate 阻擋，再由 `aips publish prepare` 產生綁定完整候選 SHA 的發布指令並重新觀測 PR checks。此診斷不代表已 push；本輪沒有 push、開 PR 或 merge。
- **建議 PR 標題：** `Complete Dewhollow world-art rebuild evidence and P7 acceptance`
- **PR 摘要：** 增補 DEV-only 世界／地圖／季節候選、12 張地圖覆蓋、載入與 PWA 預快取容量報告、視覺回歸索引、v23 離線恢復 E2E，以及 viewport／觸控等測試穩定性修正。Production art、device performance 與 CI Required Checks 仍需依 Gate 管理。

**解除發布阻擋的建議順序：** (1) 使用者逐張審核上述 exact asset hashes 與來源／權利；(2) 取得 iOS／Android 實機資料；(3) 建立 PR 並等待 Required Checks 全綠；(4) 依既有合併核准流程 merge。

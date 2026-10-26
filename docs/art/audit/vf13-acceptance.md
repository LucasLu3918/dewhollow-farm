# VF-13 綜合驗收補充紀錄

日期：2026-10-27。驗收基準：功能分支 `codex/dewhollow-visual-inventory`，VF-13 起始 revision `f1ed002`。本報告描述 VF-13 定向驗證，不宣稱替代合併後主 agent 的全分支驗收。

## 執行環境與命令

- E2E：Playwright 1.64.1、Chromium / Google Chrome for Testing `156.0.8078.4`；viewport 使用專案 Chromium 預設 1280×720，DPR 1。Vite dev／preview 分別使用隔離 localhost 埠 5197／4197。
- 軟體繪圖器：`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`；`software=true`，預設 workaround 啟用，texture units 1、renderer 上限 16。
- `npm test -- src/application/inventory-display.spec.ts src/presentation/inventory-panel.spec.ts`：**22 passed**。
- `npm run typecheck`：**PASS**。
- `npm run build`：**PASS**。
- `E2E_BASE_URL=http://127.0.0.1:5197 PWA_BASE_URL=http://127.0.0.1:4197 npm run test:e2e -- tests/e2e/render-compat.spec.ts tests/e2e/inventory-detail.spec.ts tests/e2e/save-slots.spec.ts --workers=2 --reporter=line`：**27 passed**。
- 同一環境再次單跑 `tests/e2e/render-compat.spec.ts --workers=1 --reporter=line` 以記錄 renderer metrics：**7 passed**。
- `git diff --check`：**PASS**。

未執行 `npm run test:e2e` 全套；合併後全量檢查由主 agent 統一執行。完整 `npm run check` 也未在 VF-13 這個 revision 重跑。

## 驗收證據矩陣

| 項目 | 證據 | 結果與限制 |
|---|---|---|
| 起始容量與即時資料 | `tests/e2e/inventory-grid.spec.ts` | 已驗證起始 24 格、2/24 使用、22 空格與真實起始種子資料；擴容後格數追隨新容量尚未覆蓋。 |
| 同物品不同品質價格 | 新增 `tests/e2e/inventory-detail.spec.ts` | 同一 `crop.moon-bean` 普通／優良堆疊可分開選取，數量與品質正確；顯示售價分別為 **54／68 銅幣**，符合品質換算。 |
| 不可出貨物品 | `src/application/inventory-display.spec.ts`、`src/presentation/inventory-panel.spec.ts`、新增 inventory-detail E2E | 木材詳情明確標示「不可出貨」，沒有 0 元或價格欄；價格仍只由真實 `sellPrice` 產生。 |
| 動作成功／拒絕與原子性 | `tests/e2e/inventory-detail.spec.ts` | 新增戴上帽子成功案例：穿戴欄更新且背包只減 1 件；既有背包滿額拒絕案例驗證錯誤訊息並逐字比較操作前後 GameSession state；既有脫下測試驗證返還衣物。未覆蓋所有其他拒絕碼（例如無可穿戴物、數量不足）的 UI 路徑。 |
| 篩選後選取清除 | `tests/e2e/inventory-detail.spec.ts` | 既有案例驗證被篩除堆疊不再留在詳情，避免顯示舊物品。消耗被選取堆疊後的對應情境仍未單獨驗收。 |
| Modal／鍵盤／輸入隔離 | `tests/e2e/inventory-modal.spec.ts`、`tests/e2e/accessibility.spec.ts` | 既有證據覆蓋 Esc、焦點循環與返回、方向鍵／Enter、快捷鍵、modal 期間鍵盤及觸控輸入隔離。 |
| v23 存檔 reload | 新增 `tests/e2e/save-slots.spec.ts` | 直接載入當前 schema v23 fixture，存檔並 reload 後逐項保留 inventory（含品質與數量）、tool tiers、wearing、village map／player position 與 farming/fishing skills。這證明列出的欄位 roundtrip，不是所有 GameState 欄位的全量相等測試。 |
| 舊／新版本存檔 | `src/infrastructure/persistence/save-migrations-v23.spec.ts`、`tests/e2e/save-slots.spec.ts` | 既有單元測試覆蓋 v22→v23、v23 不變及拒絕 v24；E2E 覆蓋 v1 匯入後讀取並成為 v23。 |
| 場景美術前後比較 | `docs/art/audit/vf11-scenes/README.md` 及六張同條件 PNG | 已有 farm house、farm tree、village 三組 before/after 與 viewport、camera、日期、素材 hash；素材縮圖重複感及小細節合併仍是已記錄限制。它不是 VF-13 的完整視覺簽核。 |
| 手機 RWD | `tests/e2e/inventory-mobile.spec.ts` | 既有 E2E 覆蓋 375×812、390×844、812×375、844×390 的 panel 範圍、水平 overflow、捲動、44px 目標、觸控與旋轉；未證明真實瀏海／Home Indicator 裝置或使用者易點性。 |
| 效能 | `npm run build` | 本次沒有量測 60／50 FPS、點選到詳情呈現耗時、atlas／draw calls／texture bytes、手機掉幀或載入快取；這些目標均標為 **未量測**，不能據此宣稱達標。 |

## Renderer 保底與實測

預設保底路徑在四向各 12 個 gait phases 共 **48/48** 個取樣全部通過嚴格區間 `0.97 < area ratio < 1.03`；`?compat=1` 強制啟用與 `?compat=0` 停用的設定斷言也通過。

| 朝向 | 12 phases 最小 ratio | 最大 ratio | 門檻 | 結果 |
|---|---:|---:|---|---|
| up | 1.00000 | 1.00716 | (0.97, 1.03) | PASS |
| down | 0.99867 | 1.00816 | (0.97, 1.03) | PASS |
| left | 1.00000 | 1.00993 | (0.97, 1.03) | PASS |
| right | 0.99934 | 1.00629 | (0.97, 1.03) | PASS |

強制關閉診斷在**同一台 Chromium 156 SwiftShader 環境**只量 down 向 12 phases：ratio 範圍 **1.00035–1.00606**，低於 0.97 的 phases 為 **0/12**。這是原 canary xpass 的可重現 renderer／版本觀察，診斷測試現以 JSON attachment 與 test output 留下 renderer、browser 及逐相位數值，不再用 `test.fail` 讓 xpass 把套件標紅。

單一 Chrome／SwiftShader 版本的強制關閉結果，不能證明其他 Chromium／Phaser 組合、其他軟體 renderer 或真實 GPU 已修復。runtime 偵測保底與 `?compat=1` 強制啟用均保留；此診斷不授權移除它們。預設四向像素測試仍要求保底路徑畫面完整。

## 尚未完成的 §8 驗收

- §8.2 要求的背包／多品質／空背包／fallback／錯誤訊息各情境遊戲內 screenshots、人工逐張圖批准、1× 圖示辨識與接縫、夜間及雨天、角色髮型四向與寵物辨識：本次沒有完成或宣稱完成。
- §8.3 桌機 1440×900、1280×720 背包詳情、色盲模式／大字級／減少動態組合，及實際手機安全區／易用性：本次沒有驗證。
- §8.4 FPS、100ms 互動反應、記憶體與場景 draw-call／GPU texture profiling：未量測。
- §8.5 完整 `npm run check`、全量 `npm run test:e2e` 尚待主 agent 在所有任務整合後對同一 branch revision 執行。全域 Impact Graph coverage 仍是 partial；本 bounded 驗收不證明全 repository consumer coverage。

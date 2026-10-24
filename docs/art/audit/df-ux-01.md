# DF-UX-01 手機版面與 HUD 驗收紀錄

## 範圍

- 直式手機與矮橫式版面採用 responsive safe-top token，並以瀏覽器 safe-area 值作為備援，避免狀態列貼近瀏海或系統列。
- 主要狀態列、選擇器、訊息列與種子提示維持至少 14 CSS px 的基準字級，並繼續尊重使用者字級倍率。
- 驗證方向切換及頁面進入背景時，浮動搖桿會取消目前輸入；返回頁面後，必須重新觸控才會恢復移動。
- 本階段未更動遊戲規則、存檔 schema、地圖資料或素材。

## 驗收證據

- `tests/e2e/responsive-layout.spec.ts`：390×844 直式及 844×390 橫式下，驗證 safe-top 至少 24 CSS px，HUD 功能文字至少 14 CSS px。
- `tests/e2e/touch.spec.ts`：驗證方向切換和 `visibilitychange` 隱藏時會清除搖桿 held/moving/pending 狀態，恢復後不會自行續移，新的手勢可再次移動。
- Chromium 自動化使用 Playwright；本機 E2E dev server 使用 5183 埠，PWA preview 使用 4173 埠。這些結果僅代表桌面 Chromium 模擬的 viewport 與合成輸入。
- 專案檢查：`npm run check` 通過，包含型別檢查、1,577 個單元測試（1 個既有 skip）、production build 與 bundle budget。
- 完整 E2E：`npm run test:e2e -- --workers=6` 為 211 passed、1 failed。唯一失敗是既有 `farm-loop.spec.ts` 在長流程中未於時限內到達作物互動格；相同規格獨立重跑為 1 passed（58.1 秒）。此前全套也曾分別出現貓咪動畫與搖桿取消時序失敗，其獨立重跑均通過，顯示目前 Chromium 全套併行測試有偶發時序不穩定。
- 新增／修改的 DF-UX-01 E2E 案例均通過，包括直／橫式 safe-top 與 HUD／狀態列按鈕字級、orientation change 及頁面隱藏時的搖桿取消。

## 尚待實機確認

`DEVICE_PENDING`：未在實際 iOS／Android 裝置確認瀏海／系統安全區、觸控命中率、可讀性與中階裝置效能；不將自動化模擬標記為真機通過。

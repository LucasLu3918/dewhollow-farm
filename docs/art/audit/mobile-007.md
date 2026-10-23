# DF-MOBILE-007 版面驗收

## 結果

修正 1280×720 桌機首屏垂直溢出。一般橫向桌機視窗在觸控控制列隱藏時，`.app` 使用 viewport 高度；遊戲區填入狀態列和訊息列之間的剩餘高度，並維持 4:3。390×844 直式手機、844×390 短橫式手機與 768×1024 直式平板的現有版位未受影響。

新增 `responsive-layout.spec.ts` 回歸測試，載入農場、移動玩家、執行主要動作，確認回饋列更新、遊戲畫面與主要 HUD 全在 1280×720 首屏內，頁面不需垂直捲動。

## 驗收證據

Playwright Chromium 使用隔離的 `127.0.0.1:5189` 遊戲伺服器和暫時 browser context。每個 viewport 載入農場、移動玩家四格、執行開墾並截取操作後畫面。桌機無 touch；三個行動 viewport 使用 Playwright `hasTouch` 模擬觸控能力。viewport 截圖和量測：

| Viewport | 實際檢查 | document scrollHeight / clientHeight | 結果 |
| --- | --- | ---: | --- |
| 390×844 | 直式 HUD、遊戲畫面、訊息列、外置虛擬按鍵與開墾回饋 | 844 / 844 | 通過；主要項目都在首屏 |
| 844×390 | 短橫式 HUD、居中 4:3 畫面、左右 touch controls、訊息列與回饋 | 390 / 390 | 通過；控制組不遮蓋遊戲畫面 |
| 768×1024 | 平板直式 HUD、遊戲畫面、外置 controls 與訊息列 | 1024 / 1024 | 通過；沒有頁面垂直捲動 |
| 1280×720 | 桌機 HUD、主要動作、4:3 canvas 與訊息列 | 720 / 720 | 通過；無垂直捲動 |

桌機量測：viewport 1280×720；HUD 座標 y=16–130；主要動作 y=71–119；遊戲區 572×429、y=142–571；canvas y=143–570；訊息列 y=594–647。所有區域均在視窗內，遊戲區比例為 4:3。

Playwright E2E 結果：

- Targeted `responsive-layout.spec.ts`: 5 passed。
- Touch、responsive、mobile panel 三個 spec 合併執行：28 passed（原有 27 個，加上本次桌機回歸測試）。

兩次測試皆明確使用 `E2E_BASE_URL=http://127.0.0.1:5189`、`PWA_BASE_URL=http://127.0.0.1:4189` 和獨立輸出目錄。完整 mobile 命令：

```sh
E2E_BASE_URL=http://127.0.0.1:5189 PWA_BASE_URL=http://127.0.0.1:4189 \
  npx playwright test tests/e2e/touch.spec.ts tests/e2e/responsive-layout.spec.ts tests/e2e/mobile-panel-shell.spec.ts \
  --project=chromium --workers=1 --output=/private/tmp/dewhollow-mobile-007-27
```

## AC-007 補充驗收

計畫 AC-007 的手機直式 390×844、橫式 844×390、平板直式 768×1024、桌機 1280×720 viewport 均有自動化版面證據；原有 768×1024 截圖見上方。新增的專項規格為 [mobile-acceptance-gaps.spec.ts](../../tests/e2e/mobile-acceptance-gaps.spec.ts)：

- `平板直式 768×1024 的主要操作區保持在 viewport 內並附截圖`：再次量測遊戲畫面、HUD、工具／種子／主要動作、移動／動作控制與操作紀錄，並附 `tablet-768x1024.png` Playwright screenshot。
- `觸控可開啟並關閉使用背包種子的選擇面板`：390×844 觸控操作打開 `#tool-seed-panel`，確認可見開局背包中的甜蘿蔔種子，然後關閉面板。專案沒有獨立背包總覽 UI，此案例驗證目前可觸控使用、且讀取背包種子的選擇面板。
- `直式存檔在切換橫式後仍可再次存檔並重載相同遊戲狀態`：直式移動並觸控存檔，改為橫式後再次存檔，再重載並比對地圖、位置及持久化狀態。只略過會隨等待時間增加的 `playtimeSeconds`。

執行 `npm run test:e2e -- tests/e2e/mobile-acceptance-gaps.spec.ts`（Node 24.22.1）：Chromium 3/3 通過。新增平板截圖是該次 Playwright attachment，未加入版本控制。Playwright `setViewportSize` 只驗證 viewport resize/orientation layout，未模擬原生裝置旋轉事件。

**整體仍為 Partial**：自動化確認版面與操作路徑，不足以核准實機安全區、瀏海與系統瀏覽器列、文字實際可讀性或手指命中率。使用者已表示目前沒有 iOS／Android 實機；這些人工驗收待有設備時完成。觸控工具輪盤長按／取消見 [touch.spec.ts](../../tests/e2e/touch.spec.ts)，連續農務去重／取消見 [continuous-farm.spec.ts](../../tests/e2e/continuous-farm.spec.ts)，後者的主要長按案例以滑鼠／鍵盤測試，觸控長按副作用尚未完整覆蓋。

## 截圖

- [1280×720 桌機修復前](mobile-007-desktop-before.png) — 首屏下緣裁掉遊戲畫面，操作紀錄在視窗下方。
- [390×844 直式手機](mobile-007-390x844-phone-portrait.png)
- [844×390 短橫式手機](mobile-007-844x390-phone-landscape.png)
- [768×1024 直式平板](mobile-007-768x1024-tablet-portrait.png)
- [1280×720 桌機修復後](mobile-007-1280x720-desktop-landscape.png) — 遊戲畫面與操作紀錄均在首屏。

## 實機限制

本次只用 Playwright Chromium viewport 與觸控能力模擬，未使用實體 iOS、Android、平板或桌機。截圖和尺寸是自動化瀏覽器證據，仍需真機確認瀏覽器工具列、安全區及系統旋轉行為。

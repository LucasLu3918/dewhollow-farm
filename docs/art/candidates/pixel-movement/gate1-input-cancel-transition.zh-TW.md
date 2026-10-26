# DF-G1-INPUT-CANCEL-TRANSITION-EVIDENCE 輸入取消與場景轉換證據

## 範圍

在 DEV Chromium farm 場景，以 390×844 viewport 和合成 touch `PointerEvent` 驗證三種中斷流程：持續按住下方向穿越農場南門進入 village、方向按住期間重新載入已存檔位置、方向按住期間開啟 settings modal。

每案檢查 `heldDirection === null`、`moving === false`、`pending === false`、`queuedTaps === 0`。在地圖切換／modal 開啟邊界先記錄位置，再於 300 ms 安靜窗逐個 `requestAnimationFrame` 取樣，確認每個樣本的地圖與玩家格位都保持不變。逐案邊界、停止狀態與完整樣本序列以 JSON 附件附在 Playwright 結果中。

## 驗證結果

- 專項 Chromium E2E：3/3 通過。
- `npm run check`：通過（162 個測試檔，1,643 passed／1 skipped；build 2.808 MB）。
- 完整 Chromium E2E：251/251 通過（4 workers）。
- 每案安靜窗均未觀察到額外格位提交或背景移動；地圖轉換與 modal 情境的停止位置亦與中斷邊界相同。
- 開啟設定面板時方向來源被清除；載入存檔後玩家回到存檔格位；穿門後方向輸入未延續至新地圖。

## 限制

- 測試使用合成 Chromium touch 事件與開發模式診斷；不證明原生 iOS／Android 的實際 pointer／背景行為。
- 300 ms 安靜窗只驗證本測試觀察到的短期停止狀態，不代表 60／120 FPS、輸入延遲或長時間穩定性通過。
- 本證據不核准任何候選素材，也不代表人工盲測、美術審查或 Gate 1 通過；原生實機狀態仍為 `DEVICE_PENDING`。

測試來源：[input-cancel-transition.spec.ts](../../../../tests/e2e/input-cancel-transition.spec.ts)。

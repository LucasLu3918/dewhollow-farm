# 存檔槽（save slots）

## Sub-features

- 三格存檔：面板列出 slot-1、slot-2、slot-3，預設在 slot-1。
- 位址列的槽位：網址的 `?slot=slot-2` 決定開啟哪一格。
- 新遊戲到別的格：在 slot-2 開新遊戲會切到 slot-2，slot-1 的進度保留。
- 刪除：需要二次確認。
- 匯出：下載檔名包含槽位與日期。
- 匯入：版本較新的檔案被拒絕，空格保持空；非 JSON 被拒絕；版本 1 的存檔會遷移後載入。
- 損毀存檔：顯示真實錯誤，保留原檔，並打開存檔槽面板。

## How to get to it (user POV)

按 `L` 打開存檔槽面板。面板上有新遊戲、讀取、刪除、匯出、匯入按鈕。

## Driving it with Playwright

按 `L`，然後操作面板上的按鈕。讀取槽位用網址參數：`page.goto(baseURL + '/?slot=slot-2')`。

匯入不能用系統檔案視窗，改用 `tests/e2e/save-slots.spec.ts` 的做法：先點「匯入」，再把內容放進面板的檔案欄位並觸發 `change`。

讀檔或換格後，要等「已讀取存檔」出現，而且場景就緒，才能按鍵；換格會重新載入頁面，要等網址與載入完成。

## Gotchas

- `README.md` 寫的是「單一存檔槽（`slot-1`）」，但 `save-slots.spec.ts` 測的是三格。以 `src/application/save-slots.ts` 與規格為準，不要以 README 為準。
- 這個功能的規格檔沒有「尚未執行」的註解，但也還沒有經本 skill 的驅動器跑過，目前屬於未驗證。
- 損毀存檔的測試會故意寫壞 IndexedDB 的紀錄；每次都用新的 context，避免影響其他劇本。

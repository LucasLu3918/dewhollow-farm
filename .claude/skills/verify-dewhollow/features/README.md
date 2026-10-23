# 功能地圖（verify-dewhollow）

從玩家的角度列出可以驗證的功能。每個功能一個檔案，格式固定為四個 H2：`Sub-features`、`How to get to it (user POV)`、`Driving it with Playwright`、`Gotchas`。

| 功能 | 檔案 | 狀態 |
| --- | --- | --- |
| 農場主線：開墾、播種、澆水、存檔、睡覺 | [farm-loop.md](farm-loop.md) | 已驗證（`verify.mjs farm-loop` PASS） |
| 鏡頭與地圖切換 | [camera-and-maps.md](camera-and-maps.md) | 未驗證，規格存在 |
| 設定面板與按鍵重新綁定 | [settings-and-keybinds.md](settings-and-keybinds.md) | 未驗證，規格註解寫「尚未執行」 |
| 存檔槽（三格、刪除、匯出匯入） | [save-slots.md](save-slots.md) | 未驗證，規格存在 |

「未驗證」代表還沒有用本 skill 的驅動器實際跑過一次。要宣稱通過，先依該檔的 Driving 步驟寫劇本並執行。

## 共用的按鍵與畫面

- 方向鍵移動；`X` 互動；`Z` 切換工具；`C` 切換種子；`S` 存檔；`O` 設定；`L` 存檔槽；`I` 圖鑑；`?` 說明（來源：`content/controls.json`）。
- HUD 元素的 id：`#hud-day`、`#hud-energy-text`、`#hud-gold`、`#hud-log`。
- 場景就緒：`window.__dewhollow.mapId()` 回傳非空字串。這個 API 只存在於開發模式。

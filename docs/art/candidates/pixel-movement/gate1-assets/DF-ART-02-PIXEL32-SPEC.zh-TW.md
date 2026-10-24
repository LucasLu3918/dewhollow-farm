# DF-ART-02：pixel32 候選圖集規格

> **狀態：方向已由使用者選定；素材仍為 candidate，Gate 1 尚未完成。** 本規格只定義候選圖集資料格式與機器可檢查條件。checker 通過不構成素材、動畫、場景品質或裝置驗收。

## 尺度與相容性

- 原生地面格為 `32 × 32` 像素；現行遊戲 world tile 維持 `64 × 64` 世界單位，pixel32 候選以 `2×` 最近鄰顯示。
- `manifest.json` 的 `pixelContract` 是此候選 atlas 的版本化規格。它不改寫 `content/assets.json` v1 的 `density` 定義，也不變更正式素材、rig、存檔或遊戲格座標。
- 每個 atlas cell 為 `32 × 48` 像素、4 欄 × 4 列。地面與物件 frame 可只佔 cell 上方的 `32 × 32`；主角為 `32 × 48`。各 rect 使用 atlas 左上角原點和半開區間 `[x, x + width) × [y, y + height)`。
- PNG 必須是非交錯、8-bit、RGBA，且圖集同時含完全透明與不透明像素。可為有意的特效使用半透明像素，但這不是候選通過條件。縮放只允許 nearest-neighbor。

## Frame metadata

- `x`, `y`, `width`, `height` 是 atlas 像素整數。`nativeWidth` 和 `nativeHeight` 必須等於未縮放 frame 尺寸；frame 起點須對齊其候選 cell，且 rect 不得越界或重疊。
- `footAnchor` 和 `pivot` 都是 frame 內的整數像素索引，原點在左上；有效範圍為 `0..width-1`、`0..height-1`。本批候選的 pivot 與 foot anchor 相同，用來讓地面定位穩定。
- 地面、農地、道路、樹、房屋邊、柵欄、工具採用下中點錨；主角採用雙腳中點；貓與袋鼠採用足部基準；陰影採用橢圓底部中央。具體座標保留在 manifest，不從 frame 尺寸猜測。
- `tags` 是非空且不重複的字串清單，描述 frame 種類與候選狀態。靜態 `playerWalk` 仍只是一張樣張，不得藉 metadata 解讀為動畫序列。
- Frame `sha256` 使用 canonical RGBA pixel digest：先放兩個 32-bit big-endian 尺寸值，再依列序放置 RGBA bytes。這避免 PNG 壓縮器版本影響 frame 雜湊。Atlas `sha256` 則驗證完整 PNG 檔案位元組。

pixel32 的既有錨點座標如下；pivot 必須等於同一列的 foot anchor：

| Frame | `footAnchor` / `pivot` |
|---|---:|
| `grass`, `tilled`, `road`, `tree`, `cropSeed`, `cropSprout`, `cropMature`, `houseEdge`, `fence`, `tool` | `(16, 31)` |
| `playerIdle`, `playerWalk` | `(16, 47)` |
| `cat`, `quokka` | `(16, 28)` |
| `shadow` | `(16, 11)` |

pixel16 候選依序使用 `(8, 15)`、`(8, 23)`、`(8, 14)`、`(8, 7)` 作對應座標。座標契約檢查能發現資料偏移，無法判定像素本身是否看起來真的接地。

## Checker 保證與限制

執行 `npm run assets:gate1:check` 可驗證 manifest 欄位、候選狀態、固定 frame 清單、尺寸、cell 對齊、每類 frame 的錨點座標、atlas rect、PNG chunk CRC、RGBA 解碼、alpha、atlas 檔案 digest、canonical frame digest、來源 generator digest 與 palette 檔案。Checker 也會在隔離的 OS 暫存目錄重跑綁定的 generator，逐位元比較生成的 manifest、palette 與 atlas；完成後清除暫存目錄。

Checker 不會修補或重寫候選輸入、不會把 candidate 轉成 reviewed／approved／integrated；錯誤時輸出欄位或檔案位置並回傳非零狀態。它無法判斷腳是否在視覺上接地、角色是否跨方向保持身份、場景是否清楚或畫面是否適合真實裝置。這些仍由 Gate 1 的人工與實機證據驗收。

checker 不檢查本機外的正式素材，不會讀取或改動 `content/assets.json`、`content/rigs.json`、`public/` 或存檔資料。

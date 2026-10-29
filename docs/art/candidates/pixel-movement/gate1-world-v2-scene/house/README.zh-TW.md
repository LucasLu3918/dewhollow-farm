# 小屋 World v2 Pixel32 候選

> 狀態：`candidate`，`approved: false`。本資料夾只包含候選 atlas 與其可重現產生器，不會替換舊 `house.json`、正式素材或存檔資料。

## 內容與像素契約

- `atlas.png`：512×512 RGBA，32×32 原生地面格；多格家具以整數 tile 倍數打包，alpha 外框透明。
- `manifest.json`：frame rectangle、`role`、tileability、`footAnchor`、`pivot`、`footprintTiles`、layer 與未核准狀態。
- `generate.mjs`：僅使用 Node built-in modules 與整數像素原語重現 PNG、manifest；沒有引入依賴。
- World tile 維持 64 世界單位，顯示 2× nearest-neighbor。色票沿用 `docs/art/world-v2/ART_BIBLE.md` 的暖木、深棕輪廓、暖左上主光與冷影方向。

## Phaser frame IDs

整合程式可依 `manifest.frames` 的 `rect` 從 `atlas.png` 建 frame；位置用腳底錨點定位，不能把家具 sprite 左上角當作 tile 位置。

| Frame IDs | 用途 | Footprint |
|---|---|---:|
| `floor-a`, `floor-b`, `floor-c`, `floor-d` | 木地板變體，可無縫鋪設 | 1×1 |
| `wall-middle`, `wall-left-corner`, `wall-right-corner`, `wall-top`, `wall-bottom` | 木牆、轉角、頂飾與踢腳板 | 1×1 |
| `wall-window`, `wall-shelf`, `door-leaf` | 牆面附件候選；目前可通行入口不顯示關門片 | 2×2、2×1、1×2 |
| `door-threshold` | 門口木門檻 | 2×1 |
| `rug` | 客廳地毯 | 3×2 |
| `bed`, `bedside-table` | 臥眠區 | 2×2、1×2 |
| `kitchen-counter`, `stove` | 廚房檯面、疊在檯面上的爐面 | 3×2、1×1 |
| `workbench`, `storage` | 工作／收納區 | 2×2、2×2 |
| `pet-bed` | 寵物休息墊 | 2×1 |

家具的 `footAnchor` 和 `pivot` 在 frame 內；manifest `layoutSuggestion.placements[].anchorTile` 是腳底所在世界格，不是 sprite 左上角。整合時用 `footAnchor` 對齊 tile 底部中心，依 `role` 分配地表、牆面或物件圖層。

Manifest 的 `layoutSuggestion` 示範以目前 10×7 的 legacy `house` 建立候選擺放：床置左上、廚房置右上、工作桌與收納分在下方，中央保留雙格通道，入口保持可見且可通行。爐面是檯面上的 1×1 overlay；地毯是可通行 ground overlay。這是渲染構圖建議，不修改地圖、碰撞或互動點；完整 22×20 小屋仍須由 P3 另行設計。

## 再現與自檢

```bash
node --check docs/art/candidates/pixel-movement/gate1-world-v2-scene/house/generate.mjs
node docs/art/candidates/pixel-movement/gate1-world-v2-scene/house/generate.mjs
```

產生器會檢查唯一 frame ID、整數尺寸、32px 對齊、atlas 範圍、腳底錨點範圍，以及所有 `tileable: true` 地板 frame 的 RGBA 對邊像素；PNG 與 manifest digest 隨輸出更新。請以真正 Phaser 場景檢查接地、層次、門動線、家具比例與手機可讀性，checker 不能判定美術通過。

## 限制

- 人工像素原語組成的視覺候選，尚未由使用者做整場景審核，亦非正式素材。
- 家具 `footprintTiles` 是 review 提示，不是 collision source；正式碰撞和互動仍以遊戲資料／application rules 為準。
- legacy 房間很小，若同時擺入所有候選家具會擁擠。主 agent 應挑選必要物件進場景，保留寬兩格的中心通道；不要為了塞滿 atlas 而把所有物件一次顯示。
- 不可將這些 frames 寫入 `content/assets.json`、`public/`、`content/maps/*.json` 或正式 rig，也不能以本候選推定其他場景核准。

# P6-063 四季與環境光效 Pixel32 候選

> 狀態：`candidate`，`approved: false`。素材僅供 DEV 預覽和人工審查，尚未核准，不能加入 `public/` 或 `content/assets.json`。

## 圖集與接法

`atlas.png` 為 384×128 px RGBA 圖集，包含 12 個候選 frame。季節地面與環境 wash 為 32×32 px；四季樹冠為 96×96 px。地面與樹冠以 2× nearest-neighbor 顯示，環境 wash 依 viewport 尺寸最近鄰顯示。`manifest.json` 記錄 frame 座標、錨點、層級、alpha 與 SHA-256。執行 `node generate.mjs` 可確定性重建圖集與 manifest。

- 地表：`season-spring`、`season-summer`、`season-autumn`、`season-winter`。套用到既有 ground tiles；四邊以相同底色收口，避免水平橫紋和地磚縫。
- 樹冠：`season-spring-foliage`、`season-summer-foliage`、`season-autumn-foliage`、`season-winter-foliage`。各為 96×96 px、3×3 tile canopy，`pivot`／`footAnchor` 固定 `(48, 95)`，可替換現有 `tree-canopy` frame，沿用相同 tile anchor 和 front occlusion layer。
- Viewport 環境 wash：`ambience-dawn`、`ambience-day`、`ambience-dusk`、`ambience-rain-night`。清晨為暖色漸層、日間為極低 alpha 中性亮度、黃昏為薰衣草至琥珀漸層、雨夜為藍色低光並加細雨線。每個 frame 都是 32×32、`tileable: false`、全畫布低 alpha 且四角不透明度非零。

接入場景時，選一個 ambiance frame 建立固定於相機的 image，將 `displaySize` 設為 viewport 的實際寬高，並使用 nearest-neighbor texture filtering。這是刻意的非等比 viewport 拉伸；透明 alpha 做柔和色調覆蓋，完整像素框覆蓋畫面，四邊不留透明縫或中央色塊硬邊。雨夜雨線是少量高 alpha 細節，底層仍保持連續 wash。不要把這四種 wash 平鋪到地圖 tile 上，也不要用 linear filtering。

## 素材與相容界線

素材以既有 Pixel32 32×32 tile 和 64×64 world tile contract 製作；不修改地圖、碰撞、遊戲時間、季節規則、天氣規則、存檔或正式素材清冊。樹冠僅供替換既有樹冠素材，不放置新物件，也不更改 anchor 或遮擋規則。此目錄只提供可重現候選，不代表 runtime 已接入，亦未代表 16 組季節／環境組合完成視覺驗收。正式素材整合前仍須審查遊戲內同點位截圖，並核准確切檔案雜湊。

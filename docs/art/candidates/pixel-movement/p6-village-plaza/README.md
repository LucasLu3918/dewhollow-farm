# P6-060 村莊與廣場場景候選

> 狀態：`candidate`，`approved: false`。此包只供精確 DEV 預覽與視覺審查；未核准前不可登記至正式 `content/assets.json` 或移入 `public/`。

## 檔案

- `town-tile-source.png`：1280×1344 RGBA 合成來源；上方保留圖像生成的 4×4 村鎮道具稿，下方附 9 個手繪 32×32 草地、石路、廣場磚與石牆 tile。SHA-256 `5db6fcb70a394474889eb3c3833851ef03b26213830ae291b9a5a1553f2c2ffe`。
- `atlas.png`：544×256 RGBA；16 個 64×64 道具 frame，加 9 個 32×32 可平鋪草地、石路、廣場磚與石牆 frame。SHA-256 `df7129020acfaa2be890a2e71bafb57a066f6be3e330253ad6c643e70c4bb0dc`。
- `manifest.json`：frame 索引、尺寸、處理方式、來源與核准狀態。
- `screenshots/village-dev-1280x720.png`：exact gate 的瀏覽器截圖，1280×720，SHA-256 `e23614b4c4a8486194fb33e4b7c6245e9289fe2b3fdb2414a826f647ad219afb`。
- `screenshots/plaza-dev-1280x720.png`：exact gate 的瀏覽器截圖，1280×720，SHA-256 `88f9c754065d1c4601c4251379874d3196aa209bf20c89c497c53de6e0ad3bab`。

道具原圖由 OpenAI 內建圖像生成工具產生；工具未提供可驗證的模型版本或授權條款，故不推定。道具區的 320×320 區塊降採樣至 64×64、量化為 32 色並以 alpha 160/255 門檻去背。下方地面 tile 使用整數像素圖元手工繪製，沿用木造與藍綠色石材色盤；runtime 以最近鄰整數倍率顯示。

## DEV 預覽範圍

只在 DEV、Pixel32 runtime 與精確 `gate1TownVisual=p6-060` 同時成立時載入。現有 MapDef 的 grass/path/wall 格只替換畫面材質；所有 tile 座標、碰撞、互動、居民、商店、節慶、傳送門及存檔仍由原系統控制。店面使用 2×2 格，其餘道具採較小顯示比例並減少廣場擺設，降低相鄰素材重疊。

候選畫面已以最新村莊與廣場截圖確認草地變體、石板路、石牆及較疏的道具排列；素材仍偏高細節道具搭配低解析像素底圖，需在正式審查時再評估像素一致性、建物比例、道路導引與廣場留白。通過視覺審查前，素材仍不可正式整合。

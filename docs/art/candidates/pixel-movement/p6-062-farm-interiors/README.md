# P6-062 畜舍、牧場與溫室 Pixel32 候選

> 狀態：`candidate`，`approved: false`。這組圖塊只供 DEV 預覽和人工審視；精確素材尚未核准，不可併入 `public/` 或 `content/assets.json`。

## 圖集

- `atlas.png`：8 欄 × 3 列、256 × 96 px；18 個 32 × 32 原生圖塊，顯示倍率 2×、nearest-neighbor。
- `manifest.json`：frame rect、像素契約、來源及 SHA-256。
- `generate.mjs`：以整數像素原語確定性輸出 atlas 與 manifest。執行 `node generate.mjs` 可重建兩者。

Frame IDs 固定為：

- 雞舍／牛舍：`coop-floor-a`、`coop-floor-b`、`coop-wall`、`coop-trough`、`coop-stall`。
- 牧場：`pasture-grass`、`pasture-grass-variant`、`pasture-fence-horizontal`、`pasture-fence-vertical`、`pasture-fence-corner`、`pasture-path`、`pasture-water-edge`、`pasture-wall`。
- 溫室：`greenhouse-back`、`greenhouse-front`、`greenhouse-ground`、`greenhouse-glass`、`greenhouse-door`。

## 視覺／功能界線

使用既有 world-v2 Pixel32 色票與大色塊：雞舍／牛舍採溫暖木板地面和牆面，牧場採柔和草地、木柵欄和土路，溫室採低對比玻璃與土壤。Tile 只表示畫面材質，不包含碰撞、可達性、動物數值或遊戲規則。

候選 renderer 需依既有 `coop.json`、`cowbarn.json`、`pasture.json` 和 farm 溫室格子選圖；地圖資料、入口出口、碰撞、動物系統、存檔和正式素材清冊維持現況。溫室門是否展示仍由既有 greenhouse flag 決定。

## 限制

- 本 atlas 是候選樣張，還沒有遊戲內視覺 gate，也沒有逐格 seam review。
- `pasture-water-edge` 是水岸視覺 tile，不代表可釣位置或碰撞邊界。
- 這組圖集沒有角色／動物 sprite；既有 actor art 會由場景 renderer 保留。
- 候選版本 hash 請以 `manifest.json` 為準；正式使用需另行核准確切 atlas。

## DEV 遊戲內截圖

以下是精確 gate `gate1IndoorScene=p6-062` 與既有 Pixel32 runtime 的瀏覽器 E2E 擷取。檔名中的尺寸是瀏覽器 viewport；PNG 只擷取 `#game` 畫面，尺寸會受頁面版面影響。

- 雞舍、牛舍手機 viewport：`screenshots/coop-390x844.png`、`screenshots/cowbarn-390x844.png`
- 牧場桌面 viewport：`screenshots/pasture-1280x720.png`
- 住宅與兩種升級配置：`screenshots/house-390x844.png`、`screenshots/house-wing-390x844.png`、`screenshots/house-full-390x844.png`
- 溫室鎖定／解鎖：`screenshots/greenhouse-locked-390x844.png`、`screenshots/greenhouse-390x844.png`

這些證據只代表 DEV 候選呈現與指定 fixture 的畫面，不代表正式素材核准或完整裝置相容性驗收。

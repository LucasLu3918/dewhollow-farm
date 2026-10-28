# P6-062｜動態礦坑 Pixel32 候選

> **狀態：candidate，`approved: false`。** 本目錄只提供礦坑美術樣張，尚未核准為正式素材；不得加入 `content/assets.json` 或 `public/`。

## 候選內容

- `atlas.png`：256×64 RGBA 圖集，8×2 格列，單格 32×32、遊戲顯示 2×。
- `generate.mjs`：以整數像素圖元確定性產生 PNG 與 manifest。
- `manifest.json`：frame 座標、材質角色、動態礦坑地圖覆蓋與候選限制。

圖集包括洞窟地板變體、岩壁、可敲岩石、銅／銀／金礦、上下樓梯、洞口、出口木門、支撐木架、礦燈與電梯籠。礦層由 `src/domain/mine.ts` 動態生成；本候選只為入口的 `wall`、`rock`、`path`、`cave`、`door` 與動態層的 `wall`、`rock`、`path`、`ore`、`stairs` tile kinds 提供外觀方向，不影響地圖生成、碰撞或挖礦規則。

## 像素契約與重建

- 原生 tile：32×32；world tile：64 units；nearest-neighbor 2×。
- 來源：原創手繪整數像素圖元，無外部或既有遊戲素材。
- 重建：`node docs/art/candidates/pixel-movement/p6-062-mine/generate.mjs`。
- 生成器會把本身與 atlas 的 SHA-256 寫入 manifest；重新執行後須保持相同 atlas bytes。

## 限制

- `mine-support`、`mine-lantern` 與 `mine-elevator` 是視覺樣張，不會自行出現在地圖；放置必須另由已核准的場景設計決定。
- 動態地圖寬度、地形、礦石種類、樓梯、碰撞和存檔仍由既有 MapDef 與遊戲規則決定。
- 候選需接上精確 DEV gate，並以實際入口與動態層畫面檢查接縫、遮擋和可讀性後再送視覺審核。

## DEV 遊戲內截圖

精確 gate `gate1IndoorScene=p6-062` 與既有 Pixel32 runtime 的瀏覽器 E2E 擷取：`screenshots/mine-entrance-1280x720.png` 與 `screenshots/mine-layer-1280x720.png`。檔名尺寸是瀏覽器 viewport；PNG 只擷取 `#game` 畫面，尺寸會受頁面版面影響。截圖展示既有入口及動態第 41 層的 tile 覆蓋，不代表正式素材核准或所有礦坑種子的視覺驗收。

# P6-061｜月鏡湖畔 tile-ready 候選

> **狀態：candidate，`approved: false`。** 使用者接受視覺方向並要求修水面重複與岸線呈現。此版仍是 DEV 候選，確切 atlas 尚未獲正式素材核准，不可併入 `content/assets.json` 或 `public/`。

## 候選檔案與雜湊

- `lake-shore-concept.png`：概念方向圖，1254×1254，SHA-256 `9169c9e0b2f4e2cec57d210b177573ebe2681de418cd418248e4897d2f4657cf`。
- `lake-shore-tile-source.png`：修訂用來源圖，1254×1254，SHA-256 `e24dc1aa559795ec4c746de9b6ba55acf6febcffb5a0a0756f1a3811666c7628`。
- `atlas.png`：4×4、128×128 RGB atlas，單格 32×32，SHA-256 `7d33b58230b73611df76be70aae39c719377240a1897316c9354c414cdd92035`。
- `manifest.json`：逐格 frame、尺寸、縮放契約、生成器與來源、SHA-256 和核准狀態。來源概念由內建 imagegen 依接受方向製作；原始生成模型及授權細節未提供。
- `generate.mjs`：以 Node.js 內建 zlib 解碼來源 PNG、固定 pixel-center nearest-neighbor 裁切、降低水色對比並確定性編碼 atlas。執行 `node generate.mjs` 可重建 atlas 與 manifest。

## DEV 遊戲畫面證據

以下截圖由隔離 Chromium context 載入既有 lake fixture，使用 `renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1LakeVisual=p6-061` 擷取。它們證明候選 atlas 在目前 DEV renderer 中的呈現，不是實機效能量測或正式素材核准。

- `screenshots/lake-dev-390x844.png`：390×844 CSS viewport、DPR 3、PNG 1170×2532；SHA-256 `331dd5afce192e5d77b5207b8986ab4d99f79c6c01f3a0d853db7e08f5d27eb4`。
- `screenshots/lake-dev-1280x720.png`：1280×720 CSS viewport、DPR 3、PNG 3840×2160；SHA-256 `d10313167a5fba3553d0e8fb521e30a8cec8b3c2092f4f50651189ac9cc6bc6e`。

## 水面與岸線修訂

來源圖 4×4 每格以固定起點 `1, 315, 628, 942` 裁切 310×310 區域，再於 pixel center 用 nearest-neighbor 縮到 32×32，依 manifest frame 順序 row-major 拼圖。生成器只對水色像素做低對比四階藍色壓縮；`water-open` 維持純色基底 `#1A6E90`，石頭、睡蓮、蘆葦、泡沫和岸線輪廓細節則保留。這讓普通水面格彼此一致，裝飾格仍保留石頭、睡蓮和少量低對比漣漪，不再以高反差水波造成明顯藍綠方塊。

岸邊格沿用北、東、南、西單邊與角落／灣岸組合，保留岩石、草沿與淺水交界。現有 `lake.json` 是矩形地圖；素材候選只能讓既有邊緣更像連續河岸，不能改變水域拓撲或把岸線延伸到目前地圖邊界以外。截圖仍可見地圖造成的大致直線邊界，這是已知限制。

## 執行界線與限制

- DEV 預覽只有在 Vite DEV、pixel32 runtime 與精確湖岸 query 同時啟用時才載入候選圖。
- 候選只根據 `lake.json` 現有 grass/path/water 鄰接繪製；不改地圖 schema、碰撞、移動、釣魚判定、存檔、`public/` 或 `content/assets.json`。
- `fishing-ripple` 是靜態裝飾樣本，不代表可釣位置或釣魚規則。
- 仍需人工檢查各岸線組合的接縫與不同背景下的可讀性。檢視方向已授權不等於核准此精確 atlas；正式整合前請核對上述 atlas SHA-256 並另行簽核。

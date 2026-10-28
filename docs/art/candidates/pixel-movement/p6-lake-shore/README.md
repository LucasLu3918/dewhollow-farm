# P6-061｜月鏡湖畔 tile-ready 候選

> **狀態：candidate，`approved: false`。** 使用者已接受概念方向，授權製作圖塊候選與精確 DEV 預覽。以下確切 atlas 尚未取得正式素材核准，不得併入 `content/assets.json` 或 `public/`。

## 候選檔案

- `lake-shore-concept.png`：概念方向圖，1254×1254，SHA-256 `9169c9e0b2f4e2cec57d210b177573ebe2681de418cd418248e4897d2f4657cf`。
- `lake-shore-tile-source.png`：圖塊來源圖，1254×1254，SHA-256 `b5607551e3d8a316077ae5e9a9c1f7ab9a9eb891f53a754fd38e072a3cd9a06d`。
- `atlas.png`：4×4、128×128 RGB atlas，單格 32×32，SHA-256 `d1c958be78fc95b0bec7f478a71c531c49ca3fb166b3aab0a4a4600071fa5d5f`。
- `manifest.json`：逐格 frame、尺寸、縮放契約、來源和核准狀態。

## DEV 場景檢視證據

- `screenshots/lake-dev-390x844.png`：390×844 CSS viewport、DPR 3，PNG 1170×2532；SHA-256 `9864edd943fa85aeaa7186bae6faef168e02cd044c413e6fe2dd5508bb80f8ca`。
- `screenshots/lake-dev-1280x720.png`：1280×720 CSS viewport、DPR 3，PNG 3840×2160；SHA-256 `57f905a18ac57e2c4e4f940b65eed07a7deb0dea3db09018fa165eca767d9b0f`。
- 兩張圖以隔離 Playwright context 載入 lake 測試存檔，使用 `renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1LakeVisual=p6-061`。這是 DEV 預覽證據，不是實機效能數據或正式素材核准。

## 產生與像素契約

來源圖由 OpenAI imagegen 依使用者接受的概念方向生成；模型與授權細節未提供。Atlas 從 4×4 格線內各取 310×310 區域，避開生成圖格線，再以 FFmpeg 9.0.2 nearest-neighbor 縮至 32×32，依 manifest 列序拼成 128×128。使用下列契約：原生 32 px、world tile 64 units、精確 2× nearest-neighbor。來源圖和 atlas 都保留在候選目錄供檢視與 hash 驗證；這是由生成圖裁切縮小的第一輪候選，尚未逐像素手工潤飾或完成無縫性驗收。

Frame 順序依 manifest 的 `frames` 列序：

1. 水面變化：平靜水紋、小波光、石影、睡蓮。
2. 四向單邊岸線：北、東、南、西。
3. 岸線組合與淺水：西北角、環形灣、淺灘石、東北角。
4. 草岸蘆葦、淺水卵石、蘆葦叢與裝飾漣漪。

## 執行邊界

- 遊戲內預覽只在 DEV、pixel32 runtime 與明確的湖岸候選 query 同時啟用時讀取候選圖。
- 候選只繪製 `lake.json` 現有 grass/path/water 鄰接；地圖 schema、碰撞、移動、釣魚判定、存檔與正式素材 manifest 維持原狀。
- 漣漪 frame 為靜態視覺樣本，不代表可釣位置或新釣魚規則。
- 圖片縮小後有高頻細節，單格遠看可能略繁；需以實際 DEV 畫面人工審視其 2×比例、接縫、顏色與岸線可讀性。
- 使用者必須檢視 `atlas.png` 與上列 atlas SHA-256，正式素材整合才可進行。接受視覺方向不等於核准確切素材。

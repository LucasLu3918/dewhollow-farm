# P6-061｜月鏡湖畔 tile-ready 候選

> **狀態：candidate，`approved: false`。** 使用者已接受概念方向，授權製作圖塊候選與精確 DEV 預覽。以下確切 atlas 尚未取得正式素材核准，不得併入 `content/assets.json` 或 `public/`。

## 候選檔案

- `lake-shore-concept.png`：概念方向圖，1254×1254，SHA-256 `9169c9e0b2f4e2cec57d210b177573ebe2681de418cd418248e4897d2f4657cf`。
- `lake-shore-tile-source.png`：圖塊來源修正版，1254×1254，SHA-256 `e24dc1aa559795ec4c746de9b6ba55acf6febcffb5a0a0756f1a3811666c7628`。
- `atlas.png`：4×4、128×128 RGB atlas，單格 32×32，SHA-256 `d1f8be22051becf7b4307f51694e230cd27dcb081a9e2f619925cb340a74889f`。
- `manifest.json`：逐格 frame、尺寸、縮放契約、來源和核准狀態。

## DEV 場景檢視證據

- `screenshots/lake-dev-390x844.png`：390×844 CSS viewport、DPR 3，PNG 1170×2532；SHA-256 `5823083745c78b9ec53afc7036c5d46f3e0b016768955a17321a59a2747823f8`。
- `screenshots/lake-dev-1280x720.png`：1280×720 CSS viewport、DPR 3，PNG 3840×2160；SHA-256 `015482d684fc4b0b36d1dfc68f00c0b063e8dc3d31b6c76b3ffe0da8c42cff08`。
- 兩張圖以隔離 Playwright context 載入 lake 測試存檔，使用 `renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1LakeVisual=p6-061`。這是 DEV 預覽證據，不是實機效能數據或正式素材核准。

## 產生與像素契約

來源圖由 OpenAI 內建 imagegen 依使用者接受的概念方向製作，並在本輪針對水面紋理及岸線做定向修訂；模型與授權細節未提供。Atlas 從 4×4 格線內各取 310×310 區域（格子起點為 1、315、628、942），避開生成圖格線，再以 FFmpeg nearest-neighbor 縮至 32×32，依 manifest 列序拼成 128×128。使用下列契約：原生 32 px、world tile 64 units、精確 2× nearest-neighbor。來源圖和 atlas 都保留在候選目錄供檢視與 hash 驗證；`water-open` 底格在裁切後以 FFmpeg 填為純色 `#1A6E90`，避免大量重複鋪設時出現規律波紋；其他水面與岸線格保留低頻變化和地物。候選仍未逐像素手工潤飾或完成所有拼接組合的無縫性驗收。

Frame 順序依 manifest 的 `frames` 列序：

1. 水面變化：平靜水紋、小波光、石影、睡蓮。
2. 四向單邊岸線：北、東、南、西。
3. 岸線組合與淺水：西北角、環形灣、淺灘石、東北角。
4. 草岸蘆葦、淺水卵石、蘆葦叢與裝飾漣漪。

## 執行邊界

- 遊戲內預覽只在 DEV、pixel32 runtime 與明確的湖岸候選 query 同時啟用時讀取候選圖。
- 候選只繪製 `lake.json` 現有 grass/path/water 鄰接；地圖 schema、碰撞、移動、釣魚判定、存檔與正式素材 manifest 維持原狀。
- 漣漪 frame 為靜態視覺樣本，不代表可釣位置或新釣魚規則。
- 本版水面基底刻意降低波紋頻率與亮點密度；岸線格仍需以實際 DEV 畫面檢查重複節奏、接縫、顏色與邊緣可讀性。
- 使用者必須檢視 `atlas.png` 與上列 atlas SHA-256，正式素材整合才可進行。接受視覺方向不等於核准確切素材。

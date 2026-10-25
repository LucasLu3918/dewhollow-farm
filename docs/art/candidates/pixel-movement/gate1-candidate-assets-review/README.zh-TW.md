# Pixel32 候選素材同場景檢視

> **狀態：DEV-only 候選證據；不是美術核准或 Gate 1 通過。** 只有 `status: candidate`、`approved: false` 的 atlas 會在精確 query opt-in 下載入；production 會忽略這些 query 且不請求候選圖。

## 證據截圖

以下兩張圖以同一個隔離的 1280×900 Chromium context 與固定 farm 存檔擷取，DPR 1、CSS 尺寸。第一張呈現 22 個候選畫格；第二張隱藏檢視板，顯示 farm MapScene 中實際使用的甜蘿蔔 seed／sprout／mature 候選和未覆蓋作物 fallback。

![Pixel32 crop、pet、tool 與物件候選接觸表](/Users/lucas/Coding/main/dewhollow-farm/docs/art/candidates/pixel-movement/gate1-candidate-assets-review/screenshots/candidate-assets-1280x900.png)

![固定 farm 場景中的甜蘿蔔候選與非候選作物 fallback](/Users/lucas/Coding/main/dewhollow-farm/docs/art/candidates/pixel-movement/gate1-candidate-assets-review/screenshots/farm-candidate-crops-1280x900.png)

`evidence.json` 記錄 capture provider／時間／source revision、manifest 與 atlas SHA-256、每個可見 frame 的 SHA-256、請求清單、console 訊息與截圖 SHA-256。

## 畫格範圍

- 作物：甜蘿蔔 `seed`、`sprout`、`mature`；其他作物維持正式素材 fallback。
- 寵物：cat 與 quokka 的四向 idle 畫格；僅作靜態方向預覽，不接跟隨或動作行為。
- 工具：hoe、can、seedbag、axe、pick、rod、sickle 的 held-preview 畫格；不代表角色握持、揮動或碰撞整合。
- 物件：門與出貨箱的 open／closed 靜態候選；不綁定世界狀態或互動。

精確 DEV URL：`?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1AssetPreview=pixel32-candidates`。

審核限制：這是單一 desktop viewport 的 Chromium CSS-scale 證據；沒有原生 DPR raster、iOS／Android 實機、人工可讀性／接縫／腳錨分數，也沒有對任何確切 PNG hash 的使用者核准。候選不寫入 `content/assets.json`、`public/` 或正式遊戲行為。

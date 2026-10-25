# Pixel32 候選素材同場景檢視

> **狀態：DEV-only 候選證據；不是美術核准或 Gate 1 通過。** 候選 manifest 維持 `status: candidate`、`approved: false`；production 不載入這些檔案。

## viewport／DPR 證據

固定 farm 存檔與同一組候選素材，在五種 Chromium viewport 及 DPR 1／2／3 各擷取一張接觸表與一張 farm 作物場景，共 30 張 CSS-scale 截圖。完整尺寸、camera／canvas 量測、請求狀態、輸入檔 SHA-256、截圖 SHA-256 與限制見 [`matrix.json`](matrix.json)。

| viewport | 候選接觸表（DPR 1） | farm 作物（DPR 1） |
|---|---|---|
| 手機直式 390×844 | [檢視](screenshots/phone-portrait-390x844-dpr-1-candidate-board.png) | [檢視](screenshots/phone-portrait-390x844-dpr-1-farm-crops.png) |
| 手機橫式 844×390 | [檢視](screenshots/phone-landscape-844x390-dpr-1-candidate-board.png) | [檢視](screenshots/phone-landscape-844x390-dpr-1-farm-crops.png) |
| 平板直式 768×1024 | [檢視](screenshots/tablet-portrait-768x1024-dpr-1-candidate-board.png) | [檢視](screenshots/tablet-portrait-768x1024-dpr-1-farm-crops.png) |
| 桌面 1280×720 | [檢視](screenshots/desktop-landscape-1280x720-dpr-1-candidate-board.png) | [檢視](screenshots/desktop-landscape-1280x720-dpr-1-farm-crops.png) |
| 桌面 Full HD 1920×1080 | [檢視](screenshots/desktop-fullhd-1920x1080-dpr-1-candidate-board.png) | [檢視](screenshots/desktop-fullhd-1920x1080-dpr-1-farm-crops.png) |

![手機橫向候選素材接觸表](/Users/lucas/Coding/main/dewhollow-farm/docs/art/candidates/pixel-movement/gate1-candidate-assets-review/screenshots/phone-landscape-844x390-dpr-1-candidate-board.png)

![固定 farm 場景中的甜蘿蔔候選與正式素材 fallback](/Users/lucas/Coding/main/dewhollow-farm/docs/art/candidates/pixel-movement/gate1-candidate-assets-review/screenshots/phone-portrait-390x844-dpr-1-farm-crops.png)

## 畫格範圍與限制

- 作物：甜蘿蔔 `seed`、`sprout`、`mature`；其他作物維持正式素材 fallback。
- 寵物：cat 與 quokka 四向 idle 畫格；只作靜態方向預覽，不接跟隨或動作行為。
- 工具：hoe、can、seedbag、axe、pick、rod、sickle 的 held-preview 畫格；不代表角色握持、揮動或碰撞整合。
- 物件：門與出貨箱的 open／closed 靜態候選；不綁定世界狀態或互動。
- DPR 由 Chromium 模擬，截圖以 CSS 尺寸輸出；不代表原生 DPR raster、iOS／Android 實機或裝置效能證據。
- 截圖及素材雜湊只供人眼審閱和重現，不構成任何確切素材 SHA 的核准。
- 候選不寫入 `content/assets.json`、`public/` 或正式遊戲行為。

精確 DEV URL：`?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1AssetPreview=pixel32-candidates`。

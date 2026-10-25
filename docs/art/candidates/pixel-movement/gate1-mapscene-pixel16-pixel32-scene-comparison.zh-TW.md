# Gate 1 pixel16／pixel32 同場景局部覆蓋比較

## 結論與範圍

本次在同一份隔離 farm 存檔、MapScene、viewport 與 camera 下，分別擷取 pixel16 與 pixel32 候選遊戲畫面。這是**局部覆蓋基線**，用來顯示既有候選素材在相同遊戲狀態中的實際畫面來源；素材覆蓋度不同，因此不能作為整體美術 A/B 評分或 Gate 1 通過證據。

兩個 Chromium context 都使用 1280×900 viewport、DPR 1、v13 farm fixture、玩家 `(5,5)`、春季第 4 天及三階甜蘿蔔。兩者 camera 都顯示 17×13 格；遊戲區截圖均為 824×617 CSS pixels。每個 context 各自建立瀏覽器 IndexedDB，不讀寫使用者存檔。

## 畫面與量測

| Profile | 候選內容 | 遊戲區截圖 | 主要未覆蓋項目 |
|---|---|---|---|
| pixel16 | 8bit atlas：grass、tilled、road、houseEdge、fence、甜蘿蔔三階；原生 16×16 圖格等比繪至 64 px 世界格 | [pixel16-game.png](./gate1-mapscene-pixel16-pixel32-scene-comparison/screenshots/pixel16-game.png) | 主角、寵物、土壤、門與出貨箱沿用既有素材 |
| pixel32 | 專用 32 px 地圖候選：季節草地、田地鄰接遮罩、道路；玩家使用四向候選動畫；另有 house-back、house-front、tree-canopy overlay | [pixel32-game.png](./gate1-mapscene-pixel16-pixel32-scene-comparison/screenshots/pixel32-game.png) | 作物、寵物、門、出貨箱、土壤及部分牆／柵欄沿用既有素材 |

上表的素材來源來自實際 render sprite texture/frame 計數與 pixel32 runtime／overlay diagnostics。pixel16 共記錄 1,224 個候選 atlas sprites；pixel32 記錄 1,047 個專用 map atlas sprites，另由 runtime 回報 down-idle 玩家 frame 及 3 個可見 overlay。這些數量描述目前 fixture 的渲染項目，不是品質分數。

候選資產載入各自成功，request failure、HTTP error 與 page error 均為 0。完整畫面來源、camera、候選請求、PNG 與輸入檔 SHA-256 見 [evidence.json](./gate1-mapscene-pixel16-pixel32-scene-comparison/evidence.json)。

## 候選狀態與限制

- gate1-assets/manifest.json 與 pixel32 map／animation manifests 均維持 status: candidate、approved: false；沒有修改 manifest 或素材。
- runtime evidence 直接記錄 pixel32 玩家 `down-idle` frame 與 Image 可見狀態；pixel16 未啟用此玩家候選。
- pixel32 專用地圖包含季節與 autotile 影格、屋頂多層與樹冠前景；pixel16 atlas 沒有等價影格。pixel16 本次也沒有主角或夥伴的完整動畫候選。故場景差異同時反映素材覆蓋與既有 fallback，不能單獨歸因於像素尺度。
- 測量只涵蓋單一 1280×900／DPR 1 viewport。截圖是 Chromium CSS-scale 輸出，不代表原生 iOS／Android raster、效能、接縫／閃爍人工評分或確切素材核准。
- MapScene 僅擴充 DEV-only diagnostics 以記錄候選玩家 Image 可見狀態；未改遊戲規則、地圖、碰撞、存檔 schema、content/assets.json 或正式 public/。Gate 1 與實機狀態仍未通過／DEVICE_PENDING。

## 重現

SAVE_GATE1_PIXEL_PROFILE_COMPARISON_EVIDENCE=1 npm run test:e2e -- --grep "matched partial-coverage pixel16 and pixel32 farm comparison"

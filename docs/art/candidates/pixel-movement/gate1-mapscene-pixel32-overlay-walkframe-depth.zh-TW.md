# DF-G1｜pixel32 overlay 移動幀與深度交錯證據

## 結果

在 DEV-only pixel32 `MapScene` 以 Chromium 執行專項 E2E。測試逐格移動並逐 `requestAnimationFrame` 讀取玩家動畫幀、移動狀態、腳底 Y 座標、角色深度，以及樹冠／房屋前景深度。

| 穿越位置 | 路線 | 移動中 walk frame | 錨點兩側觀測 |
|---|---|---|---|
| 樹冠 | `(8,3) → (8,5)`，向南 | `down-contact-a`、`down-contact-b`、`down-passing` | 錨點附近移動樣本：Y 319.209、depth 14.9886、在樹冠後方；另一側移動樣本 Y 334.205、depth 15.2230、在樹冠前方 |
| 房屋前景 | `(5,5) → (5,3)`，向北 | `up-contact-a`、`up-contact-b`、`up-passing` | 錨點附近移動樣本：Y 320.091、depth 15.0024、在房屋前方；另一側移動樣本 Y 312.897、depth 14.8900、在房屋後方 |

兩個 overlay depth 均為 `15.002`。本次樹冠穿越收集 17 筆樣本（15 筆移動中），房屋穿越收集 19 筆（17 筆移動中）；樣本包含步進後半段至 idle。錨點附近的同一筆移動樣本為方向 walk frame，距 Y=320 小於 1 px，且角色 depth 距 overlay depth 小於 `0.02`。兩段路線皆未被阻擋。三個 overlay 的 ID、frame、layer、位置、depth、display-list 與可見狀態在全部樣本中一致。

## 證據

- [完整逐幀資料與候選輸入 SHA-256](./gate1-mapscene-pixel32-overlay-walkframe-depth/evidence.json)
- [樹冠穿越後場景](./gate1-mapscene-pixel32-overlay-walkframe-depth/screenshots/tree-crossing.png) — SHA-256 `b3169b054489af8b81491e5fa6fd40ebb3723ee2a9bb94171c800e431960151e`
- [房屋穿越後場景](./gate1-mapscene-pixel32-overlay-walkframe-depth/screenshots/house-crossing.png) — SHA-256 `22096b630f17704fa0727045d109d82cf4e4ec05bc55c9a3793a62cf7e303889`
- 專項 E2E：1/1 通過；viewport `1280×900`、Chromium DPR 1、CSS-scale 截圖。

地圖與動畫 manifest 都維持 `status: candidate`、`approved: false`。證據只代表這條 DEV-only Chromium 路線的移動幀與數值深度排序，不代表逐像素遮擋品質、美術核准、原生 iOS／Android 表現或 Gate 1 通過。完整 12×10 場景與 Gate 1 審核仍待完成。

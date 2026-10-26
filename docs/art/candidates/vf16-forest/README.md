# VF-16 森林格線素材候選

**狀態：candidate only，未核准進入遊戲。** 本組素材是 24×16 森林地圖的格線素材提案，不是可直接替換的場景全景圖。任何正式整合都需先核准下表每一個正式候選 PNG 的確切 SHA-256。

## 審查圖

- [地表 4×4 重複接縫檢視](tile-repeat-review.png)
- [依現有森林地圖繪製的格線參考](forest-grid-reference.png)
- [透明物件在實際格數的尺寸檢視](overlay-scale-review.png)
- [尺寸、alpha、SHA-256 與接縫量測](validation.json)

格線參考直接讀取 `content/maps/forest.json`：地圖為 24×16；農場出口 W 在 `(0,7)`、湖畔出口 L 在 `(23,6)`、礦坑入口 N 在 `(12,0)`。圖片標出既有字元位置，只供素材對位審查，沒有改寫 map JSON、碰撞、路徑或互動資料。

## 正式候選檔

地表是 64 px 格子的 2× 母版（128×128 RGBA）；樹是視覺佔 2×2 格的透明 overlay（256×256 RGBA）；岩石是 1×1 格透明 overlay（128×128 RGBA）。樹的錨點與地圖實際佔格、遮擋深度仍待 runtime 整合時確認。

| 類別 | 候選路徑 | 尺寸／alpha | SHA-256 |
|---|---|---|---|
| 林間草地 | `tiles/ground-grass-2x.png` | 128×128 RGBA；全不透明 | `839c2cfd2de5c063a8b12933beffa42f27647381a8b765d90e90ce6c25f1b1c5` |
| 石土小徑 | `tiles/ground-path-v2-2x.png` | 128×128 RGBA；全不透明 | `d697f250602cbb1f4f1b2755cce6e58876e451ef977864dbdef47badff09e00e` |
| 陰影苔地 | `tiles/ground-moss-v2-2x.png` | 128×128 RGBA；全不透明 | `eb2d1e1037ee2d67b4122f05a1845a36c9f9904ede10d72f875698a2b06516f7` |
| 林木 | `tiles/forest-tree-v2-4x.png` | 256×256 RGBA；alpha bbox `(20,24,237,237)` | `d9a43c1d9a6fa1948dc30e25fb6a164b6578ef207186cf727c0bb22d8f24e10c` |
| 苔岩 | `tiles/forest-rocks-v2-2x.png` | 128×128 RGBA；alpha bbox `(11,16,110,114)` | `5928ba117c42b5f1b334f93771cf079724452def76f19a9dd8b8295df9363171` |

上述 alpha bbox 的右、下座標採 Pillow 慣例，不包含該座標像素。透明 overlay 的 alpha extrema 為 `(0,255)`。

## 生成與處理

使用 Codex 內建 imagegen，各別生成地表、林木及岩石；每張只以已核准的 `scene-candidate-farm-20261026.png`（SHA-256 `9380f9d48882c60dedd55127dc25073dcedacf88bce0e12265659c6c3b604f76`）參考像素群、輪廓與色彩處理，不複製原場景配置。原始輸出保存在 `source/`；工具未提供可查證的模型名稱或授權條款。

- 草地：苔綠林間地表，均勻分布細小葉簇與少量淺色草花；不含物件。
- 石土路：赭色土面、疏落不規則扁石；避免中央焦點。
- 陰影苔地：較深的松綠苔地、蕨葉與少量落葉；從獨立生成母圖製作，再降低亮度 20% 作林蔭變體。
- 林木：正上方樹冠與底部中央樹幹，透明背景，預期視覺佔 2×2 格。
- 苔岩：單格橫向三石群，透明背景。

三種地表用專案 `tools/art/tile_finalize.py --seamless` 作接縫混色並 nearest-neighbor 輸出 128×128；樹與岩石以 nearest-neighbor 縮放置於透明畫布。原始圖與處理後候選皆保存在此目錄，完整檔案尺寸、模式、alpha bbox、hash 與量測值見 `validation.json`。

## 驗證與限制

- 讀取實際 `forest.json` 並斷言 24×16 尺寸及三個出口座標；格線參考圖以相同 rows 繪製，沒有手動挪動出口或路徑。
- 三張地表皆為 128×128 RGBA 且全不透明；樹／岩石輸出皆為透明 RGBA，alpha 含 0 與 255。
- 對 128 px 候選的重複接縫檢查，比較首末邊界像素跳變與 tile 內部相鄰像素跳變；水平與垂直比值皆為 `1.00`。這表示 finalizer 混色後，接縫沒有高於內部的跳變；**不代表首末邊界像素完全相等**。4×4 nearest-neighbor 接觸表可檢視重複時的視覺效果；長距離鋪設仍可能看出圖樣週期。
- 64×64 縮圖中，路徑與草地用途可分辨，陰影苔地以較低亮度提供林下變化。地表紋理仍偏細密，需在遊戲實際攝影機倍率審核是否過於繁複。
- 未在 Phaser／遊戲 renderer 中試放；未驗證樹木遮擋排序、錨點與碰撞配合、異常出口路徑、行動裝置表現或不同 renderer。這些圖不可解讀成 runtime 驗收。
- 未變更 `public/`、`content/assets.json`、`content/maps/`、PWA 清單或任何 runtime 程式。候選仍須逐檔 hash 核准後，才可另開素材整合變更。

# Gate 1 原生像素網格候選

> **狀態：pixel32／16-bit 方向已選定；候選素材仍未核准。** 這些是供 Gate 1 A/B 場景預覽使用的原創像素候選稿，不是正式遊戲素材；Gate 1 尚未完成。

## 檔案

- `8bit.png`：A 候選圖集，64×96 像素，16×16 地形格；角色畫格 16×24。
- `16bit.png`：B 候選圖集，128×192 像素，32×32 地形格；主角畫格 32×48。
- `manifest.json`：版本化候選 ID、圖集路徑、15 個固定 key 的 atlas source rect、原生尺寸、格尺寸、foot anchor、pivot、tags 和每格 canonical RGBA SHA-256。
- `DF-ART-02-PIXEL32-SPEC.zh-TW.md`：32px 網格、座標、atlas cell、pivot/foot anchor 與 checker 驗收範圍。
- `tools/art/check_gate1_assets.mjs`：唯讀檢查候選規格、atlas PNG 與來源 hash。
- `palette.json`：兩套候選色票。
- `generate.mjs`：以逐像素整數圖元繪製候選並輸出 RGBA PNG；沒有縮放既有素材或外部參考圖。
- [`integrated-preview.html`](./integrated-preview.html)：在固定展示場景中合成四向動畫與四季地圖候選，供同場檢視；不接正式遊戲狀態或素材清單。

固定 keys：`grass`, `tilled`, `road`, `tree`, `cropSeed`, `cropSprout`, `cropMature`, `houseEdge`, `fence`, `playerIdle`, `playerWalk`, `cat`, `quokka`, `tool`, `shadow`。`playerWalk` 目前只有一張靜態姿勢樣張，不代表動畫循環。`cat` 和 `quokka` 都是俯視小型四足寵物的單幀樣張。

候選 atlas 以透明背景儲存；預覽端使用最近鄰取樣，依 `manifest.json` 的 frame rect 裁切。圖集固定 4 欄，每個來源格採原生尺寸儲存；不要把預覽放大後當成實際顯示辨識度驗收。

## 重現與核對

同場檢視動畫和地圖候選：[開啟整合預覽](./integrated-preview.html)。

在專案根目錄執行以下命令可重新產生候選檔，或檢查目前檔案：

```bash
node docs/art/candidates/pixel-movement/gate1-assets/generate.mjs
npm run assets:gate1:check
```


更完整的格式定義與 checker 限制見 [DF-ART-02 pixel32 規格](DF-ART-02-PIXEL32-SPEC.zh-TW.md)。

候選檔只寫入本目錄。不可把它們當成核准素材，也不可加入正式 `public/` 或 `content/assets.json`；每次修改候選都應重新產生並審閱對應雜湊。

整合預覽只用於查看兩組候選在同一個 15×9 示範畫面中的配色、步態與遮擋。它不是正式 Phaser runtime，也不取代 Gate 1 所需的同一份遊戲地圖、農務操作、完整 viewport／DPR 或實機驗收。

## 尚缺 Gate 1 證據

目前只有 tiles 與核心角色／寵物的少量靜態樣張。仍需整合到同一份 12×10 固定農場資料，完成地形接縫和組合檢查、四方向動作與 10 格移動錄影、農地操作、遮擋、寵物跟隨，以及指定 5 種 viewport × DPR 1/2/3 的遊戲畫面。主角只有向下 idle／walk 姿勢，沒有完整方向與動畫影格；三階作物目前是透明覆蓋樣張；樹、房屋、柵欄、工具、陰影亦只供場景組合初看。未做真實手機辨識度或效能測試。

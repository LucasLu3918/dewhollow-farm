# Gate 1 原生像素網格候選

> **狀態：candidate／未核准。** 這些是供 Gate 1 A/B 場景預覽使用的原創像素候選稿，不是正式遊戲素材。尚未由使用者選定風格，也未完成 Gate 1 驗收。

## 檔案

- `8bit.png`：A 候選圖集，64×96 像素，16×16 地形格；角色畫格 16×24。
- `16bit.png`：B 候選圖集，128×192 像素，32×32 地形格；主角畫格 32×48。
- `manifest.json`：候選 ID、圖集路徑、15 個固定 key 的 atlas source rect、原生尺寸、格尺寸、腳底 anchor 和每格 SHA-256。
- `palette.json`：兩套候選色票。
- `generate.mjs`：以逐像素整數圖元繪製候選並輸出 RGBA PNG；沒有縮放既有素材或外部參考圖。

固定 keys：`grass`, `tilled`, `road`, `tree`, `cropSeed`, `cropSprout`, `cropMature`, `houseEdge`, `fence`, `playerIdle`, `playerWalk`, `cat`, `quokka`, `tool`, `shadow`。`playerWalk` 目前只有一張靜態姿勢樣張，不代表動畫循環。`cat` 和 `quokka` 都是俯視小型四足寵物的單幀樣張。

候選 atlas 以透明背景儲存；預覽端使用最近鄰取樣，依 `manifest.json` 的 frame rect 裁切。圖集固定 4 欄，每個來源格採原生尺寸儲存；不要把預覽放大後當成實際顯示辨識度驗收。

## 重現與核對

在專案根目錄執行：

```bash
node docs/art/candidates/pixel-movement/gate1-assets/generate.mjs
```

可用下列 Node 命令核對圖集 SHA-256 與 PNG IHDR 尺寸是否吻合 manifest：

```bash
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const root="docs/art/candidates/pixel-movement/gate1-assets"; const m=JSON.parse(fs.readFileSync(`${root}/manifest.json`)); for (const c of m.candidates) { const b=fs.readFileSync(`${root}/${c.atlas}`); const hash=crypto.createHash("sha256").update(b).digest("hex"); const w=b.readUInt32BE(16), h=b.readUInt32BE(20); if(hash!==c.sha256 || w!==c.atlasWidth || h!==c.atlasHeight) throw Error(`invalid ${c.id}`); console.log(`${c.id}: ${w}x${h}, sha256 ${hash}`); }'
```

候選檔只寫入本目錄。不可把它們當成核准素材，也不可加入正式 `public/` 或 `content/assets.json`；每次修改候選都應重新產生並審閱對應雜湊。

## 尚缺 Gate 1 證據

目前只有 tiles 與核心角色／寵物的少量靜態樣張。仍需整合到同一份 12×10 固定農場資料，完成地形接縫和組合檢查、四方向動作與 10 格移動錄影、農地操作、遮擋、寵物跟隨，以及指定 5 種 viewport × DPR 1/2/3 的遊戲畫面。主角只有向下 idle／walk 姿勢，沒有完整方向與動畫影格；三階作物目前是透明覆蓋樣張；樹、房屋、柵欄、工具、陰影亦只供場景組合初看。未做真實手機辨識度或效能測試。

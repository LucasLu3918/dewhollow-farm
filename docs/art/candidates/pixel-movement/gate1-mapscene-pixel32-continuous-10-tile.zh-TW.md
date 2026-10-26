# DF-G1-CONTINUOUS-10-TILE-CHROMIUM-EVIDENCE

## 結果

在 DEV-only pixel32 farm `MapScene` 中，以 Chromium 對玩家分別向右、下、左、上持續按住方向鍵，逐方向完成 10 格連續移動。每一方向均記錄 10 次相鄰 tile commit、按鍵事件、逐 RAF 移動狀態／候選動畫 frame／角色 pose／腳底錨點；第 5 格時擷取按住畫面，放開按鍵並等待停止後再擷取畫面。

| 方向 | 起點 | 終點 | commits | 移動 frame 樣本 | 畫面證據 |
|---|---:|---:|---:|---:|---|
| 右 | (15, 15) | (25, 15) | 10 | 86 | [按住](gate1-mapscene-pixel32-continuous-10-tile/screenshots/right-held-5-tiles.png)／[放開](gate1-mapscene-pixel32-continuous-10-tile/screenshots/right-after-release.png) |
| 下 | (15, 15) | (15, 25) | 10 | 87 | [按住](gate1-mapscene-pixel32-continuous-10-tile/screenshots/down-held-5-tiles.png)／[放開](gate1-mapscene-pixel32-continuous-10-tile/screenshots/down-after-release.png) |
| 左 | (15, 15) | (5, 15) | 10 | 87 | [按住](gate1-mapscene-pixel32-continuous-10-tile/screenshots/left-held-5-tiles.png)／[放開](gate1-mapscene-pixel32-continuous-10-tile/screenshots/left-after-release.png) |
| 上 | (15, 15) | (15, 5) | 10 | 85 | [按住](gate1-mapscene-pixel32-continuous-10-tile/screenshots/up-held-5-tiles.png)／[放開](gate1-mapscene-pixel32-continuous-10-tile/screenshots/up-after-release.png) |

完整時間線、commit 座標、frame、pose 與足底座標分方向保存在 [`evidence-right.json`](gate1-mapscene-pixel32-continuous-10-tile/evidence-right.json)、[`evidence-down.json`](gate1-mapscene-pixel32-continuous-10-tile/evidence-down.json)、[`evidence-left.json`](gate1-mapscene-pixel32-continuous-10-tile/evidence-left.json)、[`evidence-up.json`](gate1-mapscene-pixel32-continuous-10-tile/evidence-up.json)。每份紀錄都包含一個 keydown 與 keyup；停止後再觀察 500 ms，沒有額外 tile commit。8 張截圖皆為 1280×720、Chromium DPR 1。

## 驗證

專項 E2E 4/4 通過。產生證據的命令：

```bash
SAVE_GATE1_CONTINUOUS_10_TILE_EVIDENCE=1 npm run test:e2e -- tests/e2e/gate1-mapscene-pixel32-continuous-10-tile.spec.ts --project=chromium --reporter=line
```

## 限制與 gate 狀態

這是瀏覽器合成輸入與 CSS-scale 截圖；commit 時間是瀏覽器端觀測，不是實機輸入延遲或 FPS 量測。frame／pose／腳底取樣不判定動作觀感、美術品質、圖塊接縫或腳錨是否通過人工標準。候選仍為 `candidate`／`approved: false`；三位觀察者盲測、原生 iOS／Android 驗證及 Gate 1 人工驗收維持待完成。

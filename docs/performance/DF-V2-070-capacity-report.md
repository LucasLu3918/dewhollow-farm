# DF-V2-070 載入容量報告

本報告分開呈現遊戲啟動時由 `content/assets.json` 宣告載入的素材預算，以及 Service Worker 安裝時依 `dist/sw.js` 實際 URL 清單預快取的完整回應大小。兩者用途不同，不能互相代替。

## 本次建置量測

量測命令：`npm run build && npm run budget`。建置使用專案鎖定的 Node/Vite 工具鏈；容量是 `dist/` 回應檔的原始位元組，不是實際網路傳輸量，也不包含瀏覽器額外快取索引成本。

| 範圍 | 項目 | URL／路徑數 | 原始大小 | gzip 估算 |
|---|---|---:|---:|---:|
| 遊戲啟動預算 | HTML、入口與靜態 JS chunk、CSS、manifest、Service Worker、`content/assets.json` 宣告素材 | 依 build graph 去重 | 3,317,469 bytes | 1,750,448 bytes |
| PWA 完整預快取 | `dist/sw.js` 的 `PRECACHE_URLS`；根路徑與 `index.html` 是兩個快取 URL，因此分別計算 | 93 URL／92 個不同 dist 路徑 | 15,958,759 bytes | 14,159,767 bytes |

啟動預算上限仍是 8,000,000 原始 bytes，且本次低於上限。PWA 完整預快取總量包含啟動預算之外的公開檔案；專案目前沒有對此總量設定上限。gzip 欄是逐檔 gzip 後相加的比較估算，不是 HTTP 傳輸量或 Cache Storage 實際用量。

完整預快取中較大的回應：

| 路徑 | 原始 bytes |
|---|---:|
| `assets/items/wood.png` | 2,468,844 |
| `assets/items/stew.png` | 2,327,470 |
| `assets/items/ore.png` | 2,229,302 |
| `assets/items/seed-bag.png` | 2,216,277 |
| `assets/items/sweet-turnip.png` | 1,730,439 |
| `assets/items/fish.png` | 1,506,988 |
| `assets/phaser-D8EC1TLR.js` | 1,374,100 |

六張獨立物品圖共 12,479,320 bytes。這次沒有改寫圖片：尚未選定可驗證像素逐點相同的無損編碼器／流程，避免把「無損」當成未驗證假設。候選圖集、批次繪製與資源 preload/evict 架構也未變更。

## 實機效能狀態

`docs/DEVICE_PERF.md` 的 iPhone Safari 與中階 Android Chrome 實機量測仍為 `DEVICE_PENDING`。桌機建置大小與桌面瀏覽器測試不能代替真機 FPS、載入時間或電量／熱行為；本報告不宣稱實機已達標。完整 P7-070 實機載入與效能報告須在兩種實體裝置完成文件要求的量測後更新。

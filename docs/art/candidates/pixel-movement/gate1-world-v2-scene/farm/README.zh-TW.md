# DF-V2-024｜農場場景候選素材

> **狀態：candidate，`approved: false`。** 這是 Pixel32 農場切片，僅供隔離的 DEV Phaser review。不得加入 `content/assets.json` 或正式 `public/`。

## 素材

- `atlas.png`：768×512 RGBA，32×32 原生像素網格；使用原創整數像素圖元產生，不含概念圖或外部素材。
- `manifest.json`：每幀記錄 atlas bounds、角色錨點、footprint、layer、可平鋪與核准狀態。
- `generate.mjs`：無額外依賴、固定種子的 atlas 與 manifest 產生器；相同來源可逐 byte 重現。

| Frame ID | 用途 | 尺寸／footprint | Layer |
|---|---|---:|---|
| `grass-base`, `grass-variant` | 草地基底與稀疏草簇變化 | 32×32／1×1 | ground |
| `path-center`, `path-edge`, `path-mask-00`–`path-mask-0f` | 道路十字、直向段與 N/E/S/W 連接遮罩 | 32×32／1×1 | ground |
| `soil-dry`, `soil-wet`, `field-mask-00`–`field-mask-0f` | 乾濕土與田地邊緣遮罩 | 32×32／1×1 | groundOverlay |
| `house-exterior` | 農舍屋頂、木牆、窗戶、門與暖光窗格 | 160×96／5×3 | back |
| `house-front` | 前廊、柱與門階遮擋 | 160×32／5×1 | front |
| `tree-canopy` | 樹冠、樹幹與接地影 | 96×96／3×3 | front |
| `shipping-crate` | 出貨木箱候選 | 32×32／1×1 | object |
| `stone-wall` | 農場外圍石牆 | 32×32／1×1 | object |
| `fence-horizontal`, `fence-vertical`, `fence-north-east/north-west/south-east/south-west` | greenhouse 木欄與四角方向 | 32×32／1×1 | object |
| `farm-ground-shadow` | 半透明橢圓接地影 | 32×16／1×0.5 | shadow |

## 產生與檢查

在專案根目錄執行：

```bash
node docs/art/candidates/pixel-movement/gate1-world-v2-scene/farm/generate.mjs
```

輸出保持在本目錄。Manifest 的 `source.generatorSha256` 和 `atlas.sha256` 綁定實際來源與圖集；產生器使用 deterministic stored-DEFLATE PNG 編碼。

## 像素契約與限制

- 32×32 原生 tile、64 世界單位、精確 2× nearest-neighbor 顯示；不使用平滑縮放。
- 色票與上左暖光依 `docs/art/world-v2/ART_BIBLE.md` 的提案。候選色票尚未獲准。
- 草地、基本道路填色、乾土、濕土 frame 保留一致的基色邊界，可做 RGBA wrap seam 驗證；路徑、田地與欄杆需由 Phaser 依鄰格方向選 frame。
- 建物、樹冠與出貨箱只提供視覺 bounds、pivot、foot anchor、layer 與建議 footprint；不改 map collision、spawn、傳送、互動或存檔座標。
- 此批不含完整季節、農作物、角色、工具或全地圖覆蓋；不是 P2-024 的整場景驗收結果，也不代表可直接投入正式版。完整比例、接縫、遮擋、互動安全區與手機可讀性仍須真實 Phaser 畫面和人工 Gate 檢查。

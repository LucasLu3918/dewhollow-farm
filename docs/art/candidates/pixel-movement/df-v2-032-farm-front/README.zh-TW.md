# DF-V2-032｜農場前景補充候選素材

> **狀態：candidate，`approved: false`。** 僅供候選場景檢視；不是 production 素材，不得加入正式素材清單或正式 `public/`。

本包補足 P2 農場切片周邊可辨識的生活細節：信箱與農場牌、井與飲水槽、灌溉水桶、採收籃、雨水桶、灌木、田邊石塊、落葉、樹根邊、田界與小徑過渡。素材為獨立原創整數像素圖元，沒有把概念圖或第三方圖像放進 atlas。

## 檔案與像素契約

- `atlas.png`：512×128 RGBA8；每格依 32px 原生網格定位，2× 最近鄰顯示建議。
- `manifest.json`：frame bounds、role、layer、footprint、pivot、footAnchor、tileable、候選審核狀態及 SHA-256。
- `generate.mjs`：Node.js 內建模組產生器，不需額外套件；輸出只寫入本目錄。
- 色票沿用 [`ART_BIBLE.md`](../../../world-v2/ART_BIBLE.md) 與 P2 農場候選：草 `#648A53/#85AB67/#486745`、土 `#876047/#A67D57/#5B3C31`、木 `#C79B67/#AF8258/#6E503E`、屋頂 `#8B6459`、高光 `#F7D8A2`、冷影 `#566B68`、輪廓 `#382E2D`。

## Frame 對照

| Frame ID | 用途 | Bounds / footprint | Layer | 備註 |
|---|---|---:|---|---|
| `path-transition-horizontal`, `path-transition-vertical`, `path-transition-north/south/east/west` | 草地與土路短接段、端點 | 32×32／1×1 | ground | 方向變體，需依鄰格選取 |
| `field-boundary-north/east/south/west` | 田土邊緣方向 | 32×32／1×1 | groundOverlay | 視覺邊界，不是碰撞 |
| `root-edge-north`, `root-edge-south` | 草地、樹根與裸土交界 | 32×32／1×1 | groundOverlay | 可按場景方向拼接，尚未做完整四向 |
| `leaf-litter-a`, `leaf-litter-b` | 草地落葉小簇 | 32×16／1×0.5 | groundOverlay | 透明底、輕量散置 |
| `mailbox` | 農舍前信箱 | 32×48／1×1.5 | object | 腳點在底部中央 |
| `farm-sign` | 農場入口牌 | 32×48／1×1.5 | object | 留白牌面供純圖示辨識 |
| `well-water-point` | 石砌井與水點 | 64×64／2×2 | object | 含井架及水面 |
| `water-trough` | 長形飲水槽 | 64×32／2×1 | object | 水面有亮暗分層 |
| `shrub-a`, `shrub-b` | 低矮灌木及花簇 | 32×32／1×1 | front | 候選前景遮擋層 |
| `field-rock` | 田邊小石 | 32×32／1×1 | object | 接地陰影獨立讀形 |
| `watering-pail`, `harvest-basket`, `rain-barrel` | 農舍周邊小道具 | 32×32／1×1 | object | 生活感補件 |
| `field-boundary-hedge`, `field-boundary-stone` | 水平田界片段 | 32×32／1×1 | front / object | 可水平重複，端點需由場景補角 |

## 重現與驗證

在 repo 根目錄執行：

```bash
node docs/art/candidates/pixel-movement/df-v2-032-farm-front/generate.mjs
node --check docs/art/candidates/pixel-movement/df-v2-032-farm-front/generate.mjs
```

重跑產生器時，atlas 與 manifest 的 SHA-256 應保持一致。此包尚未接入 Phaser MapScene；完整接縫、角色遮擋、腳點比例、互動區與桌面／手機呈現需在實際候選場景檢視。`footprintTiles`、pivot 與 footAnchor 是美術定位建議，不改地圖、碰撞、互動或存檔資料。

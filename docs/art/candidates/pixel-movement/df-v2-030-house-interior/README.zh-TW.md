# DF-V2-030｜22×20 小屋室內素材候選

> 狀態：`candidate`，尚未核准，不能視為 production 素材。這是程式繪製的獨立像素素材候選，不會修改現有地圖、碰撞或遊戲內容。

## 視覺與尺寸合約

沿用 `docs/art/world-v2/ART_BIBLE.md` 的 Pixel32 提案：32×32 原生像素格、64 世界單位（2× 顯示）、nearest-neighbor、左上暖光、深棕細輪廓、寬色塊與暖木色票。素材由整數像素 primitive 碼繪；不是概念圖切片。Atlas 採 6 欄、每格保留 128×128 打包槽，所有 `rect` 都是原生像素座標；透明空白保留為 RGBA alpha 0。每幀 `sha256` 是依 row-major 順序串接該 frame 的 RGBA bytes（不含 atlas padding）；atlas hash 是輸出 PNG 完整 bytes 的 SHA-256。

## Frame 對照

| Frame ID | Layer | Footprint（tile） | 用途 |
|---|---|---:|---|
| `floor-a`, `floor-b` | ground | 1×1 | 可拼接木地板變體 |
| `wall-middle`, `wall-left-corner`, `wall-right-corner`, `wall-top`, `wall-bottom`, `wall-window` | back-wall | 1×1 | 牆段、轉角、頂／底收邊、窗牆 |
| `door-threshold` | object | 2×2 | 含門扇與門框的入口視覺件 |
| `rug`, `entry-mat` | ground-detail | 3×2、2×1 | 地面裝飾，不代表不可通行 |
| `bed`, `kitchen-counter`, `workbench` | object | 3×3、3×2、3×2 | 臥室、廚房及工作區 |
| `stove` | object | 1×2 | 廚房爐具 |
| `storage`, `wardrobe` | object | 2×3 | 開放式收納櫃、衣櫃 |
| `table`, `chair` | object | 2×2、1×2 | 用餐區家具 |
| `shoe-storage` | object | 2×2 | 入口鞋櫃 |
| `pet-bed`, `water-bowl` | object | 2×1、1×1 | 寵物休息與水碗 |
| `shelf-books` | back-wall-object | 2×2 | 書架與書本 |
| `plant` | object | 1×2 | 盆栽 |

每幀 manifest 都包含 `rect`、`bounds`、`layer`、`footprintTiles`、`pivot`、`footAnchor`、`sha256`、`candidate:true` 與 `approved:false`。家具 anchor 是來源 sprite 內的底部中央原生像素；整合端需以該座標對齊 tile/world 座標，並自行決定是否沿腳底 Y 排序。Footprint 僅為美術配置提示，不是碰撞設定。

## 22×20 配置提案

座標從左上 `(0,0)` 開始。入口位於南側 `x=10..11`；南北主動線為 `x=10..11, y=2..19`，東西交叉動線為 `x=2..19, y=9..10`，兩條路維持兩格寬。四個家具區域分別是臥室 `x=1..8,y=2..8`、廚房 `x=14..20,y=2..7`、工作與收納 `x=1..8,y=12..17`、用餐與休息 `x=14..20,y=12..17`。這些範圍、入口／動線與逐件 `anchorTile` 擺位明列在 manifest 的 `composition` 欄位，僅供視覺排版討論；不宣稱已符合現行 MapDef、碰撞或遊戲規則。家具應沿區域外側放置，保留交叉路徑及門口 approach；門檻與地墊是入口視覺標記，其 footprint 不應解讀為阻擋玩家的碰撞設定。

## 重現與自我檢查

在 repo 根目錄執行：

```sh
node --check docs/art/candidates/pixel-movement/df-v2-030-house-interior/generate.mjs
node docs/art/candidates/pixel-movement/df-v2-030-house-interior/generate.mjs
```

生成器不讀取外部輸入；相同 Node/zlib 環境下會輸出相同 PNG/manifest bytes。檢查項目：manifest frame ID 唯一、frame bounds 位於 atlas 內、所有 frame 為候選且 `approved:false`、foot anchor/pivot 在 bounds 內、RGBA frame hash 可由 atlas crop 重算、兩個地板的上下與左右邊緣一致、牆 tile 的左右邊緣一致。Atlas SHA-256：`28d397a2f6c9933f3c2e749f1cf9a0b3b676ba109bc7aa18b4c386e2e5acc0c7`。

## P3-031 候選呈現驗收

DEV 預覽使用 `?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1SceneVisual=world-v2-cozy` 明確啟用。renderer 將現有 `MapDef` 地板／牆格映射到本 pack，並依 `composition.placements` 及 frame `layer` 呈現家具；`house`、`house-wing`、`house-full` 共用此 22×20 presentation-only 配置。候選圖仍是 `approved:false`，正式素材清單、地圖資料、碰撞、互動、內容 JSON 與存檔均不受此預覽影響。地毯／書架置於角色後方，其他家具依腳底 Y 排序。

Playwright 驗收：`tests/e2e/world-v2-candidate-scene.spec.ts` 通過，檢查 opt-in 資產載入、完整家具 placement、牆與家具分層、玩家進出地圖、場景清理與遊戲狀態不變。手機圖是玩家在室內中段的實際視角，22×20 房間寬於手機可視範圍；桌面圖以較大瀏覽器視窗檢視較多配置。實際圖檔尺寸及 SHA-256 見 `evidence.json`。截圖為候選視覺檢查材料，尚非正式素材核准。

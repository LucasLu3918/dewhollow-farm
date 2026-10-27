# VF-02 背包與場景 A/B 候選

狀態：使用者已選定場景方向 **B**（`candidate-b-scenes.png`）；A 不採用。六款繪本風物品圖示已於 2026-10-26 逐一核准並整合（詳見 [`docs/art/asset-review.md`](../../asset-review.md)）；場景 B 圖仍是候選素材，尚未核准整合。日期：2026-10-26。

開啟 [`index.html`](index.html) 檢視受控農場／村莊 A/B 場景、桌機背包與選中道具詳情、390×844 直式和 844×390 橫式。候選 PNG 只作氛圍靈感，不參與幾何／zoom 對照。

## 場景方向

- **A｜保守高精修（不採用）**：降低草地對比、明確處理田地及道路邊緣，只作受控比較基線。
- **B｜層次更強／細節更密（使用者選定）**：增加近景樹木、圍籬、石砌高差及建物簷影。`candidate-b-scenes.png` 使用者選定 SHA-256：`f6f00f49c4b62faf8bde0783ace0a72e4521eb885ebec099724edbdfbdea9dec`。此選擇表示採用 B 的場景方向；素材仍需逐項核准。

## 受控地圖與鏡頭設定

- `index.html` 的 A/B 場景對照共用兩份 SVG 定義：`<symbol id="farm-map">` 與 `<symbol id="village-map">`，四個 view 都以 `<use>` 重用同一份幾何、座標、地標和遮擋順序。
- 四個 view 都固定 `viewBox="0 0 640 360"`，同為 16:9；配對卡片用相同 grid 欄寬和 CSS 規則，沒有各自 SVG transform、縮放或平移。640×360 是共同向量畫框，不宣稱對應 Phaser 世界座標或實際 64 px tile。
- 農場固定棚屋、3×3 農地、主路徑、大樹與南側圍欄；村莊固定中央水槽、東西兩間店屋、十字主路徑與南側樹池。A/B 僅切換色票、輪廓／細節線寬與同一物件群陰影。
- 這是鎖定幾何和畫框比例的靜態向量風格研究，非 Phaser renderer 截圖，也不宣稱已驗證實際遊戲相機 zoom。遊戲內 zoom 驗證仍需同一地圖匯入 renderer，並保存相機參數與原始截圖。

## 場景 B 像素美術候選（VF-11）

使用者已選擇場景美術方向 **B｜強層次／高細節**。以下兩張是原創場景候選，狀態皆為 `candidate`，尚未核准作為正式素材；方向選擇與本候選板都不等於個別檔案的 production/import approval。相對地標參考既有靜態研究：農場棚屋、3×3 農地、主路徑、大樹、南側圍籬；村莊中央水槽、西／東店屋、十字道路、南側樹池。圖片只供比較視覺，不提供格子、相機、碰撞或導航資料，也沒有改動地圖。

| 場景 | 候選檔 | 尺寸／格式 | alpha | SHA-256 |
|---|---|---:|---|---|
| 農場 | `scene-candidate-farm-20261026.png` | 1672×941，8-bit RGBA | 全不透明（alpha 255） | `9380f9d48882c60dedd55127dc25073dcedacf88bce0e12265659c6c3b604f76` |
| 村莊 | `scene-candidate-village-20261026.png` | 1672×941，8-bit RGBA | 全不透明（alpha 255） | `6fbb4baffe30c2cd0ac7b4da7ffcaa2825d0699928e74ba1fc2fe58c88f115de` |

來源：Codex 內建 imagegen 分別生成農場與村莊，再以內建 imagegen 對農場做一次像素群風格修整。可查證到生成工具為 Codex 內建 imagegen；該工具沒有提供可查證的模型名稱或授權條款。原始輸出是 RGB；候選檔以 FFmpeg `format=rgba` 轉成 8-bit RGBA，沒有改尺寸或場景像素，alpha 全設為 255。生成來源／工具本身及可確認的條款資訊不足以構成發布授權審核；因此保留 `candidate`，上正式素材前仍需逐檔核准。

實際以 nearest-neighbor 產生並檢視 64×36 與 96×54 縮圖（只作檢視，衍生檔未入庫）：64×36 尚能分辨農場棚屋、田區、大樹、圍籬和主路；村莊可辨店屋分居兩側、中央水槽與南側樹池，但細節大多融合。96×54 的道路、田區／建物分區更易辨認；窗格、石板、花瓣及草葉等細節仍會消失或併成色塊。這是整張場景縮到 64／96 px 寬的讀性觀察，不是遊戲內 tile 64 px 或 renderer 驗收；候選保留原始 1672×941 尺寸。

### 依格子模組化候選（VF11-GRID-TILE-CANDIDATES）

使用者已核准以上農場／村莊母稿作為生成參考，並明確允許以 Codex 內建 imagegen 產生格子化衍生候選及對外傳送參考圖。這項授權只涵蓋下列候選；衍生檔仍為 `candidate`，母稿核准不代表衍生檔獲准正式整合。沒有變更 `public/`、`content/assets.json`、`content/maps/` 或 runtime。

下列地表依專案 `tools/art/tile_finalize.py --seamless` 輸出 128×128 RGBA8888（64 px 格的 2× 母版）；四張單格 overlay 依 `--overlay` 輸出 128×128。建築／樹木為 256×256、對齊 2×2 格，縮至 224×224 內容範圍，水平置中，透明錨點基線為 y=240，以保留邊界留白。圖像皆以 nearest-neighbor 縮放，未添加遊戲碰撞、互動或地圖語意。

| 類別 | 候選檔 | 尺寸／模式；alpha bbox | SHA-256 |
|---|---|---|---|
| 草地 | `tile-grass-2x-candidate-20261026.png` | 128×128 RGBA；全不透明 | `c392ed3eaa096ffec14b2c622f0737852146da5e290f9af021458c7c88f527df` |
| 路徑 | `tile-path-2x-candidate-20261026.png` | 128×128 RGBA；全不透明 | `53f82edb07b05e74c3f5de8dbee7a667b0189d50daa0992d6f1770dbb18842e6` |
| 耕地 | `tile-field-2x-candidate-20261026.png` | 128×128 RGBA；全不透明 | `87929b9296e120f0f565a12fedb90bd4a6103d1fca3ea6847722d156fa52011c` |
| 矮石牆 | `overlay-wall-2x-candidate-20261026.png` | 128×128 RGBA；alpha bbox `(20,30,112,99)` | `bf8da937dfb069d284197051f8f7dba8ef2163229a2e87f1a821147982bb28b6` |
| 木圍籬 | `overlay-fence-2x-candidate-20261026.png` | 128×128 RGBA；alpha bbox `(27,53,109,90)` | `569613d3c4be2c6ca7cf40173e753649c282012f8378f1169d1b74401046ea2c` |
| 出貨箱 | `overlay-shipbox-2x-candidate-20261026.png` | 128×128 RGBA；alpha bbox `(6,7,120,122)` | `bc1905a68908ff720e0800f9bef5745f28b44ddaef54a08156531c5d9d738035` |
| 門 | `overlay-door-2x-candidate-20261026.png` | 128×128 RGBA；alpha bbox `(4,5,114,114)` | `85f5ca05d866e4407d69fdef9e23c437d81996c27734cc35b54f8534edf7a3fd` |
| 一般商店 | `overlay-shop-general-4x-candidate-20261026.png` | 256×256 RGBA；alpha bbox `(16,16,238,240)` | `b4236b568a6ac5c6c05a9b4744a92c50fdfe39bc132900a883ca13c6d7aa7f33` |
| 鐵匠鋪 | `overlay-shop-smithy-4x-candidate-20261026.png` | 256×256 RGBA；alpha bbox `(16,16,237,237)` | `24d378dd0d75eb01573968b9420e81077172a9930026741cbbd2a7ee07d7d410` |
| 樹 | `overlay-tree-4x-candidate-20261026.png` | 256×256 RGBA；alpha bbox `(16,16,240,237)` | `3972b8de6b0aeef93ace94c2c90b5e167206392c8727607b814591477d1cb7ea` |
| 房屋 | `overlay-house-4x-candidate-20261026.png` | 256×256 RGBA；alpha bbox `(16,20,240,233)` | `0af23947af0fa9c7c82eb42a8fbacd52ba5f11ceca416257de5081aa52ed58ac` |

來源與可查證範圍：全部圖像由 OpenAI 內建 imagegen 生成，參考已核准農場／村莊母稿；工具未暴露模型名稱，因此無法確認具體模型。未保存 raw prompt。地表用專案 nearest-neighbor finalizer 做接縫處理；128 px 物件用其透明 overlay 模式；四張 256 px 圖另以 nearest-neighbor 縮入透明畫布並設置上述錨點。這些記錄不構成模型條款或發布權利審查。

靜態檢查：11 個檔案均由 Pillow 12.3.0 讀為指定尺寸 RGBA；地表 alpha extrema 為 `(255,255)`，物件 alpha extrema 為 `(0,255)`。地表不是逐像素相等的週期邊界：在相鄰重複格的四邊，平均 RGB 差相對於 tile 內部相鄰像素差，草地水平／垂直約 1.06／1.36、路徑約 1.08／1.15、耕地約 1.12／0.81；2×2 nearest-neighbor 重複預覽未見明顯硬接縫，但草地細碎高對比、路徑碎石密集、耕地橫向條紋仍有規律重複。這是像素差和靜態預覽結果，不是遊戲 renderer 驗收。

以 nearest-neighbor 縮至 64×64 和 96×96 檢視：三種地表的用途色塊仍可辨，草地／碎石細節會融成密集噪點，耕地行紋更明顯；單格牆、圍籬、箱子、門在 64 px 仍保有輪廓，但內部紋理需 96 px 才較清楚。四種 2×2 overlay 在 64 px 整體大小時建物／樹仍可辨但細節融合；96 px 更易看出店屋正面與樹冠層次，窗格、磚瓦及小植栽仍會合併。64／96 px 圖只作候選板檢視，沒有另存為候選素材。

### 森林場景概念候選（VF-16，未核准）

使用者已指定「森林」作為下一個場景候選。以下只核准製作與檢視概念候選，不核准正式整合；既有農場／村莊母稿只作風格參照。

| 場景 | 候選檔 | 尺寸／格式 | SHA-256 |
|---|---|---:|---|
| 山腳森林概念 | `forest-scene-concept-candidate-20261027.png` | 1536×1024 PNG | `fff15c0284fd650d881037cfe5cc1c54ff1e6c7402b5e2a312581ba573b98139` |

來源：Codex 內建 imagegen，以已核准農場與村莊候選作風格參考，並參照 `content/maps/forest.json` 的山腳森林主題。工具未提供可查證的模型名稱或授權條款。此圖是繪本感像素場景概念，不是 64 px 格子的地表／透明物件素材。人工檢視發現圖中僅有明顯的北側林間開口，沒有準確呈現森林地圖西側農場出口、東側湖畔出口與北側礦坑出口，也未對齊現有 24×16 地圖路徑；不可直接作 runtime 背景或取代互動地圖。下一步若要整合，需先按現有格子拆成地表及透明 overlay 候選，再對每個確切檔案與 SHA-256 另行核准。

## 物品圖示方向比較（VF-02B）

使用者回覆既有 `item-icons.svg`（SHA-256 `3cd9abb6376b741bd316adcc77045e9a97bf3894bdc070b67f5063ac59af04dd`）需要修改，先比較兩個新方向。該檔為 **superseded candidate（已被取代的候選）**，不是核准素材；它仍留在歷史 VF-02 提案中供追溯。新比較板位於 [`index.html`](index.html) 開頭的「VF-02B｜物品圖示風格對照」。

- **A｜精緻像素候選**：`item-icons-pixel.svg`，以 64×64 viewBox symbol 繪製甜蘿蔔、種子袋、木材、礦石、魚、料理；使用整數像素簇、深棕輪廓、分區陰影和亮面，沒有漸層或模糊。SVG 接觸表與詳情放大圖共用同一組 symbol。
- **B｜繪本手繪候選**：`item-icons-storybook.png`，1536×1024 六格 atlas，物件順序與 A 相同；紙感底色、鉛筆紋理及自然手繪輪廓，與像素版本形成明確風格差異。
- **公平比較條件**：六物件採相同 3×2 次序與等尺寸格框；桌機詳情及 390×844、844×390 詳情展示同一甜蘿蔔、同一名稱／品質／數量／價格。手機板在小寬度切成單欄。比較板只是靜態候選，沒有遊戲互動或實際資料連線。

## 繪本風單件候選（VF-02C）

使用者已選擇 **B｜繪本手繪** 作為圖示美術方向。方向選擇後，使用者再於 2026-10-26 逐項核准以下六個獨立 PNG 與確切 SHA-256；六個原始 PNG 已通過素材核准 gate，並整合至 `public/assets/items/`，由 `content/assets.json` 的 `itemIcons` 對應實際 inventory ID。完整核准與 provenance 紀錄見 [`docs/art/asset-review.md`](../../asset-review.md)。

| 素材 | 原候選檔 | 尺寸／格式 | 核准／整合 SHA-256 |
|---|---|---:|---|
| 甜蘿蔔 | `items/sweet-turnip.png` | 1254×1254 RGBA | `1a490dd850b97cb5bcfb85568cad20ccca6e60dff7c81bbb0fffbc561aeeead4` |
| 種子袋 | `items/seed-bag.png` | 1254×1254 RGBA | `2ab355b18d6a9d3779b78087d1318e7e32acd018f0d436e13eacdc04b25e8884` |
| 木材 | `items/wood.png` | 1254×1254 RGBA | `a9938778931d349da37b3e15d521f003d2a9de04b1c7d18e8360a5091de21517` |
| 礦石 | `items/ore.png` | 1254×1254 RGBA | `d4df6f786b76863832ef711f9b917d867b57a7dc3ae9a5e8e5887ba8e7668a74` |
| 魚 | `items/fish.png` | 1254×1254 RGBA | `027fa69938e6a2aa456992641bbfbf6aa8bcf10bdc3a5cdb0927afcf5c6e216a` |
| 燉菜 | `items/stew.png` | 1254×1254 RGBA | `8b1d9c211b552049f8d1326b9a3b71f17f751532119abbcac87c9ce2b98df3c3` |

來源：Codex 內建 imagegen，六個物品分別生成一張透明背景原創圖示；共同提示重點為繪本水彩與色鉛筆材質、置中單一物件、無文字／外框／場景，且在 64 px 顯示尺寸仍可辨識。工具未提供可查證的模型名稱或授權條款，因此本紀錄不推定模型名稱或授權。正式 PNG 保留核准候選的原始位元組；64 px 縮圖僅供檢查，沒有寫入正式素材。比較板使用棋盤格呈現透明背景。

甜蘿蔔資料：`seedPrice = 25`、`growthDays = 3`，基礎售價 `round(25 × 3 × 1.3) = 98`；優良品質倍率 125%，出貨價 `round(98 × 1.25) = 123`。內容來源 `content/crops.json`，規則來源 `src/domain/pricing.ts`。其他物品格子數量僅供版面示意。

## VF-16 延伸候選與阻礙

- 森林格線地表／overlay 候選及 24×16 出口對照、接縫和縮放限制：[`docs/art/candidates/vf16-forest/README.md`](../vf16-forest/README.md)。5 張正式候選仍未逐檔核准，未進入遊戲。
- 服飾概念候選與 rig 評估：[`vf16-outfit-overlay/README.md`](vf16-outfit-overlay/README.md)。因現有角色圖沒有衣物遮罩／圖層，該概念無法可靠貼合 rig；使用者決定先保留候選與阻礙紀錄，不擴增角色分層或 runtime 換裝。
- 4 格快捷欄已由 VF-16 實作，選擇工具與已擁有種子、存入各存檔；完整驗收與限制以後續共同分支測試結果為準。

## 限制與審核狀態

- `candidate-a-scenes.png` 與 `candidate-b-scenes.png` 由本機影像模型生成；Golden Reference `docs/art/style-sheet.png` 僅作像素群與深棕輪廓的質感參照。兩 PNG 是氛圍概念圖，不是同地圖受控比較；原圖仍帶較柔筆觸，正式素材需像素清理與實際倍率檢視。
- UI 與 VF-02B 圖示板皆為靜態提案，未連接 domain state、命令、鍵盤／觸控、focus restore、modal input lock、安全區或真機 hit target。按鈕只展示建議文案，不可操作。
- 六款圖示已整合至 `public/assets/items/` 並登錄 `content/assets.json`；場景素材仍是候選，尚未標記為核准或整合。
- VF-02 曾以 Chrome 檢查舊版 390×844 與 844×390 版面；VF-02B 新增比較板尚未完成瀏覽器實際渲染：`file://` 預覽遭瀏覽器安全策略拒絕，且本任務未使用其他瀏覽器路徑。新版目前只完成 XML、HTML 引用、CSS 斷點及固定 viewport 的靜態檢查；沒有可報告的新 viewport 截圖或實際排版觀察。

## 檔案校驗

| 檔案 | 尺寸 | SHA-256 |
|---|---:|---|
| `candidate-a-scenes.png` | 2117×743 | `ffd7676e6096b633b458b629eb11fd7f8ae4005fe042e3a1259d8b1ab14d565e` |
| `candidate-b-scenes.png` | 2117×743 | `f6f00f49c4b62faf8bde0783ace0a72e4521eb885ebec099724edbdfbdea9dec` |
| `item-icons.svg`（superseded） | viewBox 184×146 | `3cd9abb6376b741bd316adcc77045e9a97bf3894bdc070b67f5063ac59af04dd` |
| `item-icons-pixel.svg`（VF-02B A 候選） | viewBox 768×512；symbol 64×64 | `28c6b24978c8033d42c4fc02c902c6720992a96895a35236f79ec90c9e746e33` |
| `item-icons-storybook.png`（VF-02B B 候選） | 1536×1024 | `4e2d97445c773024c142b2d37effa0c73b1b54e17e7fa51bf937f05f129be7f0` |
| `index.html`（VF-02B A/B responsive compare） | 390px/844px responsive labels | `9c1bc87dd2dfee749aa77fd3528859515664f6a4672c5c236ba7fc11b9b3a6d4` |

未使用既有遊戲素材或第三方遊戲畫面。

# 角色描述（產圖用）

本文件把 [CHARACTERS.md](../CHARACTERS.md) 的文字設定整理成可直接用於產圖的描述。權利界線見 [ORIGINALITY.md](../ORIGINALITY.md)。

## 原型圖的處理（2026-10-21 決定）

使用者提供的原型圖是**既有網路遊戲的遊戲畫面截圖**（含該遊戲的標誌、介面、職業與公會名稱、對話框，以及以該遊戲美術呈現的角色與寵物）。依 CHARACTERS.md 與 ORIGINALITY.md：

- 截圖**不作為任何模型的輸入圖**（不做圖生圖、不描摹、不擷取），也不進 repo；
- 只讀取其中「角色本身的特徵」（髮型、服裝、配件、寵物），這些與 CHARACTERS.md 一致；
- 遊戲內美術一律由本專案的風格重新產生，風格見 [ART_PIPELINE.md](../ART_PIPELINE.md)。

若要使用圖生圖（D1 選項 B），輸入圖必須是**使用者自有、不含既有遊戲美術與標誌**的單一角色圖。

## 小涵（玩家角色）

- 身體比例：Q 版，約 2.5 頭身，大頭小身。
- 髮型：深棕色長直髮，額前齊瀏海，髮尾漸層為淺棕色。
- 臉：淺膚色，棕色大眼，安靜溫和的表情，臉頰略帶粉。
- 服裝：棕色外套（衣擺偏寬）、黑色短裙、白色休閒運動鞋。
- 配件：斜背深色肩背包；手拿銀白色平板。
- 標誌色：粉紅（愛心與閃光）。
- 寵物：黑色短毛貓，金色眼睛，長尾巴（名字待補）。

### 產圖提示詞（站姿正面，v1）

```
Cute chibi game character, full body, standing, front view, about 2.5 heads tall, big head small body. A young woman with long straight dark brown hair, straight bangs, caramel-brown gradient on the hair tips, large brown eyes, calm gentle smile, light skin with soft pink cheeks. She wears a loose brown jacket, a black short skirt and white sneakers, a dark crossbody shoulder bag, and holds a silver-white tablet. Bright saturated hand-painted cartoon style, thick dark brown outline, soft highlights and shading, centered, isolated on a flat solid magenta (#ff00ff) background. No text, no logo, no frame, no other characters, no pets.
```

### 試驗紀錄 v1（2026-10-21）

模型 Z-Image Turbo（Apache-2.0，不需授權門檻），文生圖、768×1024、9 步，seed 101／202／303，各約半分鐘；檔案與 `manifest.json` 在 `private/art-trials/xiaohan/`（`private/` 不進版控）。

| 項目 | 結果 |
| --- | --- |
| 設定符合度 | 長直髮、齊瀏海、髮尾漸層、棕外套、黑短裙、白鞋、斜背包、銀白平板都出現，比例約 2.5 頭身 |
| 風格 | 柔和扁平的 Q 版卡通，粗深棕輪廓，與 ART_PIPELINE 的路線 B 相符 |
| **問題 1：商標** | seed 202、303 的平板畫上了蘋果標誌（seed 101 沒有）。**不可入遊戲**，v1.1 提示詞加上「平板背面空白、無任何標誌」，且逐張檢查 |
| 問題 2：背景 | 背景是粉紅而非精確洋紅，且有深粉色落影，去背需用容許色差並移除落影；v1.1 改用綠幕（`#00ff00`）試試 |
| 問題 3：手臂與平板 | 手與平板的接合偶有不自然，需人工挑選或修圖 |

v1.1 提示詞的差異：把背景改為 `flat solid chroma-key green (#00ff00), no shadow on the ground`，並加入 `the tablet has a blank plain back with no logo or symbol`。

### 試驗紀錄 v1.1（2026-10-21）：四個主體同一模板

同一個風格後綴、同一組 seed（101、202）、Z-Image Turbo 9 步；角色 768×1024、寵物 768×768。原始圖、提示詞、`manifest.json`（模型、seed、提示詞、SHA-256）與去背結果都在 `private/art-trials/`，不進版控。

**共用風格後綴**（每個主體只換前面的主體描述）：

```
Bright saturated hand-painted cartoon style, thick dark brown outline, soft highlights and shading, centered, isolated on a flat solid chroma-key green (#00ff00) background with no shadow on the ground and no green on the subject. No text, no logo, no symbol, no frame.
```

| 主體 | 結果 | 暫定候選 |
| --- | --- | --- |
| 小涵 | 兩個 seed 的髮型、漸層髮尾、外套、短裙、肩背包、平板都對；平板背面皆空白、無標誌 | seed 101（正面較完整）；seed 202 為四分之三側身 |
| 毛毛 | 蓬鬆捲髮、海軍藍針織衫、墨綠灰工裝長褲、白鞋都對；兩個 seed 幾乎一致 | 兩張都可用，seed 101 輪廓較清楚 |
| 黑貓 | seed 101 金色大眼、粉鼻、輪廓乾淨；尾巴偏短（設定是長尾） | seed 101；seed 202 胸口出現亂碼般的文字，**淘汰** |
| 有袋動物 | 圓臉、小圓耳、褐灰色；兩張都偏像小熊而不太像有袋動物 | seed 202（身形較直立、較接近原設定）；要更像可再加描述 |

去背：`tools/art/key_out.py` 以四角中位數取背景色，只移除與邊界相連的背景，並壓掉邊緣綠色溢色；六張在灰底預覽上都沒有綠邊，地面落影也被一併去除。

### 採用與 64 px 處理（2026-10-21）

使用者採用：小涵 seed 101、毛毛 seed 101、黑貓 seed 101、有袋動物 seed 202。

處理工具（`tools/art/`）：`build_palette.py` 由這四張產生 `content/palette.json`（48 色：4 個錨點色＋44 個衍生色，錨點含深棕輪廓與兩位角色的標誌色）；`finalize.py` 縮到畫格、外圍補輪廓、量化到調色盤並驗證輸出顏色都在調色盤內。成品在 `private/art-trials/final/`（尚未進 `public/`）。

| 素材 | 1x 畫格 | 2x 母版畫格 | 用色（2x／1x） |
| --- | --- | --- | --- |
| 小涵 | 64×80 | 128×160 | 42／44 |
| 毛毛 | 64×80 | 128×160 | 45／45 |
| 黑貓 | 48×48 | 96×96 | 36／38 |
| 有袋動物 | 48×48 | 96×96 | 20／22 |

調色盤的 48 色**只由這四張角色圖衍生**，之後做地形與物件時要把新素材加進 `build_palette.py` 重新產生，調色盤一變，所有素材都要重新量化。

目視結果：
- **2x 母版品質良好**：輪廓一致、配色對、四個素材風格統一，可直接當引擎貼圖。
- **1x 的臉部細節會糊掉**：小涵的眼睛與微笑、黑貓眼睛的金色圈在 64×80／48×48 已不清楚；身體與服裝仍可辨識。
- **建議**：引擎載入 `@2x` 母版並以 0.5 倍顯示（Phaser 的 `setScale(0.5)`），不使用 1x 檔；1x 只留作縮圖參考。若要在 1x 保有表情，需要另外手修臉部，或把角色畫格加大。

尚待處理：
- 只有正面（或四分之三）站姿，四方向與行走動畫尚未開始。
- 小涵與毛毛的臉部比例不完全相同（毛毛的頭髮占比大），之後要統一頭身比。
- 黑貓的尾巴偏短（設定是長尾）；有袋動物偏像小熊，要更像有袋動物需再調整描述。
- 成品是「候選」，未經你確認前不放入 `public/`、不寫入 `content/assets.json`。

## 毛毛（NPC）

- 身體比例：Q 版，約 2.5 頭身。
- 髮型：深棕到近黑的捲髮，蓬鬆、髮量多。
- 臉：淺膚色，深棕色大眼，臉頰略帶粉。
- 服裝：深海軍藍針織套頭衫、墨綠灰色工裝長褲（側邊口袋）、白色休閒運動鞋。
- 標誌色：亮藍色（愛心與閃光）。
- 寵物：棕灰色、圓臉、小耳朵的小型有袋動物（名字待補）。

提示詞待小涵定稿、風格鎖定後，用同一模板與同一組風格詞產生。

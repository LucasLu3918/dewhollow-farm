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

調色盤的 48 色**只由這四張角色圖衍生**。（後續更新：做工具圖時發現顏色不夠，調色盤已**擴充到 64 色**，原本的 48 色保持不變，所以這四個角色不需要重新量化；見 [tool-briefs.md](tool-briefs.md)。）

目視結果：
- **2x 母版品質良好**：輪廓一致、配色對、四個素材風格統一，可直接當引擎貼圖。
- **1x 的臉部細節會糊掉**：小涵的眼睛與微笑、黑貓眼睛的金色圈在 64×80／48×48 已不清楚；身體與服裝仍可辨識。
- **建議**：引擎載入 `-2x` 母版並以 0.5 倍顯示（Phaser 的 `setScale(0.5)`），不使用 1x 檔；1x 只留作縮圖參考。若要在 1x 保有表情，需要另外手修臉部，或把角色畫格加大。

尚待處理：
- 只有正面（或四分之三）站姿，四方向與行走動畫尚未開始。
- 小涵與毛毛的臉部比例不完全相同（毛毛的頭髮占比大），之後要統一頭身比。
- 黑貓已於 2026-10-23 恢復為清楚的四足貓圖；尾巴仍較設定短，後續方向圖可再補強。有袋動物已依下方描述修復為矮袋鼠（quokka）。
- 已入庫（2026-10-21）：四個 2x 母版放在 `public/assets/characters/`，`content/assets.json` 以 `file`、`density: 2` 與 `source`（模型、授權、seed、處理方式）登錄；`player.up/down/left/right` 暫用同一張小涵正面圖，`npc.maomao` 用毛毛，`pet.cat`、`pet.marsupial` 先登錄、尚未接進畫面。引擎以線性取樣、0.5 倍顯示，角色以腳底對齊格子。瀏覽器實測臉部與服裝清楚，縮小沒有鋸齒。
- 四方向暫用同一張的限制已解除（見下方「四方向試驗」）。

### 四方向試驗（2026-10-21）

目的：評估文生圖能否產出與正面一致的背面與側面。Z-Image Turbo，同一模板與風格後綴，背面與側面各 3 個 seed（101、202、303），768×1024、9 步；提示詞在 `private/art-trials/prompts/xiaohan-back-v1.txt`、`xiaohan-side-v1.txt`，`manifest.json` 記錄每張的模型、seed 與雜湊。

| 項目 | 結果 |
| --- | --- |
| 一致性 | **良好**：長直髮、漸層髮尾、棕外套、黑短裙、白鞋、斜背包肩帶都對得上；側面確實朝左；背面沒有臉。三個方向處理成 64×80 畫格後，外框高度為 152–154（2x 母版像素），腳底在同一條線上 |
| 背面三張 | 都可用。seed 303 的肩背包變成藍色，不採用；seed 202 髮色略淺；**暫定 seed 101**（包色與正面最接近） |
| 側面三張 | 都朝左、都清楚。seed 303 髮尾有雜點，不採用；**暫定 seed 101**（與正面比例最接近） |
| 姿勢差異 | 正面平板抱在胸前，側面平板舉在身前，背面沒有平板；可接受 |
| 朝右 | 以側面水平翻轉，肩背包與平板會左右對調，可接受 |
| 色彩 | 背面與側面量化到共用調色盤後用色 43–44 色，沒有新增顏色 |

結論：四方向可行，不需要圖生圖。背面與側面（seed 101）已於 2026-10-21 入庫（`public/assets/characters/xiaohan-back-2x.png`、`xiaohan-side-2x.png`），`player.up`、`player.left` 各用其一，`player.right` 以 `mirrorOf` 翻轉 `player.left`；走路動畫的做法與原型結果見 [../ANIMATION_DESIGN.md](../ANIMATION_DESIGN.md)。

## 毛毛（NPC）

- 身體比例：Q 版，約 2.5 頭身。
- 髮型：深棕到近黑的捲髮，蓬鬆、髮量多。
- 臉：淺膚色，深棕色大眼，臉頰略帶粉。
- 服裝：深海軍藍針織套頭衫、墨綠灰色工裝長褲（側邊口袋）、白色休閒運動鞋。
- 標誌色：亮藍色（愛心與閃光）。
- 寵物：矮袋鼠（quokka），棕灰毛色、圓而短的口鼻、小圓耳、渾圓身軀、短前肢、較發達後肢與自然彎曲尾巴。

提示詞待小涵定稿、風格鎖定後，用同一模板與同一組風格詞產生。

## 村裡的 NPC（2026-10-22）

五位 NPC 原本只有色塊，這次依 `content/npcs.json` 的名字與職務重新設計（原創角色，不參考任何既有作品）。提示詞沿用角色的綠幕風格後綴（見上方試驗紀錄），seed 101 為採用結果；候選 seed 202 留在 `private/art-trials/v2/`。

| id | 名稱 | 職務 | 外型重點 | 提示詞 |
| --- | --- | --- | --- | --- |
| rong-bo | 榕伯 | 鎮長 | 白髮、白鬍、圓框眼鏡，墨綠背心，手拿棕色筆記本 | npc-rong-bo-v2 |
| a-gan | 阿柑 | 雜貨店 | 短鮑伯、橘色髮夾，橘黃圍裙配深藍裙 | npc-a-gan-v2 |
| shi-shifu | 石師傅 | 鐵匠 | 灰色頭巾、粗壯、棕色皮圍裙，手拿小鐵鎚 | npc-shi-shifu-v2 |
| zhi-lan | 芷蘭 | 藥草師 | 單側長辮，鼠尾草綠披肩，手上提著裝藥草的籃子 | npc-zhi-lan-v2 |
| xiao-sui | 小穗 | 麵包師 | 奶油色頭巾與圓髮髻，粉色裙配白圍裙，提麵包籃 | npc-xiao-sui-v2 |

入庫：`content/assets.json` 的 `npc.<id>`（128×160 的 2x 母版，0.5 倍顯示成 64×80）與 `content/rigs.json` 的單張精靈條目（`kind: single`）。

## 寵物物種修復（2026-10-23）

### 矮袋鼠（quokka）

- 物種：明確限定為 quokka，不使用泛稱「有袋動物」。
- 輪廓：棕灰色短毛、圓而稍短的口鼻、小圓耳、渾圓軀幹、短前肢、較發達後肢與清楚可見的自然彎曲尾巴。
- 姿勢：自然低伏的四足姿勢；不畫人類直立軀幹、肩腰比例、手指、服裝或配件。
- 已採用：使用者核准的單張靜態候選，經透明背景修正及 `tools/art/finalize.py` 轉成 96×96 RGBA8888，於遊戲中以 48×48 顯示。
- 限制：目前只有單一方向靜態圖；本次未新增方向圖或逐幀動畫。

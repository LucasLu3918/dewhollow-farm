# 素材與授權清單

本文件由 `npm run licenses`（`tools/licenses/generate.mjs`）產生，資料來源是 `content/assets.json`、`package.json`、`package-lock.json` 與 `node_modules/`。請改來源檔後重新產生，不要手改。

原則見 [ORIGINALITY.md](ORIGINALITY.md)：所有角色、地名、作物與文字皆為原創；素材來源必須登錄；來源不明的檔案不得進入發布版本。

## 一、素材（content/assets.json）

共 74 筆：有檔案 55 筆（其中本機模型生成 0、程式產生 3）、水平翻轉 1 筆（不另存檔）、占位（程式繪製的色塊，無檔案）18 筆。

### 1.1 本機影像模型生成

角色與工具圖由本機影像模型生成，流程見 [ART_PIPELINE.md](ART_PIPELINE.md)。

- **模型**：Z-Image Turbo，**授權 Apache-2.0**。文生圖、固定 seed，綠幕去背、縮放並量化到 `content/palette.json`（`tools/art`）。提示詞與挑選記錄見 [art/character-briefs.md](art/character-briefs.md) 與 [art/tool-briefs.md](art/tool-briefs.md)。
- 未使用其他模型的圖；ART_PIPELINE 所列的其他模型（FLUX.2 klein、Qwen Image Edit）**沒有**產出任何已入庫的素材。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |

### 1.2 程式產生（有檔案）

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `pwa.icon-192` | object | `assets/icons/icon-192.png` | 程式產生：tools/pwa/make-icons.mjs 以 64×64 邏輯畫布繪製像素風草地、太陽與幼苗，再以最近鄰放大輸出 RGBA8888；無外部素材。 |
| `pwa.icon-512` | object | `assets/icons/icon-512.png` | 程式產生：tools/pwa/make-icons.mjs 以 64×64 邏輯畫布繪製像素風草地、太陽與幼苗，再以最近鄰放大輸出 RGBA8888；無外部素材。 |
| `pwa.icon-maskable-512` | object | `assets/icons/icon-maskable-512.png` | 程式產生：tools/pwa/make-icons.mjs 以 64×64 邏輯畫布繪製像素風草地、太陽與幼苗，再以最近鄰放大輸出 RGBA8888；無外部素材。 |

### 1.3 其他有檔案的素材

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `tile.grass` | tile | `assets/tiles/vf11-grass-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.grass, SHA-256 c392ed3eaa096ffec14b2c622f0737852146da5e290f9af021458c7c88f527df; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.field` | tile | `assets/tiles/vf11-field-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.field, SHA-256 87929b9296e120f0f565a12fedb90bd4a6103d1fca3ea6847722d156fa52011c; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.path` | tile | `assets/tiles/vf11-path-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.path, SHA-256 53f82edb07b05e74c3f5de8dbee7a667b0189d50daa0992d6f1770dbb18842e6; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.wall` | tile | `assets/tiles/vf11-wall-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.wall, SHA-256 bf8da937dfb069d284197051f8f7dba8ef2163229a2e87f1a821147982bb28b6; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.bed` | overlay | `assets/tiles/bed-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.shipbox` | overlay | `assets/tiles/vf11-shipbox-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.shipbox, SHA-256 bc1905a68908ff720e0800f9bef5745f28b44ddaef54a08156531c5d9d738035; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.door` | overlay | `assets/tiles/vf11-door-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.door, SHA-256 85f5ca05d866e4407d69fdef9e23c437d81996c27734cc35b54f8534edf7a3fd; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `tile.soil` | tile | `assets/tiles/soil-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩農地土壤地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `crop.sweet-radish` | crop | `assets/crops/sweet-radish-2x.png` | OpenAI built-in image generation tool（2026-10-23），使用者核准之甜蘿蔔原創像素圖；保留核准 PNG 原始位元組，未重繪或重採樣。 |
| `player.up` | character | `assets/characters/xiaohan-back-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `player.down` | character | `assets/characters/xiaohan-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `player.left` | character | `assets/characters/xiaohan-side-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.maomao` | character | `assets/characters/maomao-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.rong-bo` | character | `assets/characters/npc-rong-bo-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.a-gan` | character | `assets/characters/npc-a-gan-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.shi-shifu` | character | `assets/characters/npc-shi-shifu-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.zhi-lan` | character | `assets/characters/npc-zhi-lan-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `npc.xiao-sui` | character | `assets/characters/npc-xiao-sui-2x.png` | OpenAI built-in image generation tool（2026-10-23），依 docs/art/character-briefs.md 原創角色描述生成；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `pet.cat` | character | `assets/characters/cat-2x.png` | 恢復自原創舊版素材，commit 842025a2107064039ce5851b8493f7f0e7b9fcb3；舊版 manifest 記載本機 Z-Image Turbo（Apache-2.0）文生圖 seed 101，並經 tools/art 去背、縮放與 palette 量化。 |
| `pet.marsupial` | character | `assets/characters/marsupial-2x.png` | OpenAI built-in image generation tool（2026-10-23），使用者核准候選之透明背景編修版；tools/art/finalize.py 以最近鄰縮放至 96×96 RGBA8888，使用既有 pet.marsupial rig。 |
| `tool.hoe` | object | `assets/tools/hoe-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tool.can` | object | `assets/tools/can-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tool.seedbag` | object | `assets/tools/seedbag-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tile.tree` | overlay | `assets/tiles/tree-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `scene.forest.grass` | tile | `assets/forest/ground-grass.png` | OpenAI built-in image generation tool (2026-10-27), original forest scene asset approved by user, SHA-256 839c2cfd2de5c063a8b12933beffa42f27647381a8b765d90e90ce6c25f1b1c5; model name and license terms unavailable; exact-byte integration, forest-only runtime use. |
| `scene.forest.path` | tile | `assets/forest/ground-path.png` | OpenAI built-in image generation tool (2026-10-27), original forest scene asset approved by user, SHA-256 d697f250602cbb1f4f1b2755cce6e58876e451ef977864dbdef47badff09e00e; model name and license terms unavailable; exact-byte integration, forest-only runtime use. |
| `scene.forest.moss` | tile | `assets/forest/ground-moss.png` | OpenAI built-in image generation tool (2026-10-27), original forest scene asset approved by user, SHA-256 eb2d1e1037ee2d67b4122f05a1845a36c9f9904ede10d72f875698a2b06516f7; model name and license terms unavailable; exact-byte integration, forest-only runtime use. |
| `scene.forest.tree` | overlay | `assets/forest/tree.png` | OpenAI built-in image generation tool (2026-10-27), original forest scene asset approved by user, SHA-256 d9a43c1d9a6fa1948dc30e25fb6a164b6578ef207186cf727c0bb22d8f24e10c; model name and license terms unavailable; exact-byte integration, forest-only runtime use at one existing blocked tile per tree. |
| `scene.forest.rock` | overlay | `assets/forest/rock.png` | OpenAI built-in image generation tool (2026-10-27), original forest scene asset approved by user, SHA-256 5928ba117c42b5f1b334f93771cf079724452def76f19a9dd8b8295df9363171; model name and license terms unavailable; exact-byte integration, forest-only runtime use at one existing blocked tile per rock. |
| `tile.water` | tile | `assets/tiles/water-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.floor` | tile | `assets/tiles/floor-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.furniture` | overlay | `assets/tiles/furniture-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.cave` | tile | `assets/tiles/cave-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.rock` | overlay | `assets/tiles/rock-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tool.axe` | object | `assets/tools/axe-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tile.shop` | overlay | `assets/tiles/shop-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.forage` | overlay | `assets/tiles/forage-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tool.pick` | object | `assets/tools/pick-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tile.ore` | overlay | `assets/tiles/ore-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.stairs` | overlay | `assets/tiles/stairs-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tool.rod` | object | `assets/tools/rod-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tile.trough` | overlay | `assets/tiles/trough-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.kitchen` | overlay | `assets/tiles/kitchen-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.workshop` | overlay | `assets/tiles/workshop-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.workbench` | overlay | `assets/tiles/workbench-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.tuft` | overlay | `assets/tiles/tuft-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tool.sickle` | object | `assets/tools/sickle-2x.png` | OpenAI built-in image generation tool（2026-10-23），依原創農具設計生成透明像素圖；未使用第三方遊戲素材；tools/art/finalize.py 輸出 RGBA8888。 |
| `tile.fence` | overlay | `assets/tiles/vf11-fence-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for tile.fence, SHA-256 569613d3c4be2c6ca7cf40173e753649c282012f8378f1169d1b74401046ea2c; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `scene.village.general-shop` | overlay | `assets/tiles/vf11-shop-general-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for scene.village.general-shop, SHA-256 b4236b568a6ac5c6c05a9b4744a92c50fdfe39bc132900a883ca13c6d7aa7f33; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `scene.village.smithy` | overlay | `assets/tiles/vf11-shop-smithy-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for scene.village.smithy, SHA-256 24d378dd0d75eb01573968b9420e81077172a9930026741cbbd2a7ee07d7d410; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `scene.farm.tree` | overlay | `assets/tiles/vf11-tree-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for scene.farm.tree, SHA-256 3972b8de6b0aeef93ace94c2c90b5e167206392c8727607b814591477d1cb7ea; model name and license terms unavailable; exact-byte integration with per-file provenance. |
| `scene.farm.house` | overlay | `assets/tiles/vf11-house-2x.png` | OpenAI built-in image generation tool (2026-10-26), original scene candidate approved for scene.farm.house, SHA-256 0af23947af0fa9c7c82eb42a8fbacd52ba5f11ceca416257de5081aa52ed58ac; model name and license terms unavailable; exact-byte integration with per-file provenance. |

### 1.4 水平翻轉（不另存檔）

翻轉原圖在執行期完成，不另外存檔，來源與原圖相同。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `player.right` | character | 水平翻轉 `player.left` | 水平翻轉 player.left，不另存檔 |

### 1.5 占位（程式繪製的色塊，無檔案）

遊戲運行時以 `color` 繪製的占位圖或純色區塊，沒有圖檔，也不含任何外部素材。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `crop.moon-bean` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.star-pepper` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.golden-rice` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.bell-pumpkin` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.maple-berry` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.snow-radish` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.frost-mushroom` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.ember-onion` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.dew-grass` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.dusk-potato` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.silver-wheat` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `animal.cow` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：牛的圖由 src/presentation/animal-art.ts 用 Graphics 畫成（與雞相同做法） |
| `item.milk` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：物品目前沒有圖示，這筆只登錄來源（牛奶） |
| `item.cheese` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：物品目前沒有圖示，這筆只登錄來源（起司） |
| `item.butter` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：物品目前沒有圖示，這筆只登錄來源（奶油） |
| `animal.sheep` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：羊的圖由 src/presentation/animal-art.ts 用 Graphics 畫成（與雞、牛相同做法） |
| `item.wool` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：物品目前沒有圖示，這筆只登錄來源（羊毛） |
| `item.cloth` | object | （無檔案，程式繪製色塊） | 占位（程式產生）：物品目前沒有圖示，這筆只登錄來源（布） |

### 1.6 音訊

音效與背景音樂由程式合成（`src/presentation/audio/synth.ts`、`content/music.json`、`content/sounds.json`），**沒有**音檔，不含外部素材。

## 二、第三方依賴（package.json 直接依賴）

| 套件 | 版本 | 授權 | 類別 | 用途 |
| --- | --- | --- | --- | --- |
| `dexie` | 4.4.6 | Apache-2.0 | 執行期 | IndexedDB 存檔封裝 |
| `phaser` | 4.2.1 | MIT | 執行期 | 遊戲引擎（場景、貼圖、輸入與鏡頭） |
| `zod` | 4.6.7 | MIT | 執行期 | 內容與存檔資料的格式驗證 |
| `@playwright/test` | 1.64.1 | Apache-2.0 | 開發用 | 端到端測試（不隨遊戲發布） |
| `typescript` | 5.9.3 | Apache-2.0 | 開發用 | 型別檢查與編譯 |
| `vite` | 8.3.5 | MIT | 開發用 | 開發伺服器與建置（產生 dist/） |
| `vitest` | 5.0.5 | MIT | 開發用 | 單元測試與模擬 |

## 三、已安裝的全部套件（含間接依賴）

共 68 個套件（依 `package-lock.json` 與 `node_modules/` 產生）。

| 授權 | 套件數 |
| --- | --- |
| MIT | 33 |
| （平台專用套件，本機未安裝，未讀取授權） | 24 |
| Apache-2.0 | 7 |
| MPL-2.0 | 2 |
| ISC | 1 |
| BSD-3-Clause | 1 |

| 套件 | 版本 | 授權 |
| --- | --- | --- |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT |
| `@oxc-project/types` | 0.154.0 | MIT |
| `@playwright/test` | 1.64.1 | Apache-2.0 |
| `@rolldown/binding-android-arm-eabi` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-android-arm64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-darwin-arm64` | 1.2.14 | MIT |
| `@rolldown/binding-darwin-x64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-freebsd-x64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-arm-gnueabihf` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-arm64-gnu` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-arm64-musl` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-ppc64-gnu` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-s390x-gnu` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-x64-gnu` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-linux-x64-musl` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-openharmony-arm64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-win32-arm64-msvc` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-win32-x64-msvc` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/pluginutils` | 1.0.1 | MIT |
| `@types/chai` | 5.2.3 | MIT |
| `@types/deep-eql` | 4.0.2 | MIT |
| `@types/estree` | 1.0.9 | MIT |
| `@vitest/mocker` | 5.0.5 | MIT |
| `@vitest/spy` | 5.0.5 | MIT |
| `assertion-error` | 2.0.1 | MIT |
| `chai` | 6.3.0 | MIT |
| `detect-libc` | 2.1.2 | Apache-2.0 |
| `dexie` | 4.4.6 | Apache-2.0 |
| `es-module-lexer` | 2.3.2 | MIT |
| `estree-walker` | 3.0.3 | MIT |
| `eventemitter3` | 5.0.4 | MIT |
| `expect-type` | 1.4.0 | Apache-2.0 |
| `fdir` | 6.5.0 | MIT |
| `fsevents` | 2.3.3 | MIT |
| `lightningcss` | 1.33.0 | MPL-2.0 |
| `lightningcss-android-arm64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-darwin-arm64` | 1.33.0 | MPL-2.0 |
| `lightningcss-darwin-x64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-freebsd-x64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm-gnueabihf` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm64-gnu` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm64-musl` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-x64-gnu` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-x64-musl` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-win32-arm64-msvc` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-win32-x64-msvc` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `magic-string` | 1.4.3 | MIT |
| `nanoid` | 3.3.20 | MIT |
| `obug` | 3.0.0 | MIT |
| `phaser` | 4.2.1 | MIT |
| `picocolors` | 1.1.1 | ISC |
| `picomatch` | 4.0.7 | MIT |
| `playwright` | 1.64.1 | Apache-2.0 |
| `playwright-core` | 1.64.1 | Apache-2.0 |
| `postcss` | 8.5.31 | MIT |
| `rolldown` | 1.2.14 | MIT |
| `source-map-js` | 1.2.2 | BSD-3-Clause |
| `std-env` | 4.3.0 | MIT |
| `tinybench` | 6.2.2 | MIT |
| `tinyexec` | 1.3.1 | MIT |
| `tinyglobby` | 0.2.17 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vite` | 8.3.5 | MIT |
| `vitest` | 5.0.5 | MIT |
| `why-is-node-running` | 3.2.1 | MIT |
| `zod` | 4.6.7 | MIT |

## 四、字型

遊戲使用系統字型與瀏覽器預設的中文字型，沒有內嵌或下載字型檔。

## 五、本文件的限制

- 授權欄位取自各套件的 `package.json`，不是法律意見；公開發布前請由作者或法律顧問再次確認（見 ORIGINALITY.md）。
- 模型授權以 ART_PIPELINE.md 的記載為準；若更換模型，須同步更新本文件與 `content/assets.json` 的 `source`。

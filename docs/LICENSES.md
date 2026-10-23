# 素材與授權清單

本文件由 `npm run licenses`（`tools/licenses/generate.mjs`）產生，資料來源是 `content/assets.json`、`package.json`、`package-lock.json` 與 `node_modules/`。請改來源檔後重新產生，不要手改。

原則見 [ORIGINALITY.md](ORIGINALITY.md)：所有角色、地名、作物與文字皆為原創；素材來源必須登錄；來源不明的檔案不得進入發布版本。

## 一、素材（content/assets.json）

共 65 筆：有檔案 46 筆（其中本機模型生成 0、程式產生 3）、水平翻轉 1 筆（不另存檔）、占位（程式繪製的色塊，無檔案）18 筆。

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
| `tile.grass` | tile | `assets/tiles/grass-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.field` | tile | `assets/tiles/field-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.path` | tile | `assets/tiles/path-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.wall` | tile | `assets/tiles/wall-2x.png` | OpenAI built-in image generation tool（2026-10-23），原創全彩像素地表；無縫處理由 tools/art/tile_finalize.py --seamless 完成，輸出 RGBA8888。 |
| `tile.bed` | overlay | `assets/tiles/bed-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.shipbox` | overlay | `assets/tiles/shipbox-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
| `tile.door` | overlay | `assets/tiles/door-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |
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
| `tile.fence` | overlay | `assets/tiles/fence-2x.png` | OpenAI built-in image generation tool（2026-10-23），依專案原創物件設計生成透明像素圖層；未使用第三方遊戲素材；tools/art/tile_finalize.py --overlay 輸出 RGBA8888。 |

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
| `dexie` | 4.4.6 | （未安裝，無法讀取） | 執行期 | IndexedDB 存檔封裝 |
| `phaser` | 4.2.1 | （未安裝，無法讀取） | 執行期 | 遊戲引擎（場景、貼圖、輸入與鏡頭） |
| `zod` | 4.6.7 | （未安裝，無法讀取） | 執行期 | 內容與存檔資料的格式驗證 |
| `@playwright/test` | 1.64.1 | （未安裝，無法讀取） | 開發用 | 端到端測試（不隨遊戲發布） |
| `typescript` | 5.9.3 | （未安裝，無法讀取） | 開發用 | 型別檢查與編譯 |
| `vite` | 8.3.5 | （未安裝，無法讀取） | 開發用 | 開發伺服器與建置（產生 dist/） |
| `vitest` | 5.0.5 | （未安裝，無法讀取） | 開發用 | 單元測試與模擬 |

## 三、已安裝的全部套件（含間接依賴）

共 68 個套件（依 `package-lock.json` 與 `node_modules/` 產生）。

| 授權 | 套件數 |
| --- | --- |
| （未安裝，無法讀取） | 41 |
| （平台專用套件，本機未安裝，未讀取授權） | 27 |

| 套件 | 版本 | 授權 |
| --- | --- | --- |
| `@jridgewell/resolve-uri` | 3.1.2 | （未安裝，無法讀取） |
| `@jridgewell/sourcemap-codec` | 1.6.0 | （未安裝，無法讀取） |
| `@jridgewell/trace-mapping` | 0.3.31 | （未安裝，無法讀取） |
| `@oxc-project/types` | 0.154.0 | （未安裝，無法讀取） |
| `@playwright/test` | 1.64.1 | （未安裝，無法讀取） |
| `@rolldown/binding-android-arm-eabi` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-android-arm64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
| `@rolldown/binding-darwin-arm64` | 1.2.14 | （平台專用套件，本機未安裝，未讀取授權） |
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
| `@rolldown/pluginutils` | 1.0.1 | （未安裝，無法讀取） |
| `@types/chai` | 5.2.3 | （未安裝，無法讀取） |
| `@types/deep-eql` | 4.0.2 | （未安裝，無法讀取） |
| `@types/estree` | 1.0.9 | （未安裝，無法讀取） |
| `@vitest/mocker` | 5.0.5 | （未安裝，無法讀取） |
| `@vitest/spy` | 5.0.5 | （未安裝，無法讀取） |
| `assertion-error` | 2.0.1 | （未安裝，無法讀取） |
| `chai` | 6.3.0 | （未安裝，無法讀取） |
| `detect-libc` | 2.1.2 | （未安裝，無法讀取） |
| `dexie` | 4.4.6 | （未安裝，無法讀取） |
| `es-module-lexer` | 2.3.2 | （未安裝，無法讀取） |
| `estree-walker` | 3.0.3 | （未安裝，無法讀取） |
| `eventemitter3` | 5.0.4 | （未安裝，無法讀取） |
| `expect-type` | 1.4.0 | （未安裝，無法讀取） |
| `fdir` | 6.5.0 | （未安裝，無法讀取） |
| `fsevents` | 2.3.3 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss` | 1.33.0 | （未安裝，無法讀取） |
| `lightningcss-android-arm64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-darwin-arm64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-darwin-x64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-freebsd-x64` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm-gnueabihf` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm64-gnu` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-arm64-musl` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-x64-gnu` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-linux-x64-musl` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-win32-arm64-msvc` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `lightningcss-win32-x64-msvc` | 1.33.0 | （平台專用套件，本機未安裝，未讀取授權） |
| `magic-string` | 1.4.3 | （未安裝，無法讀取） |
| `nanoid` | 3.3.20 | （未安裝，無法讀取） |
| `obug` | 3.0.0 | （未安裝，無法讀取） |
| `phaser` | 4.2.1 | （未安裝，無法讀取） |
| `picocolors` | 1.1.1 | （未安裝，無法讀取） |
| `picomatch` | 4.0.7 | （未安裝，無法讀取） |
| `playwright` | 1.64.1 | （未安裝，無法讀取） |
| `playwright-core` | 1.64.1 | （未安裝，無法讀取） |
| `postcss` | 8.5.31 | （未安裝，無法讀取） |
| `rolldown` | 1.2.14 | （未安裝，無法讀取） |
| `source-map-js` | 1.2.2 | （未安裝，無法讀取） |
| `std-env` | 4.3.0 | （未安裝，無法讀取） |
| `tinybench` | 6.2.2 | （未安裝，無法讀取） |
| `tinyexec` | 1.3.1 | （未安裝，無法讀取） |
| `tinyglobby` | 0.2.17 | （未安裝，無法讀取） |
| `typescript` | 5.9.3 | （未安裝，無法讀取） |
| `vite` | 8.3.5 | （未安裝，無法讀取） |
| `vitest` | 5.0.5 | （未安裝，無法讀取） |
| `why-is-node-running` | 3.2.1 | （未安裝，無法讀取） |
| `zod` | 4.6.7 | （未安裝，無法讀取） |

## 四、字型

遊戲使用系統字型與瀏覽器預設的中文字型，沒有內嵌或下載字型檔。

## 五、本文件的限制

- 授權欄位取自各套件的 `package.json`，不是法律意見；公開發布前請由作者或法律顧問再次確認（見 ORIGINALITY.md）。
- 模型授權以 ART_PIPELINE.md 的記載為準；若更換模型，須同步更新本文件與 `content/assets.json` 的 `source`。

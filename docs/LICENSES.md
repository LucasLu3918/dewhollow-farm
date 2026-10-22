# 素材與授權清單

本文件由 `npm run licenses`（`tools/licenses/generate.mjs`）產生，資料來源是 `content/assets.json`、`package.json`、`package-lock.json` 與 `node_modules/`。請改來源檔後重新產生，不要手改。

原則見 [ORIGINALITY.md](ORIGINALITY.md)：所有角色、地名、作物與文字皆為原創；素材來源必須登錄；來源不明的檔案不得進入發布版本。

## 一、素材（content/assets.json）

共 65 筆：有檔案 16 筆（其中本機模型生成 9、程式產生 3）、水平翻轉 1 筆（不另存檔）、占位（程式繪製的色塊，無檔案）48 筆。

### 1.1 本機影像模型生成

角色與工具圖由本機影像模型生成，流程見 [ART_PIPELINE.md](ART_PIPELINE.md)。

- **模型**：Z-Image Turbo，**授權 Apache-2.0**。文生圖、固定 seed，綠幕去背、縮放並量化到 `content/palette.json`（`tools/art`）。提示詞與挑選記錄見 [art/character-briefs.md](art/character-briefs.md) 與 [art/tool-briefs.md](art/tool-briefs.md)。
- 未使用其他模型的圖；ART_PIPELINE 所列的其他模型（FLUX.2 klein、Qwen Image Edit）**沒有**產出任何已入庫的素材。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `player.up` | character | `assets/characters/xiaohan-back-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md（背面；提示詞 xiaohan-back-v1） |
| `player.down` | character | `assets/characters/xiaohan-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md（正面） |
| `player.left` | character | `assets/characters/xiaohan-side-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md（側面朝左；提示詞 xiaohan-side-v1） |
| `npc.maomao` | character | `assets/characters/maomao-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md |
| `pet.cat` | character | `assets/characters/cat-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md |
| `pet.marsupial` | character | `assets/characters/marsupial-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 202，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定見 docs/art/character-briefs.md |
| `tool.hoe` | object | `assets/tools/hoe-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 202，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定與挑選見 docs/art/tool-briefs.md |
| `tool.can` | object | `assets/tools/can-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 101，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定與挑選見 docs/art/tool-briefs.md |
| `tool.seedbag` | object | `assets/tools/seedbag-2x.png` | 本機模型生成：Z-Image Turbo（Apache-2.0）文生圖 seed 202，綠幕去背、縮放並量化到 content/palette.json（tools/art）；設定與挑選見 docs/art/tool-briefs.md |

### 1.2 程式產生（有檔案）

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `pwa.icon-192` | object | `assets/icons/icon-192.png` | 程式產生：tools/pwa/make-icons.mjs 以幾何圖形與純色繪製（太陽、幼苗、土丘），自行設計，無外部素材。PWA 圖示（192 px） |
| `pwa.icon-512` | object | `assets/icons/icon-512.png` | 程式產生：tools/pwa/make-icons.mjs 以幾何圖形與純色繪製（太陽、幼苗、土丘），自行設計，無外部素材。PWA 圖示（512 px） |
| `pwa.icon-maskable-512` | object | `assets/icons/icon-maskable-512.png` | 程式產生：tools/pwa/make-icons.mjs 以幾何圖形與純色繪製（太陽、幼苗、土丘），內容在中央圓以內，自行設計，無外部素材。PWA maskable 圖示（512 px） |

### 1.3 其他有檔案的素材

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `tool.axe` | object | `assets/tools/axe-2x.png` | 暫用鋤頭的圖（複製 hoe-2x.png，本機模型 Z-Image Turbo 文生圖 seed 202）。斧頭的正式圖待產圖後替換；日後替換時只改 file 與 source。 |
| `tool.pick` | object | `assets/tools/pick-2x.png` | 暫用鋤頭的圖（複製 hoe-2x.png，本機模型 Z-Image Turbo 文生圖 seed 202）。鎬的正式圖待產圖後替換。 |
| `tool.rod` | object | `assets/tools/rod-2x.png` | 暫用鋤頭的圖（複製 hoe-2x.png，本機模型 Z-Image Turbo 文生圖 seed 202）。釣竿的正式圖待產圖後替換。 |
| `tool.sickle` | object | `assets/tools/sickle-2x.png` | 暫用鋤頭的圖（複製 hoe-2x.png，本機模型 Z-Image Turbo 文生圖 seed 202）。鐮刀的正式圖待產圖後替換；日後替換時只改 file 與 source。 |

### 1.4 水平翻轉（不另存檔）

翻轉原圖在執行期完成，不另外存檔，來源與原圖相同。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `player.right` | character | 水平翻轉 `player.left` | 水平翻轉 player.left，不另存檔 |

### 1.5 占位（程式繪製的色塊，無檔案）

遊戲運行時以 `color` 繪製的占位圖或純色區塊，沒有圖檔，也不含任何外部素材。

| 素材 id | 類別 | 檔案 | 來源與授權 |
| --- | --- | --- | --- |
| `tile.grass` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.field` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.path` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.wall` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.bed` | object | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.shipbox` | object | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.door` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.soil` | overlay | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.sweet-radish` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.moon-bean` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.star-pepper` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.golden-rice` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.bell-pumpkin` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.maple-berry` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.snow-radish` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.frost-mushroom` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.ember-onion` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `npc.rong-bo` | character | （無檔案，程式繪製色塊） | 占位：程式繪製的色塊（M5a），無檔案；正式美術待繪製後補上 file 與來源 |
| `npc.a-gan` | character | （無檔案，程式繪製色塊） | 占位：程式繪製的色塊（M5a），無檔案；正式美術待繪製後補上 file 與來源 |
| `npc.shi-shifu` | character | （無檔案，程式繪製色塊） | 占位：程式繪製的色塊（M5a），無檔案；正式美術待繪製後補上 file 與來源 |
| `npc.zhi-lan` | character | （無檔案，程式繪製色塊） | 占位：程式繪製的色塊（M5a），無檔案；正式美術待繪製後補上 file 與來源 |
| `npc.xiao-sui` | character | （無檔案，程式繪製色塊） | 占位：程式繪製的色塊（M5a），無檔案；正式美術待繪製後補上 file 與來源 |
| `crop.dew-grass` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.dusk-potato` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `crop.silver-wheat` | crop | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.tree` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.water` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.floor` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.furniture` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.cave` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.rock` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.shop` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.forage` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.ore` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.stairs` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.trough` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.kitchen` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.workshop` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.workbench` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.tuft` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
| `tile.fence` | tile | （無檔案，程式繪製色塊） | 占位（程式產生） |
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

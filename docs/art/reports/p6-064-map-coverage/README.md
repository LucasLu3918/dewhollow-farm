# P6-064 全地圖 Coverage 報表

此報表列出所有手寫 `content/maps/*.json` 地圖，檢查檔名與 `map.id`、列數與寬度、row legend 符號、出生格、該圖使用的 `tile.<kind>` 素材、portal 目的地與落點，以及從起始農場經 portal 落點進入後的局部／跨圖可達性。報表由純函式 `mapCoverageReport` 讀取 `MapDef[]` 和素材 manifest 產生，不修改地圖或遊戲狀態。

## 結果

- Authored map coverage：**12/12（100%）**。
- 結構、檔名／ID、出生格與 tile asset 對照：**12/12 通過**。
- Portal cell：**22**；目的地及 walkable 落點有效，且一般地圖 portal 可從起始農場經已記錄的 portal entry 抵達。
- `house-full`、`house-wing` 是住宅升級的條件式變體：兩者包含於地圖 inventory、單獨從 IndexedDB fixture 載入、驗證出生格／碰撞並截圖。它們不由標準 `farm` portal graph 到達，故保留 `fromStart: false`，而非標成缺漏。
- `farm` 的溫室內部 `q` 出口從農場出生點本身不可達，但可在進入有條件的 `Q` portal 後由其落點抵達；報表保留 `reachableFromSpawn: false`，並以 entry-state 遍歷確認 `reachableInWorld: true`。

## 地圖逐項清冊

| Map ID / file | 尺寸 | Spawn（tile） | Legend tile kinds | Portal cells | 起始農場可達 | 分類 |
|---|---:|---|---|---:|:---:|---|
| `coop` · `content/maps/coop.json` | 8×6 | (3,4) floor | door, floor, trough, wall | 1 | 是 | 一般 |
| `cowbarn` · `content/maps/cowbarn.json` | 6×5 | (2,3) floor | door, floor, trough, wall | 1 | 是 | 一般 |
| `farm` · `content/maps/farm.json` | 40×30 | (7,9) grass | door, fence, field, grass, path, shipbox, wall | 7 | 是 | 起始地圖 |
| `forest` · `content/maps/forest.json` | 24×16 | (2,7) path | door, forage, grass, path, tree, tuft | 3 | 是 | 一般 |
| `house-full` · `content/maps/house-full.json` | 22×20 | (10,18) floor | bed, door, floor, furniture, kitchen, wall, workbench, workshop | 1 | 否 | 條件式住宅變體 |
| `house-wing` · `content/maps/house-wing.json` | 22×20 | (10,18) floor | bed, door, floor, furniture, kitchen, wall, workbench, workshop | 1 | 否 | 條件式住宅變體 |
| `house` · `content/maps/house.json` | 22×20 | (10,18) floor | bed, door, floor, furniture, kitchen, wall, workbench, workshop | 1 | 是 | 一般 |
| `lake` · `content/maps/lake.json` | 20×14 | (2,7) grass | door, grass, path, water | 1 | 是 | 一般 |
| `mine-entrance` · `content/maps/mine-entrance.json` | 16×10 | (8,8) path | cave, door, path, rock | 1 | 是 | 一般 |
| `pasture` · `content/maps/pasture.json` | 22×14 | (1,7) path | door, fence, grass, path, trough, tuft, wall | 2 | 是 | 一般 |
| `plaza` · `content/maps/plaza.json` | 16×12 | (2,6) grass | door, fence, furniture, grass, path, shop, wall, water | 1 | 是 | 一般 |
| `village` · `content/maps/village.json` | 16×12 | (7,10) grass | door, grass, path, shop, wall | 2 | 是 | 一般 |

各圖出現的 tile kind 都有 `content/assets.json` 中對應的 `tile.<kind>` 記錄。Portal 的日期／旗標條件在 E2E fixture 中設為可通過，目的是驗證目標 mapId 與落點；本報表不代表正常遊戲進度可略過解鎖條件。

## 執行方式與截圖

單元測試透過 `import.meta.glob` 枚舉全部 map JSON，避免手動清冊漏掉新增地圖；E2E 同樣枚舉每個檔案，逐圖從 IndexedDB fixture 載入並驗證實際場景、出生點、阻擋移動與所有 portal 轉場。每張地圖一張桌機截圖，另有每一個 portal 的轉場測試。

```sh
npm test -- src/infrastructure/content/map-coverage.spec.ts
npm run typecheck
E2E_BASE_URL=http://127.0.0.1:5189 PWA_BASE_URL=http://127.0.0.1:4173 \
  /Users/lucas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  ./node_modules/@playwright/test/cli.js test tests/e2e/map-world-coverage.spec.ts --workers=1 --reporter=line
```

截圖位於 [`screenshots/`](./screenshots/)；12 個檔案分別是 `coop.png`、`cowbarn.png`、`farm.png`、`forest.png`、`house-full.png`、`house-wing.png`、`house.png`、`lake.png`、`mine-entrance.png`、`pasture.png`、`plaza.png`、`village.png`。這些是 Chromium E2E 的桌機呈現證據，不代表原生手機或所有 DPR 的視覺驗收。

這組圖使用既有預設 runtime，驗證每張地圖可載入、出生點可見、碰撞有效；不是 Pixel32 候選美術 Gate，也不代表候選素材核准。P6-060 至 P6-063 的 DEV 候選仍以各任務自己的預覽截圖與使用者 Gate 審查為準。

## 限制

- `MapDef` 沒有單一 `tileset` 欄位；此處的 tile asset coverage 是以 legend kinds 對照既有 `tile.<kind>` manifest IDs，不宣稱新多層 schema 或 atlas-frame 完整性。
- Collision E2E 驗出生點至少一個相鄰阻擋格與 portal 進出；不等於每個阻擋 tile、居民路徑、互動點或任意移動序列的窮舉證明。
- 起始地圖 portal graph 不包含遊戲升級造成的 house map 選擇，因此兩個住宅變體單列為條件式覆蓋。

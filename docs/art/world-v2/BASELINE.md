# 世界美術重製基線（DF-V2-001、DF-V2-004）

盤點時間：2026-10-27（Asia/Taipei）。此文件是指定版本的靜態盤點，並非視覺或功能驗收報告。

- 工作分支：`codex/world-art-rebuild`；盤點時 HEAD 與已取得的 `origin/main` 均為 `3b456898367d79de8f4eb496b6fd733931a29f88`。此 SHA 可能隨遠端更新而過時。
- 規劃文件：`DEWHOLLOW_FARM_WORLD_ART_REBUILD_PLAN.zh-TW.md`，SHA-256 `adb0617c5b9cd7c7c8b6081366a4d4ddff47cf871aa1d0748ee26468db65ecb3`；其參考基準 `c6e77435f10b3bd63b8fd7bb2dfa4dc1fedb2f7b` 早於上述版本。
- 環境：macOS Darwin arm64；Node `v26.11.1`、npm `11.20.0`。`package.json` 版本 `0.1.0`，使用 Phaser 4、TypeScript、Vite、Vitest、Playwright 與 Dexie。
- 範圍：以本次讀取的 JSON 與原始碼列出資源、尺寸及差異；不表示資產視覺品質、版權、完整性或遊戲內呈現已驗收。執行前工作樹乾淨；其他並行工作可能於其後改變。
- 測試：本文件撰寫時未執行 `npm run check`、E2E、瀏覽器或實機測試；縮放重現、三份存檔與玩法基線由 DF-V2-002／003 另行提供。不得把未測視為通過。

## 全部地圖

來源：`content/maps/*.json` 的 `id`、`width` 與 `height`；以下不是 portal、碰撞、可達性或截圖覆蓋驗收。

| mapId | 尺寸（格） | 來源 |
|---|---:|---|
| `coop` | 8 × 6 | `content/maps/coop.json` |
| `cowbarn` | 6 × 5 | `content/maps/cowbarn.json` |
| `farm` | 40 × 30 | `content/maps/farm.json` |
| `forest` | 24 × 16 | `content/maps/forest.json` |
| `house-full` | 15 × 7 | `content/maps/house-full.json` |
| `house-wing` | 15 × 7 | `content/maps/house-wing.json` |
| `house` | 10 × 7 | `content/maps/house.json` |
| `lake` | 20 × 14 | `content/maps/lake.json` |
| `mine-entrance` | 16 × 10 | `content/maps/mine-entrance.json` |
| `pasture` | 22 × 14 | `content/maps/pasture.json` |
| `plaza` | 16 × 12 | `content/maps/plaza.json` |
| `village` | 16 × 12 | `content/maps/village.json` |

## 資產清單

來源：`content/assets.json`。共 74 筆 `assets`、6 筆 `itemIcons`、18 筆 `publicSourceFiles`；後者包含來源圖及 provenance sidecar，並非全部為執行時美術。下表的「無檔案」僅表示該筆沒有 `file` 欄位，不判斷實際 fallback 行為。每筆來源／用途以 manifest 為準；候選與核准狀態須另核對 `docs/art/asset-review.md` 和個別紀錄，不能由存在檔案推定。

| asset ID | kind | file |
|---|---|---|
| `tile.grass` | `tile` | `assets/tiles/vf11-grass-2x.png` |
| `tile.field` | `tile` | `assets/tiles/vf11-field-2x.png` |
| `tile.path` | `tile` | `assets/tiles/vf11-path-2x.png` |
| `tile.wall` | `tile` | `assets/tiles/vf11-wall-2x.png` |
| `tile.bed` | `overlay` | `assets/tiles/bed-2x.png` |
| `tile.shipbox` | `overlay` | `assets/tiles/vf11-shipbox-2x.png` |
| `tile.door` | `overlay` | `assets/tiles/vf11-door-2x.png` |
| `tile.soil` | `tile` | `assets/tiles/soil-2x.png` |
| `crop.sweet-radish` | `crop` | `assets/crops/sweet-radish-2x.png` |
| `crop.moon-bean` | `crop` | 無檔案 |
| `crop.star-pepper` | `crop` | 無檔案 |
| `crop.golden-rice` | `crop` | 無檔案 |
| `crop.bell-pumpkin` | `crop` | 無檔案 |
| `crop.maple-berry` | `crop` | 無檔案 |
| `crop.snow-radish` | `crop` | 無檔案 |
| `crop.frost-mushroom` | `crop` | 無檔案 |
| `crop.ember-onion` | `crop` | 無檔案 |
| `player.up` | `character` | `assets/characters/xiaohan-back-2x.png` |
| `player.down` | `character` | `assets/characters/xiaohan-2x.png` |
| `player.left` | `character` | `assets/characters/xiaohan-side-2x.png` |
| `player.right` | `character` | 無檔案 |
| `npc.maomao` | `character` | `assets/characters/maomao-2x.png` |
| `npc.rong-bo` | `character` | `assets/characters/npc-rong-bo-2x.png` |
| `npc.a-gan` | `character` | `assets/characters/npc-a-gan-2x.png` |
| `npc.shi-shifu` | `character` | `assets/characters/npc-shi-shifu-2x.png` |
| `npc.zhi-lan` | `character` | `assets/characters/npc-zhi-lan-2x.png` |
| `npc.xiao-sui` | `character` | `assets/characters/npc-xiao-sui-2x.png` |
| `crop.dew-grass` | `crop` | 無檔案 |
| `crop.dusk-potato` | `crop` | 無檔案 |
| `crop.silver-wheat` | `crop` | 無檔案 |
| `pet.cat` | `character` | `assets/characters/cat-2x.png` |
| `pet.marsupial` | `character` | `assets/characters/marsupial-2x.png` |
| `tool.hoe` | `object` | `assets/tools/hoe-2x.png` |
| `tool.can` | `object` | `assets/tools/can-2x.png` |
| `tool.seedbag` | `object` | `assets/tools/seedbag-2x.png` |
| `tile.tree` | `overlay` | `assets/tiles/tree-2x.png` |
| `scene.forest.grass` | `tile` | `assets/forest/ground-grass.png` |
| `scene.forest.path` | `tile` | `assets/forest/ground-path.png` |
| `scene.forest.moss` | `tile` | `assets/forest/ground-moss.png` |
| `scene.forest.tree` | `overlay` | `assets/forest/tree.png` |
| `scene.forest.rock` | `overlay` | `assets/forest/rock.png` |
| `tile.water` | `tile` | `assets/tiles/water-2x.png` |
| `tile.floor` | `tile` | `assets/tiles/floor-2x.png` |
| `tile.furniture` | `overlay` | `assets/tiles/furniture-2x.png` |
| `tile.cave` | `tile` | `assets/tiles/cave-2x.png` |
| `tile.rock` | `overlay` | `assets/tiles/rock-2x.png` |
| `tool.axe` | `object` | `assets/tools/axe-2x.png` |
| `tile.shop` | `overlay` | `assets/tiles/shop-2x.png` |
| `tile.forage` | `overlay` | `assets/tiles/forage-2x.png` |
| `tool.pick` | `object` | `assets/tools/pick-2x.png` |
| `tile.ore` | `overlay` | `assets/tiles/ore-2x.png` |
| `tile.stairs` | `overlay` | `assets/tiles/stairs-2x.png` |
| `tool.rod` | `object` | `assets/tools/rod-2x.png` |
| `tile.trough` | `overlay` | `assets/tiles/trough-2x.png` |
| `tile.kitchen` | `overlay` | `assets/tiles/kitchen-2x.png` |
| `tile.workshop` | `overlay` | `assets/tiles/workshop-2x.png` |
| `tile.workbench` | `overlay` | `assets/tiles/workbench-2x.png` |
| `tile.tuft` | `overlay` | `assets/tiles/tuft-2x.png` |
| `tool.sickle` | `object` | `assets/tools/sickle-2x.png` |
| `tile.fence` | `overlay` | `assets/tiles/vf11-fence-2x.png` |
| `animal.cow` | `object` | 無檔案 |
| `item.milk` | `object` | 無檔案 |
| `item.cheese` | `object` | 無檔案 |
| `item.butter` | `object` | 無檔案 |
| `animal.sheep` | `object` | 無檔案 |
| `item.wool` | `object` | 無檔案 |
| `item.cloth` | `object` | 無檔案 |
| `pwa.icon-192` | `object` | `assets/icons/icon-192.png` |
| `pwa.icon-512` | `object` | `assets/icons/icon-512.png` |
| `pwa.icon-maskable-512` | `object` | `assets/icons/icon-maskable-512.png` |
| `scene.village.general-shop` | `overlay` | `assets/tiles/vf11-shop-general-2x.png` |
| `scene.village.smithy` | `overlay` | `assets/tiles/vf11-shop-smithy-2x.png` |
| `scene.farm.tree` | `overlay` | `assets/tiles/vf11-tree-2x.png` |
| `scene.farm.house` | `overlay` | `assets/tiles/vf11-house-2x.png` |

物品圖示對照：

| item ID | file |
|---|---|
| `crop.sweet-radish` | `assets/items/sweet-turnip.png` |
| `seed.sweet-radish` | `assets/items/seed-bag.png` |
| `wood` | `assets/items/wood.png` |
| `copper-ore` | `assets/items/ore.png` |
| `fish.carp` | `assets/items/fish.png` |
| `dish.creek-stew` | `assets/items/stew.png` |

`publicSourceFiles`（不等同正式載入）：

- `assets/tiles/door-2x.png` — `gate1-source-only`
- `assets/tiles/fence-2x.png` — `gate1-source-only`
- `assets/tiles/field-2x.png` — `gate1-source-only`
- `assets/tiles/grass-2x.png` — `gate1-source-only`
- `assets/tiles/path-2x.png` — `gate1-source-only`
- `assets/tiles/shipbox-2x.png` — `gate1-source-only`
- `assets/tiles/vf11-door-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-fence-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-field-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-grass-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-house-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-path-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-shipbox-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-shop-general-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-shop-smithy-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-tree-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/vf11-wall-2x.png.provenance.json` — `asset-provenance-sidecar`
- `assets/tiles/wall-2x.png` — `gate1-source-only`

`public/assets/` 的其他檔案與 provenance 須按實際路徑檢視；manifest 表格是邏輯 ID 清單，不代表每個 public 檔案都由 `assets` 區段直接引用。Gate 1 候選位於 `docs/art/candidates/pixel-movement/`，保留候選狀態；`pixel32`／`pixel16` 均為 QA-only，不能以本盤點當核准。

## public/assets 檔案清單

以下為盤點時的全部實體檔案（含 sidecar）；不表示均為執行時載入或已核准。

- `public/assets/characters/cat-2x.png`
- `public/assets/characters/maomao-2x.png`
- `public/assets/characters/marsupial-2x.png`
- `public/assets/characters/npc-a-gan-2x.png`
- `public/assets/characters/npc-rong-bo-2x.png`
- `public/assets/characters/npc-shi-shifu-2x.png`
- `public/assets/characters/npc-xiao-sui-2x.png`
- `public/assets/characters/npc-zhi-lan-2x.png`
- `public/assets/characters/xiaohan-2x.png`
- `public/assets/characters/xiaohan-back-2x.png`
- `public/assets/characters/xiaohan-side-2x.png`
- `public/assets/crops/sweet-radish-2x.png`
- `public/assets/forest/ground-grass.png`
- `public/assets/forest/ground-moss.png`
- `public/assets/forest/ground-path.png`
- `public/assets/forest/rock.png`
- `public/assets/forest/tree.png`
- `public/assets/icons/icon-192.png`
- `public/assets/icons/icon-512.png`
- `public/assets/icons/icon-maskable-512.png`
- `public/assets/items/fish.png`
- `public/assets/items/fish.png.provenance.json`
- `public/assets/items/ore.png`
- `public/assets/items/ore.png.provenance.json`
- `public/assets/items/seed-bag.png`
- `public/assets/items/seed-bag.png.provenance.json`
- `public/assets/items/stew.png`
- `public/assets/items/stew.png.provenance.json`
- `public/assets/items/sweet-turnip.png`
- `public/assets/items/sweet-turnip.png.provenance.json`
- `public/assets/items/wood.png`
- `public/assets/items/wood.png.provenance.json`
- `public/assets/tiles/bed-2x.png`
- `public/assets/tiles/cave-2x.png`
- `public/assets/tiles/door-2x.png`
- `public/assets/tiles/fence-2x.png`
- `public/assets/tiles/field-2x.png`
- `public/assets/tiles/floor-2x.png`
- `public/assets/tiles/forage-2x.png`
- `public/assets/tiles/furniture-2x.png`
- `public/assets/tiles/grass-2x.png`
- `public/assets/tiles/kitchen-2x.png`
- `public/assets/tiles/ore-2x.png`
- `public/assets/tiles/path-2x.png`
- `public/assets/tiles/rock-2x.png`
- `public/assets/tiles/shipbox-2x.png`
- `public/assets/tiles/shop-2x.png`
- `public/assets/tiles/soil-2x.png`
- `public/assets/tiles/stairs-2x.png`
- `public/assets/tiles/tree-2x.png`
- `public/assets/tiles/trough-2x.png`
- `public/assets/tiles/tuft-2x.png`
- `public/assets/tiles/vf11-door-2x.png`
- `public/assets/tiles/vf11-door-2x.png.provenance.json`
- `public/assets/tiles/vf11-fence-2x.png`
- `public/assets/tiles/vf11-fence-2x.png.provenance.json`
- `public/assets/tiles/vf11-field-2x.png`
- `public/assets/tiles/vf11-field-2x.png.provenance.json`
- `public/assets/tiles/vf11-grass-2x.png`
- `public/assets/tiles/vf11-grass-2x.png.provenance.json`
- `public/assets/tiles/vf11-house-2x.png`
- `public/assets/tiles/vf11-house-2x.png.provenance.json`
- `public/assets/tiles/vf11-path-2x.png`
- `public/assets/tiles/vf11-path-2x.png.provenance.json`
- `public/assets/tiles/vf11-shipbox-2x.png`
- `public/assets/tiles/vf11-shipbox-2x.png.provenance.json`
- `public/assets/tiles/vf11-shop-general-2x.png`
- `public/assets/tiles/vf11-shop-general-2x.png.provenance.json`
- `public/assets/tiles/vf11-shop-smithy-2x.png`
- `public/assets/tiles/vf11-shop-smithy-2x.png.provenance.json`
- `public/assets/tiles/vf11-tree-2x.png`
- `public/assets/tiles/vf11-tree-2x.png.provenance.json`
- `public/assets/tiles/vf11-wall-2x.png`
- `public/assets/tiles/vf11-wall-2x.png.provenance.json`
- `public/assets/tiles/wall-2x.png`
- `public/assets/tiles/water-2x.png`
- `public/assets/tiles/workbench-2x.png`
- `public/assets/tiles/workshop-2x.png`
- `public/assets/tools/axe-2x.png`
- `public/assets/tools/can-2x.png`
- `public/assets/tools/hoe-2x.png`
- `public/assets/tools/pick-2x.png`
- `public/assets/tools/rod-2x.png`
- `public/assets/tools/seedbag-2x.png`
- `public/assets/tools/sickle-2x.png`

## 與規劃文件的差異及決策

| 項目 | 目前可核實事實 | 後續處置 |
|---|---|---|
| 基準 SHA | 計畫指向 `c6e7743`；本次 `origin/main` 是 `3b45689`，其間已有素材、背包及其他提交。 | 每階段重新核對 SHA 與現況；不要以計畫的 TODO 推定功能缺席。 |
| 存檔版本 | `src/domain/game-state.ts` 的 `SAVE_SCHEMA_VERSION` 為 **24**；遷移程式包含 23 → 24。計畫仍稱 v23 為現行版本。 | 保留 v23 作舊版 fixture，新增／保護 v24 基線；任何座標遷移須驗證資料不遺失。未在本文件執行遷移測試。 |
| 地圖尺寸 | 初始小屋 10×7、兩種擴建 15×7，與計畫一致；完整 mapId 和尺寸見上表。 | 視覺重製前驗證入口、碰撞、佈局與舊存檔；目前未實測。 |
| 畫素及座標 | `TILE_SIZE=64`，基準視野 16×12；`legacy` 為預設，32px／16px 為 QA-only。 | 32px 是提案而非正式切換；依計畫進行受控比較與人工審核。 |
| 素材狀態 | `docs/art/asset-review.md` 記錄舊風格參考與逐檔核准，並有已整合素材；不適用於新候選。 | 不撤銷既有核准；新素材依確切版本與 SHA 取得使用者核准，經既有 gate 後再整合。 |
| 場景素材 | 目前 manifest 已列 farm、village 與 forest 的場景資產；不能認定整體同風格或所有地圖已覆蓋。 | 比對實際渲染和逐場景核准證據，未測項列為待驗收。 |
| 移動時長 | `movement-scheduler.ts` 預設每格 140ms，與計畫靜態觀察一致。 | 速度及步態是否需調整仍待可玩比較，不在此更改規則。 |
| 縮放故障 | 計畫提出可能的尺寸 authority 衝突，尚需同場景、同 viewport 動態量測。 | DF-V2-002 重現並記錄數據；未重現或未測時不宣稱修復。 |
| 相容及發布 | 計畫同時建議分 Gate 與保留 legacy 路徑。 | 以真實 Gate、測試與版本化核准決定整合；P0 盤點不構成發布或人工美術驗收。 |

## 影響範圍

本次僅新增人類規劃與審核使用的文件；輸入是列示的版本化專案資料和規劃文件，不變更 runtime API、遊戲資料、事件、地圖或存檔。主要風險為基準過期或誤稱驗收，因此記錄來源、SHA 與未測狀態。AIPS Change Impact 草稿狀態不代表已通過驗證。

# 技術計畫（架構、存檔、工具、測試、部署）

遵守 [AGENTS.md](../AGENTS.md) 的分層：domain 純規則 → application 指令 → infrastructure 實作 → presentation 呈現；`main.ts` 是唯一組裝點。規則變更先寫失敗的測試。

## 1. 架構擴充

### domain 新增模組

| 模組 | 責任 |
| --- | --- |
| `items`、`inventory`（M0 已完成） | 通用物品定義與背包（取代 seeds／crops 兩個字典）、品質、堆疊、格數上限；種子與收成物品由作物衍生（`seed.<id>`、`crop.<id>`），其他物品待 M4 加 `content/items.json` |
| `season` `weather` | 季節、天氣（以存檔 rng 決定，可重現） |
| `skills` | 經驗與等級 |
| `relationships` | 好感、送禮、行程判定 |
| `quests` | 任務狀態機與目標判定 |
| `events` | 事件條件與效果（見下） |
| `achievements` | 成就條件與解鎖 |
| `animals` `fishing` `mining` `cooking` | 各系統規則；礦坑逐層以種子程序生成 |
| `economy` | 售價、品質倍率、商店庫存 |
| `progression` | 農場評級、豐收重置、傳承 |

### 資料驅動的事件與任務

事件、任務、成就以 JSON 描述，並由 zod 驗證（延續 `content-schema.ts`）：

```jsonc
{
  "id": "maomao-heart-2",
  "trigger": { "type": "heart", "npc": "maomao", "min": 2, "map": "lake", "time": [1700, 2000] },
  "conditions": [{ "flag": "main-ch3-done" }, { "season": "summer" }],
  "once": true,
  "steps": [
    { "say": { "npc": "maomao", "text": "…" } },
    { "emote": { "who": "maomao", "kind": "heart" } },
    { "choice": [{ "text": "…", "effects": [{ "heart": ["maomao", 1] }] }] },
    { "give": { "item": "…", "count": 1 } },
    { "setFlag": "maomao-heart-2-seen" }
  ]
}
```

domain 負責判斷「可否觸發」與「效果結算」；presentation 的事件播放器逐步演出（對話、移動、鏡頭、音效）。同一份資料可用單元測試驗證，不需要 Phaser。

### presentation 擴充

- **鏡頭**（M0 已完成）：跟隨主角，中央留死區、平滑、邊界夾限；地圖比視窗小時邊界擴張讓地圖置中（純函式在 `presentation/camera.ts`，有單元測試）。格子 64 px，視窗固定 16×12 格；效果與占位圖的像素值以 32 px 設計稿為基準，乘上 `UNIT`。開發模式下 `window.__dewhollow` 提供鏡頭位置、地圖 id、玩家姿勢與骨架資訊、`setPose`（擺出走路循環任一相位）與 `snapshot`（讀 WebGL 畫面）、`renderCompat`（軟體繪圖器保底的偵測結果）給 e2e 與逐格檢查，正式建置不含。
- **夥伴與骨架資料**：`content/rigs.json`（`biped`／`single`／`hop`）與 `content/companions.json`（跟隨或常駐），由 `loadContent` 驗證並交叉檢查；寵物只在畫面上，不進存檔。應用層新增 `talked` 事件。
- **工具與表情**：`content/tools.json`（工具、動作、握把位置、揮動方式）、`rigs.json` 的 `hands`，由 `loadContent` 驗證並交叉檢查；應用層新增 `refused` 事件與 `talked` 的 `first`／`gifted`；`tool-swing.ts`、`emote-defs.ts` 為純函式。調色盤擴充到 64 色（只擴充、不重排）。
- **軟體繪圖器保底**：`presentation/render-compat.ts`（判斷，純函式）與 `apply-render-compat.ts`（套用）。偵測到軟體繪圖器時把每批貼圖數限制為 1，避開 Phaser 4.2.1 多貼圖著色器的精確浮點比較；實際 GPU 不受影響。`?compat=1`／`?compat=0` 可強制開關。M7 的效能預算要記得：此模式下 draw call 較多；升級 Phaser 時留意 e2e 的金絲雀。
- **地圖**：沿用 ASCII 格式為底，擴充多圖層（地表、物件、遮擋）；碰撞與互動點由 domain 讀取。是否改用 Tiled 見「工具」。
- **精靈動畫**：以貼圖集（texture atlas）載入，動畫由 `content/animations.json` 描述。
- **UI**：DOM HUD 擴充為背包、任務、地圖、設定、對話框，遵守 `game-ui-ux` 技能的鍵盤焦點與事件驅動更新。
- **特效**：Phaser 粒子為主，統一在 `effects.ts`；提供「減少動態」開關。
- **音訊**：音效配方 `content/sounds.json`（程式合成，M2 已實作）、地形腳步 `content/terrain.json`；音量匯流排與音樂來源留到 M3。
- **輸入**：動作映射與重新綁定（`input-systems` 技能），虛擬搖桿供觸控。

### 場景切換與載入

素材依區域延後載入（農場先載入，礦坑與湖畔進入前才載入）；載入畫面顯示進度與真實錯誤。

## 2. 存檔 schema 與遷移

- **目前存檔 schema v23**：早期 v2 將背包改為通用物品堆疊（`inventory`）、出貨箱改為物品條目（`shipBox.entries`），並新增 `playtimeSeconds`；後續功能透過逐版遷移擴充。這些 v2 欄位說明是歷史紀錄，不代表目前版本。
- 遷移：`save-migrations.ts` 的遷移表（鍵為來源版本，每版一個純函式、各有測試）；舊版 schema 凍結在 `save-schema-v1.ts`。讀取時先依版本驗證舊格式、遷移、再驗證新格式；版本比遊戲新、缺版本、舊格式損毀都顯示真實錯誤，不覆蓋原檔。遷移容量不足時加大背包，不丟東西。
- **M3 的 v3**：`SAVE_SCHEMA_VERSION = 3`，日曆改為四季（`calendar.day` 是季節內的第幾天，`season` 為四季之一）；新增今天的天氣 `weather` 與明天的預報 `forecast`。遷移 v2 → v3：舊的 `day` 是從開始算起的總天數（全部在春天），依 `calendarOnDay` 換成年、季、日；舊存檔的今天與明天天氣都設為晴（之後照常抽）。
- **M4 的 v4**：`SAVE_SCHEMA_VERSION = 4`，新增 `toolTiers`（每件工具的階級）與 `worldChanges`（砍樹、採野薄荷的紀錄，鍵為 "地圖,x,y"）；工具新增斧頭（`axe`）。遷移 v3 → v4：階級全部為 0、變化為空。
- **M4 P1 的 v5–v11**：v5 礦坑種子 `mineSeed` 與檢查點 `mineCheckpoint`（礦坑層由種子生成，不存進存檔）；v6 技能經驗 `skills`；v7 釣魚狀態 `fishing`；v8 動物 `animals`；v9 料理（只升版本）；v10 加工機 `processing`（加工中與已完成的批次，舊存檔從空的開始）；v11 施肥，田 `plots[*].fertilizer` 為選填欄位。
- **v12–v23**：v12 技能天賦與鐮刀階級；v13 牛舍與牛奶紀錄；v14 居民好感與心形事件；v15 委託、佈告欄、信箱與圖鑑碎片；v16 主線與節慶；v17 星河兌換紀錄；v18 社區修復與每日隨機事件；v19 圖鑑與成就；v20 秋冬季節；v21 綿羊、擴建與季節商店；v22 裝飾、衣物與旅人購買紀錄；v23 農場評級、收成年收入與傳承欄位，舊存檔會帶入預設角色名字並從第一代開始。實際轉換與欄位驗證以 `save-migrations.ts`、`save-schema.ts` 為準。
- 遊玩時數：`GameSession` 以兩次指令的間隔累加，超過 60 秒視為離開座位不計入，存檔時寫入；時鐘可注入，方便測試。
- **目前存檔管理**：三個 IndexedDB 存檔槽，支援匯出／匯入 JSON 與存檔中的遊戲版本資訊；匯入與讀取都會驗證並走 schema 遷移。實作不以雜湊作為存檔驗證。
- **設定遷移**：本機偏好採 v2 版本封套；讀取既有 v1 平面格式時保留有效欄位，之後寫入 v2。偏好儲存失敗不會阻止遊戲繼續執行。

## 3. 工具與安裝（需使用者同意後才安裝）

本機現況：Node 26、npm 11、Python 3.14、ffmpeg 已安裝；Pillow、ImageMagick、Aseprite 未安裝。

| 工具 | 用途 | 建議 |
| --- | --- | --- |
| Pillow（Python 虛擬環境內） | 去背、縮放、調色盤量化、接觸表 | 安裝（推薦），不污染系統 Python |
| ImageMagick（brew） | 批次圖片處理備援 | 可選，與 Pillow 擇一即可 |
| Tiled 地圖編輯器 | 視覺化編輯大地圖，輸出 JSON | 可選；先沿用 ASCII，地圖變大後再評估 |
| vite-plugin-pwa | 離線與安裝 | M7 安裝 |
| jsfxr 類音效合成工具或 CC0 音效包 | 程式合成音效／免費音效 | 依 D5 決定；需記錄授權 |
| Aseprite | 手修像素動畫 | 付費軟體，**不安裝**；以 Pillow 腳本與程式動畫取代 |
| GitHub Actions | CI：typecheck、test、build、e2e | M0 加入 |

專案內已可用的技能（不需安裝）：`game-feel`、`rpg`、`save-systems`、`game-ui-ux`、`audio-design`、`dialogue-systems`、`procedural-gen`、`level-design`、`camera-systems`、`input-systems`、`performance-optimization`、`local-image-model-router`、`webapp-testing`。各里程碑在對應步驟載入。

## 4. 測試策略

| 層 | 做法 |
| --- | --- |
| domain／application | Vitest，規則先寫失敗測試；每個新系統附邊界案例 |
| 內容 | 載入所有 JSON 並驗證參照（作物、物品、居民、事件旗標）無懸空 |
| 存檔 | 每個遷移一組快照測試；損毀檔案測試 |
| 遊玩時數模擬 | `tests/sim/`：無頭機器人用固定策略玩 80 天，輸出金錢、解鎖時間曲線與估計真實時間；平衡改動必須跑它 |
| E2E | Playwright：完整循環、換圖載入失敗、存讀檔、事件與任務可完成、觸控操作 |
| 視覺 | 關鍵畫面截圖比對（M2 之後），以 `webapp-testing` 技能執行 |
| 效能 | 中階手機剖析；物件池、紋理圖集、批次繪製（`performance-optimization` 技能） |

## 5. 部署與營運

- 目標：靜態網站（平台見 D3）；Vite 的 `base` 依平台設定。
- 建置：`npm run check` 通過才部署；CI 在 PR 與 main 上跑 check 與 e2e。
- PWA：離線快取、安裝提示、版本更新提示。
- 資料安全：存檔在瀏覽器 IndexedDB，易因清除網站資料而遺失 → 提供匯出匯入與提醒。
- 版本：語意化版本，畫面顯示版本號；`CHANGELOG.md`。
- 隱私：不收集個資、無第三方追蹤；若日後要加錯誤回報，需另行徵得同意並更新說明頁。
- 授權與來源清單：發布時產生 `CREDITS.md`，由 `content/assets.json` 的 `source` 彙整。

## 6. Git 與流程

- 已建立初始 commit（`private/` 與 ROM 在 `.gitignore`，維持不進版控）；M0 在 `m0-foundation` 分支進行。
- 每個里程碑一個分支與 PR，合併前跑 `npm run check` 與 `npm run test:e2e`。
- 公開發布前掃描 repo，確認沒有 `private/`、ROM、來源不明檔案。

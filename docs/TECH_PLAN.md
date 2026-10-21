# 技術計畫（架構、存檔、工具、測試、部署）

遵守 [AGENTS.md](../AGENTS.md) 的分層：domain 純規則 → application 指令 → infrastructure 實作 → presentation 呈現；`main.ts` 是唯一組裝點。規則變更先寫失敗的測試。

## 1. 架構擴充

### domain 新增模組

| 模組 | 責任 |
| --- | --- |
| `items` | 通用物品定義與背包（取代 seeds／crops 兩個字典）、品質、堆疊 |
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

- **鏡頭**：地圖大於螢幕時跟隨主角（死區、邊界夾限、平滑；見 `camera-systems` 技能）。
- **地圖**：沿用 ASCII 格式為底，擴充多圖層（地表、物件、遮擋）；碰撞與互動點由 domain 讀取。是否改用 Tiled 見「工具」。
- **精靈動畫**：以貼圖集（texture atlas）載入，動畫由 `content/animations.json` 描述。
- **UI**：DOM HUD 擴充為背包、任務、地圖、設定、對話框，遵守 `game-ui-ux` 技能的鍵盤焦點與事件驅動更新。
- **特效**：Phaser 粒子為主，統一在 `effects.ts`；提供「減少動態」開關。
- **音訊**：音量匯流排與音效事件對照表 `content/audio.json`。
- **輸入**：動作映射與重新綁定（`input-systems` 技能），虛擬搖桿供觸控。

### 場景切換與載入

素材依區域延後載入（農場先載入，礦坑與湖畔進入前才載入）；載入畫面顯示進度與真實錯誤。

## 2. 存檔 v2

- `SAVE_SCHEMA_VERSION` 升為 2，新增：背包新格式、季節與天氣、技能、好感、任務與事件旗標、成就、動物、圖鑑、設定、遊玩時間。
- 提供 `migrate(v1 → v2)`，每個版本一個純函式、各有測試；讀取時先驗證再遷移，損毀時顯示真實錯誤，不覆蓋原檔（沿用現行原則）。
- 多存檔槽（3 個）、自動存檔輪替（睡覺時寫入）、匯出／匯入 JSON 檔（含版本與雜湊檢查）。
- 遊玩時數、版本號寫入存檔，供平衡分析與支援。

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

- 目前尚無任何 commit；M0 第一步建立初始 commit（`private/` 與 ROM 已在 `.gitignore`，維持不進版控）。
- 每個里程碑一個分支與 PR，合併前跑 `npm run check` 與 `npm run test:e2e`。
- 公開發布前掃描 repo，確認沒有 `private/`、ROM、來源不明檔案。

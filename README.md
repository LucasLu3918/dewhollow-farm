# 晨露農場（Dewhollow Farm）

原創農場生活網頁遊戲的垂直切片 MVP。以 TypeScript、Phaser 與 IndexedDB 實作，所有素材為占位圖，規格見 [docs/MVP_SPEC.md](docs/MVP_SPEC.md)，權利界線見 [docs/ORIGINALITY.md](docs/ORIGINALITY.md)。

## 指令

```bash
npm install
npm run dev        # 開發伺服器 http://127.0.0.1:5173
npm test           # 單元測試（domain、application、content、schema）
npm run typecheck
npm run build
npm run check      # typecheck + test + build
npm run test:e2e   # Playwright 端到端測試（需要 Chromium）
```

## 操作

方向鍵移動 · X 互動 · Z 切換工具 · C 切換種子 · S 存檔

## 目錄

```
src/
  domain/          純規則：時間、體力、田地、背包、出貨、地圖（不依賴 Phaser、DOM 或 IndexedDB）
  application/     指令與 use case、GameSession、存檔埠（port）
  infrastructure/  內容載入與驗證、素材清單、IndexedDB 與記憶體存檔
  presentation/    Phaser 場景、DOM HUD（只呈現狀態，不做規則判斷）
  main.ts          組裝點：決定使用哪個存檔實作
content/           地圖、作物、NPC、起始設定、素材清單（JSON）
tests/e2e/         Playwright 端到端測試
```

## 文件

- 上線規劃：[ROADMAP](docs/ROADMAP.md)（總綱）· [GAME_DESIGN](docs/GAME_DESIGN.md) · [CONTENT_PLAN](docs/CONTENT_PLAN.md) · [ART_PIPELINE](docs/ART_PIPELINE.md) · [ANIMATION_DESIGN](docs/ANIMATION_DESIGN.md) · [TECH_PLAN](docs/TECH_PLAN.md) · [DECISIONS](docs/DECISIONS.md)（待決定）
- 既有：[MVP_SPEC](docs/MVP_SPEC.md) · [ORIGINALITY](docs/ORIGINALITY.md) · [CHARACTERS](docs/CHARACTERS.md) · [ART_STYLE](docs/ART_STYLE.md) · [TUNING](docs/TUNING.md)

## 替換素材

在 `content/assets.json` 為素材加上 `file`（相對於 `public/`、必須在 `assets/` 底下），並填寫實際的 `source`（有檔案卻寫「占位」會被內容驗證擋下）。圖檔若是設計尺寸的兩倍（2x 母版），加上 `"density": 2`，引擎會以 0.5 倍顯示；角色圖以腳底貼齊格子底部。朝右這類「另一張圖的水平翻轉」用 `"mirrorOf": "<素材 id>"`，不另存檔、不另外載入。沒有 `file` 時使用 `color` 的占位圖。若檔案載入失敗，畫面會列出錯誤並改用占位圖。

## 存檔

三個存檔槽（`slot-1` 至 `slot-3`）存於瀏覽器的 IndexedDB，可用 `?slot=` 指定目前槽位。睡覺時自動存檔，S 為手動存檔；預設按 L 開啟存檔管理，可讀取、新建、刪除、匯出及匯入存檔。讀取與匯入會驗證格式並遷移舊版資料；損毀或更新版本的存檔會顯示錯誤，不會靜默覆蓋。

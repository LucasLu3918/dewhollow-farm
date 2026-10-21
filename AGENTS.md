# AGENTS.md

給 AI agent 的專案指引。

## 分層（依賴只能由外往內）

- `src/domain`：純 TypeScript 規則。不得匯入 `phaser`、DOM、`indexedDB` 或 `dexie`。
- `src/application`：指令與 use case、存檔埠（port）。只依賴 domain。
- `src/infrastructure`：port 的實作（IndexedDB、內容載入、素材清單）。
- `src/presentation`：Phaser 場景與 DOM HUD。只呈現狀態並送出指令，不寫規則。
- `src/main.ts`：組裝點，是唯一決定具體實作的地方。

## 測試

- 單元測試與被測檔同目錄，命名為 `*.spec.ts`，以 `npm test` 執行。
- 規則變更先寫失敗的測試，再寫實作。
- 端到端測試放在 `tests/e2e/`，以 `npm run test:e2e` 執行。

## 內容與素材

- 遊戲數值與文字放在 `content/` 的 JSON，不寫死在程式中。
- 所有角色、地名、作物與文字必須是原創，見 `docs/ORIGINALITY.md`。
- 素材新增或替換時，同步更新 `content/assets.json` 的 `source`。

## 完成前驗證

```bash
npm run check
npm run test:e2e
```

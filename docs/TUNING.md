# 數值校準流程

MVP 的數值集中在 `content/tuning.json` 與 `content/crops.json`，不寫死在程式中。校準時只改這兩個檔案，不需要改規則程式碼。

## 可調整的數值

| 檔案 | 欄位 | 意義 |
| --- | --- | --- |
| `content/tuning.json` | `energy.max` | 體力上限 |
| `content/tuning.json` | `energy.costs.*` | 開墾、澆水、播種、收成、出貨各自消耗的體力 |
| `content/tuning.json` | `time.wakeMinute` | 睡醒時間（分鐘，360 代表 06:00） |
| `content/tuning.json` | `time.minutesPerAction` | 每個有效動作花費的分鐘數 |
| `content/crops.json` | `seedPrice` | 種子價格；出貨售價由公式 `種子價 × 3 × (1 + 0.1 × 成長天數)` 算出（見 `src/domain/pricing.ts`） |
| `content/crops.json` | `growthDays` | 作物成熟所需的澆水天數 |
| `content/start.json` | `gold`、`seeds` | 起始金錢與種子 |

## 校準原則

1. **觀察值是參考，不是複製目標。** 校準後的數值是本專案的設計決策，不要求與任何既有作品相同。
2. **只記錄數字與自己的描述。** 不抄錄任何原作的文字、對話、名稱、美術或音樂，也不從 ROM 抽取資料表。
3. **每個數值要記錄觀察依據。** 寫在 `private/reference-roms/OBSERVATION_LOG.md`（本機私人檔案，不進版控），依欄位逐項填寫。
4. **作物以代號記錄。** 觀察時用「作物 A／B／C」，正式內容的作物名稱仍由本專案自行命名。
5. **修改後必跑完整驗證。** `npm run check` 與 `npm run test:e2e` 都要通過。

## 流程

1. 依 `OBSERVATION_LOG.md` 的欄位在模擬器中觀察並記錄。
2. 把數字寫進 `content/tuning.json` 與 `content/crops.json`，並在 `docs/MVP_SPEC.md` 的數值表中同步更新。
3. 執行 `npm run check` 與 `npm run test:e2e`。
4. 若某個數值改變了遊玩節奏（例如一天能做的事太少或太多），記錄在 `MVP_SPEC.md` 的「已知限制」中，等試玩後再調整。

---
name: formal-verify-farm-growth
description: "Bounded exhaustive model check of the crop growth and withering rules in src/domain/farm.ts. Use when changing tillPlot, waterPlot, plantCrop, harvestPlot, growCrops, or waterAllPlots, the sleep settlement, watering, rain, or crop maturity, or when asked to prove that crops grow, wither, or harvest correctly in every order of actions."
---

# formal-verify-farm-growth

## 要證明的性質

農作物是玩家最珍貴的投入，錯一次就是白費體力與金錢。單元測試一次只看一個情境，漏掉的是「不同動作的順序」，例如開墾、播種、睡覺、下雨、再睡覺的組合。這個檢查把這些順序全部走一遍。

性質（依據 `src/domain/farm.ts` 的 `growCrops` 註解「睡覺結算」）：

1. 成長天數永遠在 `0..成熟天數` 之間。
2. 澆水的作物睡一晚生長一天，但不超過成熟天數，缺水計數歸零。
3. 第 1 晚缺水：成長天數減一（最低為 0），缺水計數變成 1。
4. 連續第 2 晚缺水：作物枯死，枯死清單含該作物 id。
5. 沒有作物的田，缺水計數必為 0，睡覺後澆水標記清除。
6. 只有成熟的作物可以收成。

## 工具選擇

在 TypeScript 裡用 vitest 做有限範圍的廣度優先窮舉。理由：

- 被檢查的函式是純函式，直接呼叫真實的 `farm.ts`，不另寫一份手工模型，所以不會和實作脫節。
- 專案已有 vitest 與 TypeScript，不需要安裝新工具，一行指令就能重跑。
- 本機沒有 TLA+（`tlc`）、Alloy、Dafny、Lean 或 Z3。Java 21 存在，但 `tla2tools.jar` 不在本機，取得它需要下載，必須先得到使用者同意。若使用者日後要 TLA+，這個 skill 可以改寫。

## 範圍（bounds）

- 一塊田、一種作物（`moonbean`）、成熟天數 3。
- 六個動作：`till`、`water`、`plant`、`harvest`、`rain`（`waterAllPlots`）、`night`（`growCrops`）。
- 從空地出發，廣度優先走遍所有可達狀態。狀態有限，因為成長天數被封頂、缺水計數只會是 0 或 1，所以搜尋會結束，這是完整的窮舉，不是抽樣。

**不包含**：肥料（`fertilizer`，`harvestPlot` 與 `growCrops` 的肥料保留邏輯）、多塊田之間的交互作用、存檔與讀檔、同一天內的先後順序、不同作物的不同成熟天數。這些的通過不代表它們正確。

## 怎麼執行

```bash
npx vitest run src/domain/farm.model.spec.ts
```

應該看到 2 個測試通過。也可以跑 `npm test`，它會一起跑全部單元測試。

規格檔：[src/domain/farm.model.spec.ts](../../../src/domain/farm.model.spec.ts)。

## 失敗時怎麼讀

反例以動作序列呈現，例如：

```
反例：till → plant → night → night：連續第 2 晚缺水，作物沒有枯死
```

先判斷它是哪一種：

- **真的 bug**：實作違反了 `growCrops` 的註解。修 `farm.ts`，不要改模型。
- **有意的規則變更**：先在 `farm.ts` 的註解寫下新規則，再同步修改 `farm.model.spec.ts` 裡對應的預期值（`nightProblems`），並在 PR 說明為什麼改。
- **模型寫錯**：`nightProblems` 或 `stateProblems` 的預期值與註解不符。修模型，並說明是哪一條註解。

不要為了讓它通過而放寬性質。

## 證明它會失敗（每次改了被覆蓋的程式後）

模型只有在能抓到破壞時才有意義。已經實際驗證過的兩個破壞（都是在 `farm.ts` 的暫時修改，驗證後已還原）：

| 破壞 | 反例 |
| --- | --- |
| 缺水第 2 晚才枯死（`>= 2` 改成 `>= 3`） | `till → plant → night → night`：連續第 2 晚缺水，作物沒有枯死 |
| 去掉成長天數的下限（`Math.max(..., 0)` 拿掉） | `till → plant → night`：成長天數超出 0..3：-1 |

重跑時若要再做一次，改完後先確認 `git diff` 只有你預期的那一行，驗完用 `git checkout -- src/domain/farm.ts` 還原。不要留下暫時修改。

## 覆蓋紀錄與同步點

- 覆蓋的函式：`src/domain/farm.ts` 的 `tillPlot`、`waterPlot`、`plantCrop`、`harvestPlot`、`growCrops`、`waterAllPlots`。
- 規格：`src/domain/farm.model.spec.ts`。
- **同步 commit：`7d1ec75ab1ded0676deb3c2f69ad538b97b2275f`**。在這個 commit，模型與 `farm.ts` 的描述一致，且兩個破壞都被抓到。

只有在你確認模型仍然描述 `farm.ts` 的新版本後，才把同步 commit 往前推。判斷方法：`git diff <同步 commit>..HEAD -- src/domain/farm.ts`，若有改動，逐條對照上面六條性質。

## 目前結果

在同步 commit 的範圍內，**沒有發現違反性質的狀態**。這代表「一塊田、成熟天數 3、六個動作」的所有可達狀態都符合上面六條性質，不代表整個系統正確。

## 交接

- 要保持這份驗證與程式同步，請使用 `/pstack:maintain-formal-verification-skill`。
- 如果之後想要更強的證明（例如多塊田或任意成熟天數），需要 TLA+ 或另一個定理證明器，而且要先下載工具，請先取得同意。

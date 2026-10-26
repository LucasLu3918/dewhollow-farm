# 評分者指南（封存）

請勿在所有觀察者完成並繳交 [參與者作答表](../participant/assessment-form.zh-TW.md) 前，向他們展示本資料夾或 `answer-key.json`。參與者只應拿到 `participant/` 目錄。

## 編號與目標答案

| 內部情境代碼 | 目標辨識項目 | 可接受答案 |
|---|---|---|
| `dry-unripe` | 作物是否成熟可收成，土壤乾或濕 | 未成熟／不可收成；乾土 |
| `wet-unripe` | 作物是否成熟可收成，土壤乾或濕 | 未成熟／不可收成；濕土 |
| `dry-ripe` | 作物是否成熟可收成，土壤乾或濕 | 成熟／可收成；乾土 |
| `wet-ripe` | 作物是否成熟可收成，土壤乾或濕 | 成熟／可收成；濕土 |
| `player-farm` | 辨認主角 | 玩家／主角 |
| `player-near-crop` | 辨認作物成熟度 | 成熟／可收成 |
| `player-with-cat` | 辨認夥伴種類 | 貓／小黑貓 |
| `player-with-resident` | 辨認角色組合 | 玩家與 NPC／居民（兩者都需辨認出） |
| `greenhouse-door` | 判斷畫面中的門是否可進入 | 可進入；既有溫室玩法入口 |
| `greenhouse-interior` | 辨認進門後的場所 | 溫室室內 |

依 `answer-key.json` 的編號對照逐圖計分。每題只計 0 或 1 分；四種作物情境須同時答對成熟度與土壤狀態。玩家／居民情境須辨認出兩者。空白、互斥答案或無法辨識計 0 分。

附件 §11.1 的門檻為每位觀察者至少 9／10。至少收集 3 位互不討論的觀察者結果；分別報告每人正確數與百分比、錯誤情境及樣本數。不要只報平均值。

## 對照

- `answer-key.json`：打亂後圖號到內部情境代碼的封存映射。
- `../evidence.json`：刺激圖實際尺寸與 hash、候選素材輸入 hash、擷取設定、載入失敗與頁面錯誤紀錄；不包含映射或人工作答。
- `../participant/stimuli/` 與 `../participant/assessment-form.zh-TW.md`：參與者材料。

目前人工結果為 `PENDING`；本指南不能將機器截圖結果視為可讀性 pass。候選圖仍未核准，且溫室情境只證明既有門可進入；實機維持 `DEVICE_PENDING`。

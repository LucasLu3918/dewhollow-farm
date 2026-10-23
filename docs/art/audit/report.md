# 美術回歸稽核｜2026-10-23

## 範圍與基準

- 工作基準：`main` `d243e28c03d123b5e1fff5d92b374b08a037176c`；任務開始時與 `origin/main` 一致。
- PR #12（`feat(art): upgrade to 32-bit style and layered tile rendering`）的比較來源：`049008fea59ae8436530738bd63f448c4a01aad7`。舊版寵物素材比較點：`842025a2107064039ce5851b8493f7f0e7b9fcb3`。
- 修復後截圖與測試基準：整合分支 `ea105105678d95fee3a5a8484cbe4a446d782610`。
- 範圍包含貓、矮袋鼠、玩家、村民、農地與商店／門等代表物件；沒有批次回退其他圖片。

## 確認的回歸

| 素材 | 修復前實際畫面 | PNG 比較 | 根因與處置 |
| --- | --- | --- | --- |
| 黑貓 | 農場中玩家身後顯示小女孩形體；[修復前農場](./before-cat-farm.png) | `d243e28` 的 `cat-2x.png`（SHA-256 `475edceac7b61b3e178681d7c5f1ab47b6cbdf9e0653dfad8841f76988428bfb`）同時畫有女孩與小貓。舊版 `842025a` 圖（SHA-256 `e128d8295d4d1fc8cf3ff52dc70d176b3b0ea8b6087a6f350b6feeef4c8468e5`）是獨立四足黑貓。 | **confirmed**：錯誤已存在於 PNG 像素本身，不是 `cat`／`pet.cat` mapping、rig、裁切或場景把動物轉成人形。恢復舊版貓圖，來源已追溯到舊 commit。修復後農場畫面見 [pet-cat-farm.png](../../../tests/e2e/companions.spec.ts-snapshots/pet-cat-farm.png)。 |
| 矮袋鼠（quokka） | 村莊中毛毛旁顯示女孩與小動物混合貼圖；[修復前村莊](./before-pets-village.png) | `d243e28` 的 `marsupial-2x.png`（SHA-256 `f71c7a16f4ca1a3786b5e2704c599bdaf784bdf83d7324a9087f117ead78c7ef`）含女孩與動物；舊版圖（SHA-256 `7d330f344add5f7dcdefdbd1b21f08939337549a068622812724f190098e105a`）是偏熊形輪廓，不適合作為 quokka。 | **confirmed**：回歸在 PNG 本身。以使用者核准的獨立 quokka 候選取代，修復背景透明度並依專案流程最近鄰最終化為 96×96 RGBA8888。修復後同場畫面見 [pet-companions-village.png](../../../tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png)。 |

## 其他檢查

- `content/assets.json` 的 `pet.cat`／`pet.marsupial`、`content/rigs.json` 的 96×96 hop rig、`src/presentation/character-rig.ts` texture 消費端均仍正確；寵物 ID、顯示尺寸及存檔結構未改。
- 65 個 manifest 素材路徑均存在。PR #12 同時變更貼圖 filter 與最終化流程；`BootScene` 的 NEAREST 取樣會影響銳利度，但無法造成貼圖中已存在的女孩形體，故不是本次根因。
- 玩家、村民、地面及商店／門在修復前後畫面中可檢視。它們在 PR #12 前後有素材更新；此輪未找到可重現的載入、mapping 或遮擋錯誤，整套風格是否一致仍屬需逐件人工判斷的主觀項目，不標記為已自動通過。
- 任務起始畫面曾回報缺少 `tool.sickle`、`tile.fence`、`pwa.icon-192`、`pwa.icon-512`、`pwa.icon-maskable-512` 資源鍵；這些與寵物根因無關，列為後續資產清單檢查項。
- 黑貓恢復圖尾巴比文字設定短；輪廓可辨認，保留為後續方向圖可改善項目。

## 驗收證據

- 修復前 Playwright canvas：`before-cat-farm.png`、`before-pets-village.png`（基準 commit `d243e28`，Chromium，輸出 926×694）。
- 修復後 Playwright canvas：[`pet-cat-farm.png`](../../../tests/e2e/companions.spec.ts-snapshots/pet-cat-farm.png)、[`pet-companions-village.png`](../../../tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png)。
- 修復後 `npm run check`：147 個測試檔通過，1539 passed、1 skipped，production build 與 8 MB budget 通過。
- 修復後 `npm run test:e2e`：175 passed。render compatibility 的 canary 是原測試內明確標記的預期失敗；相鄰 workaround 測試通過。
- 修復後寵物視覺快照已以固定路徑版本化，可由 macOS 與 Linux CI 共用。

## 結論

AC-001 的基準、代表資產、舊圖／修復前 PNG／實際畫面比較與根因已建立。兩項 confirmed P0 寵物回歸已各自修復並提交；其他資產的主觀風格評估及已列資源鍵缺漏不冒稱已完成。

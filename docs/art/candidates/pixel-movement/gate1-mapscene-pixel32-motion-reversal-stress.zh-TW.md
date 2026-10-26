# DF-G1-MOTION-REVERSAL-STRESS｜pixel32 候選移動輸入壓力證據

> **狀態：DEV-only Chromium 候選證據，Gate 1 未完成。** 不改動 movement runtime、正式素材、地圖、玩法或存檔；候選角色素材維持 `status: candidate`、`approved: false`。

## 測試條件

- 路徑：`/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation`；獨立 Playwright browser context，390×844 CSS viewport、DPR 2。
- 固定無阻擋路線：farm `(7,9)` 起步，向左六格到 `(1,9)`，再向上四格到 `(1,5)`；最後向左觸牆，確認不多走。
- 「10 格」指十次成功的相鄰格位提交。每一個方向意圖是一組合成 `keydown`／`keyup`；相鄰方向意圖相反時算反向，垂直時算直角轉向。
- 另以 1 次左移 kickoff 啟動移動；它不計入 100 次壓力方向意圖。之後每個 150 ms 步進中同步派送 10 次方向意圖，movement scheduler 的 latest-tap queue 最多保留最後一個方向；每批最後方向對應到路線的下一步，末批以牆面拒絕收尾。

## 結果

| 觀測 | 結果 |
|---|---:|
| 成功相鄰格位提交 | 10／10，路線完全符合預期 |
| 方向意圖 | 100 |
| 反向／直角轉向 | 50／50 |
| 觀測到的最大 tap queue | 1；每一批的 10 次輸入皆實際入列 |
| 瀏覽器端輸入至下一格提交觀測延遲 | 9 筆；最小 146.9 ms、中位數 148.1 ms、最大 148.1 ms |
| 角色候選影格 | left 與 up 走路影格皆被 RAF 取樣；最終 `left-idle` |
| 腳底錨點 | 133 筆取樣；範圍 x=96–480、y=384–640；停止於 `(96,384)` |
| 停止狀態 | tile `(1,5)`、`heldDirection=null`、`moving=false`、`pending=false`、queue=0；停止後 19 筆 RAF 樣本觀測 299.9 ms，格位、錨點、frame 與 busy 狀態穩定 |

延遲起點是每批最後一個合成 keydown，終點是第一個 RAF 取樣觀察到下一個 committed tile。數值只代表同一瀏覽器頁面內的 queue-response 觀測，不是完成畫面轉向的時間，也不是產品延遲 SLA。

## 畫面與原始證據

| 時點 | 截圖 | SHA-256 |
|---|---|---|
| 起始 | [motion-start-390x844.png](gate1-mapscene-pixel32-motion-reversal-stress/screenshots/motion-start-390x844.png) | `ab43c44058945d77b388c1f3ddc89c5ec76ec04c46d974e6d1d24a1a67810f4b` |
| 停止 | [motion-stopped-390x844.png](gate1-mapscene-pixel32-motion-reversal-stress/screenshots/motion-stopped-390x844.png) | `3d0284804139a01f6d1ecebfe7877a000b57113bba5b841bd376e72d7d6159cd` |

完整輸入事件、方向分類、格位轉換、RAF frame／腳底樣本、停止狀態及來源 SHA 收錄在 [evidence.json](gate1-mapscene-pixel32-motion-reversal-stress/evidence.json)。角色動畫 manifest 保持候選狀態；atlas SHA 與 manifest 宣告值一致。

## 限制

- 合成鍵盤事件在單一瀏覽器頁面同步派送，未涵蓋作業系統、硬體鍵盤或真實使用者輸入延遲。
- Chromium 取樣不驗證實機、觸控、60／120 FPS、原生 DPR 光柵、主觀動作流暢度或美術品質。
- 短動畫影格可能落在兩次 RAF 取樣之間；latest-tap queue 只會將每步最後輸入排入下一步。
- 本證據不構成 Gate 1、素材 SHA、美術或正式整合核准。

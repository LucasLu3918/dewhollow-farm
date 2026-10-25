# DF-QA-01｜Gate 1 候選證據稽核

> **結論：Gate 1 尚未完成，素材仍為 candidate，實機狀態為 `DEVICE_PENDING`。** 使用者已選 pixel32／16-bit 方向並同意候選進入下一階段；這項決定沒有核准任何特定 PNG、動畫幀或正式整合。

## 稽核範圍

本稽核核對三組彼此不同的證據，避免把 renderer profile、舊候選 A/B 與新 pixel32 MapScene runtime 當成同一套驗收：

1. `legacy`／`pixel32`／`pixel16` renderer profile 的舊素材 viewport／DPR 矩陣。
2. 同一 farm `MapScene` 的舊版 8-bit、16-bit局部貼圖 A/B 候選。
3. DEV-only 的新 pixel32 地圖與玩家動畫 MapScene 候選 runtime。

## 覆蓋矩陣

| Gate 1 項目 | 狀態 | 目前證據與缺口 |
|---|---|---|
| 同一 farm 起點、既有玩法與 renderer profile 的截圖矩陣 | 部分 | [`gate1-runtime-evidence.zh-TW.md`](../candidates/pixel-movement/gate1-runtime-evidence.zh-TW.md) 有 45 張圖：legacy／pixel32／pixel16 × 5 viewport × DPR 1/2/3；三者使用相同舊素材，不能證明新素材 A/B。 |
| 同一 MapScene 舊候選 A/B | 部分 | [`gate1-mapscene-ab-evidence.zh-TW.md`](../candidates/pixel-movement/gate1-mapscene-ab-evidence.zh-TW.md) 有 legacy、pixel16、pixel32 各一張 390×844、DPR 1 截圖及局部地圖／作物候選；不是完整 12×10 場景，亦不含新四向動畫候選。 |
| pixel32 候選接入正式 farm MapScene 的 QA runtime | 部分 | [`gate1-mapscene-pixel32-runtime.spec.ts`](../../../tests/e2e/gate1-mapscene-pixel32-runtime.spec.ts) 驗證 DEV-only opt-in、候選地圖與玩家四向動畫、方向切換、農務命令、存檔重新載入及 production 不載入。只有 1280×720、DPR 1 候選 runtime 截圖。 |
| 固定 12×10 場景與 legacy／pixel16／pixel32 同 runtime 比較 | 部分 | [`12×10 場景構圖證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-scene-composition-12x10.zh-TW.md) 以固定 farm 存檔擷取 1280×900 DEV-only runtime；camera 視野 17×13，含 pixel32 地面／玩家／房屋與樹冠候選及既有素材 fallback。仍無 pixel16 同 runtime 對照或完整 pixel32 素材覆蓋。 |
| 完整素材與角色行為 | 缺證據 | 新 pixel32 runtime 的建築、樹、土壤、作物、NPC、夥伴、工具及陰影仍用既有素材；尚無完整作物品種辨識、工具表演及寵物跟隨候選驗收。 |
| 移動、碰撞、遮擋與動畫穩定性 | 部分／缺證據 | pixel32 候選已有每方向 1.25 秒移動與牆碰撞證據、固定位置遮擋差分，以及 [`overlay 移動深度證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-motion-stability.zh-TW.md)：14 次單格移動期間三層穩定，且角色穿過房屋／樹冠腳底錨點時深度前後翻轉。新增 [`walk frame 深度交錯證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth.zh-TW.md)，在兩處穿越期間同時捕捉 moving 狀態、方向動畫幀與錨點兩側深度。仍缺候選夥伴跟隨與 60/120 fps frame-time 證據；自動化深度訊號不代表像素遮擋品質核准。 |
| 候選 viewport／DPR、100% 可讀性、接縫與腳錨人工評分 | 部分 | 地面／玩家 pixel32 MapScene 與 house／tree overlay 各有 5 種 viewport × DPR 1／2／3 的 15 張 Chromium CSS-scale 截圖。overlay 畫面與輸入 SHA 已記錄於 [`overlay runtime 矩陣`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix.zh-TW.md)；尚無完整候選素材組合、10 情境辨識評分、接縫／閃爍與腳底錨點審查，也不是原生 DPR raster。 |
| 原生 iOS／Android 裝置 | 待實機 | 未驗證原生安全區、觸控命中率、像素穩定性與效能，維持 `DEVICE_PENDING`。 |
| 候選狀態與正式素材隔離 | 通過（隔離檢查） | 候選 manifest 維持 `status: candidate`、`approved: false`；MapScene 僅 DEV 且精確 opt-in 載入候選，production 不請求該 atlas。隔離通過不代表 Gate 1 或美術核准。 |

## 執行與審核決策

- pixel32 MapScene 候選測試：`tests/e2e/gate1-mapscene-pixel32-runtime.spec.ts`。同測試包含一張 1280×720 截圖附件、四方向角色狀態、農務與存檔／重新載入，以及 production isolation assertions。
- 舊素材 renderer 矩陣／影片：`tests/e2e/gate1-runtime-evidence.spec.ts` 與 [`gate1-runtime-evidence.zh-TW.md`](../candidates/pixel-movement/gate1-runtime-evidence.zh-TW.md)。這些測試的舊素材畫面不能視為候選素材的視覺驗收。
- 舊素材 A/B：[`gate1-mapscene-ab-evidence.zh-TW.md`](../candidates/pixel-movement/gate1-mapscene-ab-evidence.zh-TW.md)。截圖保留供比較；它不是新 pixel32 animation runtime 的驗收。
- PR #31（DF-UX-01）已合併，Required Checks 通過；這只驗證手機控制／版面變更，不會補足 Gate 1 美術證據。DF-UX-01 的裝置實測仍為 `DEVICE_PENDING`。
- 使用者已選擇 B／pixel32／16-bit，並同意候選進入下一階段。依 [素材審核流程](../asset-review.md)，此決定不構成對特定素材 SHA 的核准；候選進入 `approved` 或正式資產目錄前，仍需逐版本明確核准。
- [`overlay 移動深度證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-motion-stability.zh-TW.md) 為 DEV-only Chromium 測試；候選狀態維持未核准，不替代完整場景或實機審查。
- [`walk frame 深度交錯證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth.zh-TW.md) 為 DEV-only Chromium 測試；逐 RAF 觀測樹冠與房屋穿越中的實際移動幀，候選狀態維持未核准，不替代美術或 Gate 1 審查。
- [`12×10 場景構圖證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-scene-composition-12x10.zh-TW.md) 在固定 farm fixture 中擷取 17×13 camera 視野，含候選地面／玩家／overlay 與明列的既有素材 fallback；不構成完整素材覆蓋、art approval 或 Gate 1 通過。

## Gate 1 尚需完成

1. 擴充 pixel32 QA scene 覆蓋與固定場景證據；保留 DEV-only 載入與候選標籤。已新增 overlay 五種 viewport × DPR 1／2／3 共 15 張 CSS-scale 圖片、SHA 與載入／圖層檢查，及一張固定存檔的 12×10 以上 runtime 場景畫面；完整素材覆蓋與 pixel16 同 runtime 對照仍缺。
2. 取得完整場景在需求 viewport／DPR 下的候選畫面，並補足移動、碰撞、遮擋、工具、作物與夥伴情境。
3. 以 100% 尺寸審查可讀性、圖塊接縫／閃爍與腳底定位；提交逐項評分與可重現證據。
4. 執行 iOS／Android 實機驗證，通過後才可清除 `DEVICE_PENDING`。
5. 把確切候選檔及 SHA 提供使用者審閱；收到該版本明確核准前，不得正式整合。

完成以上證據後再評估 Gate 1。候選接入下一階段不是 Gate 1 通過條件的豁免。

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
| 四方向各 10 格持續移動與放開停止 | Chromium 自動化完成；人工／實機待驗 | [`連續 10 格移動證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-continuous-10-tile.zh-TW.md) 記錄四方向各 10 次 tile commit、keydown／keyup、逐 RAF 候選 frame／pose／腳錨樣本與 8 張 1280×720 截圖；專項 E2E 4/4 通過。這是合成輸入及 CSS-scale 瀏覽器證據，不驗收實機輸入延遲、FPS、動作觀感或美術品質；人工 gate 仍未通過。 |
| 固定 12×10 場景與 legacy／pixel16／pixel32 同 runtime 比較 | 部分 | [`12×10 場景構圖證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-scene-composition-12x10.zh-TW.md) 以固定 farm 存檔擷取 1280×900 DEV-only runtime；camera 視野 17×13。新增 [`pixel16／pixel32 局部覆蓋比較`](../candidates/pixel-movement/gate1-mapscene-pixel16-pixel32-scene-comparison.zh-TW.md)，同一 v13 fixture、viewport、DPR 1 與 camera 下記錄兩種畫面的候選／既有 texture 來源及 SHA。pixel16 使用 8bit atlas；pixel32 使用季節地圖、autotile、玩家動畫與房屋／樹冠 overlay。兩者素材覆蓋不等，pixel32 專屬 overlay／動作沒有 pixel16 對應，完整等覆蓋比較仍缺。 |
| 作物／工具／夥伴候選同場景檢視 | 部分 | [`Pixel32 候選素材同場景檢視`](../candidates/pixel-movement/gate1-candidate-assets-review/README.zh-TW.md) 與 E2E 證據展示甜蘿蔔三階、cat／quokka 四向 idle、七種 held-preview 工具及門／出貨箱靜態狀態；甜蘿蔔在 farm fixture 使用候選圖，其他作物仍 fallback。新增五種 viewport × Chromium DPR 1／2／3 的 30 張 CSS-scale 截圖、canvas／camera 量測與載入記錄。[`pixel32 候選貓咪跟隨證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-pet-follow.zh-TW.md) 另驗證 DEV-only cat 沿既有跟隨路徑播放四方向 hop 序列；quokka、工具持握／揮動、互動與正式整合仍未覆蓋。 |
| 移動、碰撞、遮擋與動畫穩定性 | 部分／缺證據 | pixel32 候選已有每方向 1.25 秒移動與牆碰撞證據、固定位置遮擋差分，以及 [`overlay 移動深度證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-motion-stability.zh-TW.md)：14 次單格移動期間三層穩定，且角色穿過房屋／樹冠腳底錨點時深度前後翻轉。新增 [`walk frame 深度交錯證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth.zh-TW.md)，在兩處穿越期間同時捕捉 moving 狀態、方向動畫幀與錨點兩側深度；[`候選貓咪跟隨報告`](../candidates/pixel-movement/gate1-mapscene-pixel32-pet-follow.zh-TW.md) 增加四方向 follower trail 與 hop frame 觀測；[`反向與直角轉向壓力證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-motion-reversal-stress.zh-TW.md) 以十次相鄰提交承載 50 次反向與 50 次直角轉向，記錄 queue、RAF frame、腳底錨點、瀏覽器端提交延遲及停止狀態；[`四向短按證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-short-press-100.zh-TW.md) 驗證四向各 100 次單格短按與西牆拒絕。仍缺 60/120 fps frame-time、碰撞／遮擋與像素品質整體人工審查；自動化訊號不代表美術核准。 |
| 互動物候選 viewport／DPR 矩陣 | 已有 Chromium QA 證據 | [`DF-G1-INTERACTABLE-VIEWPORT-MATRIX`](../candidates/pixel-movement/gate1-mapscene-pixel32-interactables-viewport-matrix.zh-TW.md) 覆蓋五種 viewport × Chromium DPR 1／2／3，共 15 張 CSS-scale farm MapScene 截圖；四個候選 frame 均可見，無候選資產請求失敗或頁面錯誤。畫面與量測不驗收真實互動、原生 DPR raster、實機或美術品質。 |
| 候選 viewport／DPR、100% 可讀性、接縫與腳錨人工評分 | 盲測包待評分 | [`10 情境可讀性審查包`](../candidates/pixel-movement/gate1-readability-10scenarios/README.zh-TW.md) 提供打亂編號、100% CSS 尺寸候選場景圖、封存答案鍵與評分表；目前沒有觀察者作答，不能宣稱達到 90% 門檻。其他 viewport／DPR 證據為 Chromium CSS-scale，非原生 DPR；接縫／閃爍、腳底錨點與實機檢查仍未完成。 |
| pixel32 四季地表重複與 field edge mask 接縫 | 自動化觀測完成，人工待評 | [`pixel32 圖塊接縫候選報告`](../candidates/pixel-movement/gate1-map-tile-continuity.zh-TW.md) 記錄四季 grass／field／path／water 的 3×3 重複、每季基礎來源／顯示格數（4／36）、field-edge 來源／顯示格數（16／16）、混合邊界不同來源／顯示格數（7／9）、RGB 邊界量測與來源／截圖 SHA-256。每季每種基礎地表目前僅一張 frame，沒有 pixel32 soil 或多款重複變體。鄰接示意按 manifest 的 N／E／S／W bits 選 frame，3×3 範圍外假設為草地；它不是透明圖層或正式地圖規則驗收。量測不代表人眼無縫評分，候選仍未核准。 |
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
- [`反向與直角轉向壓力證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-motion-reversal-stress.zh-TW.md) 為 DEV-only Chromium 測試；固定路線 10 次成功提交、100 個合成方向意圖（50 反向／50 直角轉向），並記錄 queue、候選動畫影格、腳底錨點及停止狀態。瀏覽器端延遲與 RAF 取樣不替代實機、FPS 或 Gate 1 審查。
- [`12×10 場景構圖證據`](../candidates/pixel-movement/gate1-mapscene-pixel32-scene-composition-12x10.zh-TW.md) 在固定 farm fixture 中擷取 17×13 camera 視野，含候選地面／玩家／overlay 與明列的既有素材 fallback；不構成完整素材覆蓋、art approval 或 Gate 1 通過。
- [`候選素材同場景檢視`](../candidates/pixel-movement/gate1-candidate-assets-review/README.zh-TW.md) 顯示 22 個作物、寵物方向、工具持握預覽與門／出貨箱狀態畫格；新增五種 viewport × DPR 1／2／3 的接觸表與 farm 截圖，甜蘿蔔候選在 MapScene 中對應三個生長階段，月豆仍使用正式 fallback。寵物與互動物件仍是靜態 QA 展示，非 runtime 行為驗收。
- [`pixel32 候選貓咪跟隨報告`](../candidates/pixel-movement/gate1-mapscene-pixel32-pet-follow.zh-TW.md) 記錄候選 cat atlas 在精確 DEV opt-in 下跟隨既有路徑、四方向 hop-a／hop-b／land／idle、資產 SHA 與場景截圖；manifest 保持未核准，不代表 Gate 1 或美術評分完成。
- [`pixel32 門與出貨箱場景候選預覽`](../candidates/pixel-movement/gate1-mapscene-pixel32-interactables-preview.zh-TW.md) 將既有四個候選狀態 frame 放入 farm MapScene，記錄 manifest／atlas／frame／截圖 SHA，並驗證無互動、碰撞或存檔副作用；只覆蓋 Chromium 1280×900、DPR 1，候選仍未核准。

## Gate 1 尚需完成

1. 擴充 pixel32 QA scene 覆蓋與固定場景證據；保留 DEV-only 載入與候選標籤。已新增 overlay 五種 viewport × DPR 1／2／3 共 15 張 CSS-scale 圖片、SHA 與載入／圖層檢查，固定 12×10 runtime 場景畫面，作物／寵物方向／工具／物件 22-frame 候選接觸表，以及相同 farm fixture／17×13 camera 下的 pixel16／pixel32 局部覆蓋比較；完整等覆蓋素材與 pixel16 動畫／overlay 仍缺。
2. 取得完整場景在需求 viewport／DPR 下的候選畫面，並補足移動、碰撞、遮擋、工具、作物與夥伴情境。
3. 以 100% 尺寸審查可讀性、圖塊接縫／閃爍與腳底定位；提交逐項評分與可重現證據。
4. 執行 iOS／Android 實機驗證，通過後才可清除 `DEVICE_PENDING`。
5. 把確切候選檔及 SHA 提供使用者審閱；收到該版本明確核准前，不得正式整合。

完成以上證據後再評估 Gate 1。候選接入下一階段不是 Gate 1 通過條件的豁免。

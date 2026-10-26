# DF-G1-READABILITY-10SCENARIOS｜100% 尺寸可讀性盲測包

## 結果

本階段建置 10 張打亂編號的遊戲場景圖、封存答案鍵、盲測作答表與逐張評分規則。自動化證據只確認截圖與輸入素材雜湊及畫面載入狀態；**人工結果仍為 `PENDING`，尚未證明附件 §11.1 的 ≥90% 可讀性門檻**。參與者只需取得 `gate1-readability-10scenarios/participant/`；答案與評分資料放在獨立 `evaluator/` 目錄。

刺激包含乾／濕土各自的未成熟／成熟甜蘿蔔、農場主角、主角與作物、pixel32 候選貓、村莊居民、既有可進入溫室門，以及進入後的溫室畫面。答案鍵依隨機化後的圖號儲存於封存目錄；觀察者須先完成 [盲測作答表](gate1-readability-10scenarios/participant/assessment-form.zh-TW.md)，評分者再解封對照。

## 擷取與完整性

- E2E：`tests/e2e/gate1-readability-10scenarios.spec.ts`；Playwright Chromium、1280×900 viewport、DPR 1，剪裁至 canvas CSS 內容區。畫面檔實際寬高、SHA-256、位元組數及候選輸入 hash 見 `gate1-readability-10scenarios/evidence.json`。
- pixel32 地圖、玩家動畫、甜蘿蔔與貓候選只在 exact DEV route 載入。測試記錄所有實際載入圖集的 manifest／PNG hash、請求、候選載入失敗及頁面錯誤；候選 manifest 必須保持 `candidate`／`approved: false`。
- 證據只代表 Chromium CSS 尺寸截圖，不是原生裝置或原生 DPR 測試。瀏覽器畫面目視可供評分，但不取代 iOS／Android 實機驗收。

## 解讀限制

- `greenhouse-door` 是目前既有可進入溫室門；pixel32 門候選仍為獨立靜態預覽，本包不宣稱候選門圖已有互動連接。
- 收割成熟度與乾／濕土評分只使用甜蘿蔔候選。場景可辨識不代表已檢驗其他作物種類、素材接縫、移動中的腳底錨點或完整 Gate 1。
- 至少 3 位互不討論的觀察者各自完成 10 題；每人至少答對 9 題。收件後將實際人數、逐人分數及錯誤情境補入 `evidence.json`，再重新評估稽核狀態。
- 所有候選仍未核准，正式素材整合仍需確切 SHA 的人工核准；實機狀態維持 `DEVICE_PENDING`。

## 相關檔案

- [參與者圖片與作答說明](gate1-readability-10scenarios/README.zh-TW.md)
- [評分者指南與封存鍵](gate1-readability-10scenarios/evaluator/README.zh-TW.md)
- [盲測作答表](gate1-readability-10scenarios/participant/assessment-form.zh-TW.md)
- [Gate 1 QA 稽核矩陣](../../audit/df-qa-01.md)

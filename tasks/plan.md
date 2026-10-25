# DF-UX-01 手機 FOV、joystick 與 HUD 快捷流程

## 範圍與限制

- 依 PROT-01 與 MOVE-02 的既有呈現與移動介面，驗證直式 8–10 格、橫式 12–16 格 touch FOV，並在混合觸控裝置採用 touch framing。
- 讓 viewport／方向／焦點等輸入取消事件同步清空搖桿和展開中的「更多」快捷面板；放手後不再新增移動格。
- 驗證 HUD 顯示的工具、種子與現有 touch cycle 快捷操作同步，快捷切換不打開選擇面板。
- 不修改遊戲規則、存檔、地圖資料、碰撞、正式素材或 Gate 1 核准狀態。
- Chromium viewport/input 測試不等同 iOS／Android 實機驗收；實機項目維持 `DEVICE_PENDING`。

## 驗收（DF-UX-01 已於 PR #31 合併）

- [x] 混合指標裝置採 touch FOV；直式、短直式與矮橫式 camera FOV matrix 有 E2E 覆蓋。
- [x] 旋轉 viewport 會取消 held input 並收合「更多」；需新手勢才可繼續操作。
- [x] 工具與種子 shortcut 更新 HUD，不開啟 selector；既有農務流程與存檔回歸通過。
- [x] `npm run check`、完整 `npm run test:e2e`、Chromium 畫面檢視及 PR #31 CI 通過；完整 E2E 為 226 passed。
- [x] 變更已更新 Impact 證據並合併至 `main`；iOS／Android 實機驗收仍為 `DEVICE_PENDING`。

---

# DF-QA-01 Gate 1 證據稽核

## 範圍與結論

整理既有 renderer-profile、同場景 A/B 與 pixel32 MapScene QA runtime 證據，對照 Gate 1 驗收條件並修正過時狀態。此階段只整理證據，不改候選素材或核准狀態。詳見 [DF-QA-01 稽核矩陣](../docs/art/audit/df-qa-01.md)。

---

# DF-G1-RUNTIME-MATRIX pixel32 候選 runtime viewport／DPR 證據

為 DEV-only pixel32 farm `MapScene` 補上五種 viewport × Chromium DPR context 1／2／3 的 15 組 CSS 尺寸截圖與測量，供人眼檢視同一候選版本在不同 CSS 畫幅的呈現；不把這組輸出當作 DPR 專屬 raster 驗收。完整證據見 [候選 runtime viewport／DPR 報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-runtime-evidence.zh-TW.md)。

## 限制

- 截圖只包含現有 pixel32 地面與玩家四向動畫候選；其他角色與物件仍用舊素材。
- DPR 由 Chromium 模擬，PNG 以 CSS 尺寸輸出；不構成原生實機或實際像素輸出驗收。
- manifest 和圖集仍是 `candidate`／`approved: false`；未核准正式整合，Gate 1 仍未通過。
- 固定 12×10 完整場景、5 秒連續移動、碰撞／遮擋、作物／夥伴及實機證據仍待後續階段。

## 完成條件

- [x] 五種 viewport × Chromium DPR context 1／2／3 共 15 張截圖、量測及本次存檔 hash 已整理。
- [x] `npm run check`、完整 `npm run test:e2e`（227/227）通過，並目視抽查代表截圖。
- [ ] 更新 Impact Graph reconciliation、commit、PR；Required Checks 通過後依核准發佈流程合併。

## 任務與完成條件

- [x] 區分 45 張舊素材 viewport／DPR 矩陣與單一 1280×720 DPR1 pixel32 候選 runtime 截圖。
- [x] 記錄同一 MapScene 的方向動畫、農務、存檔與 production isolation 測試覆蓋。
- [x] 列明未覆蓋的 viewport／DPR、固定 12×10 場景、持續移動、碰撞／遮擋、完整素材與實機證據。
- [x] 更新 DF-UX-01 已合併的 CI 驗收紀錄及候選方向決策措辭。
- [ ] 跑專案檢查，commit、push、PR；Required Checks 通過後依 AIPS 發佈流程合併。
- [ ] 下一階段在素材人眼審查與 Gate 1 目標下補齊 pixel32 候選覆蓋；每個確切素材版本仍待使用者個別核准，實機項目維持 `DEVICE_PENDING`。

---

# Gate 1 整合候選預覽計畫

## 下一階段：MapScene pixel32 QA 候選 runtime

### 範圍

新增明確 DEV-only opt-in，讓同一個 Phaser `MapScene` 以 pixel32 地圖圖集繪製已覆蓋的草地、田地（含依鄰接方向選擇的 autotile 邊緣）、道路與水面，並以 pixel32 四向候選動畫繪製玩家。地圖狀態、存檔、碰撞、移動權威與遊戲規則仍沿用現行實作；沒有候選 frame 時回退正式素材。候選維持 `candidate`、`approved: false`，此工作不代表 Gate 1 通過或正式素材替換。

### 不在範圍

- 不修改 `content/assets.json`、`content/rigs.json`、`content/maps/`、正式 `public/`、domain、存檔、碰撞或正式角色骨架。
- 不改現有 legacy／pixel16／pixel32 viewport profile 與舊 8/16-bit候選路由；新 runtime 必須另有 DEV-only opt-in。
- 未覆蓋的建築、樹冠、土壤、NPC、夥伴、工具及農作物沿用現有素材。
- 不宣稱實機驗收、完整 Gate 1 或正式美術核准。

### 任務與驗收

1. [x] 驗證兩份候選 manifest 為 candidate／未核准後才註冊獨立 atlas；建立四季底圖與田地鄰接遮罩的純 mapping。
2. [x] 只在 DEV 且明確選擇新 QA 旗標時，把 pixel32 地圖與玩家四向動畫接入同一 `MapScene`；保留正式預設與舊候選行為。
3. [x] 新增單元與 E2E 覆蓋：實際 farm MapScene、同一地圖與移動／農務命令、四向動畫、缺省 fallback、以及 production 不請求候選圖集。
4. [x] 執行 `npm run check`、完整 `npm run test:e2e`，並檢視 QA runtime 截圖；更新 Impact Graph 證據、提交單一功能 commit、開 PR，required checks 通過後合併。

### 風險與限制

- pixel32 動畫是整張 sprite，不能套用既有 CharacterRig 切塊；QA profile 只替換玩家的可見 body，保留 rig root 作為移動與鏡頭錨點。工具動作視覺仍沿用既有 rig，因此 QA 候選不驗收揮工具動畫。
- autotile mask 僅描述四方向 grass/field 鄰接，不新增地圖或農務規則。
- 建築、樹、土壤、作物、NPC 及夥伴不在新圖集覆蓋範圍，沿用正式素材。

## 範圍

在既有候選目錄新增一頁整合預覽，讓玩家四向動畫候選與 pixel32 地圖候選在同一個可互動畫面中並列呈現。畫面提供四向／走路控制、季節切換、田地邊緣與樹冠遮擋展示；工具動作沿用現有純函式回饋。這是 QA 候選預覽，不是 Phaser 正式遊戲 runtime，也不代表 Gate 1 驗收。

## 不在範圍

- 不修改 `content/assets.json`、`content/rigs.json`、正式 `public/`、`CharacterRig`、`MapScene`、遊戲地圖／碰撞、存檔或 domain 規則。
- 兩份 manifest 與所有素材維持 `candidate`、`approved: false`。
- 不把這次方向核准解讀為任何確切美術素材核准。

## 任務

### 任務 1：整合候選畫面

- [x] 新增單頁同時載入動畫及地圖候選 manifest／atlas。
- [x] 可切換方向、走路、季節與樹冠前後層；提供候選未核准狀態和即時狀態文字。
- [x] 保持最近鄰像素、鍵盤可操作與手機響應式版面。

### 任務 2：驗收整合與隔離

- [x] E2E 驗證兩份候選載入、控制互動和 `approved: false`。
- [x] E2E 驗證正式遊戲入口不請求新增的整合預覽素材路徑。
- [x] 執行 `npm run check`、`npm run test:e2e` 與瀏覽器畫面檢視。

## 依賴與風險

- 依賴已完成的 DF-ART-02、DF-ANIM-01、DF-MAP-01 候選與既有動畫純函式。
- 主要風險是把展示用固定地圖誤認成正式地圖；頁面與測試須明確標示它只呈現候選樣式，不改遊戲資料或玩法。
- 預估範圍中型，預計新增一組預覽頁、E2E 測試與本計畫檔。

## 完成條件

所有候選只在獨立預覽路徑載入；檢查器、完整單元／建置與 E2E 通過；截圖經目視確認；以單一功能 commit 提交並走 PR。

---

# DF-G1-MOTION-EVIDENCE pixel32 候選連續移動與碰撞證據

## 範圍

在 DEV-only pixel32 候選 farm `MapScene` 驗證至少五秒四向持續移動、方向切換與西側牆碰撞，輸出按住期間截圖及量測。只增加測試和候選證據，不改遊戲規則、地圖、存檔、正式素材或核准狀態。

---

# DF-G1-SCENE-COVERAGE pixel32 候選場景覆蓋初步證據

## 範圍與結果

以隔離 DEV-only E2E 在同一 pixel32 MapScene opt-in 中檢視 farm 的候選地面／玩家、三階作物 fallback 和 cat follow，並在 forest 驗證現有樹圖與玩家位於前後深度層時的重疊排序。只新增測試、PNG／JSON 證據與任務文件；不改 runtime、正式素材、地圖或 gameplay。測試會在隔離 IndexedDB 寫入並遷移 v13 fixture，不改正式存檔格式或玩家存檔資料。

證據與限制見 [pixel32 MapScene 場景覆蓋報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-scene-coverage.zh-TW.md)。該切片只驗證現有素材 fallback；後續已另做 pixel32 tree canopy／house layers 與固定 12×10 場景。基本固定位置的 snapshot 差分證據見本檔後續階段；精確遮罩品質、確切素材人工核准與原生裝置驗收仍待後續。

## 驗收

- [x] 向西按住至牆面後停在可通行格，位置至少 250 ms 穩定。
- [x] 右、下、左、上各至少按住 1,250 ms，總按住輸入至少 5,000 ms；每向移動至少 4 格並顯示對應候選走路幀。
- [x] 保存四向按住期間的畫面、牆前與代表畫面、量測及 SHA-256；以瀏覽器目視確認。
- [x] 資產檢查、TypeScript、159 個單元測試檔（1,614 passed／1 skipped）、production build 與 8 MB 預算均通過；單元測試採 4 workers。
- [x] 完整 Playwright E2E 228/228 通過。

## 限制

Chromium 證據不等同原生實機；完整 12×10 runtime 組合、場景覆蓋素材、作物／夥伴辨識、農務動畫、樹冠與建築遮擋、設備效能及確切素材核准仍待後續。

---

# DF-G1-OVERLAY-12X10 pixel32 房屋／樹冠圖層與固定場景

## 範圍與結果

在精確 DEV-only pixel32 runtime opt-in 下，於 farm MapScene 隔離繪製未核准的 `house-back`、`tree-canopy`、`house-front` 候選圖層；另於 Gate 1 預覽頁新增固定 12 × 10 原生 32 × 32 pixel32 地圖圖層樣張。正式地圖、碰撞、存檔、玩法與 `content/assets.json` 不變，所有候選維持 `approved: false`。

驗收結果與畫面見 [pixel32 房屋／樹冠圖層候選報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-scene.zh-TW.md)。本階段不等於確切美術核准或 Gate 1 完成；原生裝置維持 `DEVICE_PENDING`。

## 驗收

- [x] 單元測試驗證 DEV、pixel32 runtime 與第二個精確 query 三者皆為必要條件。
- [x] 專項 E2E 驗證無第二個 query 時不建立 overlay；完整 opt-in 時載入三個候選 frame、確認 house front/back 共錨點及前景深度。
- [x] 新增 12 × 10／384 × 320 固定 canvas 預覽、模式對應說明與未核准狀態標示。
- [x] 保存 MapScene runtime 和固定場景 Chromium 截圖、量測、SHA-256；完成目視檢查。
- [x] `npm run check` 通過（1,616 passed／1 skipped）；完整 Playwright E2E 230/230 通過（4 workers）。

## 限制

- 目前驗證層次與 frame 錨點，不聲稱已驗證 actor 像素遮擋品質。
- 明確素材核准、原生裝置測試及正式資產整合均待後續人工驗收。

---

# DF-G1-OVERLAY-OCCLUSION pixel32 房屋／樹冠角色遮擋證據

在既有 DEV-only pixel32 overlay 候選場景，以固定玩家座標和原始 renderer snapshot 記錄玩家顯示／隱藏時的差分像素數。結果、四張 Chromium 截圖與 SHA-256 見 [遮擋候選報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-occlusion.zh-TW.md)。

本階段只驗證候選圖層遮擋方向，不核准素材或 Gate 1，不改正式地圖、碰撞、存檔及玩法；原生裝置仍為 `DEVICE_PENDING`。

---

# DF-G1-OVERLAY-RUNTIME-MATRIX pixel32 房屋／樹冠候選 viewport／DPR 證據

沿用精確 DEV-only pixel32 MapScene 與 overlay opt-in，在五種 viewport × Chromium DPR 1／2／3 擷取 15 張 house／tree overlay 候選畫面，驗證圖層、資產載入、Canvas／camera 量測及候選輸入與截圖 SHA-256。結果見 [overlay runtime 矩陣報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix.zh-TW.md)。

此工作只新增候選 E2E、PNG／JSON 證據、報告與稽核狀態；不變更正式 runtime、地圖、碰撞、存檔、玩法、`content/assets.json` 或素材核准狀態。Chromium CSS-scale 截圖不代表原生 DPR raster、實機表現或 Gate 1 通過。

## 完成條件

- [x] 15 個 viewport／DPR context 都載入同一 farm MapScene、精確候選 opt-in 與三個未核准 overlay layer。
- [x] 每個 context 確認候選資產請求無失敗、無頁面錯誤，記錄 viewport／DPR／Canvas／camera／overlay layer 與 SHA-256。
- [x] 保存 15 張截圖，重算 hash 全部相符；抽查代表圖並更新 Gate 1 稽核矩陣。
- [x] `npm run check` 通過（1,616 passed／1 skipped、build／8 MB 預算）；完整 Playwright E2E 231/231 通過，再進行 Impact reconciliation、提交、開 PR 並依 required checks 合併。

## 後續限制

- 完整 12×10 場景與 legacy／pixel16／pixel32 同 runtime 比較仍缺。
- 10 情境可讀性、seam／閃爍、動作腳錨人工評分與原生 iOS／Android 驗收仍待完成；實機維持 `DEVICE_PENDING`。
- 候選仍為 `candidate`／`approved: false`；確切素材人工核准與 Gate 1 簽核不在本任務授權內。

---

# DF-G1-OVERLAY-WALKFRAME-DEPTH pixel32 候選移動幀與圖層深度交錯

- [x] 從 `(8,3)` 南向穿越 tree canopy 錨點，再從 `(5,5)` 北向穿越 house front 錨點；依逐格按鍵避免略過交界樣本。
- [x] 逐 RAF 記錄移動方向、實際 walk frame、腳底 Y、角色深度與 overlay signature；確認兩個錨點兩側均有移動中樣本且沒有碰撞阻擋。
- [x] 保存候選 manifest／atlas 輸入 SHA-256、JSON 測量、兩張 Chromium 場景圖及限制說明；維持候選狀態且不變更正式素材／runtime／地圖／碰撞／存檔／玩法。
- [x] 專項 Chromium E2E 通過，`npm run build` 通過。
- [x] `npm run check` 通過（1,616 passed／1 skipped）；完整 Chromium E2E 233/233 通過（4 workers）。
- [ ] Impact reconciliation、commit、PR Required Checks 與合併。

詳見 [DF-G1 overlay 移動幀與深度交錯證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth.zh-TW.md)。


# DF-G1-SCENE-COMPOSITION-12X10 pixel32 候選完整場景構圖

## 範圍

以既有 DEV-only pixel32 farm `MapScene`、候選地圖／玩家 atlas 與 house/tree overlay opt-in，從隔離 IndexedDB fixture 擷取可審查的完整遊戲畫面。使用 1280×900 Chromium view；確認畫面至少包含中央 12×10 世界格，記錄實際 camera 可視範圍與候選／fallback 清單、素材 hash 和 screenshot hash。未覆蓋的作物、夥伴、工具與 NPC 明確標示為現有素材 fallback。

此切片只新增 E2E 與證據文件；不新增或修改 runtime camera、地圖、碰撞、gameplay、存檔 schema、正式素材清單或 `public/`。候選仍維持 `candidate`／`approved: false`，不代表美術核准或 Gate 1 通過。

## 任務與驗收

1. [x] 新增精確 DEV-only route 的 12×10 runtime 場景 E2E；用隔離存檔展示地面、玩家、房屋／樹冠層、代表作物與夥伴，並斷言可視範圍至少 12×10。
2. [x] 保存候選輸入 hash、視窗／camera 量測、fallback IDs、請求／頁面錯誤、screenshot 與 SHA-256；證據清楚說明 Chromium CSS-scale 限制。
3. [x] 更新 DF-QA-01 與本任務狀態；候選狀態和正式入口隔離保持不變。

## 驗證

- [x] 專項 Chromium E2E 1/1 及畫面檢視。
- [x] `npm run check`；完整 Chromium E2E 234/234（4 workers）。
- [ ] AIPS Impact reconciliation、commit、PR、Required Checks 通過後合併。

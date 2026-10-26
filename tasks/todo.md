# DF-UX-01 手機 FOV、joystick 與 HUD 快捷流程（PR #31 已合併）

- [x] 確認 hybrid touch 的 FOV、手機直橫式鏡頭矩陣與 camera viewport。
- [x] viewport 取消時收合 touch「更多」面板並同步 ARIA 狀態。
- [x] 驗證 joystick／touch cancel 與 HUD 工具、種子快捷流程。
- [x] 更新 DF-UX-01 驗收證據並保留 `DEVICE_PENDING` 實機狀態。
- [x] 完整檢查與 E2E、PR #31 CI、merge；完整 E2E 為 226 passed。

---

# DF-QA-01 Gate 1 證據稽核

- [x] 區分舊素材 45 張 viewport／DPR 矩陣、舊素材同場景 A/B 與 pixel32 DEV MapScene runtime 證據。
- [x] 記錄 pixel32 runtime 的方向動畫、農務、存檔／重新載入和 production 隔離覆蓋。
- [x] 列明 Gate 1 尚缺的候選 viewport／DPR 矩陣、固定組合、持續移動、碰撞／遮擋、可讀性及實機測試。
- [x] 更新 DF-UX-01 的 CI 結果和使用者候選方向決策狀態。
- [ ] 執行完整檢查、Impact reconciliation、commit、push、PR、Required Checks 和 merge。
- [ ] 下一階段補齊 pixel32 候選覆蓋並提供確切版本供人眼審查；未核准素材不得正式整合，實機維持 `DEVICE_PENDING`。

## DF-G1-READABILITY-10SCENARIOS

- [x] 建立十情境 100% 尺寸盲測證據包，涵蓋作物成熟／未成熟、乾／濕土、玩家／居民／貓，以及既有可進入門；自動化包已完成，人工評分仍待收集。
- [ ] 收集獨立人工評分並保留候選素材逐 SHA 核准及實機驗收 gate。

## DF-G1-TILING-CONTINUITY

- [x] 以現有候選圖集檢視四季 grass／field／path／water 重複、草地／田地 3×3 鄰接示意（圖格外假設為草地）與全部 64 個 field 遮罩，記錄邊緣畫素差和 SHA-256。
- [x] 報告每季各地表實際只有一種基礎圖塊、沒有 pixel32 soil。
- [ ] 人工無縫評分、素材 SHA 核准與實機檢查仍待審。

詳見 [DF-QA-01 稽核矩陣](../docs/art/audit/df-qa-01.md)。

---

# DF-G1-RUNTIME-MATRIX pixel32 候選 runtime 證據矩陣

- [x] 為 DEV-only pixel32 farm `MapScene` 產生五種 viewport × DPR 1／2／3 的 15 張 Chromium 模擬截圖。
- [x] 將四份候選 manifest／圖集與本次各截圖 SHA-256、Canvas、render resolution、可見格數及 browser DPR 收錄於矩陣；SHA-256 識別這批存檔，不承諾跨環境逐位元重現。
- [x] 抽查手機直式、1280 桌面及 Full HD 高 DPR 畫面；候選圖集未核准且非候選覆蓋物件仍使用舊素材。
- [x] `npm run check`、本切片 Playwright E2E 與完整 E2E（227/227）通過；renderer compatibility canary 的預期失敗按測試契約計為通過。
- [ ] Impact reconciliation、commit、PR、Required Checks 和 merge 待完成。
- [ ] 取得確切候選素材的人眼驗收；完成固定場景、持續移動、碰撞／遮擋、作物／夥伴和原生實機檢查後才評估 Gate 1。

詳見 [pixel32 候選 MapScene viewport／DPR 證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-runtime-evidence.zh-TW.md)。

---

# Gate 1 整合候選預覽任務

- [x] 任務 1：在獨立候選路徑整合 pixel32 地圖與四向動畫候選。
- [x] 任務 2：新增 E2E 驗證控制互動、候選狀態與正式入口隔離。
- [x] Checkpoint：完成檢查器、`npm run check`、`npm run test:e2e` 和瀏覽器目視驗收後提交 PR。

## MapScene pixel32 QA 候選 runtime

- [x] 1. 新增候選 manifest 驗證、frame 註冊與 pixel32 地圖 mapping 單元測試。
- [x] 2. 新增 DEV-only opt-in，在同一 MapScene 使用 pixel32 地圖與玩家四向候選動畫；缺少覆蓋時回退正式素材。
- [x] 3. 新增 E2E 驗證 farm MapScene 地圖／移動／農務行為、候選素材狀態與 production 隔離。
- [x] Checkpoint：`npm run check`、完整 `npm run test:e2e`、瀏覽器截圖目視與 AIPS Impact reconciliation 均通過，再 commit、PR、merge。

---

# DF-G1-MOTION-EVIDENCE pixel32 候選連續移動與碰撞證據

- [x] 驗證西側牆碰撞與停留穩定性。
- [x] 驗證四向各至少 1.25 秒持續輸入及方向動畫幀，總按住時間至少 5 秒。
- [x] 保存四向按住影格、牆前／收尾截圖、量測和 hash，並完成目視檢視。
- [x] 專項 E2E 通過；完整 Playwright E2E 228/228 通過。
- [x] 資產檢查、TypeScript、單元測試（1,614 passed／1 skipped）、build 與 8 MB 預算通過；單元測試採 4 workers。
- [x] PR #34 Required Checks 通過並合併至 `main`；merge commit `99f76bab2cc5a7637dd4c649a3da2236d15cb7b0`。
- [x] 下一階段初步場景證據：pixel32 候選地面／玩家與作物 fallback、cat follow、森林樹木前後深度排序；專項 E2E 1/1、`npm run check`、完整 E2E 229/229 通過。詳見 [場景覆蓋證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-scene-coverage.zh-TW.md)。
- [x] 隔離接入 pixel32 tree canopy／house front-back 候選層，完成固定 12×10 圖層樣張與深度驗證；不得改正式素材或碰撞，實機維持 `DEVICE_PENDING`。詳見 [圖層候選報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-scene.zh-TW.md)。
- [x] 新增 DEV-only Chromium 候選差分證據：固定玩家位於房屋／樹冠前後，量測顯示／隱藏玩家的 snapshot 差分像素數，並保存四張截圖、座標、數據與 SHA-256。詳見 [遮擋候選報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-occlusion.zh-TW.md)。
- [x] 專項遮擋 E2E 1/1、`npm run check` 與完整 Playwright E2E 230/230（4 workers）通過。
- [ ] 人工審查確切 pixel32 地圖與角色素材、原生裝置行為，並依 Gate 1 完整條件決定是否核准；本次自動化證據不取代該驗收。

詳見 [pixel32 候選連續移動與碰撞證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-motion-evidence.zh-TW.md)。

---

# DF-G1-OVERLAY-RUNTIME-MATRIX pixel32 房屋／樹冠候選 viewport／DPR 證據

- [x] 在精確 DEV-only overlay opt-in 下，覆蓋五種 viewport × DPR 1／2／3 的 15 個 Chromium context。
- [x] 確認三個 house／tree layer、候選資產載入、Canvas／camera 指標與候選狀態，保存每張截圖 SHA-256。
- [x] 重算 15 張 PNG hash 全數相符，並目視抽查手機、平板與桌面代表圖；未宣稱藝術品質或 Gate 1 通過。
- [x] 專項 Playwright E2E 1/1 通過（15 組 viewport／DPR）。
- [x] `npm run check` 通過（1,616 passed／1 skipped、build／8 MB 預算）；完整 Playwright E2E 231/231 通過（4 workers）。
- [ ] 更新 Impact reconciliation、commit、PR；Required Checks 通過後依核准流程合併。

詳見 [overlay runtime 矩陣報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix.zh-TW.md)。完整 12×10 場景、候選素材人眼核准與 iOS／Android 實機驗證仍待後續。

---

# DF-G1-OVERLAY-MOTION-STABILITY pixel32 房屋／樹冠移動深度穩定性

- [x] 在精確 DEV-only overlay opt-in 與隔離 QA 存檔下，沿樹冠與房屋前後錨點完成四向移動。
- [x] 逐步確認 14 次移動、15 個狀態樣本中的三個候選 overlay signature（ID、frame、layer、tile、depth、display list、visible）與起始樣本一致，並確認角色越過樹冠與房屋腳底錨點時深度前後翻轉。
- [x] 保存四張場景截圖、候選 manifest／atlas SHA、角色量測與錯誤計數；目視抽查代表圖。
- [x] 專項 Playwright E2E 通過 1/1。
- [x] `npm run check` 通過（1,616 passed／1 skipped）；完整 Chromium Playwright E2E 232/232 通過（4 workers）。
- [x] Impact reconciliation、commit `19adc7d1`、PR #39 Required Checks 通過並合併；merge commit `6ceb50c6fc299404a5eb7f84ba8291816caed783`。

詳見 [overlay 移動深度穩定性證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-motion-stability.zh-TW.md)。

---

# DF-G1-OVERLAY-WALKFRAME-DEPTH pixel32 候選移動幀與圖層深度交錯

- [x] 以 DEV-only Chromium E2E 逐格穿越樹冠與房屋前景錨點，逐 RAF 記錄 moving、方向 walk frame、腳底 Y、角色／overlay depth 與穩定 overlay signature。
- [x] 確認樹冠南北與房屋前後各有移動中樣本，兩段路線無阻擋，候選 manifest 仍為 `candidate`／`approved: false`。
- [x] 保存兩張穿越後場景、逐幀 JSON、SHA-256 與中文候選證據報告；未宣稱藝術品質或 Gate 1 通過。
- [x] 專項 Chromium E2E 1/1 通過；`npm run build` 通過。
- [x] `npm run check` 通過（1,616 passed／1 skipped）；完整 Chromium E2E 233/233 通過（4 workers）。
- [x] Impact reconciliation、commit `cce4bdd`、PR #40 Required Checks 通過並合併至 `main`；merge commit `e1c02ba9e11892e0634b022416d339ded7f70cfe`。

詳見 [pixel32 overlay 移動幀與深度交錯證據](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth.zh-TW.md)。


---

# DF-G1-SCENE-COMPOSITION-12X10 pixel32 候選完整場景構圖

- [x] 以現有精確 DEV-only opt-in 和隔離 IndexedDB fixture 擷取 farm MapScene 候選組合；畫面至少包含 12×10 世界格及地面、玩家、house/tree overlays、代表作物與夥伴。
- [x] 記錄實際 viewport／camera、候選 manifest／atlas SHA、未覆蓋素材 fallback、載入錯誤及 screenshot SHA；Chromium CSS-scale 限制清楚標示。
- [x] 更新 DF-QA-01 報告及本任務狀態；候選維持 `candidate`／`approved: false`，不觸碰正式素材或 Gate 1 核准。
- [x] 專項 E2E 1/1、`npm run check` 與完整 Chromium E2E 234/234（4 workers）通過。
- [ ] Impact reconciliation、commit、PR、Required Checks 通過後 merge。

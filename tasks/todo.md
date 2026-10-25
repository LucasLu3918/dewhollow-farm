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

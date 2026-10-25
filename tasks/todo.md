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

# Gate 1 整合候選預覽任務

- [x] 任務 1：在獨立候選路徑整合 pixel32 地圖與四向動畫候選。
- [x] 任務 2：新增 E2E 驗證控制互動、候選狀態與正式入口隔離。
- [x] Checkpoint：完成檢查器、`npm run check`、`npm run test:e2e` 和瀏覽器目視驗收後提交 PR。

## MapScene pixel32 QA 候選 runtime

- [x] 1. 新增候選 manifest 驗證、frame 註冊與 pixel32 地圖 mapping 單元測試。
- [x] 2. 新增 DEV-only opt-in，在同一 MapScene 使用 pixel32 地圖與玩家四向候選動畫；缺少覆蓋時回退正式素材。
- [x] 3. 新增 E2E 驗證 farm MapScene 地圖／移動／農務行為、候選素材狀態與 production 隔離。
- [x] Checkpoint：`npm run check`、完整 `npm run test:e2e`、瀏覽器截圖目視與 AIPS Impact reconciliation 均通過，再 commit、PR、merge。

# DF-UX-01 手機 FOV、joystick 與 HUD 快捷流程

- [ ] 確認 hybrid touch 的 FOV、手機直橫式鏡頭矩陣與實際 camera viewport。
- [ ] viewport 取消時收合 touch「更多」面板並同步 ARIA 狀態。
- [ ] 驗證 joystick／touch cancel 與 HUD 工具、種子快捷流程。
- [ ] 更新 DF-UX-01 驗收證據並保留 `DEVICE_PENDING` 實機狀態。
- [ ] 執行完整檢查與 E2E、commit、push、PR、CI 與 merge。

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

# DF-G1-INTERACTABLE-VIEWPORT-MATRIX｜門與出貨箱候選 viewport／DPR 證據

## 範圍與結果

以精確 DEV-only pixel32 farm `MapScene` 與互動物候選旗標，在五種 viewport、Chromium DPR 1／2／3 共 15 個隔離瀏覽器 context 中呈現 `door-closed`、`door-open`、`shipbox-closed`、`shipbox-open` 四個候選 frame。固定 farm fixture 玩家位置為 `(4,5)`，記錄 manifest／atlas／frame hash、Canvas 與 camera 尺寸、候選請求、頁面錯誤及每張截圖 SHA-256。完整機器證據與 15 張 PNG 位於 [`gate1-mapscene-pixel32-interactables-viewport-matrix/`](gate1-mapscene-pixel32-interactables-viewport-matrix/)。

所有 15 個 context 都載入預期候選資產；四個 frame 均可見，沒有候選請求失敗、HTTP 失敗或 page error。各視窗的實際可視世界格數如下：

| Viewport | CSS 尺寸 | 渲染格數 |
|---|---:|---:|
| 手機直式 | 390 × 844 | 9 × 13 |
| 手機橫式 | 844 × 390 | 14 × 11 |
| 平板直式 | 768 × 1024 | 9 × 7 |
| 桌面橫式 | 1280 × 720 | 17 × 13 |
| 桌面全高清 | 1920 × 1080 | 17 × 15 |

DPR 1／2／3 在每個 viewport 均正確回報。手機直式 DPR 1 的 context 記錄兩種 WebGL `GPU stall due to ReadPixels` 效能警告字串，共四筆訊息；其餘 context 沒有 console error 或頁面錯誤。警告已原樣保存在 JSON 證據中，屬截圖讀回時的 renderer 訊號，並非經效能基準測試判定。截圖以 CSS 尺寸輸出，故同尺寸下不同 DPR 的部分 PNG 像素及 hash 相同；不把它們視為原生 DPR raster 證據。

代表畫面已目視檢查：手機直式下四個 frame 位於遊戲畫面內，桌面全高清畫面亦完整可見。自動斷言與抽查不代表 100% 美術可讀性、接縫／閃爍品質、原生 iOS／Android 行為、互動玩法或 Gate 1 通過。

## 隔離與限制

- manifest 維持 `status: candidate`、`approved: false`，四個 frame 也都未核准；本次不核准任何特定素材 SHA。
- 僅在 DEV、pixel32 MapScene 與精確 `gate1InteractablePreview=pixel32-interactables` query 同時成立時載入。未測試真實開門／出貨、碰撞、庫存、地圖或存檔狀態變更。
- 未修改正式 runtime、`content/assets.json`、`public/`、地圖、存檔或遊戲規則。
- 僅為 Chromium viewport／DPR 模擬，實機維持 `DEVICE_PENDING`；全域 API／consumer／data／event Impact Graph 覆蓋仍有限。

## 完成條件

- [x] 五種 viewport × DPR 1／2／3 共 15 組；每組載入 farm MapScene 及四個未核准候選 frame。
- [x] 保存 15 張 CSS-scale PNG、候選輸入與截圖 SHA-256、Canvas／camera 量測、候選請求、錯誤與警告。
- [x] 目視抽查手機直式及桌面全高清代表畫面。
- [x] `npm run check` 通過（162 個測試檔，1,643 passed／1 skipped；production build 2.808 MB，8 MB 預算通過）。
- [x] 完整 Chromium E2E 240/240 通過（9 workers；含本矩陣測試）。
- [ ] AIPS Impact Graph reconciliation、commit、PR checks 與合併。

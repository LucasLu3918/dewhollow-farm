# DF-V2-024｜World v2 戶外／室內候選場景

> **狀態：候選、未核准；視覺 Gate 等待使用者審查。** 素材只會透過精確 DEV query 載入，不加入正式資產清單或 `public/`。

## 預覽

| 場景 | 桌機 | 手機 |
|---|---|---|
| 農場 | [farm-desktop.png](screenshots/farm-desktop.png) | [farm-mobile.png](screenshots/farm-mobile.png) |
| 小屋 | [house-desktop.png](screenshots/house-desktop.png) | [house-mobile.png](screenshots/house-mobile.png) |

截圖由本機 Chromium 實際載入 Phaser MapScene 擷取。農場截圖呈現目前鏡頭 viewport，不是 40×30 地圖的一張全景；目前場景接入涵蓋地面、田地／路徑 mask、出貨箱、石牆、溫室欄杆、農舍、樹冠與小屋木牆／地板／既有家具映射。手機畫面補充狹窄 viewport 的取景。細節與 hash 見 [`evidence.json`](evidence.json) 及 [`VISUAL_AUDIT.yaml`](VISUAL_AUDIT.yaml)。

## DEV 預覽

只在 Vite DEV 並啟用既有 Pixel32 runtime 時，使用：

```text
?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1SceneVisual=world-v2-cozy
```

缺少任一旗標時不載入這兩組 atlas。候選 frame 僅呈現，不改 map JSON、碰撞、互動、遊戲規則或存檔；地圖未覆蓋 frame 保留原渲染 fallback。場景 debug API 回報實際候選 frames，E2E 會驗證候選載入、轉場、viewport resize、console 與資源請求。

## 素材與驗證

- [`farm/`](farm/)：原創 32px Pixel32 農場候選 atlas／manifest／確定性產生器。
- [`house/`](house/)：原創 32px Pixel32 小屋候選 atlas／manifest／確定性產生器。
- 兩組 manifest 與每個 frame 都明確保持 `approved: false`。概念參考圖 [`concept-reference.png`](concept-reference.png) 只供構圖參考，沒有被打包進 atlas。
- 執行 `npm run assets:gate1:world-v2-scene:check` 驗證 hash、frame bounds 與候選狀態；`npm run check` 也會執行此檢查。
- 執行 `npx playwright test tests/e2e/world-v2-candidate-scene.spec.ts --workers=1` 驗證 DEV 整合。以 `SAVE_WORLD_V2_SCENE_EVIDENCE=1` 重跑可更新截圖。

## 審查限制

- 人工視覺 Gate 尚未通過；請先審查農場與小屋兩個桌機場景，再決定是否進 P3。此選擇不代表候選素材可正式整合。
- farm 截圖是目前遊戲鏡頭 viewport；整張 farm 地圖的所有邊界和地標沒有同時顯示在單張圖中。
- 大型家具 layer、被遮擋角色、寵物跟隨、季節覆蓋與完整 22×20 小屋屬後續工作；這裡只提供受控的場景候選切片。

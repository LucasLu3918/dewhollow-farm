# P4-044 Pixel32 移動速度 A/B

本比較只在 DEV 的 Pixel32 runtime 候選模式生效。預設仍為 150 ms/tile；只有 URL 同時啟用既有候選 runtime，並且恰好帶有 `gate1MovementSpeed=slow` 時，才改用 240 ms/tile。正式版、一般 Pixel32 profile、缺少或重複參數都維持 150 ms。

## Chromium 實測

| Profile | 設定速度 | 右／下／左／上實測（ms） | 平均（ms） |
|---|---:|---:|---:|
| 基準 | 150 ms/tile | 150.0 / 150.0 / 149.9 / 150.0 | 150.0 |
| 慢速候選 | 240 ms/tile | 233.4 / 233.4 / 233.2 / 233.4 | 233.3 |

實測時間取自 Chromium 的 requestAnimationFrame：第一個移動畫面至角色落格、回到 idle 的畫面；各次取樣及步態 phase 都記在 `evidence.json`。候選人物四張走路影格直接由 `MovementScheduler.gaitPhase` 選取；移動停止時立即回到方向 idle。

| 證據 | SHA-256 |
|---|---|
| `evidence.json` | `1a3621bb03decb72d8cd9c1a775949a09027c28875fa07fb0d40111b37485433` |
| `screenshots/baseline-150ms.png` | `138e13581ebfbda3a8474b94d8d80bdf7d74916adb011da38b1a7bead053eacf` |
| `screenshots/candidate-slow-240ms.png` | `efcb8fedb05f9dafd72b0bac2287754ec259b6e0f6853bab49808158885a9c79` |
| `videos/four-direction-speed-ab.webm` | `a2c9a92f51c9a67c2e79e81b6b95995988083a9688b85f2d3d8df33faa595c54` |

## 重現

```bash
SAVE_P4_044_EVIDENCE=1 npm run test:e2e -- tests/e2e/gate1-mapscene-pixel32-movement-ab.spec.ts --workers=1
```

測試驗證四個基本方向、落格停止、設定速度與候選走路影格；阻擋與大量短按仍由既有 `movement-scheduler.spec.ts`、`gate1-mapscene-pixel32-short-press-100.spec.ts` 覆蓋。這是合成 Chromium 鍵盤測試，不能代表原生手機輸入延遲或實機 FPS。資料只供候選比較；沒有變更預設或正式版速度，也不構成角色素材簽核。

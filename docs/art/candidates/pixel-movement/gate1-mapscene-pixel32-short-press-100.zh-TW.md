# DF-G1-SHORT-PRESS-100 pixel32 候選四向短按證據

## 範圍

在隔離的 DEV-only pixel32 farm `MapScene` 中，使用 390×844 CSS viewport、Chromium DPR 2 執行 100 次 R→D→L→U 短按循環。路線在 `(7,9)`、`(8,9)`、`(8,10)`、`(7,10)` 四格間往返，每圈回到起點。每次按鍵都等待移動、pending request、held input 與 tap queue 清空後，核對目標座標為正交相鄰一格，並以候選 idle frame 確認面向正確。

共完成 400 次量測短按：右、下、左、上各 100 次。另由 `(7,9)` 往西移至 `(1,9)`，按住左鍵碰觸 `x=0` 牆面，確認 `blockedDirection=left` 且座標不變，放開後 movement 與 queue 清空。

此證據僅涵蓋合成 Chromium 鍵盤輸入及未核准候選 runtime；不改正式 runtime、素材、地圖、玩法、存檔或核准狀態，也不代表原生裝置延遲、FPS、人工美術驗收或 Gate 1 通過。

## 結果

| 指標 | 結果 |
|---|---:|
| 短按總數 | 400 |
| 右／下／左／上 | 各 100；每次均完成恰好一格的正交移動 |
| 每次按鍵後面向 | 400 次均與方向一致，候選 idle frame 正確 |
| 每圈結束位置 | `(7,9)`；100 圈皆符合 |
| tap queue／pending／held input | 每次確認時皆清空 |
| 西牆碰撞 | 起點 `(1,9)`；左移遭拒後位置不變，放鍵後 idle |
| 專項 E2E | 1/1 通過 |
| `npm run check` | 通過；1,643 passed／1 skipped，production build 2.808 MB |
| 完整 Chromium E2E | 244/244 通過（4 workers） |

完整逐次座標、方向、計數、邊界狀態與 SHA-256 見 [evidence.json](gate1-mapscene-pixel32-short-press-100/evidence.json)。[起始畫面](gate1-mapscene-pixel32-short-press-100/screenshots/short-press-start-390x844.png) 與 [牆前停止畫面](gate1-mapscene-pixel32-short-press-100/screenshots/short-press-stopped-390x844.png) 為 CSS-scale 截圖。

測試程式：[gate1-mapscene-pixel32-short-press-100.spec.ts](../../../../tests/e2e/gate1-mapscene-pixel32-short-press-100.spec.ts)。

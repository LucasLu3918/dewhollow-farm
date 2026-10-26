# VF-11 場景渲染驗收（2026-10-26）

六張 PNG 是相同 renderer 參數下的 before/after 對照：before 來自基準 `e9f650f448af3414dc55dd2d6317b632ee0901cd`，after 來自 VF-11 runtime worktree。截圖由 `tests/e2e/scene-assets.spec.ts` 擷取，canvas 原始尺寸 1024×768、瀏覽器 canvas 顯示尺寸 580×435。

| 對照 | Map／玩家 tile | Camera scroll | Before SHA-256 | After SHA-256 |
|---|---|---|---|---|
| [farm house before](farm-house-before.png) / [after](farm-house-after.png) | farm `(7,5)` | `(0,0)` | `e92e58d83cf69249d8a8f07f356858b053648eefb83808883aa3fab3e147ca14` | `3c67f7a3382bb19a4f11ff2e777fc697f8b51aea0f6caef2f7e5738a4f44c877` |
| [farm tree before](farm-tree-before.png) / [after](farm-tree-after.png) | farm `(35,25)` | `(1536,1152)` | `53084fc078aac96cc5984d552177cfdd52a77bc8154489afea50ae8f12d02705` | `8698c02d056ff5af2a446bafb0de39e59767a77ecc6e2ead0cdf5995fecf6158` |
| [village before](village-before.png) / [after](village-after.png) | village `(7,10)` | `(0,0)` | `728e6de5b9ae58da6fe3afc6d6c4087a79a48846da99c157af128b4e5cca4687` | `a75ba55ae07d4a21b41dd62f8f51be5402cf897a847109d5770b6b18d57f7a16` |

所有視角使用 viewport 1280×720、DPR 1、camera 1024×768、zoom 1，並將遊戲暫停在春季第 1 年第 4 日 10:00、晴天、玩家 REST pose。farm tree 視角為右下角邊界 clamp 後的 scroll；基準與新版 camera/player metadata 一致。

## 驗收觀察

- farm house、village 兩間商店在 after 畫面完整可辨；house 與商店圖像錨定既有 door/shop map tile。使用者既有門、商店互動與 map transition 語意仍由原地圖資料控制。
- farm tree 的 trunk foot 錨於既有 farm fence `(33,21)`；單元測試確認該 tile kind 是 `fence` 且不可行走。樹冠覆蓋一段溫室右側外圍 fence，但未遮住 Q door/入口、玩家或 `path`。tree 是 display-list overlay，不修改 map、碰撞或 pathfinding。
- 透明 wall 在 wall map tile 上以鄰近有效 ground fallback 作底，再繪製 wall overlay；E2E 驗證該 tile 同時具有 ground 與 wall sprite。Map JSON、shop/door targets、world rules、actor movement 未修改。
- 三種地表重複時仍看得到規律紋理；草地和路面細節在 64 px 顯示格會成為密集色點，田地橫向紋理較明顯。大型物件細節在遊戲尺寸會合併。這些是已知素材限制，不是截圖放大造成的差異。

## 更新的既有視覺基線

依 VF-11 精確核准 scope 更新 `tests/e2e/map-world-validation.spec.ts-snapshots/` 中會受地表／物件圖改變的八張 golden PNG。Before SHA 是基準 commit `e9f650f448af3414dc55dd2d6317b632ee0901cd` 的原始 PNG；after SHA 是更新後版本。差異率以相同尺寸 RGBA 解碼後計算「至少一個 RGB 通道改變」的像素比例；原始 before blobs 仍可由 Git 基準 commit 取回。

| Snapshot | Before SHA-256 | After SHA-256 | Changed pixels |
|---|---|---|---:|
| `farm-spring.png` | `be271adb09fd5a0bd7bd12e8b26da0828be24b4e8a3210e356ff658b1d94575b` | `37cc53a76f14a1788ae645d76e3f33c315e6c143703c6602b0021dd2afee2b13` | 251326 / 253170 (99.27%) |
| `farm-summer.png` | `14000e222439d283248181e861cdddb8d30570dec6e8078500a8df5f75794ada` | `1af411b5648f4409c72ea7bebcfd3dae7fc197164323a1ef8d45acb2da095aab` | 251326 / 253170 (99.27%) |
| `farm-autumn.png` | `d5810cff977e3e598a62c320610ff9a3436dc9df8d6738882a60558bacbf2bf4` | `82b81589ebf8db80f2a4717e4c2af17de095c0368ee904aad7fbb85215faddae` | 251326 / 253170 (99.27%) |
| `farm-winter.png` | `44baec98448a93cbad7956b1709dde66caf3432b03e46ac1040b6a3cc18e7cff` | `b1761fa9f3bb906d93fef97f22ccc6c2b659d653ff15a0d7b472917ac704c4b9` | 251325 / 253170 (99.27%) |
| `farm-mature-field.png` | `71fb969dd2305c48c784961d26b3d41d8c0ed368084e33e44a392ffb921410d3` | `eca1b9bc220abafa1f8dbe9401a6722fce1c0a36d38f8bbc57db458ca8494f44` | 249732 / 253170 (98.64%) |
| `lake-fishing.png` | `0a72fa5cb4ff3f0668c162d2f3855ca386967907378a98b646a37fbd2f9156d5` | `c4c2b28bc3dfe01b343c8f591cb2e3a67eb7ddb79d5e0883662e2a5cd620b09b` | 47321 / 253170 (18.69%) |
| `mine-entrance.png` | `246e6c10e94e4747ee7b4d040582084aadf82b7e9be7815030b2944b4ec04d69` | `51bdc4ab51cd6906dddf2eb0dd763036054f543fe34dc5dc8dc9388c188dcb1e` | 198201 / 253170 (78.29%) |
| `forest-tree-occlusion.png` | `270f897e03c9856c0e6219192a2867c35139f3fa6242f28a5ef40a3eba2b952c` | `072860a81356d2bf763892e4da0f27a728a3e5bcd6d33caeb68b149d915ed694` | 245134 / 253170 (96.83%) |

這些都是素材更新預期的像素差異，不是以改 snapshot 代替邏輯測試。map-world-validation 的 walkability、碰撞、門轉場和樹木遮擋量測仍逐項執行；其中森林遮擋仍為 1714 個 opaque overlap samples、隱藏角色改變 18 個像素（1.05%）、mean RGB delta 4.14，通過既有門檻。

## 重跑

使用 bundled Node 24.22.1、Playwright Chromium、本機隔離的 Vite 埠。新版驗收在 runtime worktree 執行：

```sh
E2E_BASE_URL=http://127.0.0.1:5198 SAVE_VF11_SCENE_EVIDENCE=1 \
  /Users/lucas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  ./node_modules/@playwright/test/cli.js test tests/e2e/scene-assets.spec.ts --reporter=line
```

Before 使用相同 spec 與 fixture 在上述基準 commit 的 clean archive 執行，額外設 `VF11_CAPTURE_BASELINE=1`，使用隔離埠 `5200`；再將三張輸出複製為 `*-before.png`。兩次都通過 1/1 場景 E2E。截圖 metadata 亦附在 Playwright test result 中。

## 寵物場景基線

完整 `companions.spec.ts` 以相同穩定 canvas view 跑過 10/10。人物與寵物姿勢仍是 REST、farm spawn 與 village settled camera/角色位置一致；角色圖尺寸、貓跟隨與入村、毛毛/袋獸互動 assertions 均通過。視覺差異集中在本次已核准的地表、牆、柵欄、shipbox、door 與商店場景素材，故依 VF-11 核准 scope 更新這兩張基線。Before PNG 可由基準 commit 還原。

| Snapshot | Before SHA-256 | After SHA-256 | Any-RGB-changed pixels |
|---|---|---|---:|
| `tests/e2e/companions.spec.ts-snapshots/pet-cat-farm.png` | `89ddbff944513dc9b501918afd4027a9a093ccbd467938c2d72c3a7933e97ca3` | `348ad7bfda6805ad6cee25e2196863988b1f4543b70d3d3dce55d6baf20df14b` | 531004 / 642644 (82.63%) |
| `tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png` | `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8` | `f68294ea1684a543cc2602dc2f6e11f3f97b321db7fd6c66ff992c74efbaf3dc` | 523183 / 642644 (81.41%) |

## Full E2E 與 renderer canary

Full E2E（267 cases）完成時 264 passed、3 failed：兩張上述寵物視覺基線在更新前預期失敗；`render-compat.spec.ts` 軟體 renderer canary 則在當前環境意外通過。將 canary 單獨重跑仍重現「Expected to fail, but passed」；其 `software` renderer 條件沒有 skip。此環境 Playwright Chromium 是 Google Chrome for Testing 156.0.8078.4（revision 1248），因此記錄為 renderer 行為變化待專門處理，不將其當成 VF-11 通過，也未修改 render compatibility workaround。

# VF-01 視覺稽核：農場、村莊與行動版

日期：2026-10-26
基準：VF-00 記錄的 `main` HEAD `c6e77435f10b3bd63b8fd7bb2dfa4dc1fedb2f7b`；此稽核工作樹起始於 VF-00 文件提交 `543e469`。
判定：**REQUEST CHANGES（視覺品質）**。以下是現有畫面直接可見的問題；室內與日照時段證據不完整，不能視為涵蓋完整規格。

## 範圍與方法

依附檔的 VF-01 要求，檢視農場、村莊與室內，抽查日照時段及四季，並檢視桌機與至少兩種手機尺寸。本次以已存在的 VF-00 PNG、Playwright 截圖與 E2E 規格為證據，沒有啟動新的瀏覽器工作階段、使用登入中的使用者 profile、重跑可能輸出測試產物的流程，或新增／整合美術。

本文把 **觀察** 限定為畫面或既有測試直接證明的內容；**推測** 是可能的負責子系統，不是已驗證根因。截圖無法單獨證明觸控命中、真機效能、相機縮放數值或遊戲規則正確。

## 可重現證據清單

SHA-256 對應下列原始 PNG 位元組；「縮放」未記錄時表示現存證據無法還原其數值，不能據圖推定。

| 原始畫面路徑 | 畫面／viewport 與輸出尺寸 | 渲染設定與狀態 | SHA-256 |
|---|---|---|---|
| `docs/art/audit/visual-inventory-baseline/farm-390x844.png` | 農場直式；viewport 390×844 CSS px；PNG 390×844 | Playwright Chromium；DPR／相機 zoom 未記錄；第一年春第 3 天 06:10、晴 | `436cd451e969a6cb3fd5958e6a381e164719fc9dd9074ee105555bf4a0bdefcd` |
| `docs/art/audit/visual-inventory-baseline/farm-844x390.png` | 農場橫式；viewport 844×390 CSS px；PNG 844×390 | Playwright Chromium；DPR／相機 zoom 未記錄；第一年春第 3 天 06:10、晴 | `641f3d6a3c8588787ba337b3821083b0e1083bb803c645d8a6c581767c74ddd9` |
| `docs/art/audit/visual-inventory-baseline/village-926x694.png` | 村莊遊戲畫布；輸出 PNG 926×694。`companions.spec.ts` 將 Playwright viewport 設為 1280×720，截圖目標是 canvas，不是完整頁面 | Playwright Desktop Chrome 模擬；DPR／相機 zoom 未記錄；固定村莊場景 | `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8` |
| `tests/e2e/map-world-validation.spec.ts-snapshots/farm-spring.png` | 農場 canvas PNG 582×435；測試使用 Playwright Desktop Chrome 預設 viewport 1280×720 | 存檔設為春季第 4 天 10:00、晴；相機 zoom 未記錄 | `be271adb09fd5a0bd7bd12e8b26da0828be24b4e8a3210e356ff658b1d94575b` |
| `tests/e2e/map-world-validation.spec.ts-snapshots/farm-summer.png` | 農場 canvas PNG 582×435；viewport 1280×720 | 夏季第 4 天 10:00、晴；相機 zoom 未記錄 | `14000e222439d283248181e861cdddb8d30570dec6e8078500a8df5f75794ada` |
| `tests/e2e/map-world-validation.spec.ts-snapshots/farm-autumn.png` | 農場 canvas PNG 582×435；viewport 1280×720 | 秋季第 4 天 10:00、晴；相機 zoom 未記錄 | `d5810cff977e3e598a62c320610ff9a3436dc9df8d6738882a60558bacbf2bf4` |
| `tests/e2e/map-world-validation.spec.ts-snapshots/farm-winter.png` | 農場 canvas PNG 582×435；viewport 1280×720 | 冬季第 4 天 10:00、晴；相機 zoom 未記錄 | `44baec98448a93cbad7956b1709dde66caf3432b03e46ac1040b6a3cc18e7cff` |
| `tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png` | 村莊 canvas PNG 926×694；viewport 1280×720 | Playwright Desktop Chrome 模擬；DPR／相機 zoom 未記錄 | `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8` |
| `/Users/lucas/Coding/main/dewhollow-farm/test-results/pixel-movement-legacy-prod-dab56-s-after-orientation-changes-chromium/production-portrait-390x844.png` | viewport 390×844 CSS px；PNG 780×1688 | Playwright Chromium `deviceScaleFactor: 2`、`isMobile: true`、`hasTouch: true`；legacy render profile；相機 zoom 數值沒有附在截圖內 | `a41b6ea2ccb866e6ada00496a00fbbc82cc7b2844d042b736b34f2f41189e075` |
| `/Users/lucas/Coding/main/dewhollow-farm/test-results/pixel-movement-legacy-prod-dab56-s-after-orientation-changes-chromium/production-landscape-844x390.png` | viewport 844×390 CSS px；PNG 1688×780 | Playwright Chromium `deviceScaleFactor: 2`、`isMobile: true`、`hasTouch: true`；legacy render profile；相機 zoom 數值沒有附在截圖內 | `1b6cde54df4b12292e0f027eb971123b131b592b93166313af4c7529634f93a0` |
| `/Users/lucas/Coding/main/dewhollow-farm/test-results/mobile-acceptance-gaps-DF--c8a2e-24-的主要操作區保持在-viewport-內並附截圖-chromium/tablet-768x1024.png` | viewport 768×1024 CSS px；PNG 768×1024 | Playwright Chromium、觸控流程；DPR／相機 zoom 未記錄 | `bca02b3e5028eab2580fa0f81fdc6346a91a94084896409fc0bb2dc029a14ae0` |

上述 Playwright 證據全是**桌面 Chromium 模擬**。DPR 或 `hasTouch` 參數不會使它成為 iOS／Android 真機測試。

## Top 10 實際問題

嚴重度是對目前遊玩辨識與閱讀的影響排序，不代表程式根因已確認。

| # | 嚴重度 | 觀察（畫面可見） | 影響 | 推測的負責區域（未驗證） |
|---:|---|---|---|---|
| 1 | P1 | 農場與村莊的大面積草地由高對比、細碎且重複的 tile 填滿，畫面形成密集視覺雜訊。農場四季 canvas 與 village 截圖均可見。 | 玩家、作物與可互動物件的輪廓難以從地面紋理中凸顯；手機畫面縮小後更明顯。 | `content/assets.json` 對應的草地圖塊、tile 混合／重複規則。 |
| 2 | P1 | 農地主要呈現大塊單一棕色矩形，邊緣筆直，與草地之間幾乎沒有邊緣過渡或前景層次；成熟作物快照只顯示單株作物。 | 農場工作區視覺上像色塊，而不是有地塊邊界與生長層次的農田。 | 農地 tile 邊緣素材、作物密度及 map decoration。 |
| 3 | P1 | 固定村莊畫面中央大部分是無差異草地；可見商販、居民與攤位集中在周邊，主要道路／建築輪廓在這張取景中不突出。 | 村莊缺少一眼可辨的中心、路徑和地標，視線容易落在空地。 | 村莊地圖配置、相機取景與建築前後景佈置。 |
| 4 | P1 | 農場與村莊畫面以平坦地面及矩形地塊為主，前景、中景、背景的明暗／遮擋層次弱；固定截圖裡大型物件和地面分界多為直線。 | 世界看起來較平，距離與場景深度不易閱讀。 | 地形邊緣、建築外觀／投影及前景遮擋素材。 |
| 5 | P1 | 390×844 直式畫面中，玩家與寵物在整個遊戲畫布內佔比很小；場景視覺細節縮至手機尺寸後難以辨識。 | 玩家定位及角色表情、服裝細節難以感知。 | responsive camera zoom、canvas 可用高度與角色的實際顯示比例。 |
| 6 | P2 | 既有農場季節 snapshots 中，寵物與玩家的精靈在垂直方向貼得很近，畫面上有頭部互相遮疊的觀感。 | 角色輪廓被寵物覆蓋，跟隨關係在靜止畫面不夠清楚。 | companion follow offset、sprite anchor 或深度排序；需實際遊玩確認是否持續發生。 |
| 7 | P1 | 四季農場畫面都以綠草為主。夏季與春季看起來接近，冬季截圖仍以綠地為主，缺少畫面可辨的季節性覆蓋物。E2E 只以草地 RGB 像素不同確認季節色值變化。 | 季節雖可由色值區分，玩家仍不容易只看場景辨認季節。 | 季節材質變體、季節裝飾物與天候呈現。 |
| 8 | P1 | 390×844 直式 HUD 集中在頂部：狀態列、工具／種子、寬大的主要動作按鈕及存檔／設定／說明分多列佔用垂直空間；遊戲畫布被上下 HUD 與觸控控制夾住。 | 可觀看的世界區域變短，世界畫面在手機上更顯擁擠。 | mobile HUD 的資訊優先級、折疊方式與 responsive grid。 |
| 9 | P1 | 844×390 橫式畫面中，世界畫布被左右觸控控制擠成較窄的中央區域，下方還留有大片暗色空間；場景只佔整體寬度的一部分。 | 橫式手機沒有有效利用寬度，玩家獲得的場景視野有限。 | landscape stage grid、觸控控制停靠位置與 canvas sizing。 |
| 10 | P2 | 手機觸控按鈕分布在畫面兩側與底部，HUD、遊戲畫布、提示訊息及控制按鈕彼此有較大間隔，視覺焦點分散。 | 新玩家需在多個區域間搜尋操作入口，整體介面較像分散的控制面板。 | touch HUD 的群組與資訊層級；需以觸控任務測試確認易用性。 |

## 覆蓋狀態與證據限制

| 要求 | 可用證據 | 狀態 |
|---|---|---|
| 農場 | VF-00 直式／橫式截圖、四季 canvas snapshots、成熟田地 snapshot | 已檢視靜態畫面；沒有 3 個日照時段對照。 |
| 村莊 | VF-00 926×694 canvas、桌機 viewport 1280×720 的固定 Playwright canvas snapshot | 已檢視；四季 E2E 僅比較草地取樣色，沒有村莊四季完整畫面。 |
| 室內 | `tests/e2e/kitchen.spec.ts` 會走進屋內、開料理面板並檢查配方與錯誤訊息 | **無室內原始截圖可檢視**；功能斷言不能替代室內美術稽核。 |
| 代表日照時段 | VF-00 截圖為約 06:00／06:10；季節截圖為 10:00 且晴 | **不足三時段**；無正午／黃昏或夜間的原始場景畫面，亦沒有可用的光影對照。 |
| 四季 | `map-world-validation.spec.ts` 存有春、夏、秋、冬農場 canvas snapshots；E2E 驗證農場及村莊的草地像素值各季不同 | 農場四季畫面已檢視；像素差異測試只證明色值不同，不證明季節視覺品質或辨識度。 |
| 桌機 | Playwright viewport 1280×720 的 Desktop Chrome 模擬；村莊畫布輸出 926×694 | 有固定桌機模擬證據；未做真實桌機硬體或 DPR 矩陣檢視。 |
| 至少兩種手機尺寸 | 390×844、844×390 viewport；另有 768×1024 平板模擬 | 符合模擬尺寸數量；仍不是實體裝置。 |
| 相機縮放／viewport | Playwright viewport 可由測試規格還原；部分 PNG 是 canvas crop、部分是 full page | **相機 zoom 沒有與原始截圖一併保存**，不能精確比較跨圖顯示比例。 |

因此本報告完成的是對**可取得影像的限制範圍稽核**，不是完整 VF-01 視覺驗收。要關閉上述缺口，需補拍同一場景的室內、至少三個時段、村莊四季與 zoom-bound 的原始畫面；要宣稱手機通過，還需真機觸控與安全區確認。

## 自動化證據（非視覺品質通過）

- `tests/e2e/map-world-validation.spec.ts`：四季農場及村莊 grass RGB sample 各季皆有不同值；包含成熟作物、村莊、遮擋等 Playwright canvas snapshots。這證明指定程式狀態有輸出，不代表季節辨識度良好。
- `tests/e2e/companions.spec.ts`：桌機模擬下有固定農場／村莊 companion canvas snapshots，並測寵物素材與玩家的關係。
- `tests/e2e/pixel-movement.spec.ts`：390×844 與 844×390、DPR 2 的 full-page 截圖；測試讀取 camera viewport，但截圖 PNG 本身沒有帶出相機 zoom 數值。
- `tests/e2e/mobile-farm-flow.spec.ts`、`tests/e2e/mobile-acceptance-gaps.spec.ts`：有直式、橫式和平板的觸控操作及畫面界限檢查。Playwright 觸控模擬仍不能證明真機 hit target 或 safe area 行為。
- `tests/e2e/kitchen.spec.ts`：室內料理面板可見性、配方文字及缺少材料回饋有功能斷言，沒有保存室內視覺 baseline。
- VF-00 記錄 `npm run check` 與 `npm run test:e2e` 在基準上的通過結果；本次只讀稽核沒有重跑完整套件。

## 原創與美術核准 Gate

評估依現有 `docs/ART_STYLE.md` Golden Reference 與 `docs/ORIGINALITY.md`：使用者提供的商業遊戲畫面只可作為一般品質參照，不得複製其角色、屋舍、地圖配置、介面組合或素材。這次沒有生成、匯入或替換任何素材，也沒有宣告候選素材核准或整合；Top 10 是對現有畫面的觀察與問題排序，不是新的視覺方向批准。

## 建議下一步

先補齊室內、三時段、村莊四季及相機 zoom 有紀錄的原始 evidence，再由 VF-02 產生並提交**原創、可核准**的視覺候選。改善項目應優先處理地面重複紋理、地塊邊緣、場景層次、手機 canvas 可用區及角色辨識；現有觀察只供排程，不授權整合未核准素材。

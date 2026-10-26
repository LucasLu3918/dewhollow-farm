# DF-G1-TILING-CONTINUITY｜pixel32 圖塊接縫候選觀察

## 結果與邊界

這是四季候選素材的瀏覽器 QA 觀察包，不是 Gate 1 通過或美術核准。manifest 維持 `status: candidate`、`approved: false`；沒有修改圖集、manifest、generator、正式 runtime、遊戲地圖或資產登錄。

四季各呈現 grass、field、path、water 的 3×3 同圖重複，並檢視每季 16 種 field-edge frame（共 64 種）。混合邊界區依 manifest 的方向位元 north/east/south/west = 1/2/4/8，在上排草地、下兩排田地的 3×3 示意中選取 mask；圖格外鄰居假設為草地。這是候選 mask 選取示意，不是透明圖層疊合，也不驗證正式地圖規則。

目前每季只有一張 grass、field、path、water 基礎圖塊；沒有 pixel32 soil，也沒有多款基礎重複變體。此階段不補造缺少的素材。

## 自動邊界量測

每種基礎圖塊取 32 個左右邊界像素對及 32 個上下邊界像素對，共 64 組 RGB 比較。四季 × 四地表共 1,024 組比較；目前全部 RGB 差為 0，完全相等為 1,024／1,024，平均及最大 RGB 差皆為 0。量測不含 alpha 通道，也不代表人眼感知的無縫程度、重複紋理品質或正式素材核准。

| 季節 | 草地／田地／道路／水面 | 完全相等 | 平均／最大 RGB 差 | 截圖 |
|---|---|---:|---:|---|
| 春 | 各 64／64；平均／最大皆 0／0 | 256／256 | 0／0 | [spring.png](gate1-map-tile-continuity/screenshots/spring.png) |
| 夏 | 各 64／64；平均／最大皆 0／0 | 256／256 | 0／0 | [summer.png](gate1-map-tile-continuity/screenshots/summer.png) |
| 秋 | 各 64／64；平均／最大皆 0／0 | 256／256 | 0／0 | [autumn.png](gate1-map-tile-continuity/screenshots/autumn.png) |
| 冬 | 各 64／64；平均／最大皆 0／0 | 256／256 | 0／0 | [winter.png](gate1-map-tile-continuity/screenshots/winter.png) |

## 可重現來源與證據

- Playwright 專項：`NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost SAVE_TILING_CONTINUITY_EVIDENCE=1 E2E_BASE_URL=http://127.0.0.1:5217 PWA_BASE_URL=http://127.0.0.1:4217 npm run test:e2e -- tests/e2e/gate1-map-tile-continuity.spec.ts`，通過 1／1。
- 輸入 SHA-256：manifest `3a179659310f657b70bfd5a929e671d8fbce340e241fe16fbb90bb5d5b27c9ea`；atlas `64418c1bb8099a821ff32fd520bf3680e7416b4d99e8a50f84f1da05125a2184`；generator `333c7866a22c33a46bf403ac3ff5036011a447db6f55c6bd1104d71fd92837b5`。
- 四張截圖均為 1280 px 寬。各季完整 SHA-256、實際尺寸、載入 frame、mask 清單、RGB 指標、瀏覽器錯誤與來源 hash 收錄於 [`evidence.json`](gate1-map-tile-continuity/evidence.json)。
- E2E 未觀察到 page error、request failure 或 HTTP 4xx／5xx。候選狀態在預覽與測試中保持未核准。

## 待完成

人工接縫與紋理評分仍待收集；可讀性盲測仍待至少三位獨立觀察者完成。pixel32 soil、基礎地表變體、正式遊戲規則與原生裝置檢查也仍在 Gate 1 缺口中。以上自動化結果只證明本次靜態候選預覽可重現並通過指定檢查。

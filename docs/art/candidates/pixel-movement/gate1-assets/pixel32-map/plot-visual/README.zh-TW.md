# P4-040 田地視覺候選驗收

這組截圖驗證 DEV Pixel32 預覽中的乾／濕土 mask。候選土壤依春季色盤顯示；場景仍以既有 `PlotMap` 作為唯一田地狀態來源。作物階段、成長、存檔和收成規則未在本任務變更。

瀏覽器視窗為 390×844 CSS px，canvas 截圖為 356×578 px。E2E 使用實際農場場景與 IndexedDB 存檔載入，不是合成示意圖。

| 形狀 | 田格數 | 驗證 frame | 結果 |
| --- | ---: | --- | --- |
| 1×1 | 1 | `spring-dry-soil-edge-0` | 通過 |
| 3×3（中心濕土，其餘乾土） | 9 | `spring-dry-soil-edge-a`、`spring-wet-soil-edge-0` | 通過 |
| L 型（全濕土） | 4 | `spring-wet-soil-edge-6` | 通過 |

未帶 `gate1Runtime=pixel32-map-animation` 時，DEV 預覽 runtime 關閉且候選土 frame 數為 0。atlas 和其 manifest 仍為未核准候選，不屬於正式素材。

## 截圖

- [1×1 乾土](./plot-1x1.png)
- [3×3 乾濕混合](./plot-3x3.png)
- [L 型濕土](./plot-L.png)

可重現方式：`SAVE_GATE1_PLOT_VISUAL_EVIDENCE=1 npm run test:e2e -- tests/e2e/gate1-plot-visual.spec.ts --workers=1`。

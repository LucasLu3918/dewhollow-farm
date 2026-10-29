# P4-042 農務命中回饋錄影

`videos/till-sow-water-growth-harvest.webm` 是 `tests/e2e/gate1-farm-action-impact.spec.ts` 的 Playwright 成功錄影，覆蓋同一田格的鋤地、播種、澆水、兩次睡眠成長、第二次澆水及成熟收成。

測試同時檢查動作回饋依序為 `till → plant → water → water → harvest`、月光豆兩夜後成熟、收成後田格沒有作物且背包取得作物。工具揮動命中影格、田地更新及粒子由現有 runtime 負責；本任務沒有更動遊戲規則。

| 證據 | 值 |
|---|---|
| Playwright | `npm run test:e2e -- tests/e2e/gate1-farm-action-impact.spec.ts --workers=1` |
| 結果 | 1/1 passed |
| 影片 SHA-256 | `7c058977a9a29bda313f0c8ab329e00c94ad2739d2a6124097efd222cad638c7` |
| 範圍 | 開發版農場流程與既有動作回饋；不代表候選作物素材已核准 |

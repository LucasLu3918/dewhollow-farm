# P5-050 訊息 HUD 候選驗收

## 範圍

- 新訊息以暫時提示顯示 4 秒。
- 訊息按鈕可展開／收合最近六則訊息，並標示目前數量。
- 歷史面板浮在訊息列上方；展開、收合及新訊息不改變遊戲畫布尺寸。
- 桌機及手機均可用鍵盤操作；手機保留原觸控控制位置。
- 不更動遊戲規則、存檔格式或遊戲狀態。

## 候選畫面

下列圖片是瀏覽器 E2E 的候選驗收截圖，桌機使用 1280×720、手機使用 390×844 viewport。它們只記錄訊息提示收合與歷史展開狀態，不代表正式素材核准，也不包含實體裝置驗證。

| Viewport | 訊息提示收合 | 歷史展開 |
| --- | --- | --- |
| 桌機 1280×720 | [desktop-collapsed.png](screenshots/desktop-collapsed.png) | [desktop-history.png](screenshots/desktop-history.png) |
| 手機 390×844 | [mobile-collapsed.png](screenshots/mobile-collapsed.png) | [mobile-history.png](screenshots/mobile-history.png) |

## 驗證

- `npx playwright test tests/e2e/hud-message-toast.spec.ts`：2/2 通過。
- `npx playwright test tests/e2e/viewport-message-stability.spec.ts tests/e2e/mobile-panel-shell.spec.ts tests/e2e/mobile-acceptance-gaps.spec.ts`：21/21 通過。
- E2E 覆蓋提示逾時後歷史仍可查看、六則歷史語義、鍵盤訊息操作、手機／桌機畫布尺寸穩定，以及訊息滾動錨點。

## SHA-256

- `desktop-collapsed.png`：`59cfedae60d1835898bc4cf3b903b49a3df8967dc82b578dc8e6bfd42c368e9a`
- `desktop-history.png`：`2bc866e228900f3ac520be3b29a30c7203c18ec8d0429709a22304dfbd06d9d8`
- `mobile-collapsed.png`：`baceb945e6ce4797573301ea6f8073c99dfc20a26b7a9195a79ae7589edec346`
- `mobile-history.png`：`63339c1d8840d9d990f3a2c6a4d00e389e8731f8edc6e2f80d8cb0c782dfc64e`

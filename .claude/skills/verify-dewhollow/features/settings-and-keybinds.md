# 設定面板與按鍵重新綁定

## Sub-features

- 打開設定：`O`，`#settings-panel` 出現，列出每個動作目前的按鍵（例如互動 `X`、上移 `↑`）。
- 改鍵：點擊 `#settings-keys button[data-action="..."]`，然後按新的鍵。
- 衝突：新鍵已被其他動作使用時，`#settings-prompt` 詢問是否交換；確認（`#settings-swap`）後兩者互換，取消則都不變。
- 取消改鍵：改鍵時按 `Escape`，訊息為「已取消改鍵。」，按鍵不變，面板不關。
- 恢復預設：還原改過的按鍵。
- 偏好保存：改好的按鍵與字級，重新整理後保留（存於 `localStorage`，不進存檔）。
- 字級三檔、色盲標記（訊息前加 ✓ 或 ✕）、閃光與震動開關。

## How to get to it (user POV)

在遊戲中按 `O`，或點擊 HUD 上的「設定」按鈕。按 `Escape` 關閉面板。

## Driving it with Playwright

按鍵前要等場景就緒：`expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('')`。

範例（取自 `tests/e2e/accessibility.spec.ts` 的改鍵劇本）：

1. `page.keyboard.press('o')`，等 `#settings-panel` 可見。
2. 點 `#settings-keys button[data-action="interact"]`，按 `Escape`，等 `#settings-message` 為「已取消改鍵。」，並確認互動列仍是 `X`。
3. 衝突劇本：點 `interact`，按 `z`（`Z` 是切換工具的預設鍵），等 `#settings-prompt` 出現，再點 `#settings-swap`。

偏好存於 `localStorage` 的 `dewhollow-farm.settings`，驗證保留時可直接讀它（用 `page.evaluate` 讀取，不要改寫）。

## Gotchas

- `tests/e2e/accessibility.spec.ts` 的註解寫「本檔尚未執行」。在它被實際跑過之前，這裡的所有斷言都是未驗證的，不能當成已通過的證據。
- 改鍵會寫入 `localStorage`，每次驅動器都用新的 context，所以不會汙染下一次執行；若用既有的 context 測試，要先清掉該 key。
- 「減少動態」系統偏好由 Playwright 的 `reducedMotion` 選項模擬，不是 app 內的開關。

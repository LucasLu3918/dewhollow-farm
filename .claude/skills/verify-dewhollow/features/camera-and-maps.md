# 鏡頭與地圖切換

## Sub-features

- 鏡頭跟隨主角：農場是 32×24 格，比一個畫面（16×12 格）大，鏡頭跟著玩家，但不超出地圖邊界。
- 出生點鏡頭：出生在 (7,9)，左邊貼著邊界（x=0），垂直方向置中（y=224）。
- 地圖切換後重新定位：村莊剛好一個畫面大，鏡頭固定在原點；從村莊回農場時，直接定位到農場南端，不從舊位置滑過去。
- 世界連接（`world.spec.ts`）：農場往東通森林，森林通湖畔與礦坑入口。這部分屬於世界地圖功能，同樣未驗證。

## How to get to it (user POV)

- 農場：出生後直接可見。
- 村莊：農場南邊的門，向下走 20 步左右進入。
- 回農場：從村莊的門往上走。

## Driving it with Playwright

鏡頭位置只能用開發模式的 `window.__dewhollow.cameraScroll()` 讀取，因此驅動器必須連到開發伺服器。

```js
await expect.poll(() => page.evaluate(() => window.__dewhollow.cameraScroll())).toEqual({ x: 0, y: 224 });
```

按鍵序列與 `tests/e2e/camera.spec.ts` 相同：`ArrowDown` × 19 後 y 應為 `30*64 - 12*64 = 1152`；再 `ArrowRight` × 31 後應為 `{ x: 1536, y: 1152 }`。切到村莊：`ArrowDown` × 20，`mapId()` 為 `village`，鏡頭 `{ x: 0, y: 0 }`。

## Gotchas

- 每次都要用 `expect.poll`，鏡頭以動畫移動，不是瞬間到位。
- `cameraScroll` 與 `mapId` 只在開發模式存在，對 `npm run preview`（4173）驗證會直接失敗，這是預期行為，不是 bug。
- 農場的邊界數字依賴 `content/maps/farm.json` 的尺寸與 64 px 格子大小；改地圖尺寸時，期望值要重算。
- 規格的註解寫「尚未執行」的是 `accessibility`、`collection`、`autumn-winter`，camera 與 world 的規格沒有這樣的註解，但也還沒經本 skill 的驅動器跑過。

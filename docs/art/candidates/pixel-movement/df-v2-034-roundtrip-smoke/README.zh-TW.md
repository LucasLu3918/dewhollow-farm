# P3-034 室內外往返 Smoke

使用 DEV-only world-v2 候選路由，在 1280×720 Chromium 視窗內完成 10 次農場／小屋往返。第一次進屋會使用工作台、走到床邊睡一晚、手動存檔並重新載入；之後每輪都實際移動、穿越門並檢查候選圖層切換與清理。測試最後回到農場，日期為第 1 年春第 2 天。

- [農場起始畫面](screenshots/farm.png)
- [小屋候選畫面](screenshots/house.png)
- [十次往返後農場](screenshots/farm-after-roundtrips.png)
- [完整瀏覽器錄影](videos/ten-roundtrips.webm)
- 證據時間、指令與 SHA-256：[evidence.json](evidence.json)

執行：`npx playwright test tests/e2e/world-v2-roundtrip-smoke.spec.ts --workers=1`

此 smoke 驗證現有地圖與 DEV 候選場景的整合，不代表候選素材已核准為正式素材，也不改變地圖、存檔或正式資產。

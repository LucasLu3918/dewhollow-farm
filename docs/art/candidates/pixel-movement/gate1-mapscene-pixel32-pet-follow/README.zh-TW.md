# P4-045 黑貓與矮袋鼠 DEV 跟隨驗證

> **狀態：DEV 候選已完成驗證；素材仍為 `candidate`／`approved: false`。** 本測試只在精確 Pixel32 DEV 候選路徑使用黑貓與矮袋鼠候選圖，讓兩者跟隨玩家。正式模式仍使用原本黑貓 follower 與矮袋鼠村民行為；本文件不代表候選美術已獲人工核准。

## 驗證方式

```bash
SAVE_GATE1_PIXEL32_PET_FOLLOW_EVIDENCE=1 npm run test:e2e -- tests/e2e/gate1-mapscene-pixel32-candidate-pet-follow.spec.ts --workers=1
```

結果：2/2 通過。候選模式涵蓋兩種寵物四方向跳步、逐幀動畫、可見範圍、深度與各自跟隨一格；未帶精確 opt-in 的流程確認矮袋鼠仍是村民且位於原本位置。證據來自 Playwright `Desktop Chrome` 1280×720 viewport（輸出截圖 1280×720），不是手機或實機測試。

## 產物

| 產物 | SHA-256 |
|---|---|
| [結構化驗證證據](evidence.json) | `6a0a3530dbf6cfdabe8d4966d96e01e3d36a98229f25dd38f2d47e5b4a56d177` |
| [上方向截圖](screenshots/01-up-follow.png) | `4340b1065661d3677b645db5ce23a49a2b36ed157115aa2789a22359a4ceaccc` |
| [右方向截圖](screenshots/02-right-follow.png) | `b4a742a9a0685c64e1222222f33bfd51c4f817f7eba1c957fc5d216e8ba005ed` |
| [下方向截圖](screenshots/03-down-follow.png) | `d5faf4ebae7dbfa0807c20c477a7bbd8799fa0f84813bb12acbfcaef687be101` |
| [左方向截圖](screenshots/04-left-follow.png) | `c58f50e18ca4661892e918141e6157c1d0cb23451a37d20d0088e7cabf15ec30` |
| [DEV 候選雙寵物跟隨影片](videos/candidate-cat-quokka-follow.webm) | `37324028221799e006c3b35725099227da0d0bf755c2fc3cca92ff89ee1e9340` |
| [未 opt-in 的正式矮袋鼠村民 fallback 影片](videos/production-quokka-resident-fallback.webm) | `622a96f597cba834d688188410578757f74270ca28425855f4903501fdfdf54e` |

人工審查仍須確認候選寵物的物種辨識度、動作品質與視覺方向。四張方向截圖供 P4 gate 檢視；候選圖集與 runtime 在獲得核准前仍不得視為正式素材。

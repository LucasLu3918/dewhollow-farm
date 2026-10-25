# Pixel32 門與出貨箱場景候選預覽

## 目的

將既有 pixel32 互動物候選放進 farm `MapScene`，在遊戲實際場景尺寸和圖層中檢視關閉／開啟狀態。預覽使用遊戲主路由上的 DEV-only 精確 query 旗標：

```text
?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1InteractablePreview=pixel32-interactables
```

未帶最後一個旗標時不載入互動物候選 atlas。production build 即使收到完整 query 也不會請求候選素材。BootScene 另外要求 manifest 和四幀都明確標記 `approved: false` 才會註冊圖集。

## 候選素材與證據

來源：[pixel32 interactables candidate manifest](gate1-assets/pixel32-interactables/manifest.json)。manifest 為 `candidate`／`approved: false`，圖集 SHA-256：`b2c38612200c90b87eb1a937adcac077c4f80891b4683b8f8b1853670e687915`。

| 候選 frame | SHA-256 |
| --- | --- |
| `door-closed` | `b79a9ae2732feeec9ac25497d52476643c9efe7cdf6a3c771c029058b1b4726b` |
| `door-open` | `1dac80ea9501682faacd68da0cb62ecdda97f60d5bbb5114bc07e115ad7dd490` |
| `shipbox-closed` | `f47ef5735a125b679bcd65777059eb1c883eb5d75aae9832d377d6b42b297ac2` |
| `shipbox-open` | `a2b80a6966589f4ead8940a61d71033dde995260d38928cf94cd699ccccb4087` |

畫面證據：[1280×900 Chromium screenshot](gate1-mapscene-pixel32-interactables-preview/screenshots/pixel32-interactables-preview.png)。輸入與輸出雜湊、四個 frame 的可見狀態、載入路徑和錯誤清單記在 [evidence.json](gate1-mapscene-pixel32-interactables-preview/evidence.json)。

專項 Playwright E2E 通過 1/1。測試確認四個 frame 可見、production 不載入 atlas、測試切換不能跨門／出貨箱類別，且切換不改變玩家位置、互動目標或能量。候選圖集和 manifest 載入無失敗，瀏覽器無 page error。

## 限制

- 此畫面只驗證一個 Chromium 1280×900、DPR 1 viewport；未覆蓋其他 viewport、DPR 或原生裝置。
- 關閉／開啟 frame 是並列靜態樣本。沒有接真實門或出貨箱互動、碰撞、運輸、庫存或存檔邏輯。
- 此證據不代表素材已 reviewed、approved 或 integrated，也不代表 Gate 1 通過。素材仍需使用者檢視確切版本；正式整合必須遵循 [素材審核流程](../../asset-review.md)。

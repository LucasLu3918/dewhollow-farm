# 10 情境可讀性盲測包

這個資料夾包含參與者使用的刺激圖與作答表。請只把 `participant/` 提供給觀察者；不要在完成作答前分享評分指南、內部情境代碼或答案鍵。

## 參與者

1. 開啟 [盲測作答表](participant/assessment-form.zh-TW.md)。
2. 依序檢視 `participant/stimuli/01.png` 至 `10.png`。請以影像原尺寸顯示，不縮放，也不要查閱 repo 內的評分資料。
3. 對每張圖自由描述主要物件與狀態，並記錄信心度。
4. 完成後將表單交還評分者，再由評分者核對答案。

## 尺寸與限制

圖片由 Playwright Chromium 在 1280×900 viewport、DPR 1 下以 CSS 尺寸擷取，剪裁至遊戲畫布內容區。每張圖的實際 PNG 寬高及 SHA-256 記在 `evidence.json`。這不是原生 DPR 或 iOS／Android 實機證據。

pixel32 地圖、玩家、甜蘿蔔與貓候選依 DEV-only 路由顯示。`evidence.json` 記錄所有實際呈現之候選圖集的輸入 hash。溫室門圖是既有可進入的玩法入口，並不代表獨立 pixel32 靜態門候選已有互動連接。候選資產仍未核准；自動化證據不取代 90% 人工辨識門檻。

機器擷取報告：[DF-G1-READABILITY-10SCENARIOS](../gate1-readability-10scenarios.zh-TW.md)。

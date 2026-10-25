# Pixel32 甜蘿蔔三階候選

> **狀態：candidate；未經人工審查、未核准、未整合。** 每個素材版本需獨立檢視與核准；甜蘿蔔既有素材的核准不涵蓋本候選。

本候選以 32×32 原生網格繪製甜蘿蔔種子、幼苗與成熟期。既有核准甜蘿蔔圖只作為「紅色塊根、綠色葉片」特徵參考；產生器不讀取、縮放或取樣其像素，圖檔 SHA-256 僅用來確認參考版本。

## 預覽

![甜蘿蔔三階 Pixel32 候選預覽](./preview.html)

三個畫格以透明背景展示，preview 以 CSS 最近鄰放大；此頁面是靜態候選審查圖，不接正式 MapScene 或遊戲素材清單。

## 契約與重現

- `manifest.json` 維持 `status: "candidate"`、`approved: false`。
- Atlas 為 96×32、非交錯 8-bit RGBA PNG，三個 32×32 cell 依序為 seed、sprout、mature。
- 各畫格 `footAnchor` 與 `pivot` 都固定為 `(16,31)`，最近鄰 2× 對應 64×64 世界格。
- `tools/art/generate_gate1_crops.mjs` 以手工整數像素圖元重現 atlas 與 manifest；`tools/art/check_gate1_crops.mjs` 驗來源參考、契約、PNG／frame SHA 與產生重現。

```bash
node tools/art/generate_gate1_crops.mjs
node tools/art/check_gate1_crops.mjs
npm test -- tools/art/check_gate1_crops.spec.ts
```

Checker 通過只證明資料格式、雜湊與產生重現，不代表視覺品質、遊戲內可讀性、原生裝置驗收或 Gate 1 完成。此資料夾不會登錄到 `content/assets.json`，也不會放進 `public/`。

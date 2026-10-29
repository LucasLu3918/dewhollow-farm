# Pixel32 內容優先作物候選

> **狀態：candidate；未經人工審查、未核准、未整合。** 本候選涵蓋內容順序前三種作物：晨露草、月光豆、甜蘿蔔；既有甜蘿蔔素材的核准不涵蓋此版本。

所有畫格皆以原生 32×32 網格及 generator 中原創整數像素圖元繪製。甜蘿蔔既有圖只供紅色塊根與綠葉特徵參考，產生器不讀取、縮放或取樣其像素。露草與月豆亦為原創手繪圖元，未取用外部像素。

## 預覽

![露草、月豆與甜蘿蔔 Pixel32 六階候選預覽](./preview.html)

靜態預覽以最近鄰放大顯示三列、六階的 atlas；不接正式 MapScene 或遊戲素材清單。

## Frame 契約

- Atlas：`sweet-radish-stages.png`，192×96 RGBA8888；每格 32×32，按作物列與階段欄排列。
- 正式候選 frame key：`crop.<cropId>.<stage>`；`cropId` 為 `dew-grass`、`moon-bean`、`sweet-radish`，`stage` 為 `seed`、`sprout`、`growing-1`、`growing-2`、`flowering`、`mature`。
- 保留舊甜蘿蔔 alias `seed`、`sprout`、`mature`，其座標及像素雜湊與原候選相同。
- 各 frame 的 `footAnchor` 與 `pivot` 固定為 `(16,31)`；最近鄰 2× 對應 64×64 世界格。
- 全部素材仍標示 `status: "candidate"`、`approved: false`，不登錄到 `content/assets.json`，也不放進 `public/`。

## 重現與檢查

```bash
node tools/art/generate_gate1_crops.mjs
node tools/art/check_gate1_crops.mjs
npm test -- tools/art/check_gate1_crops.spec.ts
```

Checker 通過只證明資料格式、雜湊、候選狀態及產生重現，不代表視覺品質、遊戲內可讀性、原生裝置驗收或 Gate 1 完成。

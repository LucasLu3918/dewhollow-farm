# 美術素材提示詞模板

本模板提供一致的專案風格與檢查條件；每項素材仍須依 [素材審核流程](asset-review.md) 個別審核。提示詞只描述新素材，不把未核准候選當成定稿，也不把其他素材的核准狀態移用到新素材。

## 角色／寵物

```text
[主體：物種或角色設定、可辨識特徵、姿勢與朝向；一張只包含一個主體]
Cute original game character, chibi proportions, bright saturated full-color pixel art,
clear grouped pixels, thick dark-brown outline, soft highlights and shading, light from upper left,
centered with feet aligned to a consistent baseline, isolated on a truly transparent background.
No text, logo, watermark, frame, extra character, extra pet, human-animal composite,
unrequested clothing or accessories, blur, glow, chroma-key spill, or checkerboard pattern.
```

## 地形

```text
[主體：單一地形材質、色彩及季節；完整鋪滿方形畫面]
Original bright saturated hand-painted pixel-art game terrain, grouped crisp pixels,
soft highlights and shading, straight top-down view, even lighting, seamless repeating edges.
No outline, cast shadow, object, character, text, logo, watermark, blur, or border.
```

## 物件

```text
[主體：一件原創物件、材質、朝向與辨識細節]
Original bright saturated hand-painted pixel-art game object, grouped crisp pixels,
thick dark-brown outline, soft highlights and shading, light from upper left,
straight top-down three-quarter view, one object centered, transparent background.
No text, logo, watermark, ground tile, cast shadow, duplicate object, blur, or frame.
```

## 審核前檢查

- 一張圖的主體數量、物種、方向、輪廓和原創設定符合素材 brief。
- 角色與物件有真正透明 alpha；地形依 brief 不透明且能無縫鋪設。
- 沒有文字、商標、浮水印、拼貼殘留、綠邊、棋盤格假透明或不需要的主體。
- 原始候選放在 `private/art-trials/`；不要將含提示詞或私人原圖的試驗紀錄複製到公開文件。
- 本模板不是素材核准。任何新檔案須有自己的候選、人工檢視與明確核准紀錄。

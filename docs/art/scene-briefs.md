# 場景與物件材質（產圖用）

與角色使用同一套風格：明亮飽和的手繪卡通、深棕輪廓（物件）、光源在左上。生成與處理流程見 [ART_PIPELINE.md](../ART_PIPELINE.md)；本檔記錄每一種格子的提示詞與採用結果。

## 兩種格子

| 類型 | 格子 | 生成 | 處理 |
| --- | --- | --- | --- |
| 地形（無縫） | 草、小徑、耕地、翻土、木板地、水、石牆、室內地板 | 768 px 方圖，提示詞要求「無縫重複、無陰影、無輪廓」 | `tools/art/tile_finalize.py --seamless`（先錯開半張融掉接縫，再縮到格子） |
| 物件（整格） | 樹、石頭、礦石、柵欄、出貨箱、門、床、廚房、工作台、家具、水槽、樓梯、攤位、草叢、野生採集、洞口 | 768 px 方圖，單一主體置中，底色接近周圍地面，深棕輪廓 | `tools/art/tile_finalize.py`（不無縫、不去背） |

兩者目前都由 `tile_finalize.py` 輸出 `-2x.png`（128 px 母版）；遊戲以 0.5 倍顯示。若日後需要 1× 檔，應由母版以明確流程衍生並登錄，不假設此工具會輸出 `.png` 1× 檔。

## 共用的風格後綴

地形：

```
Bright saturated hand-painted cartoon style, soft painted brush texture, soft highlights and shading, flat even lighting, no outline, no shadows, no objects, no characters, no text, no logo, edge to edge, seamless repeating pattern, straight top-down view.
```

物件：

```
Bright saturated hand-painted cartoon style, thick dark brown outline on the object, soft highlights and shading, straight top-down three-quarter view, single object centered and filling most of the square, plain ground matching the surroundings, no text, no logo, no symbol, no characters, no lettering.
```

每張圖只換前面的主體描述。重用提示詞骨架見 [prompt-template.md](prompt-template.md)；提示詞檔與試驗素材放在 `private/art-trials/`（不進版控），不要在公開文件保存私人原始提示詞。每張素材依 [asset-review.md](asset-review.md) 逐版本審核並記錄實際來源。

## 注意事項

- 生成時 seed 固定為 101（與角色一致）；只有構圖明顯不合格時才換 202。
- 物件提示詞不寫數量與位置；數量由地圖格子決定。
- 採用的圖要逐張檢查：不得出現文字、招牌字、商標（例如平板或箱子上的標誌）。
- 歷史紀錄：地形顏色曾透過 `content/palette.json` 量化；現行 `tile_finalize.py` 保留 RGBA8888 全彩，調色盤不量化地形輸出。

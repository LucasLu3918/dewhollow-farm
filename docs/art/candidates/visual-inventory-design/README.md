# VF-02 背包與場景 A/B 候選

狀態：使用者已選定場景方向 **B**（`candidate-b-scenes.png`）；A 不採用。場景圖與六款新物品圖示仍是候選，尚未逐項核准，禁止整合至正式遊戲。日期：2026-10-26。

開啟 [`index.html`](index.html) 檢視受控農場／村莊 A/B 場景、桌機背包與選中道具詳情、390×844 直式和 844×390 橫式。候選 PNG 只作氛圍靈感，不參與幾何／zoom 對照。

## 場景方向

- **A｜保守高精修（不採用）**：降低草地對比、明確處理田地及道路邊緣，只作受控比較基線。
- **B｜層次更強／細節更密（使用者選定）**：增加近景樹木、圍籬、石砌高差及建物簷影。`candidate-b-scenes.png` 使用者選定 SHA-256：`f6f00f49c4b62faf8bde0783ace0a72e4521eb885ebec099724edbdfbdea9dec`。此選擇表示採用 B 的場景方向；素材仍需逐項核准。

## 受控地圖與鏡頭設定

- `index.html` 的 A/B 場景對照共用兩份 SVG 定義：`<symbol id="farm-map">` 與 `<symbol id="village-map">`，四個 view 都以 `<use>` 重用同一份幾何、座標、地標和遮擋順序。
- 四個 view 都固定 `viewBox="0 0 640 360"`，同為 16:9；配對卡片用相同 grid 欄寬和 CSS 規則，沒有各自 SVG transform、縮放或平移。640×360 是共同向量畫框，不宣稱對應 Phaser 世界座標或實際 64 px tile。
- 農場固定棚屋、3×3 農地、主路徑、大樹與南側圍欄；村莊固定中央水槽、東西兩間店屋、十字主路徑與南側樹池。A/B 僅切換色票、輪廓／細節線寬與同一物件群陰影。
- 這是鎖定幾何和畫框比例的靜態向量風格研究，非 Phaser renderer 截圖，也不宣稱已驗證實際遊戲相機 zoom。遊戲內 zoom 驗證仍需同一地圖匯入 renderer，並保存相機參數與原始截圖。

## 物品圖示候選

[`item-icons.svg`](item-icons.svg) 是六款原創圖示接觸表：甜蘿蔔、種子袋、木材、礦石、魚、料理。每款使用 32×32 SVG symbol，以深棕分段外框、整數像素簇和局部亮面繪製；圖示路徑沒有曲線、漸層或模糊。HTML 桌機、直式和橫式背包格皆重用相同 symbols；選中甜蘿蔔詳情以 128 px（4×）顯示於桌機／直式、以 96 px（3×）顯示於橫式，並使用 `image-rendering: pixelated`。這是候選清晰度示意，尚未輸出或整合正式 PNG。

詳情資料：甜蘿蔔 `seedPrice = 25`、`growthDays = 3`，基礎售價 `round(25 × 3 × 1.3) = 98`；優良品質倍率 125%，出貨價 `round(98 × 1.25) = 123`。內容來源 `content/crops.json`，規則來源 `src/domain/pricing.ts`。其他格子的數量只作構圖示例，非遊戲存檔證據。

## 限制與審核狀態

- `candidate-a-scenes.png` 與 `candidate-b-scenes.png` 由本機影像模型生成；Golden Reference `docs/art/style-sheet.png` 僅作像素群與深棕輪廓的質感參照。兩 PNG 是氛圍概念圖，不是同地圖受控比較；原圖仍帶較柔筆觸，正式素材需像素清理與實際倍率檢視。
- UI 是靜態提案，未連接 domain state、命令、鍵盤／觸控、focus restore、modal input lock、安全區或真機 hit target。按鈕只展示建議文案，不可操作。
- 沒有新增到 `public/assets` 或 `content/assets.json`；沒有把場景／圖示標為 `reviewed`、`approved` 或 `integrated`。
- 已用 Chrome 在 390×844 與 844×390 CSS viewport 實際渲染候選板；兩種尺寸均無文件層級水平溢位。直式 128 px 圖示與文字區可並列，橫式 96 px 詳情與清單左右並列；此為瀏覽器 viewport 排版檢查，非真機觸控或 renderer 驗證。另完成 HTML 結構、SVG symbol 引用與共用 viewBox 靜態檢查。

## 檔案校驗

| 檔案 | 尺寸 | SHA-256 |
|---|---:|---|
| `candidate-a-scenes.png` | 2117×743 | `ffd7676e6096b633b458b629eb11fd7f8ae4005fe042e3a1259d8b1ab14d565e` |
| `candidate-b-scenes.png` | 2117×743 | `f6f00f49c4b62faf8bde0783ace0a72e4521eb885ebec099724edbdfbdea9dec` |
| `item-icons.svg` | viewBox 184×146 | `3cd9abb6376b741bd316adcc77045e9a97bf3894bdc070b67f5063ac59af04dd` |

未使用既有遊戲素材或第三方遊戲畫面。

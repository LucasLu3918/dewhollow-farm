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

## 物品圖示方向比較（VF-02B）

使用者回覆既有 `item-icons.svg`（SHA-256 `3cd9abb6376b741bd316adcc77045e9a97bf3894bdc070b67f5063ac59af04dd`）需要修改，先比較兩個新方向。該檔為 **superseded candidate（已被取代的候選）**，不是核准素材；它仍留在歷史 VF-02 提案中供追溯。新比較板位於 [`index.html`](index.html) 開頭的「VF-02B｜物品圖示風格對照」。

- **A｜精緻像素候選**：`item-icons-pixel.svg`，以 64×64 viewBox symbol 繪製甜蘿蔔、種子袋、木材、礦石、魚、料理；使用整數像素簇、深棕輪廓、分區陰影和亮面，沒有漸層或模糊。SVG 接觸表與詳情放大圖共用同一組 symbol。
- **B｜繪本手繪候選**：`item-icons-storybook.png`，1536×1024 六格 atlas，物件順序與 A 相同；紙感底色、鉛筆紋理及自然手繪輪廓，與像素版本形成明確風格差異。
- **公平比較條件**：六物件採相同 3×2 次序與等尺寸格框；桌機詳情及 390×844、844×390 詳情展示同一甜蘿蔔、同一名稱／品質／數量／價格。手機板在小寬度切成單欄。比較板只是靜態候選，沒有遊戲互動或實際資料連線。

甜蘿蔔資料：`seedPrice = 25`、`growthDays = 3`，基礎售價 `round(25 × 3 × 1.3) = 98`；優良品質倍率 125%，出貨價 `round(98 × 1.25) = 123`。內容來源 `content/crops.json`，規則來源 `src/domain/pricing.ts`。其他物品格子數量僅供版面示意。

## 限制與審核狀態

- `candidate-a-scenes.png` 與 `candidate-b-scenes.png` 由本機影像模型生成；Golden Reference `docs/art/style-sheet.png` 僅作像素群與深棕輪廓的質感參照。兩 PNG 是氛圍概念圖，不是同地圖受控比較；原圖仍帶較柔筆觸，正式素材需像素清理與實際倍率檢視。
- UI 與 VF-02B 圖示板皆為靜態提案，未連接 domain state、命令、鍵盤／觸控、focus restore、modal input lock、安全區或真機 hit target。按鈕只展示建議文案，不可操作。
- 沒有新增到 `public/assets` 或 `content/assets.json`；沒有把場景／圖示標為 `reviewed`、`approved` 或 `integrated`。
- VF-02 曾以 Chrome 檢查舊版 390×844 與 844×390 版面；VF-02B 新增比較板尚未完成瀏覽器實際渲染：`file://` 預覽遭瀏覽器安全策略拒絕，且本任務未使用其他瀏覽器路徑。新版目前只完成 XML、HTML 引用、CSS 斷點及固定 viewport 的靜態檢查；沒有可報告的新 viewport 截圖或實際排版觀察。

## 檔案校驗

| 檔案 | 尺寸 | SHA-256 |
|---|---:|---|
| `candidate-a-scenes.png` | 2117×743 | `ffd7676e6096b633b458b629eb11fd7f8ae4005fe042e3a1259d8b1ab14d565e` |
| `candidate-b-scenes.png` | 2117×743 | `f6f00f49c4b62faf8bde0783ace0a72e4521eb885ebec099724edbdfbdea9dec` |
| `item-icons.svg`（superseded） | viewBox 184×146 | `3cd9abb6376b741bd316adcc77045e9a97bf3894bdc070b67f5063ac59af04dd` |
| `item-icons-pixel.svg`（VF-02B A 候選） | viewBox 768×512；symbol 64×64 | `28c6b24978c8033d42c4fc02c902c6720992a96895a35236f79ec90c9e746e33` |
| `item-icons-storybook.png`（VF-02B B 候選） | 1536×1024 | `4e2d97445c773024c142b2d37effa0c73b1b54e17e7fa51bf937f05f129be7f0` |
| `index.html`（VF-02B A/B responsive compare） | 390px/844px responsive labels | `9c1bc87dd2dfee749aa77fd3528859515664f6a4672c5c236ba7fc11b9b3a6d4` |

未使用既有遊戲素材或第三方遊戲畫面。

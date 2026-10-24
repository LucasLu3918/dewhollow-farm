# Pixel32 地圖候選素材

**狀態：候選，未核准；Gate 1 尚未通過。** 這是隔離的視覺研究頁，用來檢視地形接邊、四季配色、多格建物與樹冠遮擋。沒有註冊到遊戲資產清單，也不改動地圖碰撞或正式渲染。

## 內容

- 原生 32×32 草地、田地、道路與水面，各有春、夏、秋、冬候選色樣。
- 每季 16 種田地邊緣遮罩；遮罩以 N/E/S/W bit 表示草地接觸方向。它是圖塊樣式試驗，不是新的農務規則。
- 96×64 多格建物，拆成背景牆體與前景屋簷，並有 64×64 樹冠前景示例。
- 瀏覽器預覽可切季節與角色遮擋位置。畫布在 CSS 顯示尺寸使用最近鄰縮放。

## 生成與檢查

```bash
node tools/art/generate_gate1_map.mjs
npm run assets:gate1:map:check
```

生成器只寫入本目錄。Atlas 採固定 DEFLATE 區塊輸出，避免 Node/zlib 版本讓 PNG bytes 漂移。檢查器核對來源生成器雜湊、PNG 區塊 CRC、Atlas 雜湊、季節／遮罩完整度、錨點與候選核准狀態。

在專案根目錄執行 `npm run dev`，再開啟 `http://127.0.0.1:5173/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/preview.html`，即可操作候選畫面。預覽使用同目錄 atlas 和 manifest，沒有網路字型或外部服務依賴。

## 限制

- 這些像素由程式手繪，目的為驗證地圖構圖與資料契約；不等同最終美術品質或完整遊戲素材。
- 沒有改動 `MapScene`、`content/maps/`、`content/assets.json`、`content/rigs.json` 或 `public/`。
- 真正的無縫拼接、不同裝置上的可讀性、建物碰撞與遮擋需要在 Gate 1 場景中逐項確認；候選預覽不構成該驗收。
- `manifest.json` 及每個 frame 都必須維持 `approved: false`，待使用者檢視新畫面後再決定是否進入整合階段。

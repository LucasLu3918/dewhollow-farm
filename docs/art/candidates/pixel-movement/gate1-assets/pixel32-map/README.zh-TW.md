# Pixel32 地圖候選素材

**狀態：候選，未核准；Gate 1 尚未通過。** 這是隔離的視覺研究頁，用來檢視地形接邊、四季配色、多格建物與樹冠遮擋。沒有註冊到遊戲資產清單，也不改動地圖碰撞或正式渲染。

## 內容

- 原生 32×32 草地、田地、道路與水面，各有春、夏、秋、冬候選色樣。
- 每季增加乾土與濕土基底，並為乾／濕狀態各提供 16 種四方向鄰接遮罩；另有可重複的木地板、四種木牆轉角，以及帶部分 alpha 和透明邊界的地面陰影。
- 每季 16 種田地邊緣遮罩；遮罩以 N/E/S/W bit 表示草地接觸方向。它是圖塊樣式試驗，不是新的農務規則。
- 土壤遮罩 key 為 `<season>-dry-soil-edge-<hex>`／`<season>-wet-soil-edge-<hex>`；N/E/S/W bit 表示相鄰田格具有相同乾濕狀態，缺少同狀態鄰格的一側會畫出內縮邊線。這些圖樣只供 presentation 候選預覽，不代表遊戲規則。
- 96×64 多格建物，拆成背景牆體與前景屋簷，並有 64×64 樹冠前景示例。
- [continuity.html](./continuity.html) 以 3×3 重複顯示七種 tileable surface，檢查單一 32×32 frame 的右／左、下／上 RGBA 邊界是否完全相同；也展示牆角與 ground shadow 的透明像素摘要。
- map checker 實際解碼 PNG RGBA scanline，要求所有 `tileable: true` frame 的最大 channel delta 為 0；地面陰影須有透明與部分 alpha 像素，且四周透明。這不取代人工材質與完整場景審核。

## 生成與檢查

```bash
node tools/art/generate_gate1_map.mjs
npm run assets:gate1:map:check
```

生成器只寫入本目錄。Atlas 採固定 DEFLATE 區塊輸出，避免 Node/zlib 版本讓 PNG bytes 漂移。檢查器核對來源生成器雜湊、PNG 區塊 CRC、Atlas 雜湊、季節／遮罩完整度、錨點與候選核准狀態。

在專案根目錄執行 `npm run dev`，再開啟 `http://127.0.0.1:5173/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/continuity.html`，即可操作候選畫面。預覽使用同目錄 atlas 和 manifest，沒有網路字型或外部服務依賴。

## 限制

- 這些像素由程式手繪，目的為驗證地圖構圖與資料契約；不等同最終美術品質或完整遊戲素材。
- 土壤 candidate 只在既有 DEV Pixel32 opt-in 預覽中由 presentation adapter 使用；沒有改動 `content/maps/`、`content/assets.json`、`content/rigs.json` 或 `public/`，正式版仍使用原有田地渲染。
- exact RGBA edge checker 只證明標記為 `tileable` 的 base frame 循環邊界吻合；土壤邊緣遮罩刻意不是可平鋪 base frame。不同 surface 之間的搭配、自然材質觀感、實際地圖 autotile、裝置可讀性、建物碰撞與遮擋仍需在 Gate 1 場景中逐項確認。
- `manifest.json` 及每個 frame 都必須維持 `approved: false`，待使用者檢視新畫面後再決定是否進入整合階段。

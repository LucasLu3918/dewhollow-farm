# Pixel32 互動物件候選

**狀態：candidate，未核准；Gate 1 尚未通過。** 本候選提供七種工具與門、船運箱各自的開啟／關閉狀態，僅供視覺檢視，沒有註冊為正式遊戲素材。

## 候選內容

- 工具：鋤頭、水壺、種子袋、斧頭、十字鎬、釣竿、鐮刀。
- 互動物件：門關閉／開啟、船運箱關閉／開啟。
- 全部 frame 為原生 32×32、8-bit RGBA；atlas 使用最近鄰預覽。`footAnchor` 和 `pivot` 固定在 `(16,31)`。工具另有 32×32 內的握點，預覽可切換錨點與握點標記。
- 原創正式素材只作視覺參考，manifest 記錄來源路徑與 SHA-256；候選由整數像素原語重現，不直接縮放正式 PNG。

## 生成、檢查與預覽

```bash
node tools/art/generate_gate1_interactables.mjs
node tools/art/check_gate1_interactables.mjs
npx vitest run tools/art/check_gate1_interactables.spec.ts
npm run dev
```

開啟 `http://127.0.0.1:5173/docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables/preview.html` 檢視候選。Generator 支援 `--out-dir <directory>` 供隔離檢查。Checker 會檢查固定 frame 集、來源與 generator digest、PNG CRC／RGBA／尺寸、frame digest、錨點、候選核准旗標及輸出再生一致性；失敗時不修補輸入檔。

## 界線

- 所有 manifest/frame 核准欄位必須保持 `status: candidate`、`approved: false`。
- 工具握點標記只是位置研究；不改 `content/tools.json` 的正式 96×96 尺寸與 grip，不改 CharacterRig 或揮動動畫。
- 門與船運箱狀態只呈現外觀，不連接地圖、碰撞、運輸、物品、存檔或遊戲規則。
- Checker 通過只表示資料契約與重現性成立，不代表美術品質、裝置可讀性、人工核准或 Gate 1 通過。

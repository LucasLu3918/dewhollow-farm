# DF-UX-01 手機 FOV、joystick 與 HUD 快捷流程

## 範圍與限制

- 依 PROT-01 與 MOVE-02 的既有呈現與移動介面，驗證直式 8–10 格、橫式 12–16 格 touch FOV，並在混合觸控裝置採用 touch framing。
- 讓 viewport／方向／焦點等輸入取消事件同步清空搖桿和展開中的「更多」快捷面板；放手後不再新增移動格。
- 驗證 HUD 顯示的工具、種子與現有 touch cycle 快捷操作同步，快捷切換不打開選擇面板。
- 不修改遊戲規則、存檔、地圖資料、碰撞、正式素材或 Gate 1 核准狀態。
- Chromium viewport/input 測試不等同 iOS／Android 實機驗收；實機項目維持 `DEVICE_PENDING`。

## 驗收（DF-UX-01 已於 PR #31 合併）

- [x] 混合指標裝置採 touch FOV；直式、短直式與矮橫式 camera FOV matrix 有 E2E 覆蓋。
- [x] 旋轉 viewport 會取消 held input 並收合「更多」；需新手勢才可繼續操作。
- [x] 工具與種子 shortcut 更新 HUD，不開啟 selector；既有農務流程與存檔回歸通過。
- [x] `npm run check`、完整 `npm run test:e2e`、Chromium 畫面檢視及 PR #31 CI 通過；完整 E2E 為 226 passed。
- [x] 變更已更新 Impact 證據並合併至 `main`；iOS／Android 實機驗收仍為 `DEVICE_PENDING`。

---

# DF-QA-01 Gate 1 證據稽核

## 範圍與結論

整理既有 renderer-profile、同場景 A/B 與 pixel32 MapScene QA runtime 證據，對照 Gate 1 驗收條件並修正過時狀態。此階段只整理證據，不改候選素材或核准狀態。詳見 [DF-QA-01 稽核矩陣](../docs/art/audit/df-qa-01.md)。

---

# DF-G1-RUNTIME-MATRIX pixel32 候選 runtime viewport／DPR 證據

為 DEV-only pixel32 farm `MapScene` 補上五種 viewport × Chromium DPR context 1／2／3 的 15 組 CSS 尺寸截圖與測量，供人眼檢視同一候選版本在不同 CSS 畫幅的呈現；不把這組輸出當作 DPR 專屬 raster 驗收。完整證據見 [候選 runtime viewport／DPR 報告](../docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-runtime-evidence.zh-TW.md)。

## 限制

- 截圖只包含現有 pixel32 地面與玩家四向動畫候選；其他角色與物件仍用舊素材。
- DPR 由 Chromium 模擬，PNG 以 CSS 尺寸輸出；不構成原生實機或實際像素輸出驗收。
- manifest 和圖集仍是 `candidate`／`approved: false`；未核准正式整合，Gate 1 仍未通過。
- 固定 12×10 完整場景、5 秒連續移動、碰撞／遮擋、作物／夥伴及實機證據仍待後續階段。

## 完成條件

- [x] 五種 viewport × Chromium DPR context 1／2／3 共 15 張截圖、量測及本次存檔 hash 已整理。
- [x] `npm run check`、完整 `npm run test:e2e`（227/227）通過，並目視抽查代表截圖。
- [ ] 更新 Impact Graph reconciliation、commit、PR；Required Checks 通過後依核准發佈流程合併。

## 任務與完成條件

- [x] 區分 45 張舊素材 viewport／DPR 矩陣與單一 1280×720 DPR1 pixel32 候選 runtime 截圖。
- [x] 記錄同一 MapScene 的方向動畫、農務、存檔與 production isolation 測試覆蓋。
- [x] 列明未覆蓋的 viewport／DPR、固定 12×10 場景、持續移動、碰撞／遮擋、完整素材與實機證據。
- [x] 更新 DF-UX-01 已合併的 CI 驗收紀錄及候選方向決策措辭。
- [ ] 跑專案檢查，commit、push、PR；Required Checks 通過後依 AIPS 發佈流程合併。
- [ ] 下一階段在素材人眼審查與 Gate 1 目標下補齊 pixel32 候選覆蓋；每個確切素材版本仍待使用者個別核准，實機項目維持 `DEVICE_PENDING`。

---

# Gate 1 整合候選預覽計畫

## 下一階段：MapScene pixel32 QA 候選 runtime

### 範圍

新增明確 DEV-only opt-in，讓同一個 Phaser `MapScene` 以 pixel32 地圖圖集繪製已覆蓋的草地、田地（含依鄰接方向選擇的 autotile 邊緣）、道路與水面，並以 pixel32 四向候選動畫繪製玩家。地圖狀態、存檔、碰撞、移動權威與遊戲規則仍沿用現行實作；沒有候選 frame 時回退正式素材。候選維持 `candidate`、`approved: false`，此工作不代表 Gate 1 通過或正式素材替換。

### 不在範圍

- 不修改 `content/assets.json`、`content/rigs.json`、`content/maps/`、正式 `public/`、domain、存檔、碰撞或正式角色骨架。
- 不改現有 legacy／pixel16／pixel32 viewport profile 與舊 8/16-bit候選路由；新 runtime 必須另有 DEV-only opt-in。
- 未覆蓋的建築、樹冠、土壤、NPC、夥伴、工具及農作物沿用現有素材。
- 不宣稱實機驗收、完整 Gate 1 或正式美術核准。

### 任務與驗收

1. [x] 驗證兩份候選 manifest 為 candidate／未核准後才註冊獨立 atlas；建立四季底圖與田地鄰接遮罩的純 mapping。
2. [x] 只在 DEV 且明確選擇新 QA 旗標時，把 pixel32 地圖與玩家四向動畫接入同一 `MapScene`；保留正式預設與舊候選行為。
3. [x] 新增單元與 E2E 覆蓋：實際 farm MapScene、同一地圖與移動／農務命令、四向動畫、缺省 fallback、以及 production 不請求候選圖集。
4. [x] 執行 `npm run check`、完整 `npm run test:e2e`，並檢視 QA runtime 截圖；更新 Impact Graph 證據、提交單一功能 commit、開 PR，required checks 通過後合併。

### 風險與限制

- pixel32 動畫是整張 sprite，不能套用既有 CharacterRig 切塊；QA profile 只替換玩家的可見 body，保留 rig root 作為移動與鏡頭錨點。工具動作視覺仍沿用既有 rig，因此 QA 候選不驗收揮工具動畫。
- autotile mask 僅描述四方向 grass/field 鄰接，不新增地圖或農務規則。
- 建築、樹、土壤、作物、NPC 及夥伴不在新圖集覆蓋範圍，沿用正式素材。

## 範圍

在既有候選目錄新增一頁整合預覽，讓玩家四向動畫候選與 pixel32 地圖候選在同一個可互動畫面中並列呈現。畫面提供四向／走路控制、季節切換、田地邊緣與樹冠遮擋展示；工具動作沿用現有純函式回饋。這是 QA 候選預覽，不是 Phaser 正式遊戲 runtime，也不代表 Gate 1 驗收。

## 不在範圍

- 不修改 `content/assets.json`、`content/rigs.json`、正式 `public/`、`CharacterRig`、`MapScene`、遊戲地圖／碰撞、存檔或 domain 規則。
- 兩份 manifest 與所有素材維持 `candidate`、`approved: false`。
- 不把這次方向核准解讀為任何確切美術素材核准。

## 任務

### 任務 1：整合候選畫面

- [x] 新增單頁同時載入動畫及地圖候選 manifest／atlas。
- [x] 可切換方向、走路、季節與樹冠前後層；提供候選未核准狀態和即時狀態文字。
- [x] 保持最近鄰像素、鍵盤可操作與手機響應式版面。

### 任務 2：驗收整合與隔離

- [x] E2E 驗證兩份候選載入、控制互動和 `approved: false`。
- [x] E2E 驗證正式遊戲入口不請求新增的整合預覽素材路徑。
- [x] 執行 `npm run check`、`npm run test:e2e` 與瀏覽器畫面檢視。

## 依賴與風險

- 依賴已完成的 DF-ART-02、DF-ANIM-01、DF-MAP-01 候選與既有動畫純函式。
- 主要風險是把展示用固定地圖誤認成正式地圖；頁面與測試須明確標示它只呈現候選樣式，不改遊戲資料或玩法。
- 預估範圍中型，預計新增一組預覽頁、E2E 測試與本計畫檔。

## 完成條件

所有候選只在獨立預覽路徑載入；檢查器、完整單元／建置與 E2E 通過；截圖經目視確認；以單一功能 commit 提交並走 PR。

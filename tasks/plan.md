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

# 手機優化執行任務表

規格入口：[MOBILE_PLAN.md](MOBILE_PLAN.md)。`AC-*` 對應主計劃的驗收表；每項狀態須附實際測試與 PR 證據。

## 執行進度

| ID | 狀態 | 結果／限制 |
| --- | --- | --- |
| MB-00 | AUTO_VERIFIED / DEVICE_PENDING | `npm run check` 通過（139 files、1472 passed／1 skipped；raw 2.280 MB）；`npm run test:e2e` 138 passed。無連接真機，S1～S8 的裝置 FPS、操作數與完成時間尚無實測。 |
| MB-01～MB-17 | TODO | 依任務相依及隔離邊界派發。 |

## 執行規則

1. 先讀任務來源、相依及主計劃相關契約，依 DAG 派工：互不重疊的變更邊界可並行，重疊邊界一次只留一位寫入者，依賴任務等前置任務合併後再啟動。每項工作使用獨立 worktree；不重設或一起提交其他工作樹的修改。
2. 規則改動先補失敗測試再實作；純重構先確認既有相關測試綠燈，小步改動。單元測試同目錄 `*.spec.ts`，E2E 在 `tests/e2e/`。
3. 每張任務包含實作、必要回歸、文件／內容與受影響 consumer 核對。完成後跑專案要求的 `npm run check`、`npm run test:e2e`；必要檢查阻擋需明說，不能把計劃中的測試寫成已執行。
4. 本機透過 shell 啟動 Playwright／Chrome，依全域 AGENTS 首次即走原生沙箱外核准；用獨立測試 profile，結束清理。不可使用真實存檔或使用者瀏覽器 profile 作自動化測試資料。
5. 任務狀態採 TODO → DOING → VERIFIED，受阻用 BLOCKED 並記原因；未取得真機的項目可記 AUTO_VERIFIED／DEVICE_PENDING，不能記 VERIFIED。條件不成立的選配任務記 DEFERRED 與證據。
6. 每張交付：改動路徑、行為、前後相容、測試命令與結果、風險、下一張 ID。本次使用者已明確授權逐項 commit、開 PR 並合併 `main`；部署仍需另行授權。遠端規則或必需檢查不可觀測時，保留候選並回報阻擋原因，不推測放行。

## 排程總表

| ID | 任務 | 相依 | 工程日估算 | 對應驗收 |
| --- | --- | --- | --- | --- |
| MB-00 | 現況保全、基準與量測規格 | 無 | 1～2 | AC-05/07/09/12/13 |
| MB-01 | 共用動作入口與輸入閘門 | MB-00 | 2～3 | AC-01/02/13 |
| MB-02 | 設定 v2 與保留式遷移 | MB-00 | 1～2 | AC-10 |
| MB-03 | Viewport／LayoutManager 與鏡頭 | MB-00 | 2～3 | AC-03/06/08 |
| MB-04 | 共用互動查詢與情境標籤 | MB-01 | 1～2 | AC-01/13 |
| MB-05 | 搖桿、多指與生命週期 | MB-01/02/03 | 2～3 | AC-01/02/06 |
| MB-06 | 工具／種子直接選取與輪盤 | MB-01/02/03 | 2～3 | AC-04/05/08/10 |
| MB-07 | 精簡 HUD 與響應式面板 | MB-03/04 | 2～3 | AC-03/06/13 |
| MB-08 | 無障礙與輸入整合 | MB-05/06/07 | 1～2 | AC-02/06/13 |
| MB-09 | R1 自動化、真機與文件收尾 | MB-08 | 1～2 | AC-01～06/08/10/11/13 |
| MB-10 | plots／world tiles 增量繪圖 | MB-09；可依 MB-00 嚴重掉幀證據提前 | 2～4 | AC-07/12/13 |
| MB-11 | animals／decor／HUD／panels 差分更新 | MB-10 | 2～3 | AC-07/12/13 |
| MB-12 | 可取消的長按連續農務 | MB-09 | 2～3 | AC-01/02/05/13 |
| MB-13 | R2 整合、長時間與真機驗收 | MB-11/12 | 2～3 | AC-01/02/05/07/12/13 |
| MB-14 | 明確模式的近距離拖曳農務 | MB-13 | 3～5 | AC-01/02/05/13 |
| MB-15 | 背景降載與可選省電 | MB-13 | 1～2 | AC-02/12/14 |
| MB-16 | 基於量測的載入與離線改善 | MB-13 | 2～4 | AC-09/10/11 |
| MB-17 | 完整候選驗收與回復演練 | MB-14/15/16 已完成或有延期決策 | 2～3 | AC-01～14 的適用項目 |

時間包含任務內測試；真機等待另外計。條件式工作可縮減，不可為湊工期硬做優化。

MB-00 若已完成工作樹核對、自動化與桌面可重現基準，但實機尚未取得，可將量測部分標 DEVICE_PENDING，先進行 MB-01～08 的獨立基礎工作；這不解除 MB-09／13 的實機發布門檻。未有 profiler 證據前不得提前做大型效能重構。

## R1：先讓高頻手機操作完整好用

### MB-00｜現況保全與可重現基準（AUTO_VERIFIED / DEVICE_PENDING）

- **來源**：`git status/diff`、`package.json`、`docs/DEVICE_PERF.md`、`frame-stats.ts`、`perf-overlay.ts`、`perf-overlay.spec.ts`、`touch.spec.ts`、`tools/build/check-dist.mjs`。
- **工作**：列出既有未提交檔案，確認效能覆蓋層與居民路徑修改的來源／完成狀態；不強迫 commit 或清理。確認目前 check/E2E 結果，再決定分支／隔離策略；若建立 worktree，要明確處理未提交基準，不假定會自動帶入。
- **工作**：沿用 S1～S5，補「指定工具→指定種子→播種」、旋轉、開關面板、雨天／高密度農地。定義 fixture 起點、操作與終態；記目前 tap、gesture 與耗時。
- **工作**：將效能採樣改成完整 30s 視窗可匯總，或在 profiler 匯出完整區間；延用五秒即時數字顯示，不混稱全段統計。背景 gap 不計樣本，但短暫卡頓不能濾除。
- **完成**：有現況通過／失敗清單與基準方法；至少可用裝置三次記錄待補時，標 DEVICE_PENDING，不能宣稱手機效能或輸入操作通過。後續工期與新門檻依實測重估。
- **驗證**：相關 frame-stats 測試、`npm run check`、`npm run test:e2e`、build bytes；不把桌機 FPS 當手機 PASS。
- **回復**：僅新增 opt-in 量測與文件；不更動玩家規則或遠端 telemetry。
- **本次結果**：統計單元測試 9 passed；全套 `npm run check`：139 個測試檔、1472 passed／1 skipped，typecheck/build/budget 全通過，raw 2.280 MB；全套 E2E 138 passed。無 iPhone／Android 裝置連線，S1～S8 真機數值與 tap／gesture／時間均未記錄。

### MB-01｜共用動作入口、閘門與鍵盤相容

- **來源**：`MapScene.ts` 的 `handleKey/pressTouch`、`touch-pad.ts`、`touch-controls.ts`、`domain/keybindings.ts`、`application/game-commands.ts`。
- **工作**：抽 action gateway 與 input gate，keyboard adapter 只查 bindings；touch 直接送語意 action。第一個小步保留原動作與 UI，不同時導入搖桿。
- **工作**：把面板、改鍵、釣魚／星釣、心形事件、動作／換圖保護抽成明確狀態；集中序列與停止機制。保留靜音／音樂的既有使用者手勢要求。
- **完成**：touch 不再 ActionId→key→ActionId；鍵盤自訂綁定仍有效；UI hotkey 不被寫成 GameState command；不同 adapter 共用執行保護。
- **驗證**：gate 狀態表單元、touch／accessibility／fishing／star-exchange／farm-loop E2E；每個阻擋狀態都檢查「沒有更動遊戲狀態」。
- **回復**：先保留 legacy adapter，相容路徑只選一條；禁止雙送 command。

### MB-02｜手機偏好與設定遷移

- **來源**：`domain/settings.ts/.spec.ts`、`application/settings.ts/.spec.ts`、`local-settings-store.ts/.spec.ts`、`apply-settings.ts`、`settings-panel.ts`。
- **工作**：實作版本 envelope、v1→v2 migration 與 mobile 欄位驗證；保留既有全部有效偏好；未知未來版本避免回寫毀損。
- **工作**：SettingsService 的 mobile patch 做欄位合併；提供慣用手、控制方式、按鈕比例與外置／overlay 設定。尚未實作的功能不要顯示可操作的空開關。
- **完成**：v1 改鍵／大字／色盲／關效果完整保留；mobile 任一欄位異常只重設該欄；localStorage 被拒仍可玩且提示未保存。
- **驗證**：先失敗的 migration／nested patch 測試、零資料／壞 JSON／舊版／未知版／儲存失敗 fixture，accessibility E2E。
- **回復**：測試相容 binary 可同時讀 v1/v2；不修改 IndexedDB 或 GameState v23。

### MB-03｜統一可視範圍、版面與鏡頭

- **來源**：`camera.ts/.spec.ts`、`layout.ts`、`MapScene.frameCamera`、`styles.css`、`index.html`、`camera.spec.ts`、`touch.spec.ts`。
- **工作**：建立 `presentation/responsive/` 中的 metrics 與 pure layout 計算，保留舊 layout.ts 座標功能；CSS tokens、camera world rect／safe rect 共用結果。
- **工作**：容器 resize、visual viewport、安全區、軟鍵盤、混合指標與手動控制模式；每幀合併排版變化、清理 observer。
- **完成**：連續旋轉十次不重建世界、不改遊戲狀態；兩種控制擺法與小地圖居中／大地圖邊界正確。
- **驗證**：pure rect 邊界測試、最小矩陣、旋轉＋面板／文字輸入 E2E、真機 browser chrome 與瀏海。
- **回復**：保留外置控制版型，layout 模式可切回；不把 viewport 寫入存檔。

### MB-04｜共用互動查詢

- **來源**：`application/game-commands.ts` 的 `interact/workPlot`、`application/residents.ts`、釣魚與裝飾規則、`content/controls.json`。
- **工作**：抽出無副作用的目標／動作解析，供描述與執行共用；標籤 key 與原創文字分離。
- **完成**：NPC、作物、空田、水邊、石頭、床、出貨、設備、裝飾、無目標的預覽與實際執行一致；門保留走入語意；狀態改變後重新驗證。
- **驗證**：逐類 query/execute parity、查詢前後 state／rng／時間完全不變；既有 interact 測試照常通過。
- **回復**：保留單一執行規則；descriptor 失效可隱藏提示，不能改走另一套推測規則。

### MB-05｜四方向搖桿與多指

- **來源**：MB-01 gateway、MB-02 settings、MB-03 metrics、`touch-controls.ts`、`motion.ts`、`MapScene.movePlayer`。
- **工作**：pointer state machine、capture、dead zone／軸遲滯與四方向量化、單一移動排程、浮動／固定／D-pad 與左右手。
- **完成**：長按移動速度與既有格子節奏一致；撞牆、進門、轉向不重複排隊；右指使用／放開不取消左指，blur／背景等停止後不補發。
- **驗證**：純手勢／時鐘測試；DOM 多 pointer 合成測試清楚標成合成；touch farm-loop；iPhone/Android 實際雙指與 OS 中斷。
- **回復**：設定可回 D-pad；失效指標清理不影響其他指標；不改碰撞、角色座標 schema 或斜向規則。

### MB-06｜直接選工具、種子與輪盤

- **來源**：`game-commands.ts` 的 takeTool/cycleSeed、工具／crop／inventory 型別、`content/tools.json`、`content/crops.json`、`content/controls.json`。
- **工作**：先新增直接選種子的 command 與驗證，確認 selectedSeed 使用 cropId 的既有契約；工具沿用 takeTool；選種子與播種工具原子切換。
- **工作**：先做點選選單，再加 long-press wheel、上次選取、穩定排序、分頁／邊緣避讓、無庫存與失效項目。所有方式共用相同模型。
- **完成**：任意可用項目兩次點擊內完成；長按取消不切換；空庫存、最後一顆種子、溫室與旋轉行為符合主計劃；選單顯示延遲符合 AC-08 定義。
- **驗證**：非法 ID／缺庫存 command 測試；hold 閾值前後、取消、外圍／中心、超過八項測試；快捷序列點擊量與終態驗收。
- **回復**：保留 cycle 快捷鍵，隱藏新 UI 仍能玩；不以多次 cycle 模擬直接選取。

### MB-07｜精簡 HUD 與共用面板外框

- **來源**：`hud.ts`、`panel-dialog.ts/.spec.ts`、各 `*-panel.ts`、`styles.css`、`index.html`、`content/controls.json`。
- **工作**：compact HUD 與情境主要按鈕；共用 responsive sheet 殼，依序搬商店、設定、任務／居民，再覆蓋其他面板。共用外框與逐面板搬遷可拆小差異。
- **完成**：面板內容最新、旋轉保持焦點 key／輸入／捲動；手機關閉／確認常可見；大字與長文字不壓縮觸控目標。
- **驗證**：focus restore/trap、疊放 modal、三種字級與直橫式；居民、商店、委託、技能、收藏、存檔、legacy 等所有入口 smoke。
- **回復**：共用 CSS presentation mode，可回 centered／外置；不重寫各面板的業務規則。

### MB-08｜無障礙與操作整合

- **來源**：`accessibility.ts/.spec.ts`、`apply-settings.ts`、`settings-panel.ts`、help／controls 內容、MB-05～07。
- **工作**：確認不用長按也可選工具／種子、鍵盤與焦點可達、左右手不交換語意、字級／色盲／減少動態、touch on/off 與 hybrid input。
- **完成**：新功能均有可理解標籤與錯誤原因；高頻訊息不洗 live region；旋轉後焦點不丟到隱藏元素。
- **驗證**：accessibility／help／touch E2E、鍵盤完整農務、核心 target 48px 與 major action 大按鈕、人工 VoiceOver 面板操作。
- **回復**：保留既有設定與手動操作；本任務不承諾整個 Canvas 遊戲已能由螢幕閱讀器獨立完成。

### MB-09｜R1 候選與文件同步

- **來源**：上述任務與全套回歸；`README.md`、`ROADMAP.md`、`TECH_PLAN.md`、`content/help.json`、`content/changelog.json`。
- **工作**：核對來源／消費端閉包，更新 touch 測試的舊外置假設與新增 overlay safe rect 測試；修正 README 存檔槽數與已落後技術計劃。
- **完成**：三槽／v23／v1 migration／離線／桌機全過，操作步驟降幅有等價基準；至少 iPhone 與中階 Android 真機完成主要流程與十次旋轉。
- **驗證**：`npm run check`、`npm run test:e2e`；AC-01～06、08、10、11、13；效能至少不低於基準與原 M7 目標，未達則列出剖析阻擋。
- **交付**：R1 可用版、實測表、未解限制與 R2 重估。部署另依明確授權。

## R2：以量測處理卡頓與重複操作

### MB-10｜田地與地圖增量繪圖

- **來源**：`MapScene.refresh/drawPlots/syncWorldTiles`、`heldPlots`、工具命中／收成動畫、MB-00 profiler。
- **工作**：先建立 command→view 影響表（move／tool／harvest／sleep／season／map／load），比較必要 state 片段與 stable keys；plot renderer 重用土壤／作物物件。
- **完成**：移動不銷毀重建全部 plots；單格澆水只更新相關格與必要 HUD；工具命中前後時序一致；全域失效能完整刷新。
- **驗證**：物件 create/destroy/update 計數、雨天／密集田 A/B profiler、像素／動畫／farm-loop 回歸。若量測成本無實益，保留可讀拆分並停止額外優化。
- **回復**：受控 full refresh fallback；不更動 CommandOutcome 事件 schema。

### MB-11｜動物、裝飾與 UI 差分

- **來源**：`syncAnimals/syncDecor/syncWearing/syncResidents`、現有 resident-route 修改、`hud.ts`、panel refresh。
- **工作**：依現有模型穩定鍵重用顯示物件；只有相關資料改變才更新 HUD／面板；關閉面板不重建內容，開啟時補最新。
- **完成**：換圖／添購動物／取回裝飾／穿脫／居民行程／跟隨動物仍同步；map 切換與 scene shutdown 清除 map cache、listener、tween 與 timer。
- **驗證**：牧場／decor／residents／companions／render-compat E2E、30 分鐘循環與物件計數回落。
- **回復**：逐 renderer 可回全量更新；不清掉使用者原先的居民路徑修正。

### MB-12｜可停止的長按連續農務

- **來源**：MB-01 gate、MB-04 query、MB-05 指標、MB-06 selection、既有農務 costs／動畫。
- **工作**：預設關閉的 continuousActions；一次一個原 command，等待命中／完成再接續；同格同動作 dedupe。
- **完成**：資源耗盡／無效格／放開／換圖／背景／面板／旋轉／換工具皆停止；不自動收成或觸發任何非農務互動；不提前扣隊列中的成本。
- **驗證**：先失敗的成本與中斷測試、動畫未完成時重複輸入、最後種子、體力不足、任務／成就／rng 結果等價；必要時跑 `npm run sim`。
- **回復**：設定關閉即回單次操作；隊列不入存檔。

### MB-13｜R2 整合與長時間真機

- **工作**：依 AC-07 採完整 active interval 三次統計；農場、村莊、屋內、雨天、工具連續使用與 30 分鐘循環，左右手與大字各做代表情境。
- **完成**：呈現成本改善有前後同 fixture 證據，無新洩漏／掉畫面；連續農務成本與手動等價，玩家可理解如何停止。
- **驗證**：完整 check/E2E、真機與 PWA；效能門檻的已採用／仍屬建議狀態分列。
- **交付**：可獨立停在 R2；效益不足的 renderer 優化附數據延後，不硬做通用事件匯流排。

## R3：條件式進階功能

### MB-14｜近距離拖曳農務

- **前提**：明確採用主計劃「只操作當下相鄰可觸及格」範圍；若要求整片自動尋路，先另做影響計劃，不擅自擴充。
- **工作**：明確進入／離開農務 brush 模式、screen→world→tile 的座標換算、路徑 dedupe、可用／不可用預覽與可取消 runner。
- **完成**：縮放／鏡頭／safe-area 下不點錯格，拖過不可達格不遠距執行；未執行項目中斷後不扣成本；不與 joystick 或面板捲動搶 pointer。
- **驗證**：邊界格、出界、相同格、多指、旋轉、門口、背景、資源耗盡；同成功 command 序列終態等價。
- **回復**：退出 brush 即回一般操作；需要玩家尋路的需求另建任務。

### MB-15｜背景降載與省電

- **工作**：檢查現有 Phaser visibility 行為，補自訂 timer／particles／audio 停止與恢復；有實益再增加 balanced／battery 偏好，不用 Battery API。
- **完成**：關畫質特效不改 simulation；省電建議 30 FPS 必須先確認釣魚／星釣以真實時間判定，無畫面幀率耦合。
- **驗證**：相同 seed／command 終態一致、reduced motion、音訊解鎖、背景回來不補發農務；量測同情境幀節奏與熱度，無電力工具不宣稱省幾％電。
- **回復**：回 balanced；若計時耦合無法安全解除，延期限幀功能但完成背景清理。

### MB-16｜載入與離線

- **前提**：MB-00／13 的 cold/warm 指標未達或有明確資產成長壓力；否則記 DEFERRED，保留原 cache 與載入流程。
- **來源**：BootScene、main imports、資產 manifest、Vite／`tools/pwa/`、`presentation/service-worker.ts`、PWA 測試與 build budget。
- **工作**：分析載入依賴，必要時 lazy panel／非首場資產；同步設計安裝完成與離線資料齊備，失敗可重試但不混版。
- **完成**：完整離線承諾不退步；更新等待保存玩家進度後才 reload；warm／cold／raw bytes／wire bytes 分開報。
- **驗證**：preview 正式 build 的首次安裝、斷網、跨圖、延後資產失敗、舊 worker 更新、三槽讀寫與配額錯誤。
- **回復**：維持上一版完整 cache，必要時回原 precache；不自動清掉存檔。

### MB-17｜最終整合、交接與回復演練

- **工作**：核對任務延期理由、完整適用 AC、歷史設定與存檔、桌機／平板／真機、觸控模式、離線更新、30 分鐘、原創素材／文字來源。
- **工作**：演練含 v2 設定相容的回復候選；同步 README／ROADMAP／TECH_PLAN／DEVICE_PERF／help／changelog，不宣稱未測機種已通過。
- **完成**：交付可重現的驗收摘要、具體未解風險、候選識別與回復步驟；LOCAL_COMPLETE 與可發布狀態分列。
- **驗證**：`npm run check`、`npm run test:e2e`，規則改動再跑 sim；真正 deployment 與 merge 依當下使用者授權。

## 接續使用範例

```text
請依 docs/MOBILE_PLAN.md 與 docs/MOBILE_TASKS.md 執行 MB-00。
先保留現有未提交修改，完成現況與量測基準；只做本任務必要異動。
實機資料無法取得時，完成可獨立進行的檢查並標 DEVICE_PENDING，不填推測數字。
交付實際檢查結果、異動清單及下一個可開始的任務。
```

R1 後可用相同格式指定下一張 ID；跨任務持續執行時，應由使用者明確授權批次範圍。不得因本文含任務清單就自行部署、修改系統規則或啟動多 agent。

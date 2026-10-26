# 美術素材進件與審核狀態

每個新素材依序記錄下列狀態。狀態屬於單一素材版本；一張已核准的寵物圖不代表同物種的其他方向、動畫幀或其他素材已核准。

| 狀態 | 含義 | 可否進 `public/`／`content/assets.json` |
| --- | --- | --- |
| `candidate` | 產生的候選或未完稿；來源、brief、預覽仍待檢查 | 否 |
| `reviewed` | 已檢查內容、透明度／接縫、尺寸、權利來源與遊戲內顯示；等待使用者明確核准 | 否 |
| `approved` | 使用者對這個特定候選版本明確核准；保留核准訊息或可追溯紀錄 | 尚未整合 |
| `integrated` | 已核准的確切版本完成最終化、登錄來源並整合；驗證通過 | 是 |

## 進件步驟

1. 建立 candidate，記錄素材 ID、brief、來源工具／授權和版本雜湊；原始候選與私人提示詞留在 `private/art-trials/`。
2. 產生縮放預覽或接觸表，依 brief 檢查主體、輪廓、色彩、尺寸、alpha／接縫、商標和遊戲中的可讀性。審核者只能把通過檢視的精確版本標為 reviewed。
3. 把 reviewed 候選與預覽交給使用者。只有針對該確切版本的明確同意，才能標為 approved；未回覆、沉默、其他素材的舊核准或 agent 自行判斷都不算同意。
4. 僅對 approved 版本執行最終化。要將輸出放入 `public/` 或登錄 `content/assets.json` 前，先使用 [`asset_review_gate.py`](../../tools/art/asset_review_gate.py) 提供人工核准 JSON、asset key、候選檔和新目的地；核准 SHA 必須精確相符。閘門拒絕未核准候選和任何既有目的地，並寫入 provenance。不得以複製檔案或直接編輯 manifest 繞過此步驟。
5. 檢查閘門輸出與 provenance，再新增 `content/assets.json` 的用途、檔案及真實來源，狀態改為 integrated。以載入／渲染驗證和適用的測試完成驗收。修圖或替換候選會產生新版本，須回到 candidate，不能沿用前一版核准。

## 人工核准紀錄

- `docs/art/style-sheet.png` 是由既有遊戲截圖與既有核准素材組合的風格參考。使用者於 2026-10-23 明確核准此確切版本作為專案像素美術 Golden Reference；SHA-256：`9cf2c3db8e3047b577386f873b58b4c17ff1379263329e44b5930a60bdbcc4ae`。圖內的「NOT APPROVED」字樣是核准前的樣張標籤，現由本紀錄的版本化簽核狀態取代；個別新素材仍須獨立審核。
- 使用者已核准恢復舊黑貓及採用第二張矮袋鼠候選作為修復基底；這項核准僅涵蓋寵物修復所指定的素材版本，不延伸到其他方向、幀、場景或資產。
- 使用者於 2026-10-23 核准確切整合圖 `public/assets/characters/marsupial-2x.png`，SHA-256：`614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7`。使用者於 2026-10-24 檢視村莊場景中 48×48 的袋貂，確認可辨認為矮袋鼠，且沒有小熊或小人的觀感；審核截圖為 `tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png`，SHA-256：`af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8`。此目視核准僅涵蓋該截圖、場景尺寸與上述確切素材版本，不延伸到其他方向、動畫幀或素材。
- 新資產核准應保留候選檔名／雜湊、審核預覽與使用者明確決定，方便追溯。

## VF-12｜繪本風背包物品圖示（2026-10-26）

使用者於 2026-10-26 逐一核准下列六個精確 PNG 候選與 SHA-256。六檔由 `tools/art/asset_review_gate.py` 逐檔核准並以原始位元組整合；每個正式 PNG 旁的 `.provenance.json` 記錄 asset key、候選檔名、核准日期與整合雜湊。來源為 Codex 內建 imagegen；模型名稱與授權條款無可查證資料，因此不推定模型或授權。六檔均為 1254×1254、RGBA、8-bit PNG，原候選未重繪、去背或重採樣。

| 狀態 | Inventory ID | 正式檔案 | 候選 SHA-256 | Alpha（透明／半透明／不透明像素） |
| --- | --- | --- | --- | ---: |
| `integrated` | `crop.sweet-radish` | `public/assets/items/sweet-turnip.png` | `1a490dd850b97cb5bcfb85568cad20ccca6e60dff7c81bbb0fffbc561aeeead4` | 915491 / 656813 / 212 |
| `integrated` | `seed.sweet-radish` | `public/assets/items/seed-bag.png` | `2ab355b18d6a9d3779b78087d1318e7e32acd018f0d436e13eacdc04b25e8884` | 716475 / 855441 / 600 |
| `integrated` | `wood` | `public/assets/items/wood.png` | `a9938778931d349da37b3e15d521f003d2a9de04b1c7d18e8360a5091de21517` | 673376 / 898949 / 191 |
| `integrated` | `copper-ore` | `public/assets/items/ore.png` | `d4df6f786b76863832ef711f9b917d867b57a7dc3ae9a5e8e5887ba8e7668a74` | 747277 / 824788 / 451 |
| `integrated` | `fish.carp` | `public/assets/items/fish.png` | `027fa69938e6a2aa456992641bbfbf6aa8bcf10bdc3a5cdb0927afcf5c6e216a` | 1016660 / 555647 / 209 |
| `integrated` | `dish.creek-stew` | `public/assets/items/stew.png` | `8b1d9c211b552049f8d1326b9a3b71f17f751532119abbcac87c9ce2b98df3c3` | 648499 / 923784 / 233 |

六個候選都以 64×64 暫存縮圖檢視，主體仍可辨識；正式檔維持原始尺寸。場景 B 圖仍只代表已選定的美術方向，沒有納入本次整合或 `content/assets.json`。

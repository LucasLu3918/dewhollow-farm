# Gate 1 同場景 MapScene 候選 A/B 證據

> **狀態：候選、未核准；Gate 1 未完成。** 本證據是 DEV-only 的部分貼圖替換，用來比較現有 farm MapScene 的可支援圖塊。不得將它視為完整素材、動畫、實機或風格簽核。

## 實際遊戲截圖

三張圖由隔離的 Chromium context 以相同 390×844 viewport、DPR 1、相同 farm 初始狀態擷取；截圖為 CSS 顯示尺寸，不放大原始圖。

| Profile | 實際候選 | 畫面 | SHA-256 |
|---|---|---|---|
| `legacy` | 正式素材 | [legacy-390x844.png](gate1-mapscene-ab/legacy-390x844.png) | `dc6390439b93980f9150240685c1eb43901918ab447524cc41bf2fba7ef01421` |
| `pixel16` | 8-bit 時代風格、16×16 atlas frame，4× 顯示 | [pixel16-390x844.png](gate1-mapscene-ab/pixel16-390x844.png) | `e9645e21ee267b6d4680aca277e48574e488be8ce05969d25f30aeaec2fb098c` |
| `pixel32` | 16-bit 時代風格、32×32 atlas frame，2× 顯示 | [pixel32-390x844.png](gate1-mapscene-ab/pixel32-390x844.png) | `188359312f8c22cf668f8c0c11b2ee9c84d050e0680e7cadf399eb56cc674b44` |

## 貼圖覆蓋與 fallback

候選仍使用既有原創 atlas 與 manifest；A/B profile 沿用同一份 farm session、地圖、角色座標、碰撞與操作規則。圖片只在 DEV query 指定 profile 時載入；production build 收到候選 query 仍使用 legacy，且不請求候選 atlas。

| 正式 key | 候選 frame | 顯示尺寸 | 限制 |
|---|---|---:|---|
| `tile.grass` | `grass` | 64×64 world units | 候選地面 |
| `tile.field` | `tilled` | 64×64 | 對應 field；不是已開墾的 `tile.soil` |
| `tile.path` | `road` | 64×64 | 候選道路 |
| `tile.tree` | `tree` | 64×64 | 單格樣張；沿用現有底邊深度排序 |
| `tile.wall` | `houseEdge` | 64×64 | 只覆蓋現有 wall key |
| `tile.fence` | `fence` | 64×64 | 候選柵欄樣張 |
| `crop.*` | `cropSeed`／`cropSprout`／`cropMature` | 依 16／32px 原生 frame 放大至 64px | 只表達成長階段，不保留 12 種作物各自的物種外觀 |

以下都走 legacy：`tile.soil`、`tile.water`、未列出的 tile/object/decor、玩家與 NPC rig、黑貓、矮袋鼠、工具和角色陰影。候選 atlas 目前的單張玩家姿勢、貓與 quokka 並未接入遊戲角色骨架，避免以靜態圖取代方向動畫或改變腳錨。

## 功能驗證

- `npm run check` 通過：154 個 spec files、1,581 項通過、1 項略過；production build 與 8 MB 初始載入預算通過，輸出 2.794 MB。
- `npm run test:e2e -- --workers=2` 完整通過 216/216（約 10 分鐘）；Chromium renderer canary 標記為預期失敗，符合既有保底機制驗收。
- `tests/e2e/gate1-mapscene-art-candidates.spec.ts` 專項通過 2/2：以隔離存檔建立幼苗、芽苗和成熟作物，確認三種候選畫面皆顯示對應階段及 64 world units 尺寸；三 profile 使用相同 farm 起點並各向右移動精確三格，起點、終點、地圖 ID、工具切換結果一致。
- E2E 檢查 legacy profile 沒有候選 atlas，A/B profile 註冊 15 個 manifest frame，候選 key 與 fallback key 符合範圍，且沒有 page error 或 console error。
- production preview 以 `?renderProfile=pixel16` 啟動時未發出任何 `/gate1-assets/` 請求。
- 專項 E2E 截圖、frame dimensions／候選 SHA 與完整 E2E 結果均已逐項核對。

## 視覺觀察與尚缺證據

三張實際畫面都保留相同 HUD、farm 起點、玩家位置和視角，並在田區顯示三個成長階段。legacy 草地細節密；8-bit 候選草地與地面圖樣較簡潔；16-bit 候選保留較多地面／房屋紋理。這組 viewport 顯示的地形以草地、田區、道路和房屋邊緣為主。截圖未顯示完整的 12×10 固定組合，也未能確認工具、quokka、柵欄／樹前後穿越和完整寵物跟隨。

仍待補齊：固定 12×10 場景所需全部素材與組合、四方向角色動畫、作物品種辨識、完整農務與遮擋影片、更多 viewport/DPR 下的候選遊戲畫面、100% 顯示尺寸人眼可讀性審查及真實 iOS/Android 裝置測試。故本次只交付可比較的局部候選畫面；**不代表 Gate 1、手機驗收或任何 art direction 已通過**。

素材來源與候選狀態見 [gate1-assets/README.zh-TW.md](gate1-assets/README.zh-TW.md)。候選 manifest 必須維持 `approved: false`；使用者看過 A/B 後仍需明確選擇下一步方向。

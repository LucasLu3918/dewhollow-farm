# P6-061 湖岸候選概念

狀態：`candidate`（尚未核准；不可放入 `public/`、`content/assets.json` 或遊戲執行流程）。

## Brief

為 Dewhollow 湖畔提出一張俯視角湖岸概念：草地與泥土岸線自然轉入清澈淺水，水下石頭、蘆葦及少量水生植物建立湖邊層次；一處小型釣點以低調漣漪與魚影提示。畫面只用作候選視覺方向，並非 tile atlas、sprite sheet 或已切格正式素材。

## 來源與版本

- 素材：[`lake-shore-concept.png`](lake-shore-concept.png)
- 產生來源：OpenAI 內建 imagegen；模型名稱與授權條款無可查證資料，不推定模型或授權。
- 尺寸／色彩：1254×1254，RGB PNG。
- SHA-256：`9169c9e0b2f4e2cec57d210b177573ebe2681de418cd418248e4897d2f4657cf`
- 審核狀態：candidate；尚未取得本張候選的人工核准。

## 初步檢視與限制

畫面包含草岸、土岸、淺水石底、蘆葦、水生植物、漣漪與魚影，構圖清楚。像素顆粒比目前 32px 地圖格更細，畫面也不是可無縫平鋪的單格素材；正式整合前仍需使用者核准確切候選版本，並另行設計／最終化可切片圖塊、接縫、遊戲尺寸可讀性與素材來源紀錄。

本候選不修改 `content/maps/lake.json`、map schema、碰撞、釣魚規則、存檔或任何 runtime consumer。上述範圍需另立核准與驗收。

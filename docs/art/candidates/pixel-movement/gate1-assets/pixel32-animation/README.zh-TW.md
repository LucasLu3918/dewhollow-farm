# Pixel32 四向動畫候選

> 狀態：candidate，`approved` 為 `false`。方向已選為 pixel32／16-bit；角色畫稿與動作仍待 Gate 1 人工檢視。

## 內容

- `player-4dir.png`：128×192 原生像素圖集。每列一個方向（下、上、左、右），每欄一格 32×48；包含站立、左右腳接地與 passing 幀。
- `manifest.json`：方向、影格座標、統一腳錨 `(16,47)`、clip 時序、生成器與圖格雜湊。
- `preview.html`：可切換四方向、站立／走路／工具動作與減少動態的隔離預覽。
- `generate_gate1_animation.mjs`：以整數像素圖元可重現產生候選圖與 manifest。

## 產生與檢查

在專案根目錄執行：

```bash
node tools/art/generate_gate1_animation.mjs
node tools/art/check_gate1_animation.mjs
```

`npm run check` 也會執行動畫候選檢查。圖集使用 nearest-neighbor 顯示，不能以平滑縮放修改原生像素。

## 動畫與工具回饋

`src/presentation/candidate-sprite-animator.ts` 以 55 ms 固定影格循環走路序列，左右朝向使用鏡像影格；工具預覽僅示範位置、旋轉與命中時序，減少動態時採用 0.4 倍幅度。這些只供候選預覽，不會接到 `CharacterRig` 或遊戲玩法。

## Gate 1 限制

此圖集以原創像素圖元製作，並非正式角色素材。checker 能驗證方向／影格完整性、矩形、腳錨、雜湊及生成器重現結果；無法判斷角色跨方向是否像同一個人、腳底是否視覺接地、動作是否自然或工具是否遮到角色。請在 [獨立預覽](./preview.html) 逐格檢視後再決定是否通過 Gate 1。不得登記到 `content/assets.json`、`content/rigs.json` 或正式 `public/`。

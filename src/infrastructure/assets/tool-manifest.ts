import type { ActionKind } from '../../domain/tuning';
import type { AssetEntry, AssetManifest } from './asset-manifest';

/**
 * 工具：玩家做農務動作時握在手上、揮動的東西。圖是正式素材（`kind: 'object'`），
 * 握把位置與揮動方式寫在這裡；新增工具（斧、鎬、釣竿）只要加資料與產圖，不改程式。
 */

/** 揮動的方式：砍（鋤頭）、倒（水壺）、撒（種子袋）。 */
export const SWING_KINDS = ['chop', 'pour', 'sow'] as const;
export type SwingKind = (typeof SWING_KINDS)[number];

export interface ToolDef {
  id: string;
  /** 哪個農務動作會拿出這個工具；一個動作只能有一個工具。 */
  action: ActionKind;
  asset: string;
  /** 圖片的原始大小（2x 母版像素），載入後會與實際貼圖核對。 */
  textureSize: { width: number; height: number };
  /** 握把在圖片上的位置（2x 母版像素）；揮動時工具繞這一點旋轉。圖畫的是朝右的樣子。 */
  grip: { x: number; y: number };
  swing: SwingKind;
}

export interface ToolManifest {
  version: 1;
  tools: ToolDef[];
}

/** 工具與素材清單的交叉檢查。 */
export function toolProblems(manifest: ToolManifest, assets: AssetManifest): string[] {
  const problems: string[] = [];
  const byId = new Map<string, AssetEntry>(assets.assets.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const byAction = new Map<ActionKind, string>();

  for (const tool of manifest.tools) {
    if (seen.has(tool.id)) problems.push(`工具 id 重複：${tool.id}`);
    seen.add(tool.id);

    const other = byAction.get(tool.action);
    if (other !== undefined) problems.push(`工具 ${tool.id} 與工具 ${other} 綁定了同一個動作 ${tool.action}`);
    else byAction.set(tool.action, tool.id);

    const asset = byId.get(tool.asset);
    if (!asset) {
      problems.push(`工具 ${tool.id} 的素材 ${tool.asset} 不存在`);
    } else {
      if (asset.kind !== 'object') problems.push(`工具 ${tool.id} 的素材 ${tool.asset} 必須是 object`);
      if (asset.file === undefined) problems.push(`工具 ${tool.id} 的素材 ${tool.asset} 沒有檔案，工具只能用正式素材`);
    }

    const { x, y } = tool.grip;
    const { width, height } = tool.textureSize;
    if (!(x >= 0 && x <= width && y >= 0 && y <= height)) {
      problems.push(`工具 ${tool.id} 的 grip (${x},${y}) 必須在圖片 ${width}×${height} 之內`);
    }
  }
  return problems;
}

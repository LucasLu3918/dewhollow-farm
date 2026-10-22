import { z } from 'zod';
import { ACTION_IDS, type ActionId } from '../../domain/keybindings';
import { INTERACTION_LABEL_KEYS, type InteractionLabelKey } from '../../application/interaction';
import { ContentError } from './load-content';

/**
 * 操作說明的文字（content/controls.json）：狀態列提示、設定面板的動作名稱、虛擬按鍵的文字。
 * 這裡只驗證文字：每個動作都要有（不多不少）、每段文字都不可是空白。
 * 排版與順序（哪些按鍵合併成一段、虛擬按鍵怎麼排）留在 presentation。
 */

/** 會出現在虛擬按鍵上的動作（排版與分組見 presentation/touch-pad.ts）。 */
export const TOUCH_ACTION_IDS = [
  'moveUp',
  'moveLeft',
  'moveRight',
  'moveDown',
  'interact',
  'cycleTool',
  'cycleSeed',
  'skills',
  'residents',
  'collection',
  'quests',
  'manualSave',
  'takeAxe',
  'takePick',
  'takeRod',
  'takeSickle',
  'placeDecor',
  'wear',
  'takeOff',
] as const satisfies readonly ActionId[];

export type TouchActionId = (typeof TOUCH_ACTION_IDS)[number];

export interface TouchButtonText {
  /** 按鈕上的短文字。 */
  label: string;
  /** 給螢幕閱讀器的完整名稱。 */
  name: string;
}

export interface HintTextContent {
  /** 移動鍵全是方向鍵時顯示的文字。 */
  arrowMovement: string;
  /** 提示列最後的說明。 */
  note: string;
}

export interface ControlsContent {
  /** 狀態列提示用的短標籤，每個 ActionId 一個。 */
  hintLabels: Readonly<Record<ActionId, string>>;
  hintText: HintTextContent;
  /** Original wording for interaction descriptor keys; behavior owns keys, content owns copy. */
  interactionLabels: Readonly<Record<InteractionLabelKey, string>>;
  /** 設定面板的動作名稱，每個 ActionId 一個。 */
  settingsLabels: Readonly<Record<ActionId, string>>;
  /** 虛擬按鍵的文字，每個虛擬按鍵動作一個。 */
  touchButtons: Readonly<Record<TouchActionId, TouchButtonText>>;
  /** 虛擬按鍵的「更多」鍵：展開次要動作（技能、居民、圖鑑、委託、存檔與工具）。 */
  touchMore: TouchButtonText;
}

const nonBlank = z.string().refine((text) => text.trim().length > 0, '不可是空白字串');

const controlsSchema = z.strictObject({
  hintLabels: z.record(z.string(), nonBlank),
  hintText: z.strictObject({ arrowMovement: nonBlank, note: nonBlank }),
  interactionLabels: z.record(z.string(), nonBlank),
  settingsLabels: z.record(z.string(), nonBlank),
  touchButtons: z.record(z.string(), z.strictObject({ label: nonBlank, name: nonBlank })),
  touchMore: z.strictObject({ label: nonBlank, name: nonBlank }),
});

/**
 * 讀入 content/controls.json 並驗證。缺少任一動作、多出不認得的動作、或有空白文字都會拋出 ContentError，
 * 一次列出所有問題。
 */
export function parseControlsContent(raw: unknown): ControlsContent {
  const parsed = controlsSchema.safeParse(raw);
  if (!parsed.success) throw new ContentError(parsed.error.issues.map(issueText));
  const data = parsed.data;
  const problems = [
    ...coverageProblems('狀態列提示的標籤', data.hintLabels, ACTION_IDS),
    ...coverageProblems('互動提示文字', data.interactionLabels, INTERACTION_LABEL_KEYS),
    ...coverageProblems('設定面板的動作名稱', data.settingsLabels, ACTION_IDS),
    ...coverageProblems('虛擬按鍵的文字', data.touchButtons, TOUCH_ACTION_IDS),
  ];
  if (problems.length > 0) throw new ContentError(problems);
  // 上面已確認每個 id 都在、沒有多出的 key，這裡的型別是可信的。
  return data as ControlsContent;
}

/** 檢查表格是否正好涵蓋 ids：缺的與多的都列出來。 */
function coverageProblems(label: string, table: Record<string, unknown>, ids: readonly string[]): string[] {
  const missing = ids.filter((id) => !Object.hasOwn(table, id)).map((id) => `${label}缺少動作 ${id}`);
  const extra = Object.keys(table)
    .filter((key) => !ids.includes(key))
    .map((key) => `${label}有不認得的動作 ${key}`);
  return [...missing, ...extra];
}

function issueText(issue: z.core.$ZodIssue): string {
  const where = issue.path.map(String).join('.') || '(根)';
  return `${where}：${issue.message}`;
}

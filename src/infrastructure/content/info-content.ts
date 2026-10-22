import { z } from 'zod';

/**
 * 說明頁與更新日誌的內容（M7）：content/changelog.json 與 content/help.json。
 * 讀進來時一律驗證格式，錯誤會指出哪個欄位有問題。
 */

const changelogSchema = z.array(
  z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, '版本號要是 x.y.z 的格式'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期要是 YYYY-MM-DD'),
    title: z.string().min(1),
    items: z.array(z.string().min(1)).min(1),
  }),
);

const keyEntrySchema = z.object({ keys: z.string().min(1), action: z.string().min(1) });

const helpSchema = z.object({
  controls: z.array(keyEntrySchema).min(1),
  /** 畫面下方虛擬按鍵的說明（觸控裝置）：按鈕上的文字與對應的功能，不寫鍵盤字母。 */
  touch: z.array(keyEntrySchema).min(1),
  privacy: z.object({
    title: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).min(1),
  }),
});

export type ChangelogEntry = z.infer<typeof changelogSchema>[number];
export type HelpKeyEntry = z.infer<typeof keyEntrySchema>;
export type HelpContent = z.infer<typeof helpSchema>;

/** 更新日誌：最新的版本在最前面（陣列順序即顯示順序）。 */
export function parseChangelog(raw: unknown): ChangelogEntry[] {
  const parsed = changelogSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`更新日誌格式錯誤：${describe(parsed.error)}`);
  return parsed.data;
}

export function parseHelpContent(raw: unknown): HelpContent {
  const parsed = helpSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`說明內容格式錯誤：${describe(parsed.error)}`);
  return parsed.data;
}

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return '未知';
  return `${issue.path.map(String).join('.') || '(根)'}：${issue.message}`;
}

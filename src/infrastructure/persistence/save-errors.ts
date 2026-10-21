export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

/** 把 zod 的第一個問題整理成「於哪個欄位：原因」，方便玩家與開發者定位。 */
export function describeIssue(issue: { path: PropertyKey[]; message: string } | undefined): string {
  if (!issue) return '(未知)：未知';
  return `${issue.path.map(String).join('.') || '(根)'}：${issue.message}`;
}

/** Tokens distilled from the user-approved B direction: dark forest frame, warm paper and carved wood. */
export const GAME_UI_TOKENS = {
  frameEdge: '#59402c',
  frameLine: '#98784b',
  paper: '#ede0ae',
  paperRaised: '#d5ba7d',
  ink: '#252a23',
  mutedInk: '#52624a',
  leafAccent: '#73aa68',
  selection: '#f4c95c',
  forest: '#29372c',
  forestShadow: '#17281f',
  spaceSmall: '0.5rem',
  spaceMedium: '0.75rem',
  spaceLarge: '1rem',
  frameRadius: '0.25rem',
  panelMaxWidth: '56rem',
} as const;

const CSS_TOKEN_NAMES: Readonly<Record<keyof typeof GAME_UI_TOKENS, string>> = {
  frameEdge: '--ui-frame-edge',
  frameLine: '--ui-frame-line',
  paper: '--ui-paper',
  paperRaised: '--ui-paper-raised',
  ink: '--ui-ink',
  mutedInk: '--ui-muted-ink',
  leafAccent: '--ui-leaf-accent',
  selection: '--ui-selection',
  forest: '--ui-forest',
  forestShadow: '--ui-forest-shadow',
  spaceSmall: '--ui-space-sm',
  spaceMedium: '--ui-space-md',
  spaceLarge: '--ui-space-lg',
  frameRadius: '--ui-frame-radius',
  panelMaxWidth: '--ui-panel-max-width',
};

/** Apply the shared palette to one UI subtree without relying on global styles being installed first. */
export function applyGameUiTokens(target: Pick<HTMLElement, 'style'>): void {
  for (const key of Object.keys(CSS_TOKEN_NAMES) as Array<keyof typeof GAME_UI_TOKENS>) {
    target.style.setProperty(CSS_TOKEN_NAMES[key], GAME_UI_TOKENS[key]);
  }
}

import { describe, expect, it } from 'vitest';
import { GAME_UI_TOKENS, applyGameUiTokens } from './game-ui-tokens';

describe('game UI tokens', () => {
  it('keeps the approved B-direction paper, wood and forest palette', () => {
    expect(GAME_UI_TOKENS).toEqual({
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
    });
  });

  it('applies token names as CSS custom properties to the chosen root', () => {
    const properties = new Map<string, string>();
    applyGameUiTokens({ style: { setProperty: (name: string, value: string) => properties.set(name, value) } } as never);

    expect(properties.get('--ui-frame-edge')).toBe(GAME_UI_TOKENS.frameEdge);
    expect(properties.get('--ui-paper')).toBe(GAME_UI_TOKENS.paper);
    expect(properties.get('--ui-forest')).toBe(GAME_UI_TOKENS.forest);
    expect(properties.get('--ui-space-md')).toBe(GAME_UI_TOKENS.spaceMedium);
    expect(properties.size).toBe(Object.keys(GAME_UI_TOKENS).length);
  });
});

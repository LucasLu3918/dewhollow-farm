import { describe, expect, it } from 'vitest';
import { renderProfileFor } from './profiles';

describe('renderProfileFor', () => {
  it('keeps experimental profiles disabled unless QA access is explicitly enabled', () => {
    expect(renderProfileFor('pixel32').id).toBe('legacy');
    expect(renderProfileFor('pixel16').id).toBe('legacy');
    expect(renderProfileFor('pixel32', true).id).toBe('pixel32');
    expect(renderProfileFor('pixel16', true).id).toBe('pixel16');
  });
});

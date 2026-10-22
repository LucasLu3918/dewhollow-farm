import { describe, expect, it } from 'vitest';
import { pageOf } from './tool-seed-selector';

describe('tool and seed selector wheel paging', () => {
  it('shows at most eight choices and wraps through additional seed pages', () => {
    const crops = Array.from({ length: 12 }, (_, index) => `crop-${index}`);
    expect(pageOf(crops, 0).items).toEqual(crops.slice(0, 8));
    expect(pageOf(crops, 1).items).toEqual(crops.slice(8));
    expect(pageOf(crops, 2).pageIndex).toBe(0);
    expect(pageOf(crops, -1).pageIndex).toBe(1);
  });
});

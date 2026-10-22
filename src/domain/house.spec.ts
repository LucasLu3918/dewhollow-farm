import { describe, expect, it } from 'vitest';
import { expansionRefusal, houseMapIdFor, resolveDestination } from './house';

describe('which house the player walks into', () => {
  it('an unexpanded house is the base map', () => {
    expect(houseMapIdFor({})).toBe('house');
  });

  it('the first expansion (the east room) gives the wing layout', () => {
    expect(houseMapIdFor({ 'house-wing': true })).toBe('house-wing');
  });

  it('the second expansion (kitchen and workbench) gives the full layout', () => {
    expect(houseMapIdFor({ 'house-wing': true, 'house-full': true })).toBe('house-full');
  });

  it('a door that leads to the house goes to whichever layout is built now', () => {
    expect(resolveDestination('house', {})).toBe('house');
    expect(resolveDestination('house', { 'house-wing': true })).toBe('house-wing');
    expect(resolveDestination('house', { 'house-wing': true, 'house-full': true })).toBe('house-full');
  });

  it('other destinations are unchanged', () => {
    expect(resolveDestination('farm', { 'house-wing': true })).toBe('farm');
    expect(resolveDestination('mine-1', {})).toBe('mine-1');
  });
});

describe('buying an expansion', () => {
  it('the first expansion can be bought when the house is not expanded yet', () => {
    expect(expansionRefusal({}, 'house-wing')).toBeNull();
  });

  it('the second expansion needs the first one', () => {
    expect(expansionRefusal({}, 'house-full')).toBe('NEED_HOUSE_WING');
    expect(expansionRefusal({ 'house-wing': true }, 'house-full')).toBeNull();
  });

  it('each expansion is bought only once', () => {
    expect(expansionRefusal({ 'house-wing': true }, 'house-wing')).toBe('ALREADY_OWNED');
    expect(expansionRefusal({ 'house-wing': true, 'house-full': true }, 'house-full')).toBe('ALREADY_OWNED');
  });
});

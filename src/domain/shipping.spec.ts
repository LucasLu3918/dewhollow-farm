import { describe, expect, it } from 'vitest';
import { createShipBox, settleShipBox, shipStack } from './shipping';

const price = (itemId: string, quality: string) => (itemId === 'crop.moon-bean' ? 80 : 45) * (quality === 'fine' ? 2 : 1);

describe('shipping box', () => {
  it('accepts a stack and keeps its item and quality', () => {
    const box = shipStack(createShipBox(), { itemId: 'crop.sweet-radish', quality: 'normal', count: 2 });
    expect(box.entries).toEqual([{ itemId: 'crop.sweet-radish', quality: 'normal', count: 2 }]);
  });

  it('merges stacks of the same item and quality, keeps other qualities apart', () => {
    let box = createShipBox();
    box = shipStack(box, { itemId: 'crop.sweet-radish', quality: 'normal', count: 2 });
    box = shipStack(box, { itemId: 'crop.sweet-radish', quality: 'normal', count: 3 });
    box = shipStack(box, { itemId: 'crop.sweet-radish', quality: 'fine', count: 1 });
    expect(box.entries).toEqual([
      { itemId: 'crop.sweet-radish', quality: 'normal', count: 5 },
      { itemId: 'crop.sweet-radish', quality: 'fine', count: 1 },
    ]);
  });

  it('settles the box into gold and empties it', () => {
    let box = shipStack(createShipBox(), { itemId: 'crop.sweet-radish', quality: 'normal', count: 2 });
    box = shipStack(box, { itemId: 'crop.moon-bean', quality: 'normal', count: 1 });
    box = shipStack(box, { itemId: 'crop.sweet-radish', quality: 'fine', count: 1 });
    expect(settleShipBox(box, price)).toEqual({ gold: 2 * 45 + 80 + 90, box: { entries: [] } });
  });

  it('settles an empty box to zero gold', () => {
    expect(settleShipBox(createShipBox(), price)).toEqual({ gold: 0, box: { entries: [] } });
  });
});

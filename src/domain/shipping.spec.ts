import { describe, expect, it } from 'vitest';
import { createShipBox, settleShipBox, shipCrop } from './shipping';

const price = (id: string) => (id === 'moon-bean' ? 80 : 45);

describe('shipping box', () => {
  it('accepts a crop and counts it', () => {
    const box = shipCrop(createShipBox(), 'sweet-radish', 2);
    expect(box.items).toEqual({ 'sweet-radish': 2 });
  });

  it('settles the box into gold and empties it', () => {
    const box = shipCrop(shipCrop(createShipBox(), 'sweet-radish', 2), 'moon-bean', 1);
    expect(settleShipBox(box, price)).toEqual({ gold: 2 * 45 + 80, box: { items: {} } });
  });

  it('settles an empty box to zero gold', () => {
    expect(settleShipBox(createShipBox(), price)).toEqual({ gold: 0, box: { items: {} } });
  });
});

import { describe, expect, it } from 'vitest';
import { closeIncomeYear, receiveGold } from './income';

describe('收入的記錄（本年收入 yearlyIncome）', () => {
  it('收到的金幣同時加進金幣與本年收入', () => {
    const next = receiveGold({ gold: 100, yearlyIncome: 50, previousYearIncome: 0 }, 30);
    expect(next).toEqual({ gold: 130, yearlyIncome: 80, previousYearIncome: 0 });
  });

  it('收到 0 金不改變任何東西（回傳同一個物件）', () => {
    const state = { gold: 100, yearlyIncome: 50, previousYearIncome: 0 };
    expect(receiveGold(state, 0)).toBe(state);
  });

  it('金額必須是非負整數', () => {
    const state = { gold: 100, yearlyIncome: 50, previousYearIncome: 0 };
    expect(() => receiveGold(state, -1)).toThrow(RangeError);
    expect(() => receiveGold(state, 1.5)).toThrow(RangeError);
  });

  it('換年時本年收入移到上一年、本年歸零，金幣不動', () => {
    expect(closeIncomeYear({ gold: 500, yearlyIncome: 1200, previousYearIncome: 300 })).toEqual({
      gold: 500,
      yearlyIncome: 0,
      previousYearIncome: 1200,
    });
  });
});

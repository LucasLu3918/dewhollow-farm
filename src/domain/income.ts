/**
 * 收入的記錄（M6）：所有「金幣流入」都經過 receiveGold，本年收入與金幣一起加；花費不算收入。
 * 換年時（睡醒跨年）用 closeIncomeYear 把本年收入移到上一年，供農場評級與豐收重置參考。
 * 這裡只做純計算；哪些金幣算收入由應用層決定（出貨、委託、主線、節慶、修復、圖鑑、成就）。
 */

export interface IncomeState {
  gold: number;
  /** 本年（目前這一年）賺到的金幣總和，不含花費。 */
  yearlyIncome: number;
  /** 上一年的收入總和（換年時保存；第 1 年還沒有上一年，為 0）。 */
  previousYearIncome: number;
}

/** 收到 amount 金：金幣與本年收入同時增加。0 金回傳原來的物件。金額必須是非負整數。 */
export function receiveGold<T extends IncomeState>(state: T, amount: number): T {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`收入的金額必須是非負整數：${amount}`);
  if (amount === 0) return state;
  return { ...state, gold: state.gold + amount, yearlyIncome: state.yearlyIncome + amount };
}

/** 換年：本年收入移到上一年，本年歸零（金幣不變）。 */
export function closeIncomeYear<T extends IncomeState>(state: T): T {
  return { ...state, previousYearIncome: state.yearlyIncome, yearlyIncome: 0 };
}

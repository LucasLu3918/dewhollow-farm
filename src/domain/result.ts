/** 規則層的結果型別：失敗時回傳原因代碼，不拋例外，由應用層轉成畫面文字。 */
export type Ok<T> = { ok: true; value: T };
export type Fail<R extends string = string> = { ok: false; reason: R };
export type Result<T, R extends string = string> = Ok<T> | Fail<R>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const fail = <R extends string>(reason: R): Fail<R> => ({ ok: false, reason });

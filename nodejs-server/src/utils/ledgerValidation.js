// 매출/매입 장부·계정과목 입력 검사 — 정해진 값은 3-3 constraints 기준, 칸 길이는 migrations/2026-11-06-work-ledger.sql 기준
const { str, date, isMoney, isId, isNil, MAX_AMOUNT } = require('./contractValidation');

const SIDES = ['sales', 'purchase'];
const fail = error => ({ ok: false, error });

const validateLedger = input => {
    const b = input || {};
    if (!SIDES.includes(b.side)) return fail('Invalid side');
    const entryDate = date(b.entryDate);
    if (!entryDate) return fail('Invalid entryDate'); // 필수 — 비거나 틀리면 오류
    if (!isId(b.accountId)) return fail('Invalid accountId');
    const title = str(b.title, 200);
    if (!title) return fail('Invalid title');
    const memo = str(b.memo, 5000, { trim: false });
    if (memo === null) return fail('Invalid memo');
    const supply = isNil(b.supply) ? 0 : b.supply;
    const tax = isNil(b.tax) ? 0 : b.tax;
    // 합계도 범위 안이어야 함(서버가 다시 계산해 저장)
    if (!isMoney(supply) || !isMoney(tax) || Math.abs(supply + tax) > MAX_AMOUNT) return fail('Invalid amount');
    const value = { side: b.side, entryDate, accountId: b.accountId, title, memo, supply, tax, total: supply + tax };
    if (b.updatedAt !== undefined) {
        if (typeof b.updatedAt !== 'string') return fail('Invalid updatedAt');
        value.updatedAt = b.updatedAt;
    }
    return { ok: true, value };
};

const validateAccount = input => {
    const b = input || {};
    if (!SIDES.includes(b.side)) return fail('Invalid side');
    if (typeof b.code !== 'string' || !/^[A-Za-z0-9]{1,10}$/.test(b.code)) return fail('Invalid code');
    const label = str(b.label, 50);
    if (label === null) return fail('Invalid label');
    const name = str(b.name, 100);
    if (!name) return fail('Invalid name');
    return { ok: true, value: { side: b.side, code: b.code, label, name } };
};

module.exports = { validateLedger, validateAccount, SIDES };

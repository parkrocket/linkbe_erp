// 매출/매입 장부·계정과목 검사·모델 점검: node scripts/checkLedgerModel.js  (pool·연결 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');
const { validateLedger, validateAccount } = require('../src/utils/ledgerValidation');

const calls = [];
const events = [];
let handlers = [];
let failOn = null; // { re, code } — 이 정규식에 맞는 SQL이면 오류
const answer = (sql, params, tx) => {
    calls.push({ sql, params, tx });
    if (failOn && failOn.re.test(sql)) throw Object.assign(new Error('fake failure'), failOn.code ? { code: failOn.code } : {});
    const h = handlers.find(([re]) => re.test(sql));
    if (h) return typeof h[1] === 'function' ? h[1](params) : h[1];
    return sql.includes('COUNT(*) AS n FROM wk_ledger') ? [[{ n: 0 }]] : [[]];
};
pool.query = async (sql, params) => answer(sql, params, false);
pool.getConnection = async () => ({
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql, params) => answer(sql, params, true),
});
const reset = (h = []) => ((calls.length = 0), (events.length = 0), (handlers = h), (failOn = null));
const last = () => calls[calls.length - 1];
const { Ledger, Account } = require('../src/models/ledgerModel');

const L = (patch = {}) => ({ side: 'purchase', entryDate: '2026-12-31', accountId: 3, title: ' 서버비 ', memo: '', supply: -15, tax: -1, ...patch });
const err = (fn, input, msg) => assert.deepStrictEqual(fn(input), { ok: false, error: msg }, msg);
const lv = (patch = {}) => ({ side: 'purchase', entryDate: '2026-12-31', accountId: 3, title: '서버비', memo: '', supply: -15, tax: -1, total: -16, updatedAt: '2026-11-06 10:00:00', ...patch });

(async () => {
    // ---- validateLedger ----
    assert.deepStrictEqual(validateLedger(L()), { ok: true, value: { side: 'purchase', entryDate: '2026-12-31', accountId: 3, title: '서버비', memo: '', supply: -15, tax: -1, total: -16 } });
    assert.strictEqual(validateLedger(L({ updatedAt: 'x' })).value.updatedAt, 'x');
    err(validateLedger, L({ side: 'x' }), 'Invalid side');
    err(validateLedger, L({ entryDate: '2026-02-30' }), 'Invalid entryDate');
    err(validateLedger, L({ accountId: '3' }), 'Invalid accountId');
    err(validateLedger, L({ accountId: 0 }), 'Invalid accountId');
    err(validateLedger, L({ title: '  ' }), 'Invalid title');
    err(validateLedger, L({ title: 'a'.repeat(201) }), 'Invalid title');
    err(validateLedger, L({ memo: 'a'.repeat(5001) }), 'Invalid memo');
    err(validateLedger, L({ supply: 1.5 }), 'Invalid amount');
    err(validateLedger, L({ supply: 2000000001 }), 'Invalid amount');
    err(validateLedger, L({ supply: 2000000000, tax: 1 }), 'Invalid amount');
    assert.ok(validateLedger(L({ supply: 2000000000, tax: 0 })).ok);

    // ---- validateAccount ----
    assert.deepStrictEqual(validateAccount({ side: 'purchase', code: 'p101', label: '', name: '서버' }), { ok: true, value: { side: 'purchase', code: 'p101', label: '', name: '서버' } });
    err(validateAccount, { side: 'purchase', code: 'p-1', name: 'a' }, 'Invalid code');
    err(validateAccount, { side: 'purchase', code: 'a'.repeat(11), name: 'a' }, 'Invalid code');
    err(validateAccount, { side: 'purchase', code: 'p1', name: ' ' }, 'Invalid name');
    err(validateAccount, { side: 'x', code: 'p1', name: 'a' }, 'Invalid side');

    // ---- Ledger.list ----
    reset([[/COUNT\(\*\)/, [[{ n: '4' }]]], [/FROM wk_ledger/, [[{ id: 1 }]]]]);
    assert.deepStrictEqual(await Ledger.list(1, { year: 2026, month: 12 }), { rows: [{ id: 1 }], total: 4 });
    let { sql, params } = calls[0];
    assert.ok(sql.includes('cp_id = ?') && sql.includes('entry_date >= ? AND entry_date < ?') && sql.includes("DATE_FORMAT(entry_date, '%Y-%m-%d')"));
    assert.ok(sql.includes('ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?'));
    assert.deepStrictEqual(params, [1, '2026-12-01', '2027-01-01', 50, 0], '12월은 다음 해 1월 1일 미만');
    assert.ok(calls[1].sql.includes('cp_id = ?') && !calls[1].sql.includes('LIMIT'));
    reset();
    await Ledger.list(1, { year: 2026, month: 1 });
    assert.deepStrictEqual(calls[0].params.slice(1, 3), ['2026-01-01', '2026-02-01']);
    reset();
    await Ledger.list(1, { year: 2026 });
    assert.deepStrictEqual(calls[0].params.slice(1, 3), ['2026-01-01', '2027-01-01'], '월 없으면 그 해 전체');
    reset();
    await Ledger.list(2, { year: 2026, month: 5, side: 'sales', accountId: 7, q: '50%_', page: 3, size: 20 });
    ({ sql, params } = calls[0]);
    assert.ok(sql.includes('side = ?') && sql.includes('account_id = ?') && sql.includes('title LIKE ?') && sql.includes('memo LIKE ?'));
    assert.deepStrictEqual(params, [2, '2026-05-01', '2026-06-01', 'sales', 7, '%50\\%\\_%', '%50\\%\\_%', 20, 40]);
    assert.deepStrictEqual(calls[1].params, [2, '2026-05-01', '2026-06-01', 'sales', 7, '%50\\%\\_%', '%50\\%\\_%']);

    // ---- Ledger.summary ----
    reset([[/GROUP BY/, [[{ side: 'sales', account_id: 1, total: '3000', n: 2 }, { side: 'purchase', account_id: 5, total: '1000', n: 1 }]]]]);
    assert.deepStrictEqual(await Ledger.summary(1, { year: 2026, month: 12, side: 'sales', accountId: 1 }), {
        sales: 3000, purchase: 1000, diff: 2000, byAccount: [{ accountId: 1, total: 3000, count: 2 }, { accountId: 5, total: 1000, count: 1 }],
    });
    assert.ok(last().sql.includes('cp_id = ?') && last().sql.includes('entry_date >= ? AND entry_date < ?') && !last().sql.includes('LIKE'));
    assert.deepStrictEqual(last().params, [1, '2026-12-01', '2027-01-01', 'sales', 1]);
    reset([[/GROUP BY/, [[]]]]);
    assert.deepStrictEqual(await Ledger.summary(1, { year: 2026 }), { sales: 0, purchase: 0, diff: 0, byAccount: [] });

    // ---- Ledger.findById ----
    reset();
    assert.strictEqual(await Ledger.findById(1, 9), undefined);
    assert.ok(last().sql.includes('cp_id = ? AND id = ?') && last().sql.includes("DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at") && last().sql.includes("CONVERT_TZ(created_at, @@session.time_zone, '+09:00')"));
    assert.deepStrictEqual(last().params, [1, 9]);

    // ---- Ledger.create ----
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^INSERT INTO wk_ledger/, [{ insertId: 42 }]]]);
    assert.strictEqual(await Ledger.create(1, lv(), 7), 42);
    const chk = calls[0];
    assert.ok(chk.sql.includes('a.cp_id = ?') && chk.sql.includes('a.side = ?') && chk.sql.includes('NOT EXISTS'), '항목(묶음 아님)·같은 회사·같은 구분');
    assert.deepStrictEqual(chk.params.slice(0, 3), [1, 3, 'purchase']);
    assert.deepStrictEqual(last().params, [1, 'purchase', '2026-12-31', 3, '서버비', '', -15, -1, -16, 7]);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset(); // 계정이 항목 아님/다른 회사·구분 → null
    assert.strictEqual(await Ledger.create(1, lv(), 7), null);
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // ---- Ledger.update ----
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^UPDATE wk_ledger/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Ledger.update(1, 9, lv()), 'ok');
    assert.ok(last().sql.includes("cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') = ?") && last().sql.includes('updated_at = NOW()'));
    assert.deepStrictEqual(last().params.slice(-3), [1, 9, '2026-11-06 10:00:00']);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^UPDATE wk_ledger/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_ledger/, [[{ id: 9 }]]]]);
    assert.strictEqual(await Ledger.update(1, 9, lv()), 'changed');
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^UPDATE wk_ledger/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await Ledger.update(1, 9, lv()), 'missing');
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^UPDATE wk_ledger/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_ledger/, [[{ id: 9 }]]]]);
    assert.strictEqual(await Ledger.update(1, 9, lv({ updatedAt: undefined })), 'changed');
    reset();
    assert.strictEqual(await Ledger.update(1, 9, lv()), 'invalid');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));

    // ---- Ledger.remove ----
    reset([[/^DELETE FROM wk_ledger/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Ledger.remove(1, 9), true);
    assert.deepStrictEqual(last().params, [1, 9]);
    assert.ok(last().sql.includes('cp_id = ?'));
    reset([[/^DELETE FROM wk_ledger/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await Ledger.remove(2, 9), false);

    // ---- Account.list ----
    reset([[/FROM wk_account a/, [[{ id: 1, side: 'purchase', code: 'p1', label: '', name: '묶음', sort: 0, used: '0', is_group: 1 }, { id: 2, side: 'purchase', code: 'p101', label: '', name: '서버', sort: 1, used: '3', is_group: 0 }]]]]);
    assert.deepStrictEqual(await Account.list(1), [
        { id: 1, side: 'purchase', code: 'p1', label: '', name: '묶음', sort: 0, used: 0, isGroup: true },
        { id: 2, side: 'purchase', code: 'p101', label: '', name: '서버', sort: 1, used: 3, isGroup: false },
    ]);
    assert.ok(last().sql.includes('a.cp_id = ?') && last().sql.includes('l.cp_id = a.cp_id') && last().sql.includes('ORDER BY a.side, a.code') && last().sql.includes("CONCAT(a.code, '%')"));
    assert.deepStrictEqual(last().params, [1]);

    // ---- Account.create ----
    const av = (patch = {}) => ({ side: 'purchase', code: 'p101', label: '', name: '서버', ...patch });
    reset([[/AS next/, [[{ next: 4 }]]], [/^INSERT INTO wk_account/, [{ insertId: 8 }]]]);
    assert.strictEqual(await Account.create(1, av()), 8);
    assert.deepStrictEqual(last().params, [1, 'purchase', 'p101', '', '서버', 4]);
    const guard = calls.find(c => c.sql.includes('FROM wk_account a') && c.sql.includes('l.cp_id = a.cp_id'));
    assert.ok(guard && guard.sql.includes('a.cp_id = ?'), '장부 붙은 계정 앞부분 검사');
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset([[/code = \? AND id <> \?/, [[{ id: 1 }]]]]); // 같은 코드 있음
    assert.strictEqual(await Account.create(1, av()), 'duplicate');
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));
    reset([[/AS next/, [[{ next: 1 }]]]]);
    failOn = { re: /^INSERT INTO wk_account/, code: 'ER_DUP_ENTRY' };
    assert.strictEqual(await Account.create(1, av()), 'duplicate', '동시 등록 충돌도 duplicate');
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    // 묶음 판정(가짜 DB가 SQL 의미를 흉내: 파라미터 [cp, side, id, code, selfHasLedger, like]) — 장부 붙은 p101이 있을 때
    const accts = [{ id: 1, code: 'p1' }, { id: 2, code: 'p101', ledger: true }, { id: 3, code: 'p102' }];
    const guardSim = [/l.cp_id = a.cp_id/, params => [accts.filter(a => a.id !== params[2] && ((a.ledger && params[3].startsWith(a.code)) || (params[4] === 1 && a.code.startsWith(params[3]))))]];
    reset([guardSim, [/AS next/, [[{ next: 1 }]]], [/^INSERT INTO wk_account/, [{ insertId: 9 }]]]);
    assert.strictEqual(await Account.create(1, av({ code: 'p10' })), 9, '새 코드가 장부 계정의 앞부분 → 묶음이 될 뿐이라 허용');
    reset([guardSim]);
    assert.strictEqual(await Account.create(1, av({ code: 'p1010' })), 'invalid', '장부 붙은 p101이 새 코드의 앞부분 → 막음');
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    // SQL 조각: (가) 방향은 '? LIKE CONCAT(a.code', 새 코드가 앞부분인 쪽('a.code LIKE ? OR')은 없어야 함
    const gsql = calls.find(c => c.sql.includes('l.cp_id = a.cp_id')).sql;
    assert.ok(gsql.includes("? LIKE CONCAT(a.code, '%')") && !gsql.includes('a.code LIKE ? OR') && gsql.includes('a.id <> ?') && gsql.includes('a.cp_id = ?') && gsql.includes('a.side = ?'));
    // 장부 붙은 계정 항목 판정(accountOk) SQL 조각
    reset([[/FROM wk_account a/, [[{ id: 3 }]]], [/^INSERT INTO wk_ledger/, [{ insertId: 1 }]]]);
    await Ledger.create(1, lv(), 7);
    const okSql = calls[0].sql;
    assert.ok(okSql.includes('c.id <> a.id') && okSql.includes('c.side = a.side') && okSql.includes('c.cp_id = a.cp_id') && okSql.includes("c.code LIKE CONCAT(a.code, '%')"));

    // ---- Account.update ----
    const cur = [/SELECT side, code FROM wk_account/, [[{ side: 'purchase', code: 'p101' }]]];
    reset([cur, [/^UPDATE wk_account/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Account.update(1, 2, av({ name: '서버비' })), 'ok');
    assert.ok(last().sql.includes('cp_id = ? AND id = ?'));
    assert.deepStrictEqual(last().params, ['purchase', 'p101', '', '서버비', 1, 2]);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset();
    assert.strictEqual(await Account.update(1, 2, av()), 'missing');
    assert.deepStrictEqual(calls[0].params, [1, 2]);
    reset([cur, [/code = \? AND id <> \?/, [[{ id: 5 }]]]]);
    assert.strictEqual(await Account.update(1, 2, av({ code: 'p102' })), 'duplicate');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));
    // side 바뀜 + 장부 있음 → invalid
    reset([cur, [/COUNT\(\*\) AS n FROM wk_ledger/, [[{ n: '2' }]]]]);
    assert.strictEqual(await Account.update(1, 2, av({ side: 'sales' })), 'invalid');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));
    // 묶음 p1(하위 p101에 장부)을 p10으로 → 통과 (p1 자신은 장부 없음)
    const curP1 = [/SELECT side, code FROM wk_account/, [[{ side: 'purchase', code: 'p1' }]]];
    reset([curP1, guardSim, [/^UPDATE wk_account/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Account.update(1, 1, av({ code: 'p10' })), 'ok');
    // 장부 있는 p101을 p10으로 → 다른 계정 p102가 p10으로 시작해 묶음이 되어 버림 → invalid
    reset([cur, [/COUNT\(\*\) AS n FROM wk_ledger/, [[{ n: '2' }]]], guardSim]);
    assert.strictEqual(await Account.update(1, 2, av({ code: 'p10' })), 'invalid');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    // 장부 있는 p101을 p103으로 → 통과
    reset([cur, [/COUNT\(\*\) AS n FROM wk_ledger/, [[{ n: '2' }]]], guardSim, [/^UPDATE wk_account/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Account.update(1, 2, av({ code: 'p103' })), 'ok');
    // 코드·구분이 그대로면 묶음 검사 생략(이름만 수정)
    reset([cur, [/^UPDATE wk_account/, [{ affectedRows: 1 }]]]);
    await Account.update(1, 2, av());
    assert.ok(!calls.some(c => c.sql.includes('EXISTS')));
    // 코드 바뀜, 검사 통과
    reset([cur, [/^UPDATE wk_account/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Account.update(1, 2, av({ code: 'p102' })), 'ok');
    const g = calls.find(c => c.sql.includes('EXISTS'));
    assert.ok(g.params[0] === 1 && g.params.includes(2) && g.params.includes('p102%'));

    // ---- Account.remove ----
    reset([[/SELECT id FROM wk_account WHERE/, [[{ id: 2 }]]], [/AS n/, [[{ n: '1' }]]]]);
    assert.strictEqual(await Account.remove(1, 2), 'used');
    assert.ok(!calls.some(c => c.sql.startsWith('DELETE')));
    reset();
    assert.strictEqual(await Account.remove(1, 2), 'missing');
    reset([[/SELECT id FROM wk_account WHERE/, [[{ id: 2 }]]], [/AS n/, [[{ n: '0' }]]]]);
    assert.strictEqual(await Account.remove(1, 2), 'ok');
    assert.deepStrictEqual(last().params, [1, 2]);
    assert.ok(last().sql.startsWith('DELETE FROM wk_account') && last().sql.includes('cp_id = ?'));

    console.log('checkLedgerModel: 모든 점검 통과');
})().catch(error => {
    console.error(error);
    process.exit(1);
});

// 매출/매입 장부·계정과목 API 점검: node scripts/checkLedger.js  (모델 가짜 — 운영 DB 호출 없음)
const assert = require('assert');
const { Ledger, Account } = require('../src/models/ledgerModel');
const Admin = require('../src/models/adminModel');

Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍길동' });
const calls = {};
const rec = (name, ret) => async (...a) => ((calls[name] = a), typeof ret === 'function' ? ret(...a) : ret);

const dbRow = { id: 1, side: 'sales', entry_date: '2026-03-05', account_id: 4, account_name: '용역', title: '테스트거래', memo: '', supply: 1000, tax: 100, total: 1100, created_at: '2026-03-05 10:00:00' };
Ledger.list = rec('list', { rows: [dbRow], total: 1 });
const summary = { sales: 1100, purchase: 0, diff: 1100, byAccount: [{ accountId: 4, total: 1100, count: 1 }] };
Ledger.summary = rec('summary', summary);
Ledger.findById = async (cp, id) => (id === 1 ? { ...dbRow, created_by: 7, updated_at: '2026-03-05 10:00:00', updated_at_kst: '2026-03-05 19:00:00' } : undefined);
let createResult = 55;
Ledger.create = rec('create', () => createResult);
let updateResult = 'ok';
Ledger.update = rec('update', () => updateResult);
let removeResult = true;
Ledger.remove = rec('remove', () => removeResult);
Account.list = rec('accounts', [{ id: 4, side: 'sales', code: '10', label: '1', name: '용역', sort: 0, used: 2, isGroup: false }]);
let accCreate = 9;
Account.create = rec('accCreate', () => accCreate);
let accUpdate = 'ok';
Account.update = rec('accUpdate', () => accUpdate);
let accRemove = 'ok';
Account.remove = rec('accRemove', () => accRemove);

const ctrl = require('../src/controllers/workLedgerController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'a@x.kr', ...req }, res);
    return res;
};
const body = { side: 'sales', entryDate: '2026-03-05', accountId: 4, title: '테스트거래', memo: '', supply: 1000, tax: 100, updatedAt: 'u' };
const accBody = { side: 'sales', code: '10', label: '1', name: '용역' };
const expect = (res, code, error) => assert.deepStrictEqual([res.code, res.body.error], [code, error]);

(async () => {
    // 목록: 칸 이름 정확히, 기본 year = KST 올해(now 주입 — UTC 12/31 16시는 KST 다음 해)
    ctrl.now = () => Date.UTC(2026, 11, 31, 16, 0, 0);
    let res = await call(ctrl.list, {});
    assert.deepStrictEqual(Object.keys(res.body), ['entries', 'total', 'page', 'size', 'summary']);
    assert.deepStrictEqual(Object.keys(res.body.entries[0]), ['id', 'side', 'entryDate', 'accountId', 'title', 'memo', 'supply', 'tax', 'total', 'createdAt']);
    assert.deepStrictEqual([res.body.page, res.body.size, res.body.total], [1, 20, 1]);
    assert.deepStrictEqual(res.body.summary, summary);
    assert.strictEqual(calls.list[1].year, 2027);
    assert.strictEqual(calls.summary[1].year, 2027);
    ctrl.now = () => Date.UTC(2026, 5, 1);
    await call(ctrl.list, { query: { year: '' } });
    assert.strictEqual(calls.list[1].year, 2026);

    // 필터 전달: 요약은 검색어·페이지 없이 같은 필터
    res = await call(ctrl.list, { query: { year: '2025', month: '12', side: 'purchase', accountId: '4', q: ' 테스 ', page: '2', size: '999' } });
    assert.deepStrictEqual(calls.list[1], { year: 2025, month: 12, side: 'purchase', accountId: 4, q: '테스', page: 2, size: 100 });
    assert.deepStrictEqual(calls.summary[1], { year: 2025, month: 12, side: 'purchase', accountId: 4 });
    res = await call(ctrl.list, { query: { month: '', side: '', accountId: '', page: '', size: '' } });
    assert.deepStrictEqual([calls.list[1].month, calls.list[1].side, calls.list[1].accountId, calls.list[1].page, calls.list[1].size], [null, null, null, 1, 20]);
    // 잘못된 쿼리 400
    for (const [query, error] of [
        [{ year: '1999' }, 'Invalid year'], [{ year: '2101' }, 'Invalid year'], [{ year: 'abc' }, 'Invalid year'], [{ year: '2026.5' }, 'Invalid year'],
        [{ month: '0' }, 'Invalid month'], [{ month: '13' }, 'Invalid month'], [{ month: 'x' }, 'Invalid month'],
        [{ side: 'x' }, 'Invalid side'], [{ accountId: 'a' }, 'Invalid accountId'], [{ accountId: '0' }, 'Invalid accountId'],
        [{ page: '0' }, 'Invalid page'], [{ page: 'x' }, 'Invalid page'], [{ size: '0' }, 'Invalid size'], [{ size: 'x' }, 'Invalid size'],
    ]) expect(await call(ctrl.list, { query }), 400, error);

    // 상세
    res = await call(ctrl.detail, { params: { id: '1' } });
    assert.deepStrictEqual(Object.keys(res.body.entry), ['id', 'side', 'entryDate', 'accountId', 'title', 'memo', 'supply', 'tax', 'total', 'createdAt', 'updatedAt', 'updatedAtKst']);
    assert.strictEqual(res.body.entry.updatedAt, '2026-03-05 10:00:00');
    for (const id of ['abc', '0', '99']) assert.strictEqual((await call(ctrl.detail, { params: { id } })).code, 404);

    // 작성: 작성자 mb_no, 합계는 서버가 계산
    res = await call(ctrl.create, { body: { ...body, total: 5 } });
    assert.deepStrictEqual(res.body, { id: 55 });
    assert.strictEqual(calls.create[2], 7);
    assert.strictEqual(calls.create[1].total, 1100);
    expect(await call(ctrl.create, { body: { ...body, title: '' } }), 400, 'Invalid title');
    expect(await call(ctrl.create, { body: { ...body, supply: 2000000000, tax: 1 } }), 400, 'Invalid amount');
    createResult = null;
    expect(await call(ctrl.create, { body }), 400, 'Invalid accountId');

    // 수정
    assert.deepStrictEqual((await call(ctrl.update, { params: { id: '1' }, body })).body, { ok: true });
    assert.strictEqual(calls.update[2].updatedAt, 'u');
    for (const [r, code, err] of [['changed', 409, 'Ledger changed'], ['missing', 404, 'Not found'], ['invalid', 400, 'Invalid accountId']]) {
        updateResult = r;
        expect(await call(ctrl.update, { params: { id: '1' }, body }), code, err);
    }
    assert.strictEqual((await call(ctrl.update, { params: { id: 'x' }, body })).code, 404);
    assert.strictEqual((await call(ctrl.update, { params: { id: '1' }, body: { ...body, side: 'x' } })).code, 400);

    // 삭제
    assert.deepStrictEqual((await call(ctrl.remove, { params: { id: '1' } })).body, { ok: true });
    removeResult = false;
    assert.strictEqual((await call(ctrl.remove, { params: { id: '1' } })).code, 404);
    assert.strictEqual((await call(ctrl.remove, { params: { id: 'x' } })).code, 404);

    // 계정과목
    res = await call(ctrl.accounts, {});
    assert.deepStrictEqual(Object.keys(res.body.accounts[0]), ['id', 'side', 'code', 'label', 'name', 'sort', 'used', 'isGroup']);
    assert.deepStrictEqual((await call(ctrl.createAccount, { body: accBody })).body, { id: 9 });
    assert.deepStrictEqual(calls.accCreate, [1, { side: 'sales', code: '10', label: '1', name: '용역' }]);
    expect(await call(ctrl.createAccount, { body: { ...accBody, code: '한글' } }), 400, 'Invalid code');
    expect(await call(ctrl.createAccount, { body: { ...accBody, name: '' } }), 400, 'Invalid name');
    accCreate = 'duplicate';
    expect(await call(ctrl.createAccount, { body: accBody }), 409, 'Duplicate code');
    accCreate = 'invalid';
    expect(await call(ctrl.createAccount, { body: accBody }), 400, 'Invalid code');

    assert.deepStrictEqual((await call(ctrl.updateAccount, { params: { id: '4' }, body: accBody })).body, { ok: true });
    for (const [r, code, err] of [['duplicate', 409, 'Duplicate code'], ['invalid', 400, 'Invalid code'], ['missing', 404, 'Not found']]) {
        accUpdate = r;
        expect(await call(ctrl.updateAccount, { params: { id: '4' }, body: accBody }), code, err);
    }
    assert.strictEqual((await call(ctrl.updateAccount, { params: { id: 'x' }, body: accBody })).code, 404);

    assert.deepStrictEqual((await call(ctrl.removeAccount, { params: { id: '4' } })).body, { ok: true });
    for (const [r, code, err] of [['used', 409, 'In use'], ['missing', 404, 'Not found']]) {
        accRemove = r;
        expect(await call(ctrl.removeAccount, { params: { id: '4' } }), code, err);
    }
    assert.strictEqual((await call(ctrl.removeAccount, { params: { id: 'x' } })).code, 404);

    // 모델이 던지면 500
    Account.list = async () => {
        throw new Error('boom');
    };
    const origErr = console.error;
    console.error = () => {};
    expect(await call(ctrl.accounts, {}), 500, 'Database query error');
    console.error = origErr;

    console.log('checkLedger OK');
    process.exit(0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});

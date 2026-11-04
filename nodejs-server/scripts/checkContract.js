// 견적·계약서 API 점검: node scripts/checkContract.js  (모델 가짜 — 운영 DB 호출 없음)
const assert = require('assert');
const Contract = require('../src/models/contractModel');
const DocSetting = require('../src/models/docSettingModel');
const Admin = require('../src/models/adminModel');

Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍길동' });
const calls = {};
const rec = (name, ret) => async (...a) => ((calls[name] = a), typeof ret === 'function' ? ret(...a) : ret);

const listRow = { id: 1, doc_no: '20260101-0900', category_id: 2, category_name: '웹', company_name: '테스트업체', project_name: '프로젝트', contract_date: '2026-01-01', delivery_date: null, total: 1000, paid_amount: 100, receivable: 1000, is_hold: 0, is_cancelled: 0, is_paid_full: 0, invoice_issued: 1, created_at: 'c' };
Contract.list = rec('list', { rows: [listRow], total: 1 });
Contract.companyTotals = rec('totals', { paid: 100, receivable: 1000 });
const detailRow = {
    id: 1, cp_id: 1, doc_no: 'n', category_id: 2, company_name: '테스트업체', biz_no: '', ceo_name: '', company_email: '', project_name: '', contract_date: '2026-01-01', delivery_date: null,
    work_period: '', memo: '', link1: '', link2: '', total: 1000, deposit: 0, balance: 0, paid_amount: 0, is_hold: 0, is_cancelled: 0, is_paid_full: 0, invoice_issued: 0,
    ops_server1: '', ops_server2: '', ops_spend: '', ops_site: '', created_by: 7, created_at: 'c', updated_at: '2026-11-04 10:00:00',
    items: [{ id: 1, sort: 0, group_name: 'g', content: 'c', unit_price: 1, qty: 1, period: 1, note: '', kind: 'normal' }], managers: [{ id: 1, sort: 0, name: '김담당', phone: '', email: '', memo: '' }],
};
Contract.findById = async (cp, id) => (id === 1 ? detailRow : undefined);
DocSetting.listCategories = async () => [{ id: 2, name: '웹', sort: 1, used: 1 }];
Contract.create = rec('create', 55);
let updateResult = 'ok';
Contract.update = rec('update', () => updateResult);
Contract.remove = rec('remove', true);
Contract.companies = rec('companies', [{ company_name: '테스트업체', biz_no: '1', ceo_name: '대표', company_email: 'a@x.kr', manager_name: '담당', manager_phone: '010', manager_email: 'm@x.kr' }]);

const ctrl = require('../src/controllers/workContractController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'a@x.kr', ...req }, res);
    return res;
};
const body = { companyName: '테스트업체', categoryId: 2, total: 1000, items: [{ content: '디자인', unitPrice: 1000, qty: 1, period: 1 }], managers: [{ name: '', phone: '', email: '', memo: '' }, { name: '김담당' }], updatedAt: 'u' };

(async () => {
    // 목록: 칸 이름 정확히, q 없으면 companyTotals null
    let res = await call(ctrl.list, { query: {} });
    assert.deepStrictEqual(Object.keys(res.body.contracts[0]), ['id', 'docNo', 'categoryId', 'categoryName', 'companyName', 'projectName', 'contractDate', 'deliveryDate', 'total', 'paidAmount', 'receivable', 'status', 'invoiceIssued', 'createdAt']);
    assert.deepStrictEqual([res.body.companyTotals, res.body.page, res.body.size, res.body.total], [null, 1, 20, 1]);
    assert.strictEqual(res.body.contracts[0].status, 'unpaid');
    assert.ok(!calls.totals);
    res = await call(ctrl.list, { query: { q: ' 테스트 ', page: '-1', size: '999', categoryId: '2', status: 'paid', from: '2026-01-01', to: '2026-12-31' } });
    assert.deepStrictEqual([res.body.page, res.body.size], [1, 100]);
    assert.deepStrictEqual(res.body.companyTotals, { paid: 100, receivable: 1000 });
    assert.deepStrictEqual(calls.list[1], { categoryId: 2, status: 'paid', from: '2026-01-01', to: '2026-12-31', q: '테스트', page: 1, size: 100 });
    res = await call(ctrl.list, { query: { size: 'abc', page: 'x' } });
    assert.deepStrictEqual([res.body.page, res.body.size], [1, 20]);
    res = await call(ctrl.list, { query: { page: '', size: '' } });
    assert.deepStrictEqual([res.body.page, res.body.size], [1, 20]);
    for (const query of [{ status: 'x' }, { categoryId: 'a' }, { from: '2026-02-30' }, { to: 'zz' }]) assert.strictEqual((await call(ctrl.list, { query })).code, 400);
    assert.strictEqual((await call(ctrl.list, { query: { status: 'x' } })).body.error, 'Invalid status');

    // 상세
    res = await call(ctrl.detail, { params: { id: '1' } });
    assert.strictEqual(res.body.contract.categoryName, '웹');
    assert.strictEqual(res.body.contract.updatedAt, '2026-11-04 10:00:00');
    assert.strictEqual(res.body.contract.items[0].unitPrice, 1);
    assert.strictEqual(res.body.contract.managers[0].name, '김담당');
    for (const id of ['abc', '0', '99']) assert.strictEqual((await call(ctrl.detail, { params: { id } })).code, 404);

    // 작성: 작성자 mb_no, 빈 담당자 행 제거
    res = await call(ctrl.create, { body });
    assert.deepStrictEqual(res.body, { id: 55 });
    assert.strictEqual(calls.create[2], 7);
    assert.deepStrictEqual(calls.create[1].managers.map(m => m.name), ['김담당']);
    assert.strictEqual((await call(ctrl.create, { body: { ...body, companyName: '' } })).body.error, 'Invalid companyName');
    // 품목 금액·합계 범위
    res = await call(ctrl.create, { body: { ...body, items: [{ content: 'x', unitPrice: 2000000000, qty: 2, period: 1 }] } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid items']);
    res = await call(ctrl.create, { body: { ...body, items: [{ content: 'x', unitPrice: 1500000000, qty: 1 }, { content: 'y', unitPrice: 1500000000, qty: 1 }] } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid items']);
    Contract.create = async () => null;
    res = await call(ctrl.create, { body });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid categoryId']);

    // 수정
    assert.deepStrictEqual((await call(ctrl.update, { params: { id: '1' }, body })).body, { ok: true });
    assert.strictEqual(calls.update[2].updatedAt, 'u');
    for (const [r, code, err] of [['changed', 409, 'Contract changed'], ['missing', 404, 'Not found'], ['invalid', 400, 'Invalid categoryId']]) {
        updateResult = r;
        res = await call(ctrl.update, { params: { id: '1' }, body });
        assert.deepStrictEqual([res.code, res.body.error], [code, err]);
    }
    assert.strictEqual((await call(ctrl.update, { params: { id: 'x' }, body })).code, 404);
    assert.strictEqual((await call(ctrl.update, { params: { id: '1' }, body: { ...body, total: 1.5 } })).code, 400);

    // 삭제
    assert.deepStrictEqual((await call(ctrl.remove, { params: { id: '1' } })).body, { ok: true });
    Contract.remove = async () => false;
    assert.strictEqual((await call(ctrl.remove, { params: { id: '1' } })).code, 404);
    assert.strictEqual((await call(ctrl.remove, { params: { id: 'x' } })).code, 404);

    // 업체 자동 완성: q가 비면 모델 호출 없이 빈 목록
    delete calls.companies;
    for (const q of [undefined, '', '   ']) assert.deepStrictEqual((await call(ctrl.companies, { query: { q } })).body, { companies: [] });
    assert.ok(!calls.companies);
    res = await call(ctrl.companies, { query: { q: '테스' } });
    assert.deepStrictEqual(Object.keys(res.body.companies[0]), ['companyName', 'bizNo', 'ceoName', 'companyEmail', 'managerName', 'managerPhone', 'managerEmail']);

    console.log('OK');
})().catch(e => {
    console.error(e);
    process.exit(1);
});

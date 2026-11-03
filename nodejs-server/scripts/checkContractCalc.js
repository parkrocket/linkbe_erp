// 견적·계약서 계산·권한·입력 검사 점검: node scripts/checkContractCalc.js  (DB 접속 없음)
const assert = require('assert');
const { vat, itemAmount, itemsTotal, receivable, contractStatus, RECEIVABLE_SQL } = require('../src/utils/contractCalc');
const { requireWorkDoc } = require('../src/middlewares/requireWorkDoc');
const { validateContract, validateCategory, validateItemTemplate, validateDocTemplate } = require('../src/utils/contractValidation');

// 계산 (화면 lib/contract.ts 테스트와 같은 값)
assert.strictEqual(vat(0), 0);
assert.strictEqual(vat(15), 1);
assert.strictEqual(vat(19999), 1999);
assert.strictEqual(vat(-15), -1);
const a = { unitPrice: 100000, qty: 0, period: 0 };
const b = { unitPrice: 50000, qty: 2, period: 3 };
const c = { unitPrice: -30000, qty: 1, period: 0 };
assert.strictEqual(itemAmount(a), 100000);
assert.strictEqual(itemAmount(b), 300000);
assert.strictEqual(itemAmount(c), -30000);
assert.strictEqual(itemsTotal([]), 0);
assert.strictEqual(itemsTotal([a, b, c]), 370000);
assert.strictEqual(receivable({ total: 1000000, paidAmount: 500000 }), 600000);
assert.strictEqual(receivable({ total: 1000000, paidAmount: 500000, isHold: true }), 0);
assert.strictEqual(receivable({ total: 1000000, paidAmount: 500000, isCancelled: true }), 0);
assert.strictEqual(receivable({ total: 1000000, paidAmount: 1100000 }), 0);
assert.strictEqual(receivable({ total: 1000000, paidAmount: 1200000 }), -100000);
const open = { total: 1000000, paidAmount: 500000 };
assert.strictEqual(contractStatus({ ...open, isCancelled: true, isHold: true }), 'cancelled');
assert.strictEqual(contractStatus({ ...open, isHold: true, isPaidFull: true }), 'hold');
assert.strictEqual(contractStatus({ ...open, isPaidFull: true }), 'paid');
assert.strictEqual(contractStatus(open), 'unpaid');
assert.strictEqual(contractStatus({ total: 1000000, paidAmount: 1100000 }), 'active');
assert.ok(RECEIVABLE_SQL.includes('is_hold = 1') && RECEIVABLE_SQL.includes('paid_amount'));

// requireWorkDoc
const run = workDoc => {
    const out = { next: false };
    const res = { status: code => ((out.code = code), res), json: body => ((out.body = body), res) };
    requireWorkDoc({ workDoc }, res, () => (out.next = true));
    return out;
};
assert.deepStrictEqual(run(false), { next: false, code: 403, body: { error: 'Work doc only' } });
assert.strictEqual(run(true).next, true);

// validateContract
const min = { companyName: ' 테스트업체 ', total: 1000000, items: [{ content: '디자인', unitPrice: 100000, qty: 1 }], managers: [{ name: '홍길동' }] };
const ok = validateContract(min);
assert.ok(ok.ok);
const v = ok.value;
assert.strictEqual(v.companyName, '테스트업체');
for (const k of ['docNo', 'bizNo', 'ceoName', 'companyEmail', 'projectName', 'workPeriod', 'memo', 'link1', 'link2', 'opsServer1', 'opsServer2', 'opsSpend', 'opsSite']) assert.strictEqual(v[k], '', k);
for (const k of ['deposit', 'balance', 'paidAmount']) assert.strictEqual(v[k], 0, k);
for (const k of ['contractDate', 'deliveryDate', 'categoryId']) assert.strictEqual(v[k], null, k);
for (const k of ['isHold', 'isCancelled', 'isPaidFull', 'invoiceIssued']) assert.strictEqual(v[k], false, k);
assert.deepStrictEqual(v.items[0], { groupName: '', content: '디자인', unitPrice: 100000, qty: 1, period: 0, note: '', kind: 'normal' });
assert.deepStrictEqual(v.managers[0], { name: '홍길동', phone: '', email: '', memo: '' });
assert.strictEqual('updatedAt' in v, false);
assert.strictEqual(validateContract({ ...min, updatedAt: '2026-11-05 10:00:00' }).value.updatedAt, '2026-11-05 10:00:00');

const err = patch => validateContract({ ...min, ...patch }).error;
const item = patch => ({ ...min.items[0], ...patch });
assert.strictEqual(err({ companyName: '  ' }), 'Invalid companyName');
assert.strictEqual(err({ companyName: 'a'.repeat(101) }), 'Invalid companyName');
assert.strictEqual(err({ contractDate: '2026-02-30' }), 'Invalid contractDate');
assert.ok(validateContract({ ...min, contractDate: '2026-02-27', deliveryDate: '' }).ok);
assert.strictEqual(err({ deliveryDate: 'x' }), 'Invalid deliveryDate');
assert.strictEqual(err({ total: 1.5 }), 'Invalid total');
assert.strictEqual(err({ total: 2000000001 }), 'Invalid total');
assert.strictEqual(err({ paidAmount: -2000000001 }), 'Invalid paidAmount');
assert.strictEqual(err({ items: Array(201).fill(item()) }), 'Invalid items');
assert.ok(validateContract({ ...min, items: Array(200).fill(item()) }).ok);
assert.strictEqual(err({ items: [item({ qty: -1 })] }), 'Invalid item');
assert.strictEqual(err({ items: [item({ qty: 100001 })] }), 'Invalid item');
assert.strictEqual(err({ items: [item({ period: 10001 })] }), 'Invalid item');
assert.strictEqual(err({ items: [item({ kind: 'x' })] }), 'Invalid item');
assert.strictEqual(err({ items: [item({ content: '' })] }), 'Invalid item');
assert.strictEqual(err({ items: [item({ content: 'a'.repeat(256) })] }), 'Invalid item');
assert.ok(validateContract({ ...min, items: [item({ unitPrice: -30000, kind: 'normal' })] }).ok); // 예전 데이터
assert.ok(validateContract({ ...min, items: [item({ unitPrice: -30000, kind: 'discount' })] }).ok);
assert.strictEqual(err({ managers: Array(21).fill({ name: 'a' }) }), 'Invalid managers');
assert.strictEqual(err({ managers: [{ name: 'a'.repeat(51) }] }), 'Invalid manager');
assert.strictEqual(err({ link1: 'javascript:alert(1)' }), 'Invalid link1');
assert.ok(validateContract({ ...min, link1: 'https://example.com', link2: '' }).ok);
assert.strictEqual(err({ isHold: '1' }), 'Invalid isHold');
assert.strictEqual(err({ docNo: 'a'.repeat(31) }), 'Invalid docNo');
assert.strictEqual(err({ memo: 'a'.repeat(10001) }), 'Invalid memo');
assert.strictEqual(err({ opsSite: 'a'.repeat(501) }), 'Invalid opsSite');
assert.strictEqual(err({ categoryId: 0 }), 'Invalid categoryId');
assert.ok(validateContract({ ...min, companyEmail: '이메일아님' }).ok); // 형식 검사 없음

// 분류·품목 문구·양식
assert.deepStrictEqual(validateCategory({ name: ' 웹 ' }), { ok: true, value: { name: '웹' } });
assert.ok(!validateCategory({ name: '' }).ok && !validateCategory({ name: 'a'.repeat(51) }).ok);
const it = { categoryId: 3, content: '디자인', unitPrice: 1000 };
assert.ok(validateItemTemplate(it).ok);
assert.strictEqual(validateItemTemplate({ ...it, categoryId: 0 }).error, 'Invalid categoryId');
assert.strictEqual(validateItemTemplate({ ...it, qty: -1 }).error, 'Invalid item');
const dt = { kind: 'estimate', name: '기본', categoryId: null, bodyHtml: '<p>x</p>', css: '', isDefault: false };
assert.ok(validateDocTemplate(dt).ok);
assert.ok(validateDocTemplate({ ...dt, kind: 'contract', categoryId: 2, updatedAt: 'x' }).ok);
assert.strictEqual(validateDocTemplate({ ...dt, kind: 'etc' }).error, 'Invalid kind');
assert.strictEqual(validateDocTemplate({ ...dt, name: '' }).error, 'Invalid name');
assert.strictEqual(validateDocTemplate({ ...dt, categoryId: -1 }).error, 'Invalid categoryId');
assert.strictEqual(validateDocTemplate({ ...dt, bodyHtml: 'a'.repeat(2000001) }).error, 'Invalid bodyHtml');
assert.strictEqual(validateDocTemplate({ ...dt, css: 'a'.repeat(200001) }).error, 'Invalid css');
assert.strictEqual(validateDocTemplate({ ...dt, isDefault: 1 }).error, 'Invalid isDefault');

console.log('OK');

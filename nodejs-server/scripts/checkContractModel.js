// 견적·계약서·설정 모델 점검: node scripts/checkContractModel.js  (pool·연결 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

// 호출 기록 + 응답 규칙(handlers: [정규식, 응답] — 먼저 맞는 것). 기본 응답은 빈 결과
const calls = []; // { sql, params, tx }
const events = []; // 트랜잭션 이벤트 기록
let handlers = [];
let failOn = null; // 이 정규식에 맞는 SQL이면 오류
const answer = (sql, params, tx) => {
    calls.push({ sql, params, tx });
    if (failOn && failOn.test(sql)) throw new Error('fake failure');
    const h = handlers.find(([re]) => re.test(sql));
    if (h) return h[1];
    return sql.includes('COUNT(*) AS n FROM wk_contract') ? [[{ n: 0 }]] : [[]];
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

const Contract = require('../src/models/contractModel');
const DocSetting = require('../src/models/docSettingModel');

const value = (patch = {}) => ({
    docNo: '', categoryId: null, companyName: '테스트업체', bizNo: '', ceoName: '', companyEmail: '', projectName: '', contractDate: '2026-11-05', deliveryDate: null,
    workPeriod: '', memo: '', link1: '', link2: '', total: 1000, deposit: 0, balance: 0, paidAmount: 0, isHold: false, isCancelled: false, isPaidFull: false, invoiceIssued: true,
    opsServer1: '', opsServer2: '', opsSpend: '', opsSite: '', updatedAt: '2026-11-05 10:00:00',
    items: [
        { groupName: 'a', content: '첫째', unitPrice: 1, qty: 1, period: 1, note: '', kind: 'normal' },
        { groupName: 'a', content: '둘째', unitPrice: 2, qty: 0, period: 0, note: '', kind: 'normal' },
        { groupName: '할인', content: '셋째', unitPrice: -3, qty: 1, period: 1, note: '', kind: 'discount' },
    ],
    managers: [{ name: '홍길동', phone: '', email: '', memo: '' }, { name: '김철수', phone: '', email: '', memo: '' }],
    ...patch,
});

(async () => {
    // ---- list ----
    reset([[/COUNT\(\*\)/, [[{ n: '7' }]]], [/FROM wk_contract/, [[{ id: 1 }]]]]);
    assert.deepStrictEqual(await Contract.list(1, {}), { rows: [{ id: 1 }], total: 7 });
    let { sql, params } = calls[0];
    assert.ok(sql.includes('cp_id = ?') && sql.includes("DATE_FORMAT(contract_date, '%Y-%m-%d')") && sql.includes('AS receivable') && sql.includes('AS category_name'));
    assert.ok(sql.includes('ORDER BY contract_date DESC, id DESC LIMIT ? OFFSET ?'));
    assert.deepStrictEqual(params, [1, 50, 0]);
    assert.ok(calls[1].sql.includes('cp_id = ?') && !calls[1].sql.includes('LIMIT'));

    const statusSql = async status => (reset(), await Contract.list(1, { status }), calls[0].sql);
    const unpaid = await statusSql('unpaid');
    assert.ok(unpaid.includes('is_cancelled = 0 AND is_hold = 0 AND is_paid_full = 0') && unpaid.includes(') > 0'));
    assert.ok((await statusSql('cancelled')).includes('is_cancelled = 1'));
    assert.ok((await statusSql('hold')).includes('is_cancelled = 0 AND is_hold = 1'));
    assert.ok((await statusSql('paid')).includes('is_cancelled = 0 AND is_hold = 0 AND is_paid_full = 1'));
    const active = await statusSql('active');
    assert.ok(active.includes('is_paid_full = 0') && active.includes(') <= 0'));
    assert.ok(!(await statusSql('')).includes('is_cancelled = 0'), '상태 없으면 조건 없음');
    assert.ok(!(await statusSql('x; DROP')).includes('DROP'), '모르는 상태는 무시');

    reset();
    await Contract.list(2, { categoryId: 3, from: '2026-01-01', to: '2026-12-31', q: '50%_', page: 3, size: 20 });
    ({ sql, params } = calls[0]);
    assert.ok(sql.includes('category_id = ?') && sql.includes('contract_date >= ?') && sql.includes('contract_date <= ?') && sql.includes('company_name LIKE ?'));
    assert.deepStrictEqual(params, [2, 3, '2026-01-01', '2026-12-31', '%50\\%\\_%', 20, 40]);
    assert.deepStrictEqual(calls[1].params, [2, 3, '2026-01-01', '2026-12-31', '%50\\%\\_%']);

    // ---- companyTotals ----
    reset([[/SUM/, [[{ paid: '300', receivable: '-5' }]]]]);
    assert.deepStrictEqual(await Contract.companyTotals(1, '업체'), { paid: 300, receivable: -5 });
    assert.ok(last().sql.includes('cp_id = ?') && last().sql.includes('company_name LIKE ?'));
    assert.deepStrictEqual(last().params, [1, '%업체%']);
    await Contract.companyTotals(1, '');
    assert.ok(!last().sql.includes('LIKE'));

    // ---- findById: 계약을 cp_id로 먼저, 없으면 품목 조회 없음 ----
    reset();
    assert.strictEqual(await Contract.findById(1, 9), undefined);
    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].sql.includes('cp_id = ? AND id = ?') && calls[0].sql.includes("DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at"));
    assert.ok(calls[0].sql.includes("CONVERT_TZ(created_at, @@session.time_zone, '+09:00')") && calls[0].sql.includes('AS updated_at_kst') && calls[0].sql.includes('AS created_at'));
    assert.deepStrictEqual(calls[0].params, [1, 9]);
    reset([[/FROM wk_contract WHERE/, [[{ id: 9, cp_id: 1 }]]], [/wk_contract_item/, [[{ id: 1 }]]], [/wk_contract_manager/, [[{ id: 2 }]]]]);
    assert.deepStrictEqual(await Contract.findById(1, 9), { id: 9, cp_id: 1, items: [{ id: 1 }], managers: [{ id: 2 }] });
    assert.strictEqual(calls.length, 3);
    for (const c of calls.slice(1)) assert.ok(c.sql.includes('ORDER BY sort, id') && c.sql.includes('contract_id = ?') && c.params[0] === 9);

    // ---- nextDocNo ----
    const docNoHandlers = used => [[/AS base/, [[{ base: '20261105103000' }]]], [/SELECT doc_no/, [used.map(doc_no => ({ doc_no }))]]];
    reset(docNoHandlers([]));
    assert.strictEqual(await Contract.nextDocNo(pool, 1), '20261105103000');
    assert.ok(calls[0].sql.includes("CONVERT_TZ(NOW(), @@session.time_zone, '+09:00')") && calls[0].sql.includes("'%Y%m%d%H%i%s'"));
    assert.ok(calls[1].sql.includes('cp_id = ?'));
    assert.deepStrictEqual(calls[1].params, [1, '20261105103000', '20261105103000-%']);
    reset(docNoHandlers(['20261105103000']));
    assert.strictEqual(await Contract.nextDocNo(pool, 1), '20261105103000-2');
    reset(docNoHandlers(['20261105103000', '20261105103000-2']));
    assert.strictEqual(await Contract.nextDocNo(pool, 1), '20261105103000-3');
    reset(docNoHandlers(['20261105103000', '20261105103000-3']));
    assert.strictEqual(await Contract.nextDocNo(pool, 1), '20261105103000-2', '비는 번호부터');

    // ---- create ----
    reset([...docNoHandlers([]), [/INSERT INTO wk_contract \(/, [{ insertId: 42 }]]]);
    assert.strictEqual(await Contract.create(1, value(), 7), 42);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    const ins = calls.find(c => c.sql.startsWith('INSERT INTO wk_contract ('));
    assert.ok(ins.sql.includes('cp_id, doc_no, created_by') && ins.sql.includes('memo') && ins.sql.includes('ops_server1') && ins.sql.includes('ops_spend'));
    assert.deepStrictEqual(ins.params.slice(0, 3), [1, '20261105103000', 7], '문서번호 비면 자동');
    assert.strictEqual(ins.params.length, 3 + 24);
    assert.ok(ins.params.includes(1) && !ins.params.includes(true), '불리언은 숫자로');
    const itemIns = calls.find(c => c.sql.startsWith('INSERT INTO wk_contract_item'));
    assert.deepStrictEqual(itemIns.params[0].map(r => [r[0], r[1]]), [[42, 0], [42, 1], [42, 2]]);
    assert.deepStrictEqual(itemIns.params[0][2], [42, 2, '할인', '셋째', -3, 1, 1, '', 'discount']);
    const mgrIns = calls.find(c => c.sql.startsWith('INSERT INTO wk_contract_manager'));
    assert.deepStrictEqual(mgrIns.params[0].map(r => [r[1], r[2]]), [[0, '홍길동'], [1, '김철수']]);

    reset([[/INSERT INTO wk_contract \(/, [{ insertId: 43 }]]]);
    await Contract.create(1, value({ docNo: 'X-1', items: [], managers: [] }), 7);
    assert.strictEqual(calls.find(c => c.sql.startsWith('INSERT INTO wk_contract (')).params[1], 'X-1');
    assert.ok(!calls.some(c => /item|manager|AS base/.test(c.sql)), '품목 없으면 삽입 없음, 번호 직접 입력이면 생성 안 함');

    // 품목 INSERT 실패 → rollback·release (commit 없음)
    reset([...docNoHandlers([]), [/INSERT INTO wk_contract \(/, [{ insertId: 44 }]]]);
    failOn = /INSERT INTO wk_contract_item/;
    await assert.rejects(Contract.create(1, value(), 7), /fake failure/);
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // 다른 회사 분류 → null, 삽입 없음
    reset();
    assert.strictEqual(await Contract.create(1, value({ categoryId: 5 }), 7), null);
    assert.deepStrictEqual(calls[0].params, [1, 5]);
    assert.ok(calls[0].sql.includes('wk_doc_category') && calls[0].sql.includes('cp_id = ?'));
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // ---- update ----
    reset([[/^UPDATE wk_contract/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Contract.update(1, 9, value()), 'ok');
    const upd = calls.find(c => c.sql.startsWith('UPDATE wk_contract'));
    assert.ok(upd.sql.includes('cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') = ?'));
    assert.deepStrictEqual(upd.params.slice(-3), [1, 9, '2026-11-05 10:00:00']);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    // 지우기 → 다시 넣기 순서, sort 0,1,2
    const sqls = calls.map(c => c.sql.split(' (')[0].split(' WHERE')[0]);
    const iUpd = sqls.indexOf(upd.sql.split(' WHERE')[0]);
    assert.ok(sqls.indexOf('DELETE FROM wk_contract_item') > iUpd && sqls.indexOf('INSERT INTO wk_contract_item') > sqls.indexOf('DELETE FROM wk_contract_manager'));
    assert.deepStrictEqual(calls.find(c => c.sql.startsWith('INSERT INTO wk_contract_item')).params[0].map(r => r[1]), [0, 1, 2]);
    assert.deepStrictEqual(calls.find(c => c.sql.startsWith('DELETE FROM wk_contract_item')).params, [9]);

    // 0행 + 존재 → changed, 삭제·삽입 없음, rollback
    reset([[/^UPDATE wk_contract/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_contract WHERE/, [[{ id: 9 }]]]]);
    assert.strictEqual(await Contract.update(1, 9, value()), 'changed');
    assert.ok(!calls.some(c => /^(DELETE|INSERT)/.test(c.sql)));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    // 0행 + 없음 → missing
    reset([[/^UPDATE wk_contract/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await Contract.update(1, 9, value()), 'missing');
    assert.deepStrictEqual(calls.find(c => c.sql.startsWith('SELECT id FROM wk_contract WHERE')).params, [1, 9]);
    // updatedAt 없으면 절대 일치하지 않음 → changed 경로
    reset([[/^UPDATE wk_contract/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_contract WHERE/, [[{ id: 9 }]]]]);
    assert.strictEqual(await Contract.update(1, 9, value({ updatedAt: undefined })), 'changed');
    // 다른 회사 분류 → invalid
    reset();
    assert.strictEqual(await Contract.update(1, 9, value({ categoryId: 5 })), 'invalid');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));
    // 중간 실패 → rollback·release
    reset([[/^UPDATE wk_contract/, [{ affectedRows: 1 }]]]);
    failOn = /INSERT INTO wk_contract_manager/;
    await assert.rejects(Contract.update(1, 9, value()), /fake failure/);
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // ---- remove ----
    reset([[/^DELETE FROM wk_contract WHERE/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await Contract.remove(1, 9), true);
    assert.deepStrictEqual(calls[0].params, [1, 9]);
    assert.ok(calls[0].sql.includes('cp_id = ?'));
    assert.deepStrictEqual(calls.slice(1).map(c => c.sql), ['DELETE FROM wk_contract_item WHERE contract_id = ?', 'DELETE FROM wk_contract_manager WHERE contract_id = ?']);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset([[/^DELETE FROM wk_contract WHERE/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await Contract.remove(2, 9), false);
    assert.strictEqual(calls.length, 1, '다른 회사 계약이면 품목·담당자 삭제 안 함');
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // ---- companies ----
    reset([[/FROM wk_contract c/, [[{ company_name: '테스트업체' }]]]]);
    assert.deepStrictEqual(await Contract.companies(1, '테_'), [{ company_name: '테스트업체' }]);
    assert.ok(last().sql.includes('c.cp_id = ?') && last().sql.includes('LIMIT 10') && last().sql.includes('MAX(c2.id)'));
    assert.ok(last().sql.includes('manager_name') && last().sql.includes('manager_phone') && last().sql.includes('manager_email'));
    assert.deepStrictEqual(last().params, [1, '테\\_%']);

    // ---- DocSetting: 분류 ----
    reset([[/FROM wk_doc_category c/, [[{ id: 1, name: 'a', sort: 1, used: '2' }]]]]);
    assert.deepStrictEqual(await DocSetting.listCategories(1), [{ id: 1, name: 'a', sort: 1, used: 2 }]);
    assert.ok(last().sql.includes('c.cp_id = ?') && last().sql.includes('k.cp_id = c.cp_id'));
    reset([[/^INSERT INTO wk_doc_category/, [{ insertId: 5 }]]]);
    assert.strictEqual(await DocSetting.createCategory(1, { name: '웹' }), 5);
    assert.deepStrictEqual(last().params, [1, '웹', 1]);
    reset([[/^UPDATE wk_doc_category/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await DocSetting.renameCategory(1, 5, { name: '앱' }), true);
    assert.deepStrictEqual(last().params, ['앱', 1, 5]);

    // moveCategory: 이웃과 교환 후 0부터 번호
    const catRows = [[/SELECT id FROM wk_doc_category/, [[{ id: 10 }, { id: 11 }, { id: 12 }]]]];
    reset(catRows);
    assert.strictEqual(await DocSetting.moveCategory(1, 12, 'up'), true);
    assert.deepStrictEqual(calls.filter(c => c.sql.startsWith('UPDATE')).map(c => [c.params[1], c.params[0]]), [[10, 0], [12, 1], [11, 2]]);
    assert.ok(calls.every(c => c.sql.includes('cp_id = ?')) && events.join() === 'begin,commit,release');
    reset(catRows);
    assert.strictEqual(await DocSetting.moveCategory(1, 10, 'up'), false, '맨 위는 안 움직임');
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')) && events.join() === 'begin,rollback,release');
    reset(catRows);
    assert.strictEqual(await DocSetting.moveCategory(1, 12, 'down'), false);
    reset(catRows);
    assert.strictEqual(await DocSetting.moveCategory(1, 99, 'down'), false, '없는 id');
    reset(catRows);
    assert.strictEqual(await DocSetting.moveCategory(1, 10, 'down'), true);
    assert.deepStrictEqual(calls.filter(c => c.sql.startsWith('UPDATE')).map(c => [c.params[1], c.params[0]]), [[11, 0], [10, 1], [12, 2]]);

    // removeCategory
    reset();
    assert.strictEqual(await DocSetting.removeCategory(1, 5), 'missing');
    reset([[/SELECT id FROM wk_doc_category/, [[{ id: 5 }]]], [/AS n/, [[{ n: '1' }]]]]);
    assert.strictEqual(await DocSetting.removeCategory(1, 5), 'used');
    assert.ok(/wk_contract[^)]*cp_id/.test(calls[1].sql) && calls[1].sql.includes('wk_item_template') && calls[1].sql.includes('wk_doc_template'));
    assert.ok(!calls.some(c => c.sql.startsWith('DELETE')));
    reset([[/SELECT id FROM wk_doc_category/, [[{ id: 5 }]]], [/AS n/, [[{ n: '0' }]]]]);
    assert.strictEqual(await DocSetting.removeCategory(1, 5), 'ok');
    assert.deepStrictEqual(last().params, [1, 5]);

    // ---- DocSetting: 품목 문구 ----
    const tpl = { categoryId: 5, groupName: 'g', content: '문구', unitPrice: 10, qty: 1, period: 1, note: '', kind: 'normal' };
    reset();
    assert.strictEqual(await DocSetting.createItemTemplate(1, tpl), null, '다른 회사 분류');
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));
    reset([[/AS next/, [[{ next: 4 }]]], [/^INSERT INTO wk_item_template/, [{ insertId: 8 }]]]);
    assert.strictEqual(await DocSetting.createItemTemplate(1, tpl), 8);
    assert.deepStrictEqual(last().params, [1, 5, 'g', '문구', 10, 1, 1, '', 'normal', 4]);
    reset([[/^UPDATE wk_item_template/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await DocSetting.updateItemTemplate(1, 8, tpl), true);
    assert.deepStrictEqual(last().params.slice(-2), [1, 8]);
    reset([[/^DELETE FROM wk_item_template/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await DocSetting.removeItemTemplate(1, 8), false);
    assert.deepStrictEqual(last().params, [1, 8]);
    reset([[/SELECT category_id/, [[{ category_id: 5 }]]], [/SELECT id FROM wk_item_template/, [[{ id: 1 }, { id: 2 }]]]]);
    assert.strictEqual(await DocSetting.moveItemTemplate(1, 2, 'up'), true);
    assert.deepStrictEqual(calls.find(c => c.sql.startsWith('SELECT id FROM wk_item_template')).params, [1, 5]);
    reset();
    assert.strictEqual(await DocSetting.moveItemTemplate(1, 2, 'up'), false);
    reset([[/FROM wk_item_template/, [[{ id: 1 }]]]]);
    assert.deepStrictEqual(await DocSetting.listItemTemplates(1, 5), [{ id: 1 }]);
    assert.deepStrictEqual(last().params, [1, 5]);

    // ---- DocSetting: 양식 ----
    reset([[/FROM wk_doc_template/, [[{ id: 1, name: 'a' }]]]]);
    assert.deepStrictEqual(await DocSetting.listDocTemplates(1), [{ id: 1, name: 'a' }]);
    assert.ok(!/body_html|css/.test(last().sql.split(' FROM ')[0]), '목록에는 본문·CSS 없음');
    assert.ok(last().sql.includes('group_name'));
    assert.deepStrictEqual(await DocSetting.findDocTemplate(1, 1), { id: 1, name: 'a' });
    assert.ok(last().sql.includes('body_html') && last().sql.includes('css') && last().sql.includes('cp_id = ? AND id = ?'));
    const dt = { kind: 'estimate', name: '양식', groupName: '로엘', categoryId: null, bodyHtml: '<p>a</p>', css: '', isDefault: true, updatedAt: '2026-11-05 10:00:00' };
    reset([[/^INSERT INTO wk_doc_template/, [{ insertId: 3 }]]]);
    assert.strictEqual(await DocSetting.createDocTemplate(1, dt), 3);
    assert.deepStrictEqual(calls[0].params, [1, 'estimate', '양식', '로엘', null, '<p>a</p>', '', 1], 'css·body_html 항상 명시');
    assert.ok(calls[0].sql.includes('group_name'));
    let off = calls.find(c => c.sql.startsWith('UPDATE wk_doc_template SET is_default = 0'));
    assert.ok(off.sql.includes('category_id <=> ?') && off.sql.includes('kind = ?') && off.sql.includes('cp_id = ?'));
    assert.deepStrictEqual(off.params, [1, 'estimate', null, 3]);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
    reset([[/^INSERT INTO wk_doc_template/, [{ insertId: 4 }]]]);
    await DocSetting.createDocTemplate(1, { ...dt, isDefault: false });
    assert.ok(!calls.some(c => c.sql.includes('is_default = 0')), '기본 아니면 다른 기본 안 끔');
    reset();
    assert.strictEqual(await DocSetting.createDocTemplate(1, { ...dt, categoryId: 9 }), null);
    assert.ok(!calls.some(c => c.sql.startsWith('INSERT')));

    reset([[/^UPDATE wk_doc_template SET kind/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await DocSetting.updateDocTemplate(1, 3, { ...dt, categoryId: null }), 'ok');
    assert.ok(calls[0].sql.includes("DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') = ?") && calls[0].sql.includes('cp_id = ? AND id = ?'));
    assert.deepStrictEqual(calls[0].params.slice(-3), [1, 3, '2026-11-05 10:00:00']);
    assert.ok(calls[0].sql.includes('group_name = ?') && calls[0].params.includes('로엘'));
    off = calls.find(c => c.sql.includes('is_default = 0'));
    assert.ok(off.sql.includes('category_id <=> ?') && off.sql.includes('id <> ?'));
    assert.deepStrictEqual(off.params, [1, 'estimate', null, 3]);
    reset([[/^UPDATE wk_doc_template SET kind/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_doc_template/, [[{ id: 3 }]]]]);
    assert.strictEqual(await DocSetting.updateDocTemplate(1, 3, dt), 'changed');
    assert.ok(!calls.some(c => c.sql.includes('is_default = 0')));
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    reset([[/^UPDATE wk_doc_template SET kind/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await DocSetting.updateDocTemplate(1, 3, dt), 'missing');
    reset([[/^DELETE FROM wk_doc_template/, [{ affectedRows: 1 }]]]);
    assert.strictEqual(await DocSetting.removeDocTemplate(1, 3), true);
    assert.deepStrictEqual(last().params, [1, 3]);

    console.log('checkContractModel: 모든 점검 통과');
})().catch(error => {
    console.error(error);
    process.exit(1);
});

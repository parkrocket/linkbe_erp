// 경비 입력 검사·모델 점검: node scripts/checkExpenseModel.js  (pool 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const { EXPENSE_CATEGORIES, EXPENSE_STATUSES, STATUS_NAME, validateExpense, parseMonth } = require('../src/utils/expenseValidation');
const pool = require('../src/config/dbPromise');

const calls = [];
let reply = [[]];
pool.query = async (sql, params) => (calls.push({ sql, params }), reply);
const Expense = require('../src/models/expenseModel');
const last = () => calls[calls.length - 1];

(async () => {
    // 정해진 값
    assert.deepStrictEqual(EXPENSE_CATEGORIES, ['server', 'supplies', 'welfare', 'rent', 'tax', 'etc']);
    assert.deepStrictEqual(EXPENSE_STATUSES, ['pending', 'approved', 'confirmed', 'paid']);
    assert.strictEqual(STATUS_NAME.confirmed, '승인완료');

    // validateExpense
    const base = { spentOn: '2026-11-30', category: 'server', amount: 12000, title: '  도메인 연장  ', body: '' };
    assert.deepStrictEqual(validateExpense(base), { ok: true, value: { spentOn: '2026-11-30', category: 'server', amount: 12000, title: '도메인 연장', body: '' } });
    const err = patch => validateExpense({ ...base, ...patch }).error;
    assert.strictEqual(err({ spentOn: '2026-02-30' }), 'Invalid date');
    assert.strictEqual(err({ spentOn: '2026/11/01' }), 'Invalid date');
    assert.strictEqual(err({ category: 'food' }), 'Invalid category');
    for (const amount of [12.5, -1, '12,000', 2000000001]) assert.strictEqual(err({ amount }), 'Invalid amount');
    for (const amount of [0, 2000000000]) assert.ok(validateExpense({ ...base, amount }).ok);
    assert.strictEqual(err({ title: '   ' }), 'Invalid title');
    assert.strictEqual(err({ title: 'a'.repeat(101) }), 'Invalid title');
    assert.strictEqual(err({ body: 'a'.repeat(5001) }), 'Invalid body');
    assert.strictEqual(err({ body: 123 }), 'Invalid body');
    assert.ok(validateExpense({ ...base, body: 'a'.repeat(5000) }).ok);

    // parseMonth
    assert.strictEqual(parseMonth('2026-11'), '2026-11');
    for (const v of ['2026-13', '2026-1', 'x']) assert.strictEqual(parseMonth(v), null);
    const now = new Date('2026-11-30T16:00:00Z'); // KST로는 12월 1일 01시
    assert.strictEqual(parseMonth('', now), '2026-12');
    assert.strictEqual(parseMonth(undefined, now), '2026-12');

    // list: 월 범위·문자열 날짜·본문/history 제외
    reply = [[{ id: 1 }]];
    assert.deepStrictEqual(await Expense.list(1, { month: '2026-11', status: null, writerNo: null }), [{ id: 1 }]);
    let { sql, params } = last();
    assert.ok(sql.includes('cp_id = ?') && sql.includes("DATE_FORMAT(spent_on, '%Y-%m-%d')"));
    assert.ok(sql.includes('spent_on >= ? AND spent_on < DATE_ADD(?, INTERVAL 1 MONTH)'));
    assert.ok(sql.includes('ORDER BY spent_on DESC, id DESC') && sql.includes('created_at') && sql.includes('CONVERT_TZ') && sql.includes('DATE_FORMAT'));
    assert.ok(!/body|history/.test(sql.split(' FROM ')[0]), '컬럼 목록에 본문·history 없음');
    assert.ok(!sql.includes('writer_no = ?') && !sql.includes('status = ?'));
    assert.deepStrictEqual(params, [1, '2026-11-01', '2026-11-01']);
    await Expense.list(1, { month: '2026-12', status: 'paid', writerNo: 7 });
    ({ sql, params } = last());
    assert.ok(sql.includes('status = ?') && sql.includes('writer_no = ?'));
    assert.deepStrictEqual(params, [1, '2026-12-01', '2026-12-01', 'paid', 7]);

    // summary: 모든 분류 합, 숫자 변환
    reply = [[{ category: 'server', n: 2, total: '30000' }, { category: 'tax', n: 1, total: '5000' }]];
    assert.deepStrictEqual(await Expense.summary(1, { month: '2026-11', writerNo: null }), { count: 3, total: 35000, byCategory: { server: 30000, tax: 5000 } });
    assert.ok(last().sql.includes('GROUP BY category') && last().sql.includes('cp_id = ?'));
    assert.deepStrictEqual(last().params, [1, '2026-11-01', '2026-11-01']);
    await Expense.summary(1, { month: '2026-11', writerNo: 7 });
    assert.ok(last().sql.includes('writer_no = ?') && last().params[3] === 7);
    reply = [[]];
    assert.deepStrictEqual(await Expense.summary(1, { month: '2026-11' }), { count: 0, total: 0, byCategory: {} });

    // findById: 회사 범위 + 기안자 이메일 JOIN
    reply = [[{ id: 3, writer_email: 'a@x.kr' }]];
    assert.deepStrictEqual(await Expense.findById(1, 3), { id: 3, writer_email: 'a@x.kr' });
    ({ sql, params } = last());
    assert.ok(sql.includes('LEFT JOIN lk_user u ON u.mb_no = e.writer_no') && sql.includes('u.user_id AS writer_email'));
    assert.ok(sql.includes('e.cp_id = ?') && sql.includes('e.id = ?') && sql.includes("DATE_FORMAT(e.spent_on, '%Y-%m-%d')"));
    assert.deepStrictEqual(params, [1, 3]);
    reply = [[]];
    assert.strictEqual(await Expense.findById(1, 99), undefined);

    // create: 대기 상태 + 첫 history 줄(시각은 SQL, 이름은 파라미터)
    reply = [{ insertId: 11 }];
    assert.strictEqual(await Expense.create(1, { writerNo: 5, writerName: '홍길동', spentOn: '2026-11-30', category: 'server', amount: 12000, title: '테스트', body: '내용' }), 11);
    ({ sql, params } = last());
    assert.ok(sql.includes("CONVERT_TZ(NOW(), @@session.time_zone, '+09:00')") && sql.includes("'%Y-%m-%d %H:%i'") && sql.includes("'pending'"));
    assert.deepStrictEqual(params, [1, 5, '홍길동', '2026-11-30', 'server', 12000, '테스트', '내용', ' 홍길동 기안']);

    // 본인 대기 건 수정·삭제
    const v = { spentOn: '2026-11-01', category: 'tax', amount: 1, title: 't', body: '' };
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Expense.updateOwnPending(1, 3, 5, v), true);
    assert.ok(last().sql.includes("cp_id = ? AND id = ? AND writer_no = ? AND status = 'pending'"));
    assert.deepStrictEqual(last().params, ['2026-11-01', 'tax', 1, 't', '', 1, 3, 5]);
    assert.strictEqual(await Expense.removeOwnPending(1, 3, 5), true);
    assert.ok(last().sql.startsWith('DELETE') && last().sql.includes("cp_id = ? AND id = ? AND writer_no = ? AND status = 'pending'"));
    assert.deepStrictEqual(last().params, [1, 3, 5]);
    reply = [{ affectedRows: 0 }];
    assert.strictEqual(await Expense.updateOwnPending(1, 3, 5, v), false);
    assert.strictEqual(await Expense.removeOwnPending(1, 3, 5), false);

    // transition: 조건부 전이 + history 한 줄 추가
    reply = [{ affectedRows: 1 }];
    assert.strictEqual(await Expense.transition(1, 3, 'pending', 'approved', '김승인'), true);
    ({ sql, params } = last());
    assert.ok(sql.includes('status = ?') && sql.includes("history = CONCAT(history, '\n', DATE_FORMAT(CONVERT_TZ(NOW()"));
    assert.ok(/WHERE cp_id = \? AND id = \? AND status = \?$/.test(sql));
    assert.deepStrictEqual(params, ['approved', ' 김승인 승인', 1, 3, 'pending']);
    reply = [{ affectedRows: 0 }];
    assert.strictEqual(await Expense.transition(1, 3, 'pending', 'paid', '김승인'), false);

    // pendingCount
    reply = [[{ n: '4' }]];
    assert.strictEqual(await Expense.pendingCount(1), 4);
    assert.ok(last().sql.includes("status = 'pending'") && last().sql.includes('cp_id = ?'));

    console.log('checkExpenseModel OK');
    process.exit(0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});

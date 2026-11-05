// 경비 API·Slack DM 점검: node scripts/checkExpense.js  (모델·Slack 가짜 — 운영 DB·Slack 호출 없음)
const assert = require('assert');
const slackDm = require('../src/utils/slackDm');
const dms = [];
let dmThrows = false;
slackDm.sendDm = async (email, text) => {
    if (dmThrows) throw new Error('slack down');
    dms.push({ email, text });
    return true;
};
// #결제 채널 알림 가짜 (실제 Slack 호출 없음)
const slack = require('../src/utils/slack');
const posts = [];
let postThrows = false;
slack.sendSlackMessage = async (channel, text) => {
    if (postThrows) throw new Error('slack down');
    posts.push({ channel, text });
};

const Expense = require('../src/models/expenseModel');
const Admin = require('../src/models/adminModel');

const people = { 'boss@x.kr': { mb_no: 1, user_name: '대표' }, 'hong@x.kr': { mb_no: 2, user_name: '홍길동' }, 'kim@x.kr': { mb_no: 3, user_name: '김철수' } };
Admin.findByUserId = async (cp, email) => people[email];

const rows = {
    10: { id: 10, writer_no: 2, writer_name: '홍길동', writer_email: 'hong@x.kr', spent_on: '2026-11-03', category: 'etc', amount: 12000, title: '<b>제목', body: '내용', status: 'pending', history: 'h', created_at: 'c' },
    11: { id: 11, writer_no: 2, writer_name: '홍길동', writer_email: 'hong@x.kr', spent_on: '2026-11-03', category: 'etc', amount: 12000, title: '승인건', body: '', status: 'approved', history: 'h', created_at: 'c' },
    12: { id: 12, writer_no: 3, writer_name: '김철수', writer_email: 'kim@x.kr', spent_on: '2026-11-03', category: 'etc', amount: 500, title: '남의것', body: '', status: 'pending', history: 'h', created_at: 'c' },
    13: { id: 13, writer_no: 9, writer_name: '퇴사자', writer_email: null, spent_on: '2026-11-03', category: 'etc', amount: 500, title: '이전', body: '', status: 'pending', history: 'h', created_at: 'c' },
};
const calls = {};
const rec = (name, ret) => async (...a) => ((calls[name] = (calls[name] || []).concat([a])), typeof ret === 'function' ? ret(...a) : ret);
Expense.findById = async (cp, id) => rows[id]; // 다른 회사·없는 id는 undefined
Expense.list = rec('list', () => [rows[10]]);
Expense.summary = rec('summary', { count: 1, total: 12000, byCategory: { etc: 12000 } });
Expense.create = rec('create', 77);
Expense.updateOwnPending = rec('update', true);
Expense.removeOwnPending = rec('remove', true);
Expense.transition = rec('transition', true);
Expense.pendingCount = rec('pendingCount', 4);

const ctrl = require('../src/controllers/workExpenseController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'hong@x.kr', expenseApprover: false, ...req }, res);
    return res;
};
const boss = { userId: 'boss@x.kr', expenseApprover: true };
const input = { spentOn: '2026-11-03', category: 'etc', amount: 12000, title: '  <b>제목  ', body: '' };
const reset = () => (dms.length = 0) || (posts.length = 0) || Object.keys(calls).forEach(k => delete calls[k]);

(async () => {
    // 목록: 일반 직원은 본인 것만(writerNo), 승인 권한자는 전체
    let res = await call(ctrl.list, { query: { month: '2026-11' } });
    assert.strictEqual(calls.list[0][1].writerNo, 2);
    assert.strictEqual(calls.summary[0][1].writerNo, 2);
    assert.deepStrictEqual(Object.keys(res.body.expenses[0]), ['id', 'spentOn', 'category', 'amount', 'title', 'status', 'writerName', 'isMine', 'createdAt']);
    assert.strictEqual(res.body.expenses[0].isMine, true);
    assert.ok(!JSON.stringify(res.body).includes('@'), '이메일이 응답에 있음');
    assert.strictEqual(res.body.canApprove, false);
    reset();
    res = await call(ctrl.list, { ...boss, query: { month: '2026-11' } });
    assert.strictEqual(calls.list[0][1].writerNo, null);
    assert.strictEqual(res.body.canApprove, true);
    assert.strictEqual(res.body.expenses[0].isMine, false);
    assert.strictEqual((await call(ctrl.list, { query: { month: '2026-13' } })).code, 400);
    assert.strictEqual((await call(ctrl.list, { query: { status: 'done' } })).code, 400);

    // 상세
    assert.strictEqual((await call(ctrl.detail, { params: { id: '12' } })).code, 404, '남의 경비를 일반 직원이 봄');
    assert.strictEqual((await call(ctrl.detail, { params: { id: '999' } })).code, 404);
    for (const id of ['abc', '0']) assert.strictEqual((await call(ctrl.detail, { params: { id } })).code, 404, id);
    res = await call(ctrl.detail, { params: { id: '10' } });
    assert.strictEqual(res.code, 200);
    res = await call(ctrl.detail, { ...boss, params: { id: '12' } });
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.expense.body, '');
    assert.strictEqual(res.body.expense.history, 'h');
    assert.ok(!JSON.stringify(res.body).includes('@'));

    // 기안: 본인 정보로 저장, #결제 채널에 알림(개인 DM 없음), 제목 이스케이프
    reset();
    res = await call(ctrl.create, { body: input });
    assert.deepStrictEqual([res.code, res.body], [200, { id: 77 }]);
    assert.deepStrictEqual([calls.create[0][1].writerNo, calls.create[0][1].writerName, calls.create[0][1].title], [2, '홍길동', '<b>제목']);
    assert.deepStrictEqual(posts, [{ channel: process.env.SLACK_SHOP_CHANNEL || '#결제', text: '새 경비 기안: &lt;b&gt;제목 · 12,000원 · 홍길동 → https://hibye.kr/work/expense' }]);
    assert.strictEqual(dms.length, 0);
    assert.strictEqual((await call(ctrl.create, { body: { ...input, amount: -1 } })).code, 400);
    // Slack이 죽어도 기안은 200
    postThrows = true;
    res = await call(ctrl.create, { body: input });
    assert.strictEqual(res.code, 200);
    postThrows = false;

    // 수정·삭제
    reset();
    assert.strictEqual((await call(ctrl.update, { params: { id: '10' }, body: input })).code, 200);
    assert.strictEqual((await call(ctrl.remove, { params: { id: '10' } })).code, 200);
    res = await call(ctrl.update, { params: { id: '11' }, body: input });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'Not pending']);
    res = await call(ctrl.remove, { params: { id: '11' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'Not pending']);
    res = await call(ctrl.update, { ...boss, params: { id: '10' }, body: input });
    assert.deepStrictEqual([res.code, res.body.error], [403, 'Not yours']);
    assert.strictEqual((await call(ctrl.remove, { ...boss, params: { id: '10' } })).code, 403);
    assert.strictEqual((await call(ctrl.update, { params: { id: '12' }, body: input })).code, 404);
    assert.strictEqual((await call(ctrl.remove, { params: { id: '12' } })).code, 404);
    assert.strictEqual((await call(ctrl.update, { params: { id: '10' }, body: { ...input, title: '' } })).code, 400);
    const origUpdate = Expense.updateOwnPending;
    Expense.updateOwnPending = async () => false; // 그 사이 상태가 바뀜
    assert.strictEqual((await call(ctrl.update, { params: { id: '10' }, body: input })).code, 409);
    Expense.updateOwnPending = origUpdate;
    Expense.removeOwnPending = async () => false;
    assert.strictEqual((await call(ctrl.remove, { params: { id: '10' } })).code, 409);

    // 상태 변경
    reset();
    res = await call(ctrl.changeStatus, { params: { id: '10' }, body: { from: 'pending', to: 'approved' } });
    assert.deepStrictEqual([res.code, res.body.error], [403, 'Approver only']);
    assert.ok(!calls.transition, '일반 직원이 transition 호출');
    assert.strictEqual((await call(ctrl.changeStatus, { ...boss, params: { id: '10' }, body: { from: 'pending', to: 'done' } })).code, 400);
    assert.strictEqual((await call(ctrl.changeStatus, { ...boss, params: { id: '10' }, body: { from: 'x', to: 'paid' } })).code, 400);
    assert.strictEqual((await call(ctrl.changeStatus, { ...boss, params: { id: '10' }, body: { from: 'paid', to: 'paid' } })).code, 400);
    assert.strictEqual((await call(ctrl.changeStatus, { ...boss, params: { id: '999' }, body: { from: 'pending', to: 'paid' } })).code, 404);
    assert.ok(!calls.transition);
    res = await call(ctrl.changeStatus, { ...boss, params: { id: '10' }, body: { from: 'pending', to: 'approved' } });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(calls.transition[0], [1, 10, 'pending', 'approved', '대표']);
    assert.deepStrictEqual(dms, [{ email: 'hong@x.kr', text: "경비 '&lt;b&gt;제목'이 승인됐어요 (12,000원)" }]);
    // 바꾼 사람이 기안자 본인이면 DM 없음
    reset();
    await call(ctrl.changeStatus, { userId: 'hong@x.kr', expenseApprover: true, params: { id: '10' }, body: { from: 'pending', to: 'paid' } });
    assert.strictEqual(dms.length, 0);
    // 기안자 이메일 없음(퇴사·이전)이면 DM 없음
    await call(ctrl.changeStatus, { ...boss, params: { id: '13' }, body: { from: 'pending', to: 'paid' } });
    assert.strictEqual(dms.length, 0);
    // 그 사이 상태가 바뀌었으면 409
    Expense.transition = async () => false;
    res = await call(ctrl.changeStatus, { ...boss, params: { id: '10' }, body: { from: 'pending', to: 'approved' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'Status changed']);
    assert.strictEqual(dms.length, 0);

    // 요약 건수
    reset();
    assert.deepStrictEqual((await call(ctrl.summary, {})).body, { pendingExpenses: 0 });
    assert.ok(!calls.pendingCount, '일반 직원에게 pendingCount 호출');
    assert.deepStrictEqual((await call(ctrl.summary, boss)).body, { pendingExpenses: 4 });

    // sendDm 단위 (원본 모듈은 위에서 가짜로 바꿨으므로 새로 불러옴)
    delete require.cache[require.resolve('../src/utils/slackDm')];
    const real = require('../src/utils/slackDm');
    const sent = [];
    const client = { users: { lookupByEmail: async () => ({ ok: true, user: { id: 'U1' } }) }, chat: { postMessage: async a => sent.push(a) } };
    assert.strictEqual(await real.sendDm('a@x.kr', '안녕', client), true);
    assert.deepStrictEqual(sent, [{ channel: 'U1', text: '안녕' }]);
    sent.length = 0;
    const warn = console.warn;
    console.warn = () => {};
    const missing = { users: { lookupByEmail: async () => { throw new Error('users_not_found'); } }, chat: client.chat };
    assert.strictEqual(await real.sendDm('a@x.kr', '안녕', missing), false);
    console.warn = warn;
    assert.strictEqual(sent.length, 0);

    console.log('checkExpense: 모든 점검 통과 ✅');
})().catch(err => {
    console.error('checkExpense 실패 ❌', err);
    process.exit(1);
});

// 관리자 근태 현황·대신 취소 점검: node scripts/checkAdminLeaves.js  (가짜 DB·캘린더·Slack)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');
const { google } = require('googleapis');
const pool = require('../src/config/dbPromise');

let calendarCalls;
google.calendar = () => ({ events: { delete: async ({ eventId }) => calendarCalls.push(`delete:${eventId}`) } });

let queries, leaveRow, userRow;
pool.getConnection = async () => ({
    beginTransaction: async () => queries.push('BEGIN'),
    commit: async () => queries.push('COMMIT'),
    rollback: async () => queries.push('ROLLBACK'),
    release: () => {},
    query: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM lk_vacation/.test(sql)) return [leaveRow ? [leaveRow] : []];
        if (/FROM lk_user/.test(sql)) return [[userRow]];
        return [{ affectedRows: 1 }];
    },
});
const Apply = require('../src/models/applyModel');
Apply.today = () => '2026-11-05';
const find = re => queries.filter(q => q.sql && re.test(q.sql));
const reset = (row = { id: 7, type: 'day', calendar_id: 'evt-7', user_id: 'kim@x', user_name: '김직원', md: '11/05', ymd: '2026-11-05' }) => {
    queries = [];
    calendarCalls = [];
    leaveRow = row;
    userRow = { mb_no: 3, cp_id: 1, user_stip: 4, user_vaca: 1 };
};
const input = { id: 7, cpId: 1, actorMbNo: 1, reason: '날짜 잘못 신청' };

(async () => {
    // ── 모델: 대신 취소 ──
    // 같은 회사 조건으로 조회 (본인 확인 대신)
    reset();
    const result = await Apply.cancelByAdmin(input);
    const select = find(/FROM lk_vacation/)[0];
    assert.ok(/cp_id = \?/.test(select.sql) && /FOR UPDATE/.test(select.sql));
    assert.deepStrictEqual(select.params, [7, 1]);
    assert.deepStrictEqual(result, { userName: '김직원', type: 'day', md: '11/05' });
    // 삭제·직원에게 잔여 복원·장부(변경자 관리자, 사유 메모)·커밋 후 캘린더 삭제
    assert.ok(find(/DELETE FROM lk_vacation WHERE id = \?/).length === 1);
    const restore = find(/UPDATE lk_user SET user_stip = user_stip \+ \?/)[0];
    assert.deepStrictEqual(restore.params, [1, 'kim@x']);
    assert.deepStrictEqual(find(/INSERT INTO lk_balance_log/)[0].params, [1, 3, 1, 'cancel', 4, 5, 1, 1, '연차 취소 11/05 (관리자: 날짜 잘못 신청)']);
    assert.ok(queries.includes('COMMIT'));
    assert.deepStrictEqual(calendarCalls, ['delete:evt-7']);

    // 다른 회사·없는 근태 → 404, 아무것도 지우지 않음
    reset(null);
    let err = await Apply.cancelByAdmin(input).catch(e => e);
    assert.deepStrictEqual([err.status, err.message], [404, 'Leave not found']);
    assert.strictEqual(find(/^DELETE|^UPDATE/).length, 0);
    assert.deepStrictEqual(calendarCalls, []);

    // 지난 날짜 → 400 (오늘은 가능 — 위 성공 케이스가 오늘)
    reset({ id: 7, type: 'day', calendar_id: 'evt-7', user_id: 'kim@x', user_name: '김직원', md: '11/04', ymd: '2026-11-04' });
    err = await Apply.cancelByAdmin(input).catch(e => e);
    assert.deepStrictEqual([err.status, err.message], [400, 'Past date not allowed']);
    assert.strictEqual(find(/^DELETE/).length, 0);
    assert.ok(queries.includes('ROLLBACK'));

    // 재택 → 삭제·캘린더만, 장부 없음
    reset({ id: 8, type: 'home', calendar_id: 'evt-8', user_id: 'kim@x', user_name: '김직원', md: '11/06', ymd: '2026-11-06' });
    await Apply.cancelByAdmin({ ...input, id: 8 });
    assert.strictEqual(find(/INSERT INTO lk_balance_log/).length, 0);
    assert.strictEqual(find(/^DELETE/).length, 1);


    // ── 목록 SQL (pool 가짜) ──
    let q;
    pool.query = async (sql, params) => ((q = { sql, params }), [[]]);
    const Admin = require('../src/models/adminModel');
    await Admin.listLeaves(7, '2026-11-01', '2026-11-30');
    assert.ok(/JOIN lk_user/.test(q.sql) && /u\.cp_id = \?/.test(q.sql) && /v\.date BETWEEN \? AND \?/.test(q.sql));
    assert.ok(!/SELECT\s+\*/i.test(q.sql) && !/user_password|user_birth|user_gender/.test(q.sql));
    assert.deepStrictEqual(q.params, [7, '2026-11-01', '2026-11-30']);

    // ── API (모델·Slack 가짜) ──
    const slack = require('../src/utils/slack');
    let notices = [];
    let slackFails = false;
    slack.sendSlackMessage = async (channel, text) => {
        if (slackFails) throw new Error('slack down');
        notices.push({ channel, text });
    };
    let listArgs;
    Admin.listLeaves = async (...args) => ((listArgs = args), [{ id: 1 }]);
    Admin.findByUserId = async (cpId, userId) => (cpId === 1 && userId === 'me@x' ? { mb_no: 1, user_name: '관리자' } : undefined);
    let cancelArgs;
    let cancelImpl = async () => ({ userName: '김<b>직원', type: 'half', md: '11/05' });
    Apply.cancelByAdmin = async args => ((cancelArgs = args), cancelImpl(args));

    const admin = require('../src/controllers/adminController');
    const call = async (fn, req) => {
        const res = { code: 200 };
        res.status = c => ((res.code = c), res);
        res.json = b => ((res.body = b), res);
        await fn({ userId: 'me@x', userCpId: 1, userRole: 'admin', params: {}, query: {}, body: {}, ...req }, res);
        return res;
    };

    // 목록: 기간 검증 (실존 날짜, from ≤ to, 366일 이하), 요청자 회사
    let res = await call(admin.listLeaves, { query: { from: '2026-11-01', to: '2026-11-30' } });
    assert.deepStrictEqual(res.body, { leaves: [{ id: 1 }] });
    assert.deepStrictEqual(listArgs, [1, '2026-11-01', '2026-11-30']);
    res = await call(admin.listLeaves, { query: { from: '2026-01-01', to: '2026-12-31' } });
    assert.strictEqual(res.code, 200, '올해 전체');
    for (const query of [{}, { from: '2026-11-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-11-30', to: '2026-11-01' }, { from: '2025-01-01', to: '2026-12-31' }]) {
        res = await call(admin.listLeaves, { query });
        assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid range'], JSON.stringify(query));
    }

    // 대신 취소: 사유 필수, 번호 형식
    for (const reason of [undefined, '', '   ', 'a'.repeat(201)]) {
        cancelArgs = undefined;
        res = await call(admin.cancelLeave, { params: { id: '7' }, body: { reason } });
        assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid reason']);
        assert.strictEqual(cancelArgs, undefined);
    }
    res = await call(admin.cancelLeave, { params: { id: 'x' }, body: { reason: '사유' } });
    assert.deepStrictEqual([res.code, res.body.error], [404, 'Leave not found']);

    // 성공 → 요청자 회사·관리자 번호·trim 사유, Slack 기록(이스케이프)
    notices = [];
    res = await call(admin.cancelLeave, { params: { id: '7' }, body: { reason: ' 날짜 <잘못> 신청 ' } });
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);
    assert.deepStrictEqual(cancelArgs, { id: 7, cpId: 1, actorMbNo: 1, reason: '날짜 <잘못> 신청' });
    assert.deepStrictEqual(notices, [{ channel: '#hibye-관리', text: '관리자님이 김&lt;b&gt;직원님의 11/05 반차을(를) 취소했어요 — 사유: 날짜 &lt;잘못&gt; 신청' }]);

    // 모델 오류 코드는 그대로 (404·지난 날짜 400), Slack 없음
    for (const [status, message] of [[404, 'Leave not found'], [400, 'Past date not allowed']]) {
        notices = [];
        cancelImpl = async () => {
            throw new Apply.ApplyError(status, message);
        };
        res = await call(admin.cancelLeave, { params: { id: '7' }, body: { reason: '사유' } });
        assert.deepStrictEqual([res.code, res.body.error], [status, message]);
        assert.deepStrictEqual(notices, []);
    }
    // Slack 실패해도 이미 취소된 건은 성공 응답
    cancelImpl = async () => ({ userName: '김직원', type: 'day', md: '11/05' });
    slackFails = true;
    res = await call(admin.cancelLeave, { params: { id: '7' }, body: { reason: '사유' } });
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);

    console.log('checkAdminLeaves ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkAdminLeaves 실패 ❌', err.message);
    process.exit(1);
});

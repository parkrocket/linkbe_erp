// 근태 신청·취소 점검: node scripts/checkApply.js  (DB·Google 캘린더는 가짜로 대체)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { google } = require('googleapis');
const pool = require('../src/config/dbPromise');

// ── 가짜 캘린더 ──
let calendarCalls;
google.calendar = () => ({
    events: {
        insert: async () => (calendarCalls.push('insert'), { data: { id: 'evt-new' } }),
        delete: async ({ eventId }) => calendarCalls.push(`delete:${eventId}`),
    },
});

// ── 가짜 DB 연결: SQL 패턴별 응답, 실행된 쿼리 기록 ──
let queries, fixtures;
pool.getConnection = async () => ({
    beginTransaction: async () => queries.push('BEGIN'),
    commit: async () => queries.push('COMMIT'),
    rollback: async () => queries.push('ROLLBACK'),
    release: () => {},
    query: async (sql, params) => {
        queries.push({ sql, params });
        for (const [pattern, result] of fixtures) {
            if (pattern.test(sql)) {
                if (result instanceof Error) throw result;
                return [result];
            }
        }
        return [[]];
    },
});

const Apply = require('../src/models/applyModel');
const ran = sql => queries.some(q => q.sql && sql.test(q.sql));
const statusOf = p => p.then(() => 200, e => e.status || 500);

function reset(user = { user_name: '홍길동', user_stip: 5, user_vaca: 2 }, extra = []) {
    calendarCalls = [];
    queries = [];
    fixtures = [[/FROM lk_user/, [user]], ...extra];
}

(async () => {
    // 신청: 입력 검증
    reset();
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'gtw' })), 400);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-13-40', type: 'day' })), 400);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: 'abc', type: 'day' })), 400);
    assert.deepStrictEqual(calendarCalls, [], '검증 실패 시 캘린더 호출 금지');

    // 신청: 잔여 부족 → 409, 캘린더 일정 만들지 않음
    reset({ user_name: '홍길동', user_stip: 0, user_vaca: 0 });
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'day' })), 409);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'vacation' })), 409);
    assert.ok(!calendarCalls.includes('insert'), '잔여 부족이면 캘린더 일정 만들지 않음');
    reset({ user_name: '홍길동', user_stip: 0.5, user_vaca: 0 });
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'half' })), 200, '반차는 0.5일로 신청 가능');

    // 신청: 같은 날 중복 → 409
    reset(undefined, [[/FROM lk_vacation/, [{ id: 9 }]]]);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'home' })), 409);
    assert.deepStrictEqual(calendarCalls, []);

    // 신청: 연차 성공 — 토큰 주인으로 차감·저장, 트랜잭션 커밋
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 42 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-03', type: 'day' }), 42);
    const update = queries.find(q => q.sql && /UPDATE lk_user SET user_stip = user_stip - \?/.test(q.sql));
    assert.ok(update && update.params[0] === 1 && update.params[1] === 'me', '연차 1일 차감');
    assert.ok(queries.includes('COMMIT'));

    // 신청: 재택 — 차감 없음 (기존 코드는 없는 user_home 컬럼을 수정해 항상 실패)
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 43 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-03', type: 'home' }), 43);
    assert.ok(!ran(/UPDATE lk_user/), '재택은 차감하지 않음');
    assert.ok(!queries.some(q => q.sql && /user_home/.test(q.sql)));

    // 신청: 재택은 같은 달 최대 2회 — 이미 2회면 409, 캘린더 일정 만들지 않음
    reset(undefined, [[/COUNT\(\*\)/i, [{ count: 2 }]]]);
    const homeLimit = await Apply.insert({ userId: 'me', date: '2026-11-20', type: 'home' }).catch(e => e);
    assert.strictEqual(homeLimit.status, 409, '재택 월 2회 초과 차단');
    assert.strictEqual(homeLimit.message, 'Monthly home limit exceeded');
    assert.deepStrictEqual(calendarCalls, []);
    const countQuery = queries.find(q => q.sql && /COUNT\(\*\)/i.test(q.sql));
    assert.ok(/type = 'home'/.test(countQuery.sql) && countQuery.params.includes('me'), '본인의 재택만 셈');
    assert.ok(countQuery.params.includes('2026-11-20'), '신청 날짜의 달 기준');

    // 신청: 재택 1회 사용 상태면 신청 가능
    reset(undefined, [[/COUNT\(\*\)/i, [{ count: 1 }]], [/INSERT INTO lk_vacation/, { insertId: 45 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-21', type: 'home' }), 45);

    // 신청: 연차는 재택 횟수와 무관
    reset(undefined, [[/COUNT\(\*\)/i, [{ count: 5 }]], [/INSERT INTO lk_vacation/, { insertId: 46 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-22', type: 'day' }), 46);

    // 신청: 지난 날짜 허용
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 44 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2020-01-02', type: 'home' }), 44);

    // 신청: 저장 실패 → 롤백 + 만든 캘린더 일정 삭제
    reset(undefined, [[/INSERT INTO lk_vacation/, new Error('db down')]]);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'day' })), 500);
    assert.ok(queries.includes('ROLLBACK'));
    assert.ok(calendarCalls.includes('delete:evt-new'), '실패 시 캘린더 일정 정리');

    // 취소: 본인 것이 아니면 404, 아무것도 지우지 않음
    reset(undefined, [[/FROM lk_vacation/, []]]);
    assert.strictEqual(await statusOf(Apply.cancel({ id: 7, userId: 'me' })), 404);
    assert.ok(!ran(/DELETE/) && calendarCalls.length === 0);
    const owner = queries.find(q => q.sql && /FROM lk_vacation/.test(q.sql));
    assert.deepStrictEqual(owner.params, [7, 'me'], '본인 소유 확인 (id + 토큰 주인)');

    // 취소: 반차 — DB의 종류·캘린더 ID 사용, 본인에게 0.5일 복원
    reset(undefined, [[/FROM lk_vacation/, [{ id: 7, type: 'half', calendar_id: 'evt-7' }]]]);
    await Apply.cancel({ id: 7, userId: 'me' });
    const restore = queries.find(q => q.sql && /UPDATE lk_user SET user_stip = user_stip \+ \?/.test(q.sql));
    assert.ok(restore && restore.params[0] === 0.5 && restore.params[1] === 'me');
    assert.ok(ran(/DELETE FROM lk_vacation WHERE id = \?/) && queries.includes('COMMIT'));
    assert.ok(calendarCalls.includes('delete:evt-7'));

    // 취소: 재택 — 복원 없음
    reset(undefined, [[/FROM lk_vacation/, [{ id: 8, type: 'home', calendar_id: null }]]]);
    await Apply.cancel({ id: 8, userId: 'me' });
    assert.ok(!ran(/UPDATE lk_user/));

    // 컨트롤러: 요청 바디의 userId는 무시하고 토큰 주인 사용, 오류 코드 그대로 응답
    const controller = require('../src/controllers/applyController');
    const fakeRes = () => {
        const r = { code: 200 };
        r.status = c => ((r.code = c), r);
        r.json = b => ((r.body = b), r);
        return r;
    };
    let args;
    Apply.insert = async a => ((args = a), 50);
    let res = fakeRes();
    await controller.applyIn({ body: { userId: 'other', date: '2026-11-03', type: 'day' }, userId: 'me' }, res);
    assert.deepStrictEqual(args, { userId: 'me', date: '2026-11-03', type: 'day' });
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.gtwSuccess, true);

    Apply.insert = async () => {
        throw new Apply.ApplyError(409, 'Insufficient balance');
    };
    res = fakeRes();
    await controller.applyIn({ body: {}, userId: 'me' }, res);
    assert.strictEqual(res.code, 409, '실패를 200으로 숨기지 않음');
    assert.strictEqual(res.body.gtwSuccess, false);

    Apply.cancel = async a => (args = a);
    res = fakeRes();
    await controller.applyCancel({ body: { id: 7, userId: 'other', type: 'day', calendar_id: 'x' }, userId: 'me' }, res);
    assert.deepStrictEqual(args, { id: 7, userId: 'me' });
    assert.strictEqual(res.body.vacationCancelSuccess, true);

    Apply.cancel = async () => {
        throw new Error('db down');
    };
    res = fakeRes();
    await controller.applyCancel({ body: { id: 7 }, userId: 'me' }, res);
    assert.strictEqual(res.code, 500);

    console.log('checkApply ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkApply 실패 ❌', err.message);
    process.exit(1);
});

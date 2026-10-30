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
// 테스트가 날짜 경과로 깨지지 않도록 '오늘'을 고정 (테스트 날짜들은 이보다 뒤)
Apply.today = () => '2026-10-29';
const ran = sql => queries.some(q => q.sql && sql.test(q.sql));
const statusOf = p => p.then(() => 200, e => e.status || 500);

function reset(user = { mb_no: 5, cp_id: 1, user_name: '홍길동', user_stip: 5, user_vaca: 2 }, extra = []) {
    calendarCalls = [];
    queries = [];
    // 실제 DB 행처럼 상태 기본값 approved (각 테스트는 필요한 값만 덮어씀)
    fixtures = [[/FROM lk_user/, [{ user_status: 'approved', ...user }]], ...extra];
}

(async () => {
    // 신청: 승인되지 않은 계정(대기·거절·비활성) → 403, 캘린더 일정 만들지 않음
    for (const status of ['pending', 'rejected', 'inactive']) {
        reset({ user_name: '홍길동', user_stip: 5, user_vaca: 2, user_status: status });
        const blocked = await Apply.insertMany({ userId: 'me', dates: ['2026-11-18'], type: 'day' }).catch(e => e);
        assert.strictEqual(blocked.status, 403, status);
        assert.strictEqual(blocked.message, 'Account not approved');
        assert.deepStrictEqual(calendarCalls, []);
    }

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
    reset(undefined, [[/COUNT\(\*\)/i, [{ ym: '2026-11', count: 2 }]]]);
    const homeLimit = await Apply.insert({ userId: 'me', date: '2026-11-20', type: 'home' }).catch(e => e);
    assert.strictEqual(homeLimit.status, 409, '재택 월 2회 초과 차단');
    assert.strictEqual(homeLimit.message, 'Monthly home limit exceeded');
    assert.deepStrictEqual(calendarCalls, []);
    const countQuery = queries.find(q => q.sql && /COUNT\(\*\)/i.test(q.sql));
    assert.ok(/type = 'home'/.test(countQuery.sql) && countQuery.params.includes('me'), '본인의 재택만 셈');
    assert.ok(JSON.stringify(countQuery.params).includes('2026-11'), '신청 날짜의 달 기준');

    // 신청: 재택 1회 사용 상태면 신청 가능
    reset(undefined, [[/COUNT\(\*\)/i, [{ ym: '2026-11', count: 1 }]], [/INSERT INTO lk_vacation/, { insertId: 45 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-23', type: 'home' }), 45);

    // 신청: 연차는 재택 횟수와 무관
    reset(undefined, [[/COUNT\(\*\)/i, [{ ym: '2026-11', count: 5 }]], [/INSERT INTO lk_vacation/, { insertId: 46 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-11-24', type: 'day' }), 46);

    // ── 여러 날 신청 ──
    // 주말은 신청 불가 (2026-11-21 토, 11-22 일)
    reset();
    const weekend = await Apply.insertMany({ userId: 'me', dates: ['2026-11-20', '2026-11-21'], type: 'day' }).catch(e => e);
    assert.strictEqual(weekend.status, 400);
    assert.strictEqual(weekend.message, 'Weekend not allowed');
    // 빈 목록·같은 날짜 중복 선택 → 400
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: [], type: 'day' })), 400);
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-11-18'], type: 'day' })), 400);
    assert.deepStrictEqual(calendarCalls, []);

    // 잔여는 선택한 날 전체 합으로 검사 — 연차 2일인데 3일 신청 → 409, 아무것도 만들지 않음
    reset({ user_name: '홍길동', user_stip: 2, user_vaca: 0 });
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-11-19', '2026-11-20'], type: 'day' })), 409);
    assert.deepStrictEqual(calendarCalls, []);

    // 하나라도 이미 신청한 날이면 전체 거절
    reset(undefined, [[/FROM lk_vacation WHERE user_id = \? AND date IN/, [{ id: 3 }]]]);
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-11-19'], type: 'day' })), 409);
    assert.deepStrictEqual(calendarCalls, []);

    // 재택은 달별로 기존 + 이번 선택 합산 — 11월 1회 사용 + 11월 2일 선택 → 409
    reset(undefined, [[/COUNT\(\*\)/i, [{ ym: '2026-11', count: 1 }]]]);
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-11-19'], type: 'home' })), 409);
    // 11월 1회 사용 + 11월 1일 + 12월 1일 → 가능
    reset(undefined, [[/COUNT\(\*\)/i, [{ ym: '2026-11', count: 1 }]], [/INSERT INTO lk_vacation/, { insertId: 60 }]]);
    assert.strictEqual((await Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-12-02'], type: 'home' })).length, 2);

    // 연차 3일 성공 — 한 번에 3일 차감, 날짜마다 캘린더 일정·행 저장, 한 트랜잭션
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 70 }]]);
    const ids = await Apply.insertMany({ userId: 'me', dates: ['2026-11-20', '2026-11-18', '2026-11-19'], type: 'day' });
    assert.strictEqual(ids.length, 3);
    const multiUpdate = queries.find(q => q.sql && /UPDATE lk_user SET user_stip = user_stip - \?/.test(q.sql));
    assert.strictEqual(multiUpdate.params[0], 3, '3일 차감');
    assert.strictEqual(calendarCalls.filter(c => c === 'insert').length, 3);
    assert.strictEqual(queries.filter(q => q.sql && /INSERT INTO lk_vacation/.test(q.sql)).length, 3);
    assert.strictEqual(queries.filter(q => q === 'COMMIT').length, 1);

    // 중간 실패 → 전체 롤백 + 이미 만든 캘린더 일정 모두 삭제
    let inserts = 0;
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 80 }]]);
    pool.getConnection = (orig => async () => {
        const conn = await orig();
        const q = conn.query;
        conn.query = async (sql, params) => {
            if (/INSERT INTO lk_vacation/.test(sql) && ++inserts === 2) throw new Error('db down');
            return q(sql, params);
        };
        return conn;
    })(pool.getConnection);
    assert.strictEqual(await statusOf(Apply.insertMany({ userId: 'me', dates: ['2026-11-18', '2026-11-19'], type: 'day' })), 500);
    assert.ok(queries.includes('ROLLBACK'));
    assert.strictEqual(calendarCalls.filter(c => c.startsWith('delete:')).length, 2, '만든 일정 2건 모두 정리');

    // 신청: 오늘 이전 날짜 불가(사용자 결정 변경), 오늘은 가능 — 오늘은 한국 시간 기준
    reset();
    const past = await Apply.insertMany({ userId: 'me', dates: ['2026-10-28', '2026-10-30'], type: 'home' }).catch(e => e);
    assert.strictEqual(past.status, 400);
    assert.strictEqual(past.message, 'Past date not allowed');
    assert.deepStrictEqual(calendarCalls, []);
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 44 }]]);
    assert.strictEqual(await Apply.insert({ userId: 'me', date: '2026-10-29', type: 'home' }), 44, '오늘은 신청 가능');
    // 한국 시간 오늘 계산: UTC 2026-10-28 15:30 = KST 10-29 00:30
    assert.strictEqual(Apply.kstToday(new Date('2026-10-28T15:30:00Z')), '2026-10-29');
    assert.strictEqual(Apply.kstToday(new Date('2026-10-28T14:59:00Z')), '2026-10-28');

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

    // ── 잔여 장부 (관리자 2단계) ──
    const logs = () => queries.filter(q => q.sql && /INSERT INTO lk_balance_log/.test(q.sql));
    // 연차 3일 신청 → 장부 1행(전·후, 본인이 변경자), 커밋 전에 같은 트랜잭션으로
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 90 }]]);
    await Apply.insertMany({ userId: 'me', dates: ['2026-11-20', '2026-11-18', '2026-11-19'], type: 'day' });
    assert.strictEqual(logs().length, 1);
    assert.deepStrictEqual(logs()[0].params, [1, 5, 5, 'apply', 5, 2, 2, 2, '연차 신청 11/18, 11/19, 11/20']);
    assert.ok(queries.indexOf(logs()[0]) < queries.indexOf('COMMIT'), '장부는 커밋 전에 기록');
    // 반차 0.5일
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 91 }]]);
    await Apply.insert({ userId: 'me', date: '2026-11-03', type: 'half' });
    assert.deepStrictEqual(logs()[0].params, [1, 5, 5, 'apply', 5, 4.5, 2, 2, '반차 신청 11/03']);
    // 휴가는 user_vaca만 변화
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 92 }]]);
    await Apply.insert({ userId: 'me', date: '2026-11-03', type: 'vacation' });
    assert.deepStrictEqual(logs()[0].params, [1, 5, 5, 'apply', 5, 5, 2, 1, '휴가 신청 11/03']);
    // 재택은 차감이 없어 기록하지 않음
    reset(undefined, [[/INSERT INTO lk_vacation/, { insertId: 93 }]]);
    await Apply.insert({ userId: 'me', date: '2026-11-03', type: 'home' });
    assert.strictEqual(logs().length, 0);
    // 장부 기록 실패 → 신청 전체 롤백 + 캘린더 일정 정리
    reset(undefined, [[/INSERT INTO lk_balance_log/, new Error('log down')], [/INSERT INTO lk_vacation/, { insertId: 94 }]]);
    assert.strictEqual(await statusOf(Apply.insert({ userId: 'me', date: '2026-11-03', type: 'day' })), 500);
    assert.ok(queries.includes('ROLLBACK') && !queries.includes('COMMIT'));
    assert.ok(calendarCalls.includes('delete:evt-new'));
    // 취소 반차 → 사용자 행 잠금 후 복원, 장부 1행
    reset(undefined, [[/FROM lk_vacation/, [{ id: 7, type: 'half', calendar_id: 'evt-7', md: '11/05' }]]]);
    await Apply.cancel({ id: 7, userId: 'me' });
    assert.ok(ran(/FROM lk_user WHERE user_id = \? FOR UPDATE/), '취소도 사용자 행 잠금');
    assert.strictEqual(logs().length, 1);
    assert.deepStrictEqual(logs()[0].params, [1, 5, 5, 'cancel', 5, 5.5, 2, 2, '반차 취소 11/05']);
    // 취소 재택 → 기록 없음
    reset(undefined, [[/FROM lk_vacation/, [{ id: 8, type: 'home', calendar_id: null, md: '11/05' }]]]);
    await Apply.cancel({ id: 8, userId: 'me' });
    assert.strictEqual(logs().length, 0);

    // 컨트롤러: 요청 바디의 userId는 무시하고 토큰 주인 사용, 오류 코드 그대로 응답
    const controller = require('../src/controllers/applyController');
    const fakeRes = () => {
        const r = { code: 200 };
        r.status = c => ((r.code = c), r);
        r.json = b => ((r.body = b), r);
        return r;
    };
    let args;
    Apply.insertMany = async a => ((args = a), [50]);
    let res = fakeRes();
    // 기존 react-app: date 하나
    await controller.applyIn({ body: { userId: 'other', date: '2026-11-03', type: 'day' }, userId: 'me' }, res);
    assert.deepStrictEqual(args, { userId: 'me', dates: ['2026-11-03'], type: 'day' });
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.gtwSuccess, true);
    // 새 화면: dates 여러 개
    res = fakeRes();
    await controller.applyIn({ body: { dates: ['2026-11-18', '2026-11-19'], type: 'day' }, userId: 'me' }, res);
    assert.deepStrictEqual(args, { userId: 'me', dates: ['2026-11-18', '2026-11-19'], type: 'day' });

    Apply.insertMany = async () => {
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

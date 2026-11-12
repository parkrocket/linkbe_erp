// vacation/list 점검: node scripts/checkVacationList.js
// 토큰 주인(req.userId)만 조회하고 비밀번호 해시를 내려보내지 않아야 함 (DB 없이 모델을 가짜로 대체)
const assert = require('assert');
const Vacation = require('../src/models/vacationModel');
const controller = require('../src/controllers/vacationController');

let queriedId;
Vacation.findByIdAsync = async id => {
    queriedId = id;
    return [{ id: 1, user_id: id, type: 'day', date: '2026-11-03', user_password: '$2b$hash' }];
};

(async () => {
    let body;
    const res = { json: b => (body = b) };
    await controller.list({ body: { user_id: 'someone@else' }, userId: 'me@linkbe' }, res);

    assert.strictEqual(queriedId, 'me@linkbe', '요청 바디가 아닌 토큰 주인으로 조회해야 함');
    assert.ok(!('user_password' in body.vacationList[0]), '비밀번호 해시가 응답에 포함됨');

    // DB 오류 시 프로세스가 죽지 않고 500 응답 (처리 안 된 rejection 금지)
    Vacation.findByIdAsync = async () => {
        throw new Error('db down');
    };
    let status;
    const errRes = { status: s => ((status = s), errRes), json: b => (body = b) };
    await controller.list({ body: {}, userId: 'me@linkbe' }, errRes);
    assert.strictEqual(status, 500, 'DB 오류는 500이어야 함');
    assert.strictEqual(body.vacationSuccess, false);

    // 오늘 날짜 근태도 '다가오는 일정'에 포함 (DATE >= NOW()는 오늘을 제외함)
    const db = require('../src/config/db');
    let sql;
    db.query = (q, p, cb) => ((sql = q), cb(null, []));
    delete require.cache[require.resolve('../src/models/vacationModel')];
    const FreshVacation = require('../src/models/vacationModel');
    await new Promise(r => FreshVacation.findById('me@linkbe', r));
    assert.ok(/date\s*>=\s*CURDATE\(\)/i.test(sql), '오늘 근태 포함: CURDATE() 기준이어야 함');

    // vacation/cancel: 요청 바디의 stipNumber·vacaNumber·userId로 잔여를 임의로 늘리던 경로 → 안전한 취소로 위임
    const Apply = require('../src/models/applyModel');
    let cancelArgs;
    Apply.cancel = async a => (cancelArgs = a);
    const cancelRes = { status: () => cancelRes, json: b => (body = b) };
    await controller.cancel(
        { body: { id: 7, stipNumber: 100, vacaNumber: 100, userId: 'other', type: 'day', calendar_id: 'x' }, userId: 'me@linkbe' },
        cancelRes,
    );
    assert.deepStrictEqual(cancelArgs, { id: 7, userId: 'me@linkbe' }, '본인 근태 취소만, 바디의 일수·사용자 무시');
    assert.strictEqual(body.vacationCancelSuccess, true);

    // vacation/team: 같은 회사(토큰)·본인 제외·기간, 이름·종류·날짜만, 기간 62일 이하
    const pool = require('../src/config/dbPromise');
    let teamQuery;
    pool.query = async (q, p) => ((teamQuery = { q, p }), [[{ date: '2026-11-18', type: 'day', name: '김직원' }]]);
    const call = async query => {
        const r = { code: 200 };
        r.status = c => ((r.code = c), r);
        r.json = b => ((r.body = b), r);
        await controller.team({ query, userId: 'me@linkbe', userCpId: 3 }, r);
        return r;
    };
    let teamRes = await call({ from: '2026-11-01', to: '2026-11-30' });
    assert.deepStrictEqual([teamRes.code, teamRes.body], [200, { leaves: [{ date: '2026-11-18', type: 'day', name: '김직원' }] }]);
    assert.deepStrictEqual(teamQuery.p, [3, 'me@linkbe', '2026-11-01', '2026-11-30'], '토큰의 회사·본인 제외·기간');
    assert.ok(/u\.cp_id = \?/.test(teamQuery.q) && /v\.user_id <> \?/.test(teamQuery.q));
    assert.ok(!/SELECT \*|u\.\*|user_password|user_birth|user_id AS/.test(teamQuery.q), '이름·종류·날짜만');
    for (const query of [{}, { from: 'x', to: 'y' }, { from: '2026-11-30', to: '2026-11-01' }, { from: '2026-01-01', to: '2026-06-01' }]) {
        teamQuery = null;
        teamRes = await call(query);
        assert.deepStrictEqual([teamRes.code, teamRes.body.error, teamQuery], [400, 'Invalid range', null], JSON.stringify(query));
    }
    pool.query = async () => {
        throw new Error('db down');
    };
    assert.strictEqual((await call({ from: '2026-11-01', to: '2026-11-30' })).code, 500);

    console.log('checkVacationList ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkVacationList 실패 ❌', err.message);
    process.exit(1);
});

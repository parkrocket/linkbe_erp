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

    console.log('checkVacationList ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkVacationList 실패 ❌', err.message);
    process.exit(1);
});

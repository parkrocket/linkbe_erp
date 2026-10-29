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
    console.log('checkVacationList ✅');
})().catch(err => {
    console.error('checkVacationList 실패 ❌', err.message);
    process.exit(1);
});

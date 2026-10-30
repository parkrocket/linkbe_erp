// 민감 필드 제거 점검: node scripts/checkSafeUser.js
const assert = require('assert');
const { toSafeUser } = require('../src/utils/safeUser');

const row = { user_id: 'a@b.c', user_name: '홍', user_password: '$2b$hash', start_time: null };
assert.deepStrictEqual(toSafeUser(row), { user_id: 'a@b.c', user_name: '홍', start_time: null });
assert.ok(!('user_password' in toSafeUser({ user_password: 'x' })));

// 개인정보·토큰 칸도 직원용 응답에서 제거 (관리자 API는 명시 컬럼으로 별도 조회)
const full = { user_id: 'a@b.c', user_password: 'h', user_birth: '1990-01-01', user_gender: 'male', calendar_token: 't', user_doe: '2020-01-01' };
assert.deepStrictEqual(toSafeUser(full), { user_id: 'a@b.c', user_doe: '2020-01-01' });

// 근무기록 목록 API: 모든 직원 행이 나가므로 행마다 제거 (기존: 비밀번호 해시 그대로 응답)
const List = require('../src/models/listModel');
List.findByList = (date, cb) => cb(null, [{ ...full }]);
List.findByListMember = (date, cb) => cb(null, [{ ...full }, { ...full, user_id: 'b@b.c' }]);
const list = require('../src/controllers/listController');
const respond = fn =>
    new Promise(resolve => {
        const res = { status: () => res, json: body => resolve(body) };
        fn({ body: { date: '2026-10-30' } }, res);
    });
(async () => {
    for (const fn of [list.lists, list.listsMember]) {
        const body = await respond(fn);
        assert.strictEqual(body.listSuccess, true);
        assert.ok(body.list.length > 0);
        for (const r of body.list) {
            for (const key of ['user_password', 'user_birth', 'user_gender', 'calendar_token']) assert.ok(!(key in r), key);
        }
    }
    console.log('checkSafeUser ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkSafeUser 실패 ❌', err.message);
    process.exit(1);
});

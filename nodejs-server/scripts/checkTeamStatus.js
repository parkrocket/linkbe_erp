// gtwStatusAll(팀 근태) 점검: node scripts/checkTeamStatus.js
// - SELECT * 조인으로 user_id가 NULL로 덮이던 문제 → 명시적 컬럼
// - 회사는 요청 바디 cpId가 아닌 토큰 주인의 회사로
const assert = require('assert');
const db = require('../src/config/db');

let captured;
db.query = (sql, params, cb) => {
    captured = { sql, params };
    cb(null, []);
};

const controller = require('../src/controllers/gtwController');

let body;
controller.gtwStatusAllWeb(
    { body: { date: '2026-10-29', cpId: 999 }, userId: 'me@linkbe' },
    { status: () => ({ json: b => (body = b) }) },
);

assert.ok(!/SELECT\s+\*/i.test(captured.sql), 'SELECT * 사용 금지 (user_id 충돌)');
assert.ok(/user\.user_id/.test(captured.sql), 'lk_user.user_id를 명시적으로 선택해야 함');
assert.ok(!captured.params.includes(999), '요청 바디 cpId를 쓰면 안 됨');
assert.ok(captured.params.includes('me@linkbe'), '토큰 주인 기준으로 회사를 정해야 함');
assert.deepStrictEqual(body.gtw, []);
console.log('checkTeamStatus ✅');
process.exit(0);

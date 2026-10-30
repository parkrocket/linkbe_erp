// 관리자 모델 SQL 점검: node scripts/checkAdminModel.js  (pool.query를 가로채 SQL·파라미터만 확인, DB 접속 없음)
// checkAdmin.js는 모델 전체를 가짜로 쓰므로, 실제 SQL의 '같은 회사' 조건과 민감 컬럼 제외는 여기서 고정
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let calls = [];
pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return [[{ n: 0 }]];
};
const Admin = require('../src/models/adminModel');

const last = () => calls[calls.length - 1];
const scoped = (call, cpId) => /\bcp_id\s*=\s*\?/.test(call.sql) && call.params[0] === cpId;

(async () => {
    for (const [name, run] of [
        ['listUsers', () => Admin.listUsers(7)],
        ['listUsers(status)', () => Admin.listUsers(7, 'pending')],
        ['pendingCount', () => Admin.pendingCount(7)],
        ['findByMbNo', () => Admin.findByMbNo(7, 3)],
        ['findByUserId', () => Admin.findByUserId(7, 'a@b.c')],
        ['countApprovedAdmins', () => Admin.countApprovedAdmins(7)],
    ]) {
        calls = [];
        await run();
        assert.ok(scoped(last(), 7), `${name}: 회사(cp_id) 조건 누락`);
        assert.ok(!/SELECT\s+\*/i.test(last().sql), `${name}: SELECT * 금지`);
        assert.ok(!/user_password/.test(last().sql), `${name}: 비밀번호 컬럼 조회 금지`);
    }

    // 조회 대상 범위: mb_no·user_id도 파라미터로 (문자열 연결 금지)
    calls = [];
    await Admin.findByMbNo(7, 3);
    assert.deepStrictEqual(last().params, [7, 3]);
    await Admin.listUsers(7, 'pending');
    assert.deepStrictEqual(last().params, [7, 'pending']);

    // 변경은 파라미터 바인딩
    await Admin.updateStatus(3, 'inactive');
    assert.ok(/UPDATE lk_user SET user_status = \? WHERE mb_no = \?/.test(last().sql));
    assert.deepStrictEqual(last().params, ['inactive', 3]);
    await Admin.updateRole(3, 'admin');
    assert.deepStrictEqual(last().params, ['admin', 3]);

    // 승인된 관리자만 셈
    await Admin.countApprovedAdmins(7);
    assert.ok(/user_role = 'admin'/.test(last().sql) && /user_status = 'approved'/.test(last().sql));

    console.log('checkAdminModel ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkAdminModel 실패 ❌', err.message);
    process.exit(1);
});

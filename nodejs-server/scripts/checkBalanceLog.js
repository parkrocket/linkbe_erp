// 잔여 장부 모델 SQL 점검: node scripts/checkBalanceLog.js  (가짜 연결·pool, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let poolCalls = [];
pool.query = async (sql, params) => {
    poolCalls.push({ sql, params });
    return [[]];
};
const BalanceLog = require('../src/models/balanceLog');

const fakeConn = () => {
    const calls = [];
    return { calls, query: async (sql, params) => (calls.push({ sql, params }), [{ insertId: 1 }]) };
};

(async () => {
    // insert: 호출자의 트랜잭션 연결로 실행 (pool 직접 사용 금지 — 롤백에 묶이지 않음)
    const conn = fakeConn();
    await BalanceLog.insert(conn, {
        cpId: 1,
        mbNo: 5,
        actorMbNo: 2,
        kind: 'admin',
        before: { stip: 2.5, vaca: 0 },
        after: { stip: 15, vaca: 3 },
        memo: '2027년 연차 부여',
    });
    assert.strictEqual(conn.calls.length, 1);
    assert.strictEqual(poolCalls.length, 0, 'pool이 아니라 전달한 conn 사용');
    assert.ok(/INSERT INTO lk_balance_log/.test(conn.calls[0].sql));
    assert.deepStrictEqual(conn.calls[0].params, [1, 5, 2, 'admin', 2.5, 15, 0, 3, '2027년 연차 부여']);

    // insert: 메모 200자 초과는 잘라서 저장 (VARCHAR(200) 오류로 신청이 실패하지 않게)
    const long = fakeConn();
    await BalanceLog.insert(long, {
        cpId: 1, mbNo: 5, actorMbNo: 5, kind: 'apply',
        before: { stip: 1, vaca: 1 }, after: { stip: 0, vaca: 1 }, memo: '가'.repeat(250),
    });
    const memo = long.calls[0].params[8];
    assert.strictEqual(memo.length, 200);
    assert.ok(memo.endsWith('…'));

    // listByMember: 같은 회사·직원 조건, 최근순, 민감 컬럼 없음
    await BalanceLog.listByMember(7, 3);
    const list = poolCalls[poolCalls.length - 1];
    assert.ok(/cp_id = \?/.test(list.sql) && /mb_no = \?/.test(list.sql));
    assert.ok(/ORDER BY l\.id DESC/.test(list.sql));
    assert.deepStrictEqual(list.params, [7, 3, 100]);
    assert.ok(!/SELECT\s+\*/i.test(list.sql) && !/user_password/.test(list.sql));

    console.log('checkBalanceLog ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkBalanceLog 실패 ❌', err.message);
    process.exit(1);
});

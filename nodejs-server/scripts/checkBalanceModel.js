// 관리자 조정 모델 점검: node scripts/checkBalanceModel.js  (가짜 DB 연결, 실행된 쿼리 기록)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let queries;
let rows;
pool.getConnection = async () => ({
    beginTransaction: async () => queries.push('BEGIN'),
    commit: async () => queries.push('COMMIT'),
    rollback: async () => queries.push('ROLLBACK'),
    release: () => {},
    query: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM lk_user/.test(sql)) return [rows];
        return [{ affectedRows: 1 }];
    },
});
pool.query = async (sql, params) => {
    queries.push({ sql, params });
    return [rows];
};

const Balance = require('../src/models/balanceModel');
const find = re => queries.filter(q => q.sql && re.test(q.sql));
const updates = () => find(/UPDATE lk_user/);
const logs = () => find(/INSERT INTO lk_balance_log/);
const reset = r => ((queries = []), (rows = r));
const errorOf = p => p.then(() => null, e => e);

const change = (mbNo, stip, vaca, expectedStip, expectedVaca) => ({ mbNo, stip, vaca, expectedStip, expectedVaca });
const input = changes => ({ cpId: 1, actorMbNo: 2, reason: '2027년 연차 부여', changes });

(async () => {
    // 대상 조회: 같은 회사 + 요청한 직원들 + 잠금
    reset([{ mb_no: 3, user_stip: 2.5, user_vaca: 0 }]);
    await Balance.adjust(input([change(3, 15, 3, 2.5, 0)]));
    const select = find(/FROM lk_user/)[0];
    assert.ok(/cp_id = \?/.test(select.sql) && /mb_no IN \(\?\)/.test(select.sql) && /FOR UPDATE/.test(select.sql));
    assert.deepStrictEqual(select.params, [1, [3]]);

    // 다른 회사 직원이 섞임(조회 결과 부족) → 404, 아무것도 바꾸지 않음
    reset([{ mb_no: 3, user_stip: 2.5, user_vaca: 0 }]);
    let err = await errorOf(Balance.adjust(input([change(3, 15, 3, 2.5, 0), change(9, 15, 3, 0, 0)])));
    assert.strictEqual(err.status, 404);
    assert.strictEqual(err.message, 'User not found');
    assert.strictEqual(updates().length + logs().length, 0);
    assert.ok(queries.includes('ROLLBACK') && !queries.includes('COMMIT'));

    // 화면을 연 뒤 잔여가 바뀜 → 409, 전체 롤백
    reset([{ mb_no: 3, user_stip: 2.5, user_vaca: 0 }, { mb_no: 4, user_stip: 1, user_vaca: 0 }]);
    err = await errorOf(Balance.adjust(input([change(3, 15, 3, 2.5, 0), change(4, 15, 3, 2, 0)])));
    assert.strictEqual(err.status, 409);
    assert.strictEqual(err.message, 'Balance changed');
    assert.strictEqual(updates().length + logs().length, 0);
    assert.ok(queries.includes('ROLLBACK'));

    // 잔여 NULL 직원: 기대값 null이면 일치, 장부 before는 null
    reset([{ mb_no: 5, user_stip: null, user_vaca: null }]);
    await Balance.adjust(input([change(5, 15, 0, null, null)]));
    assert.deepStrictEqual(logs()[0].params.slice(4, 8), [null, 15, null, 0]);

    // 현재값과 같은 항목은 건너뜀, 전부 같으면 400
    reset([{ mb_no: 3, user_stip: 2.5, user_vaca: 0 }]);
    err = await errorOf(Balance.adjust(input([change(3, 2.5, 0, 2.5, 0)])));
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.message, 'No changes');
    assert.ok(queries.includes('ROLLBACK'));

    // 성공 2명 (1명은 그대로라 건너뜀) — 같은 회사 조건 UPDATE, 관리자 장부, 커밋 1회
    reset([
        { mb_no: 3, user_stip: 2.5, user_vaca: 0 },
        { mb_no: 4, user_stip: 1, user_vaca: 2 },
        { mb_no: 6, user_stip: 7, user_vaca: 1 },
    ]);
    const result = await Balance.adjust(input([change(3, 15, 3, 2.5, 0), change(4, 1, 5, 1, 2), change(6, 7, 1, 7, 1)]));
    assert.deepStrictEqual(result, { changed: 2 });
    assert.strictEqual(updates().length, 2);
    assert.ok(/UPDATE lk_user SET user_stip = \?, user_vaca = \? WHERE mb_no = \? AND cp_id = \?/.test(updates()[0].sql));
    assert.deepStrictEqual(updates()[0].params, [15, 3, 3, 1]);
    assert.deepStrictEqual(logs().map(l => l.params), [
        [1, 3, 2, 'admin', 2.5, 15, 0, 3, '2027년 연차 부여'],
        [1, 4, 2, 'admin', 1, 1, 2, 5, '2027년 연차 부여'],
    ]);
    assert.strictEqual(queries.filter(q => q === 'COMMIT').length, 1);

    // 목록: 같은 회사 승인 직원만, 필요한 컬럼만
    reset([]);
    await Balance.listApproved(7);
    let q = queries[0];
    assert.ok(/cp_id = \?/.test(q.sql) && /user_status = 'approved'/.test(q.sql) && !/SELECT\s+\*/i.test(q.sql) && !/user_password/.test(q.sql));
    assert.deepStrictEqual(q.params, [7]);

    // 존재 확인: 같은 회사 조건
    reset([]);
    assert.strictEqual(await Balance.exists(7, 3), false);
    q = queries[0];
    assert.ok(/cp_id = \?/.test(q.sql) && /mb_no = \?/.test(q.sql));
    assert.deepStrictEqual(q.params, [7, 3]);
    reset([{ mb_no: 3 }]);
    assert.strictEqual(await Balance.exists(7, 3), true);

    console.log('checkBalanceModel ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkBalanceModel 실패 ❌', err.message);
    process.exit(1);
});

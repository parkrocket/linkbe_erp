// 신입 월차 자동 부여 점검: node scripts/checkMonthlyGrant.js  (가짜 DB·Slack, 날짜 고정)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');
const pool = require('../src/config/dbPromise');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => notices.push({ channel, text });

// ── 가짜 DB: 대상 조회 결과·이미 받은 직원을 테스트가 지정 ──
let queries, targets, alreadyGranted, failLog;
pool.getConnection = async () => ({
    beginTransaction: async () => queries.push('BEGIN'),
    commit: async () => queries.push('COMMIT'),
    rollback: async () => queries.push('ROLLBACK'),
    release: () => {},
    query: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM lk_user/.test(sql)) return [targets];
        if (/FROM lk_balance_log/.test(sql)) return [alreadyGranted.map(mb_no => ({ mb_no }))];
        if (/INSERT INTO lk_balance_log/.test(sql) && failLog) throw new Error('log down');
        return [{ affectedRows: 1 }];
    },
});
const reset = (t = [], granted = []) => {
    queries = [];
    notices = [];
    targets = t;
    alreadyGranted = granted;
    failLog = false;
};
const find = re => queries.filter(q => q.sql && re.test(q.sql));

const MonthlyGrant = require('../src/models/monthlyGrant');
const kim = { mb_no: 3, cp_id: 1, user_name: '김신입', user_stip: 2, user_vaca: 0 };
const lee = { mb_no: 4, cp_id: 1, user_name: '이<b>신입', user_stip: null, user_vaca: null };

(async () => {
    // 대상 조회: 승인·올해 입사·이번 달 1일 전·고용형태(미지정 포함, 프리랜서 제외)·잠금
    reset([kim]);
    await MonthlyGrant.run('2026-11-01');
    const select = find(/FROM lk_user/)[0];
    assert.ok(/user_status = 'approved'/.test(select.sql));
    assert.ok(/user_doe >= \?/.test(select.sql) && /user_doe < \?/.test(select.sql));
    assert.deepStrictEqual(select.params, ['2026-01-01', '2026-11-01']);
    assert.ok(/employment_type IS NULL OR employment_type IN \('regular', 'contract', 'intern'\)/.test(select.sql));
    assert.ok(/FOR UPDATE/.test(select.sql));

    // 부여: +1, 장부 grant·시스템(0)·memo, 커밋
    reset([kim, lee]);
    let result = await MonthlyGrant.run('2026-11-01');
    assert.deepStrictEqual(result, { month: '2026-11', granted: [{ mbNo: 3, name: '김신입' }, { mbNo: 4, name: '이<b>신입' }] });
    const updates = find(/UPDATE lk_user SET user_stip = COALESCE\(user_stip, 0\) \+ 1 WHERE mb_no = \?/);
    assert.deepStrictEqual(updates.map(u => u.params), [[3], [4]]);
    assert.deepStrictEqual(find(/INSERT INTO lk_balance_log/).map(l => l.params), [
        [1, 3, 0, 'grant', 2, 3, 0, 0, '2026-11 월차 자동 부여'],
        [1, 4, 0, 'grant', null, 1, null, null, '2026-11 월차 자동 부여'], // 잔여 NULL → 1
    ]);
    assert.strictEqual(queries.filter(q => q === 'COMMIT').length, 1);

    // 이번 달 이미 받은 직원은 건너뜀 (재시작·중복 실행 안전)
    reset([kim, lee], [3]);
    result = await MonthlyGrant.run('2026-11-15');
    assert.deepStrictEqual(result.granted, [{ mbNo: 4, name: '이<b>신입' }]);
    const dup = find(/FROM lk_balance_log/)[0];
    assert.ok(/kind = 'grant'/.test(dup.sql) && /memo = \?/.test(dup.sql));
    assert.deepStrictEqual(dup.params, ['2026-11 월차 자동 부여', [3, 4]]);
    assert.strictEqual(find(/UPDATE lk_user/).length, 1);

    // 대상 없음 → 쿼리는 조회만, 커밋
    reset([]);
    result = await MonthlyGrant.run('2026-01-01');
    assert.deepStrictEqual(result.granted, []);
    assert.deepStrictEqual(find(/FROM lk_user/)[0].params, ['2026-01-01', '2026-01-01'], '1월은 범위가 비어 대상 없음');
    assert.strictEqual(find(/^(UPDATE|INSERT)/).length, 0);

    // 장부 실패 → 전체 롤백
    reset([kim]);
    failLog = true;
    await assert.rejects(MonthlyGrant.run('2026-11-01'));
    assert.ok(queries.includes('ROLLBACK') && !queries.includes('COMMIT'));

    // 알림: 이름 이스케이프, 0명이면 보내지 않음
    await MonthlyGrant.notify({ month: '2026-11', granted: [{ mbNo: 3, name: '김신입' }, { mbNo: 4, name: '이<b>신입' }] });
    assert.deepStrictEqual(notices, [{ channel: '#hibye-관리', text: '11월 월차 자동 부여: 김신입, 이&lt;b&gt;신입 (2명)' }]);
    notices = [];
    await MonthlyGrant.notify({ month: '2026-11', granted: [] });
    assert.deepStrictEqual(notices, []);

    console.log('checkMonthlyGrant ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkMonthlyGrant 실패 ❌', err.message);
    process.exit(1);
});

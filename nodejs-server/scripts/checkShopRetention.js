// 개인결제 주문 보관 기간 정리 점검: node scripts/checkShopRetention.js  (DB·Slack 가짜)
const assert = require('assert');
const path = require('path');
const pool = require('../src/config/dbPromise');

const sent = [];
const slackPath = path.resolve(__dirname, '../src/utils/slack.js');
require.cache[slackPath] = { id: slackPath, filename: slackPath, loaded: true, exports: { sendSlackMessage: async (ch, text) => sent.push([ch, text]) } };

let calls = [];
let state = '';
// 가짜 연결: 지울 대상 id, 남길 건수, 실패 지점
const fakeConn = ({ ids = [], kept = 0, failOn } = {}) => ({
    beginTransaction: async () => (state += 'B'),
    commit: async () => (state += 'C'),
    rollback: async () => (state += 'R'),
    release: () => (state += 'L'),
    query: async (sql, params) => {
        calls.push({ sql, params });
        if (failOn && failOn.test(sql)) throw new Error('db down');
        if (/SELECT id FROM hp_order/.test(sql)) return [ids.map(id => ({ id }))];
        if (/SELECT COUNT/.test(sql)) return [[{ n: kept }]];
        return [{ affectedRows: ids.length }];
    },
});

const Order = require('../src/models/orderModel');
const { purgeOldOrders, RETENTION_YEARS, PENDING_DAYS } = require('../src/controllers/shopCron');

(async () => {
    assert.strictEqual(RETENTION_YEARS, 5);
    assert.strictEqual(PENDING_DAYS, 7);

    // 모델: 5년 지난 주문 삭제 (상태 조건 없음)
    calls = [];
    pool.query = async (sql, params) => {
        calls.push({ sql, params });
        return [{ affectedRows: 3 }];
    };
    assert.strictEqual(await Order.purgeOlderThan(5), 3);
    assert.ok(/DELETE FROM hp_order WHERE created_at < NOW\(\) - INTERVAL \? YEAR/.test(calls[0].sql) && !/status/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, [5]);

    // 모델: 결제 대기 7일 — 조건·결과 모름 제외·트랜잭션
    calls = [];
    state = '';
    pool.getConnection = async () => fakeConn({ ids: [11, 12], kept: 2 });
    assert.deepStrictEqual(await Order.purgeStalePending(7), { deleted: 2, kept: 2 });
    const sel = calls[0];
    assert.ok(/status = 'pending'/.test(sel.sql) && /INTERVAL \? DAY/.test(sel.sql) && /FOR UPDATE/.test(sel.sql));
    assert.ok(/history NOT LIKE '%확인 필요%'/.test(sel.sql) && /history NOT LIKE '%직접 취소 필요%'/.test(sel.sql));
    assert.deepStrictEqual(sel.params, [7]);
    const del = calls.find(c => /DELETE FROM hp_order/.test(c.sql));
    assert.deepStrictEqual(del.params, [[11, 12]]);
    const cnt = calls.find(c => /SELECT COUNT/.test(c.sql));
    assert.ok(/history LIKE '%확인 필요%' OR history LIKE '%직접 취소 필요%'/.test(cnt.sql) && /status = 'pending'/.test(cnt.sql));
    assert.strictEqual(state, 'BCL');

    // 지울 것 없음 → DELETE 없음
    calls = [];
    state = '';
    pool.getConnection = async () => fakeConn();
    assert.deepStrictEqual(await Order.purgeStalePending(7), { deleted: 0, kept: 0 });
    assert.ok(!calls.some(c => /DELETE/.test(c.sql)));

    // 크론: kept>0 → Slack 1건
    sent.length = 0;
    pool.getConnection = async () => fakeConn({ ids: [1], kept: 4 });
    const r1 = await purgeOldOrders();
    assert.deepStrictEqual(r1, { old: 3, deleted: 1, kept: 4 });
    assert.ok(sent.length === 1 && sent[0][0] === '#결제' && /4건/.test(sent[0][1]) && /KCP 승인 결과를 모르는/.test(sent[0][1]));

    // kept 0 → Slack 0건
    sent.length = 0;
    pool.getConnection = async () => fakeConn({ ids: [1], kept: 0 });
    assert.strictEqual((await purgeOldOrders()).kept, 0);
    assert.strictEqual(sent.length, 0);

    // 실패 → 되돌림, null, 경고 1건
    sent.length = 0;
    state = '';
    pool.getConnection = async () => fakeConn({ ids: [1], failOn: /DELETE FROM hp_order/ });
    assert.strictEqual(await purgeOldOrders(), null);
    assert.strictEqual(state, 'BRL');
    assert.ok(sent.length === 1 && /정리에 실패/.test(sent[0][1]));

    console.log('checkShopRetention ✅');
    process.exit(0);
})().catch(error => {
    console.error(error);
    process.exit(1);
});

// 문의 보관 기간(3년) 정리 점검: node scripts/checkInquiryRetention.js  (DB·파일·Slack 가짜)
const assert = require('assert');
const path = require('path');
const pool = require('../src/config/dbPromise');

// 업로드 삭제·Slack은 가짜 (require.cache 교체 — 직접 대입은 무시됨)
const removed = [];
const uploadsPath = require.resolve('../src/utils/uploads');
require.cache[uploadsPath] = { id: uploadsPath, filename: uploadsPath, loaded: true, exports: { ...require(uploadsPath), removeUpload: (name, vis) => removed.push([name, vis]) } };
const sent = [];
const slackPath = path.resolve(__dirname, '../src/utils/slack.js');
require.cache[slackPath] = { id: slackPath, filename: slackPath, loaded: true, exports: { sendSlackMessage: async (ch, text) => sent.push([ch, text]) } };

let calls = [];
let state = '';
const fakeConn = rows => ({
    beginTransaction: async () => (state += 'B'),
    commit: async () => (state += 'C'),
    rollback: async () => (state += 'R'),
    release: () => (state += 'L'),
    query: async (sql, params) => {
        calls.push({ sql, params });
        if (/SELECT id FROM hp_inquiry/.test(sql)) return [rows.ids.map(id => ({ id }))];
        if (/SELECT stored_name FROM hp_file/.test(sql)) return [rows.files.map(n => ({ stored_name: n }))];
        if (rows.failOn && rows.failOn.test(sql)) throw new Error('db down');
        return [{ affectedRows: 1 }];
    },
});

const Homepage = require('../src/models/homepageModel');
const { purgeOldInquiries, RETENTION_YEARS } = require('../src/controllers/homepageCron');

(async () => {
    assert.strictEqual(RETENTION_YEARS, 3);

    // 지난 문의 2건 + 첨부 1개 → 같은 트랜잭션에서 첨부 행·문의 행 삭제, 커밋 뒤 파일 삭제
    calls = [];
    state = '';
    pool.getConnection = async () => fakeConn({ ids: [4, 9], files: ['a.pdf'] });
    const result = await purgeOldInquiries();
    assert.deepStrictEqual(result, { inquiries: 2, files: 1 });
    const select = calls.find(c => /SELECT id FROM hp_inquiry/.test(c.sql));
    assert.ok(/created_at < NOW\(\) - INTERVAL \? YEAR/.test(select.sql) && /FOR UPDATE/.test(select.sql));
    assert.deepStrictEqual(select.params, [3]);
    const delFile = calls.findIndex(c => /DELETE FROM hp_file/.test(c.sql));
    const delInq = calls.findIndex(c => /DELETE FROM hp_inquiry/.test(c.sql));
    assert.ok(delFile >= 0 && delInq > delFile, '첨부 행 먼저, 문의 행 나중');
    assert.ok(/owner_type = 'inquiry'/.test(calls[delFile].sql));
    assert.deepStrictEqual(calls[delFile].params, [[4, 9]]);
    assert.deepStrictEqual(calls[delInq].params, [[4, 9]]);
    assert.strictEqual(state, 'BCL');
    assert.deepStrictEqual(removed, [['a.pdf', 'private']]);

    // 지난 문의 없음 → 삭제 쿼리 없음, 파일 삭제 없음
    calls = [];
    state = '';
    removed.length = 0;
    pool.getConnection = async () => fakeConn({ ids: [], files: [] });
    assert.deepStrictEqual(await purgeOldInquiries(), { inquiries: 0, files: 0 });
    assert.ok(!calls.some(c => /DELETE/.test(c.sql)));
    assert.deepStrictEqual(removed, []);

    // DB 실패 → 되돌림, 파일은 그대로, #hibye-관리 알림 (서버는 안 죽음)
    calls = [];
    state = '';
    pool.getConnection = async () => fakeConn({ ids: [4], files: ['b.pdf'], failOn: /DELETE FROM hp_inquiry/ });
    assert.strictEqual(await purgeOldInquiries(), null);
    assert.strictEqual(state, 'BRL');
    assert.deepStrictEqual(removed, []);
    assert.ok(sent.length === 1 && sent[0][0] === '#hibye-관리' && /문의 보관 기간/.test(sent[0][1]));

    // 모델 단독: DB 정리는 Homepage.purgeInquiriesOlderThan
    assert.strictEqual(typeof Homepage.purgeInquiriesOlderThan, 'function');

    console.log('checkInquiryRetention ✅');
    process.exit(0);
})().catch(error => {
    console.error(error);
    process.exit(1);
});

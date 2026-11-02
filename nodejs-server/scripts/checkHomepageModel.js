// 홈페이지 모델 SQL 점검: node scripts/checkHomepageModel.js  (pool 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

let calls = [];
let reply = [[]];
pool.query = async (sql, params) => (calls.push({ sql, params }), reply);
const Homepage = require('../src/models/homepageModel');
const last = () => calls[calls.length - 1];
const all = () => calls.map(c => c.sql).join('\n');

(async () => {
    // 공개 목록: 보이는 글만, 정렬·페이지 바인딩, 본문 제외, SELECT * 금지
    calls = [];
    reply = [[{ id: 1 }]];
    pool.query = async (sql, params) => (calls.push({ sql, params }), /COUNT\(\*\)/.test(sql) ? [[{ n: 7 }]] : [[{ id: 1, title: 't' }]]);
    const list = await Homepage.listPosts('portfolio', { visibleOnly: true, mainOnly: true, page: 2, size: 12 });
    assert.deepStrictEqual(list, { rows: [{ id: 1, title: 't' }], total: 7 });
    const listSql = calls.find(c => !/COUNT/.test(c.sql));
    assert.ok(/board = \?/.test(listSql.sql) && /is_visible = 1/.test(listSql.sql) && /show_on_main = 1/.test(listSql.sql));
    assert.ok(!/body_html/.test(listSql.sql), '목록은 본문 제외');
    assert.ok(!/SELECT\s+\*/i.test(all()));
    assert.deepStrictEqual(listSql.params, ['portfolio', 12, 12]);
    // 관리 목록: 숨김 포함
    calls = [];
    await Homepage.listPosts('notice', { visibleOnly: false, page: 1, size: 20 });
    assert.ok(!/is_visible = 1/.test(calls.find(c => !/COUNT/.test(c.sql)).sql));

    // 상세: 공개는 숨김 제외
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), [[]]);
    assert.strictEqual(await Homepage.findPost('notice', 3, { visibleOnly: true }), undefined);
    assert.ok(/board = \? AND id = \?/.test(last().sql) && /is_visible = 1/.test(last().sql));
    assert.deepStrictEqual(last().params, ['notice', 3]);

    // 저장: 새 글 INSERT / 수정 UPDATE (board 조건 포함 — 다른 게시판 글을 고치지 않게)
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ insertId: 9, affectedRows: 1 }]);
    const fields = { title: '제목', bodyHtml: '<p>본문</p>', thumbnailFileId: null, client: null, category: null, siteUrl: null, showOnMain: 0, sortOrder: 0, isVisible: 1 };
    assert.strictEqual(await Homepage.savePost('notice', null, fields, 5), 9);
    assert.ok(/INSERT INTO hp_post/.test(last().sql) && last().params.includes('notice') && last().params.includes(5));
    assert.strictEqual(await Homepage.savePost('notice', 9, fields, 5), 9);
    assert.ok(/UPDATE hp_post SET/.test(last().sql) && /WHERE id = \? AND board = \?/.test(last().sql));
    await Homepage.deletePost('portfolio', 9);
    assert.ok(/DELETE FROM hp_post WHERE id = \? AND board = \?/.test(last().sql));
    assert.deepStrictEqual(last().params, [9, 'portfolio']);

    // 팝업: 공개는 보이기 + 기간 안
    calls = [];
    pool.query = async (sql, params) => (calls.push({ sql, params }), [[]]);
    const now = new Date('2026-11-05T01:00:00Z');
    await Homepage.listPopups({ activeAt: now });
    assert.ok(/is_visible = 1/.test(last().sql) && /starts_at <= \? AND ends_at >= \?/.test(last().sql));
    assert.deepStrictEqual(last().params, [now, now]);
    await Homepage.listPopups({ activeAt: null });
    assert.ok(!/WHERE/.test(last().sql), '관리는 전체');

    // FAQ: 공개는 보이는 것만, 순서대로
    await Homepage.listFaqs({ visibleOnly: true });
    assert.ok(/is_visible = 1/.test(last().sql) && /ORDER BY sort_order, id/.test(last().sql));

    // 문의: IP별 최근 건수(스팸 판정), 생성은 바인딩
    pool.query = async (sql, params) => (calls.push({ sql, params }), [[{ n: 3 }]]);
    assert.strictEqual(await Homepage.countRecentByIp('1.2.3.4', 10), 3);
    assert.ok(/ip = \?/.test(last().sql) && /INTERVAL \? MINUTE/.test(last().sql));
    assert.deepStrictEqual(last().params, ['1.2.3.4', 10]);

    // 파일: 공개 조회용 findFile은 id 바인딩
    pool.query = async (sql, params) => (calls.push({ sql, params }), [[{ id: 4, visibility: 'private' }]]);
    assert.deepStrictEqual(await Homepage.findFile(4), { id: 4, visibility: 'private' });
    assert.deepStrictEqual(last().params, [4]);

    // 문의 수정: 메모 undefined면 상태만
    pool.query = async (sql, params) => (calls.push({ sql, params }), [{ affectedRows: 1 }]);
    await Homepage.updateInquiry(5, { status: 'done', adminMemo: undefined });
    assert.ok(!/admin_memo/.test(last().sql), '메모 안 건드림');
    assert.deepStrictEqual(last().params, ['done', 5]);
    await Homepage.updateInquiry(5, { status: 'done', adminMemo: null });
    assert.ok(/admin_memo = \?/.test(last().sql), 'null은 메모 지우기');

    // 모든 쿼리에 값 직접 삽입 없음 (따옴표 문자열 리터럴은 상수만)
    assert.ok(!/'\$\{/.test(all()));

    console.log('checkHomepageModel ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkHomepageModel 실패 ❌', err.message);
    process.exit(1);
});

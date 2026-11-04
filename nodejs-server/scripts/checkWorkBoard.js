// 바이럴 게시판 API 점검: node scripts/checkWorkBoard.js  (모델·pool 가짜 — 운영 DB 호출 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');
const Admin = require('../src/models/adminModel');

// ── 모델 SQL 점검: pool 가짜로 SQL·바인딩 확인 ──
const sqls = [];
const conn = { query: async (sql, params) => (sqls.push({ sql, params }), [{ affectedRows: 1 }]), beginTransaction: async () => sqls.push({ sql: 'BEGIN' }), commit: async () => sqls.push({ sql: 'COMMIT' }), rollback: async () => sqls.push({ sql: 'ROLLBACK' }), release: () => {} };
pool.getConnection = async () => conn;

const { Board } = require('../src/models/boardModel');

(async () => {
    // 목록: cp_id·board 범위, 검색어 LIKE 이스케이프·바인딩
    pool.query = async (sql, params) => (sqls.push({ sql, params }), sql.includes('COUNT(*) AS n') ? [[{ n: 0 }]] : [[]]);
    sqls.length = 0;
    await Board.list(3, 'viral', { q: '50%_a', page: 2, size: 10 });
    assert.ok(/p\.cp_id = \? AND p\.board = \?/.test(sqls[0].sql) && /p\.title LIKE \?/.test(sqls[0].sql));
    assert.deepStrictEqual(sqls[0].params, [3, 'viral', '%50\\%\\_a%', 10, 10]);
    assert.ok(!sqls[0].sql.includes('50%'), '검색어가 SQL에 직접 들어감');
    assert.ok(/CONVERT_TZ/.test(sqls[0].sql));
    // 글 조회·수정·삭제·댓글은 cp_id + board (또는 확인된 post_id) 범위
    sqls.length = 0;
    await Board.findPost(3, 'viral', 5);
    await Board.updatePost(3, 'viral', 5, { title: 't', bodyHtml: 'b' });
    await Board.removePost(3, 'viral', 5);
    assert.ok(/WHERE cp_id = \? AND board = \? AND id = \?/.test(sqls[0].sql));
    assert.ok(/WHERE cp_id = \? AND board = \? AND id = \?/.test(sqls[1].sql));
    assert.deepStrictEqual(sqls[1].params, ['t', 'b', 3, 'viral', 5]);
    assert.deepStrictEqual(sqls.slice(2).map(s => s.sql.split(' ')[0]), ['BEGIN', 'DELETE', 'DELETE', 'COMMIT']);
    assert.ok(/DELETE FROM wk_board_post WHERE cp_id = \? AND board = \? AND id = \?/.test(sqls[3].sql));
    assert.ok(/DELETE FROM wk_board_comment WHERE post_id = \?/.test(sqls[4].sql));

    // ── 컨트롤러 점검(모델 가짜) ──
    Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍길동' });
    const calls = {};
    const rec = (name, ret) => async (...a) => ((calls[name] = a), typeof ret === 'function' ? ret(...a) : ret);
    const post = { id: 1, title: '테스트글', body_html: '<p>본문</p><script>alert(1)</script>', writer_no: 7, writer_name: '홍길동', created_at: '2026-03-05 19:00:00', updated_at: '2026-03-05 19:00:00' };
    Board.list = rec('list', { rows: [{ id: 1, title: '테스트글', writer_name: '홍길동', comment_count: '2', created_at: '2026-03-05 19:00:00' }], total: 1 });
    Board.findPost = async (cp, board, id) => (cp === 1 && board === 'viral' && id === 1 ? post : id === 2 && cp === 1 ? { ...post, id: 2, writer_no: 8 } : id === 3 && cp === 1 ? { ...post, id: 3, writer_no: null } : undefined);
    Board.comments = async () => [{ id: 10, body: '내 댓글', writer_no: 7, writer_name: '홍길동', created_at: 't' }, { id: 11, body: '남 댓글', writer_no: 8, writer_name: '김철수', created_at: 't' }];
    Board.createPost = rec('createPost', 55);
    Board.updatePost = rec('updatePost', true);
    Board.removePost = rec('removePost', true);
    Board.findComment = async (postId, id) => ({ 10: { id: 10, writer_no: 7 }, 11: { id: 11, writer_no: 8 } })[id];
    Board.createComment = rec('createComment', 77);
    Board.removeComment = rec('removeComment', true);

    const ctrl = require('../src/controllers/workBoardController');
    const call = async (fn, req) => {
        const res = { code: 200 };
        res.status = c => ((res.code = c), res);
        res.json = b => ((res.body = b), res);
        await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'a@x.kr', userRole: 'member', ...req }, res);
        return res;
    };
    const expect = (res, code, error) => assert.deepStrictEqual([res.code, res.body.error], [code, error]);

    // 목록: 칸 이름·페이지 값
    let res = await call(ctrl.list, { query: { q: ' 테 ', page: '2', size: '999' } });
    assert.deepStrictEqual(Object.keys(res.body), ['posts', 'total', 'page', 'size']);
    assert.deepStrictEqual(Object.keys(res.body.posts[0]), ['id', 'title', 'writerName', 'commentCount', 'createdAt']);
    assert.strictEqual(res.body.posts[0].commentCount, 2);
    assert.deepStrictEqual(calls.list.slice(1), ['viral', { q: '테', page: 2, size: 100 }]);
    for (const query of [{ page: '0' }, { page: 'x' }, { size: '0' }, { size: '-1' }]) {
        assert.strictEqual((await call(ctrl.list, { query })).code, 400);
    }

    // 상세: 칸 이름, 출력 정제, isMine
    res = await call(ctrl.detail, { params: { id: '1' } });
    assert.deepStrictEqual(Object.keys(res.body.post), ['id', 'title', 'bodyHtml', 'writerName', 'isMine', 'createdAt', 'updatedAt']);
    assert.deepStrictEqual(Object.keys(res.body.comments[0]), ['id', 'body', 'writerName', 'isMine', 'createdAt']);
    assert.strictEqual(res.body.post.bodyHtml, '<p>본문</p>', '출력에 script가 남음');
    assert.deepStrictEqual([res.body.post.isMine, res.body.comments.map(c => c.isMine)], [true, [true, false]]);
    res = await call(ctrl.detail, { params: { id: '2' } });
    assert.strictEqual(res.body.post.isMine, false);
    res = await call(ctrl.detail, { params: { id: '2' }, userRole: 'admin' });
    assert.deepStrictEqual([res.body.post.isMine, res.body.comments.map(c => c.isMine)], [true, [true, true]]);
    res = await call(ctrl.detail, { params: { id: '3' } }); // 작성자 없는 예전 글: 관리자만
    assert.strictEqual(res.body.post.isMine, false);
    for (const id of ['99', 'abc', '0']) expect(await call(ctrl.detail, { params: { id } }), 404, 'Not found');
    // 다른 회사 → 404
    expect(await call(ctrl.detail, { params: { id: '1' }, userCpId: 2 }), 404, 'Not found');

    // 쓰기: 저장 전 정제, 작성자는 토큰 주인(바디 무시), 제목·본문 검사
    res = await call(ctrl.create, { body: { title: ' 제목 ', bodyHtml: '<p onclick="x()">안녕</p><script>a()</script><img src="javascript:1">', writerNo: 999 } });
    assert.deepStrictEqual(res.body, { id: 55 });
    assert.deepStrictEqual(calls.createPost.slice(1), ['viral', { title: '제목', bodyHtml: '<p>안녕</p>' }, { no: 7, name: '홍길동' }]);
    for (const body of [{ bodyHtml: '' }, { title: '', bodyHtml: '' }, { title: '   ', bodyHtml: '' }, { title: 'a'.repeat(201), bodyHtml: '' }, { title: 't' }, { title: 't', bodyHtml: 5 }, { title: 't', bodyHtml: 'a'.repeat(500001) }]) {
        assert.strictEqual((await call(ctrl.create, { body })).code, 400, JSON.stringify(body).slice(0, 40));
    }
    assert.strictEqual((await call(ctrl.create, { body: { title: 'a'.repeat(200), bodyHtml: '' } })).code, 200);

    // 수정·삭제: 작성자·관리자만, 아니면 403 Not yours
    assert.strictEqual((await call(ctrl.update, { params: { id: '1' }, body: { title: 'x', bodyHtml: '<b>y</b>' } })).code, 200);
    assert.deepStrictEqual(calls.updatePost.slice(1), ['viral', 1, { title: 'x', bodyHtml: '<b>y</b>' }]);
    expect(await call(ctrl.update, { params: { id: '2' }, body: { title: 'x', bodyHtml: '' } }), 403, 'Not yours');
    expect(await call(ctrl.update, { params: { id: '3' }, body: { title: 'x', bodyHtml: '' } }), 403, 'Not yours');
    assert.strictEqual((await call(ctrl.update, { params: { id: '2' }, userRole: 'admin', body: { title: 'x', bodyHtml: '' } })).code, 200);
    assert.strictEqual((await call(ctrl.update, { params: { id: '3' }, userRole: 'admin', body: { title: 'x', bodyHtml: '' } })).code, 200);
    expect(await call(ctrl.update, { params: { id: '1' }, body: { title: '', bodyHtml: '' } }), 400, 'Invalid title');
    expect(await call(ctrl.update, { params: { id: '99' }, body: { title: 'x', bodyHtml: '' } }), 404, 'Not found');
    expect(await call(ctrl.update, { params: { id: '1' }, userCpId: 2, body: { title: 'x', bodyHtml: '' } }), 404, 'Not found');
    expect(await call(ctrl.remove, { params: { id: '2' } }), 403, 'Not yours');
    expect(await call(ctrl.remove, { params: { id: '3' } }), 403, 'Not yours');
    assert.strictEqual((await call(ctrl.remove, { params: { id: '1' } })).code, 200);
    assert.strictEqual((await call(ctrl.remove, { params: { id: '3' }, userRole: 'admin' })).code, 200);
    expect(await call(ctrl.remove, { params: { id: '99' } }), 404, 'Not found');
    Admin.findByUserId = async () => undefined;
    expect(await call(ctrl.remove, { params: { id: '1' } }), 401, 'Unauthorized');
    Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍길동' });

    // 댓글: 확인된 글 범위, 1~2,000자, 작성자·관리자만 삭제
    assert.deepStrictEqual((await call(ctrl.createComment, { params: { id: '1' }, body: { body: ' 댓글 ' } })).body, { id: 77 });
    assert.deepStrictEqual(calls.createComment, [1, '댓글', { no: 7, name: '홍길동' }]);
    for (const body of [{}, { body: '' }, { body: '  ' }, { body: 5 }, { body: 'a'.repeat(2001) }]) {
        assert.strictEqual((await call(ctrl.createComment, { params: { id: '1' }, body })).code, 400);
    }
    assert.strictEqual((await call(ctrl.createComment, { params: { id: '1' }, body: { body: 'a'.repeat(2000) } })).code, 200);
    expect(await call(ctrl.createComment, { params: { id: '1' }, userCpId: 2, body: { body: 'x' } }), 404, 'Not found');
    expect(await call(ctrl.createComment, { params: { id: '99' }, body: { body: 'x' } }), 404, 'Not found');
    assert.strictEqual((await call(ctrl.removeComment, { params: { id: '1', cid: '10' } })).code, 200);
    expect(await call(ctrl.removeComment, { params: { id: '1', cid: '11' } }), 403, 'Not yours');
    assert.strictEqual((await call(ctrl.removeComment, { params: { id: '1', cid: '11' }, userRole: 'admin' })).code, 200);
    expect(await call(ctrl.removeComment, { params: { id: '1', cid: '99' } }), 404, 'Not found');
    expect(await call(ctrl.removeComment, { params: { id: '1', cid: 'x' } }), 404, 'Not found');
    expect(await call(ctrl.removeComment, { params: { id: '1', cid: '10' }, userCpId: 2 }), 404, 'Not found');

    console.log('checkWorkBoard 통과');
    process.exit(0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});

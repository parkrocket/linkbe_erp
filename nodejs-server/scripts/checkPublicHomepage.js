// 홈페이지 공개 API 점검: node scripts/checkPublicHomepage.js  (모델 가짜 — DB·파일 접근 없음)
const assert = require('assert');
const Homepage = require('../src/models/homepageModel');

// ── 가짜 데이터 ──
const posts = {
    notice: [{ id: 1, title: '공지', body_html: '<p>본문</p>', thumbnail_file_id: null, is_visible: 1, created_at: '2026-11-01' }],
    portfolio: [
        { id: 2, title: '보이는 글', body_html: '<p>a</p>', thumbnail_file_id: 7, client: '고객', category: '홈페이지', site_url: 'https://a.example', is_visible: 1, show_on_main: 1, created_at: '2026-11-01' },
        { id: 3, title: '숨긴 글', body_html: '<p>b</p>', thumbnail_file_id: null, is_visible: 0, show_on_main: 0, created_at: '2026-11-01' },
    ],
};
const files = { 7: { id: 7, visibility: 'public', stored_name: 'a1b2c3d4-0000-4000-8000-000000000001', mime: 'image/png' }, 8: { id: 8, visibility: 'private', stored_name: 'a1b2c3d4-0000-4000-8000-000000000002', mime: 'application/pdf' } };
let listArgs;
Homepage.listPosts = async (board, opts) => {
    listArgs = { board, ...opts };
    const rows = posts[board].filter(p => !opts.visibleOnly || p.is_visible).filter(p => !opts.mainOnly || p.show_on_main);
    return { rows: rows.map(({ body_html, ...r }) => r), total: rows.length };
};
Homepage.findPost = async (board, id, { visibleOnly }) => posts[board].find(p => p.id === id && (!visibleOnly || p.is_visible));
Homepage.listFaqs = async ({ visibleOnly }) => (visibleOnly ? [{ id: 1, question: 'Q', answer_html: '<p>A</p>', sort_order: 1, is_visible: 1 }] : []);
let popupArgs;
Homepage.listPopups = async args => ((popupArgs = args), [{ id: 5, title: '팝업', image_file_id: 7, link_url: null, pos_left: 10, pos_top: 20, width: 400, ends_at: '2026-12-31' }]);
Homepage.getPage = async slug => (slug === 'privacy' ? { slug, title: '개인정보처리방침', body_html: '<p>x</p>', updated_at: '2026-11-01' } : undefined);
Homepage.findFile = async id => files[id];

const ctrl = require('../src/controllers/publicHomepageController');
const call = async (fn, req) => {
    const res = { code: 200, headers: {} };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.set = (k, v) => ((res.headers[k] = v), res);
    res.sendFile = (p, opts) => ((res.sent = { p, opts }), res);
    await fn({ params: {}, query: {}, body: {}, ...req }, res);
    return res;
};

(async () => {
    // 목록: 보이는 글만, 본문 없음, 썸네일은 공개 파일 주소
    let res = await call(ctrl.listPosts, { params: { board: 'portfolio' }, query: { main: '1', page: '2', size: '6' } });
    assert.deepStrictEqual(listArgs, { board: 'portfolio', visibleOnly: true, mainOnly: true, page: 2, size: 6 });
    assert.deepStrictEqual(res.body.posts.map(p => p.id), [2]);
    assert.strictEqual(res.body.posts[0].thumbnailUrl, '/node/api/public/homepage/files/7');
    assert.ok(!('bodyHtml' in res.body.posts[0]) && !('is_visible' in res.body.posts[0]));
    assert.strictEqual(res.body.total, 1);
    // 잘못된 값은 기본값·상한
    await call(ctrl.listPosts, { params: { board: 'notice' }, query: { page: '-3', size: '9999' } });
    assert.deepStrictEqual([listArgs.page, listArgs.size], [1, 50]);
    // board 화이트리스트
    for (const board of ['qna', 'inquiry', 'form_doc', '__proto__']) {
        res = await call(ctrl.listPosts, { params: { board } });
        assert.strictEqual(res.code, 404, board);
    }

    // 상세: 숨김 글 404, 정상은 본문 포함
    res = await call(ctrl.getPost, { params: { board: 'portfolio', id: '3' } });
    assert.strictEqual(res.code, 404, '숨김 글 상세');
    res = await call(ctrl.getPost, { params: { board: 'portfolio', id: 'x' } });
    assert.strictEqual(res.code, 404);
    res = await call(ctrl.getPost, { params: { board: 'portfolio', id: '2' } });
    assert.deepStrictEqual(res.body.post, {
        id: 2,
        title: '보이는 글',
        bodyHtml: '<p>a</p>',
        thumbnailUrl: '/node/api/public/homepage/files/7',
        client: '고객',
        category: '홈페이지',
        siteUrl: 'https://a.example',
        createdAt: '2026-11-01',
    });

    // FAQ·팝업(지금 시각 기준)·안내 페이지
    res = await call(ctrl.listFaqs, {});
    assert.deepStrictEqual(res.body.faqs, [{ id: 1, question: 'Q', answerHtml: '<p>A</p>' }]);
    res = await call(ctrl.listPopups, {});
    assert.ok(popupArgs.activeAt instanceof Date, '공개 팝업은 지금 보이는 것만');
    assert.deepStrictEqual(res.body.popups[0], { id: 5, title: '팝업', imageUrl: '/node/api/public/homepage/files/7', linkUrl: null, posLeft: 10, posTop: 20, width: 400, endsAt: '2026-12-31' });
    res = await call(ctrl.getPage, { params: { slug: 'privacy' } });
    assert.strictEqual(res.body.page.title, '개인정보처리방침');
    for (const slug of ['nope', '../etc', 'A B']) {
        res = await call(ctrl.getPage, { params: { slug } });
        assert.strictEqual(res.code, 404, slug);
    }

    // 파일: 공개만, 캐시 헤더, 저장 폴더 안에서만
    res = await call(ctrl.getFile, { params: { id: '7' } });
    assert.ok(res.sent && res.sent.p === files[7].stored_name && /public$/.test(res.sent.opts.root.replace(/\\/g, '/')));
    assert.strictEqual(res.headers['Content-Type'], 'image/png');
    assert.ok(/max-age=86400/.test(res.headers['Cache-Control']));
    assert.strictEqual(res.headers['X-Content-Type-Options'], 'nosniff');
    for (const id of ['8', '99', 'x']) {
        res = await call(ctrl.getFile, { params: { id } });
        assert.strictEqual(res.code, 404, `파일 ${id}`);
        assert.ok(!res.sent, '비공개·없는 파일은 보내지 않음');
    }

    console.log('checkPublicHomepage ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkPublicHomepage 실패 ❌', err.message);
    process.exit(1);
});

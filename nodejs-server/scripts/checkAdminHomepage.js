// 홈페이지 관리자 API 점검: node scripts/checkAdminHomepage.js  (모델 가짜, 업로드는 임시 폴더)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.UPLOAD_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-admin-'));

const { sanitizeHtml } = require('../src/utils/sanitizeHtml');
const { requireHomepage } = require('../src/middlewares/requireHomepage');
const Homepage = require('../src/models/homepageModel');
const Admin = require('../src/models/adminModel');

// ── 가짜 모델 ──
const calls = [];
const record = name => async (...args) => (calls.push([name, ...args]), name === 'savePost' || name === 'saveFaq' || name === 'savePopup' ? 11 : undefined);
for (const name of ['savePost', 'deletePost', 'saveFaq', 'deleteFaq', 'savePopup', 'deletePopup', 'savePage', 'updateInquiry']) Homepage[name] = record(name);
Homepage.moveFaq = async (id, d) => (calls.push(['moveFaq', id, d]), id === 1);
Homepage.findPost = async (board, id) => (id === 3 ? { id: 3, board, title: '숨김', body_html: '<p>x</p>', is_visible: 0 } : undefined);
Homepage.listPosts = async (board, opts) => (calls.push(['listPosts', board, opts]), { rows: [], total: 0 });
Homepage.findInquiry = async id => (id === 5 ? { id: 5, kind: 'qna', name: '홍길동', status: 'new' } : undefined);
Homepage.listFiles = async (type, id) => (type === 'inquiry' && id === 5 ? [{ id: 8, original_name: '견적.pdf', mime: 'application/pdf', size: 10 }] : []);
const files = {
    7: { id: 7, owner_type: null, owner_id: null, visibility: 'public', stored_name: 'a1b2c3d4-0000-4000-8000-000000000007', mime: 'image/png', original_name: 'a.png' },
    8: { id: 8, owner_type: 'inquiry', owner_id: 5, visibility: 'private', stored_name: 'a1b2c3d4-0000-4000-8000-000000000008', mime: 'application/pdf', original_name: '견적.pdf' },
    9: { id: 9, owner_type: 'inquiry', owner_id: 6, visibility: 'private', stored_name: 'a1b2c3d4-0000-4000-8000-000000000009', mime: 'application/pdf', original_name: 'b.pdf' },
};
Homepage.findFile = async id => files[id];
let inserted;
Homepage.insertFile = async f => ((inserted = f), 12);
Admin.findByUserId = async () => ({ mb_no: 1, user_name: '관리자' });

const ctrl = require('../src/controllers/adminHomepageController');
const call = async (fn, req) => {
    const res = { code: 200, headers: {} };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.set = (k, v) => ((res.headers[k] = v), res);
    res.download = (p, name) => ((res.sent = { p, name }), res);
    await fn({ userId: 'me@x', userCpId: 1, userRole: 'member', userHomepage: true, params: {}, query: {}, body: {}, ...req }, res);
    return res;
};
const post = { title: '공지', bodyHtml: '<p>본문</p>', isVisible: true };

(async () => {
    // ── HTML 정제 ──
    assert.strictEqual(sanitizeHtml('<p onclick="x()">a<script>alert(1)</script></p>'), '<p>a</p>');
    assert.strictEqual(sanitizeHtml('<img src="x" onerror="alert(1)">'), '', '허용 안 된 이미지 주소는 제거');
    assert.strictEqual(sanitizeHtml('<img src="/node/api/public/homepage/files/7" alt="a">'), '<img src="/node/api/public/homepage/files/7" alt="a" />');
    assert.strictEqual(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), '<a rel="noopener noreferrer">x</a>');
    assert.strictEqual(sanitizeHtml('<a href="https://linkbe.kr" target="_blank">x</a>'), '<a href="https://linkbe.kr" target="_blank" rel="noopener noreferrer">x</a>');
    assert.strictEqual(sanitizeHtml('<iframe src="https://evil"></iframe><h2>제목</h2>'), '<h2>제목</h2>');
    assert.strictEqual(sanitizeHtml('<span style="color:red;position:fixed">a</span>'), '<span style="color:red">a</span>');

    // ── 권한 ──
    const mw = req => new Promise(resolve => {
        const res = { status: c => ({ json: b => resolve([c, b]) }) };
        requireHomepage(req, res, () => resolve('next'));
    });
    assert.strictEqual(await mw({ userRole: 'admin', userHomepage: false }), 'next');
    assert.strictEqual(await mw({ userRole: 'member', userHomepage: true }), 'next');
    assert.deepStrictEqual(await mw({ userRole: 'member', userHomepage: false }), [403, { error: 'Homepage only' }]);

    // ── 글 ──
    let res = await call(ctrl.savePost, { params: { board: 'notice' }, body: { ...post, bodyHtml: '<p>a</p><script>x</script>' } });
    assert.deepStrictEqual(res.body, { ok: true, id: 11 });
    const saved = calls.find(c => c[0] === 'savePost');
    assert.deepStrictEqual(saved.slice(1, 3), ['notice', null]);
    assert.strictEqual(saved[3].bodyHtml, '<p>a</p>', '저장 전 정제');
    assert.strictEqual(saved[4], 1, '작성자 mb_no');
    for (const [patch, error] of [
        [{ title: '' }, 'Invalid title'],
        [{ title: 'a'.repeat(201) }, 'Invalid title'],
        [{ siteUrl: 'javascript:alert(1)' }, 'Invalid url'],
        [{ thumbnailFileId: 8 }, 'Invalid file'], // 비공개 파일을 대표 이미지로 쓸 수 없음
        [{ thumbnailFileId: 99 }, 'Invalid file'],
    ]) {
        res = await call(ctrl.savePost, { params: { board: 'portfolio' }, body: { ...post, ...patch } });
        assert.deepStrictEqual([res.code, res.body.error], [400, error], JSON.stringify(patch));
    }
    res = await call(ctrl.savePost, { params: { board: 'qna' }, body: post });
    assert.strictEqual(res.code, 404, 'board 화이트리스트');
    res = await call(ctrl.savePost, { params: { board: 'notice', id: '99' }, body: post });
    assert.strictEqual(res.code, 404, '없는 글 수정');
    res = await call(ctrl.getPost, { params: { board: 'notice', id: '3' } });
    assert.strictEqual(res.body.post.title, '숨김', '관리는 숨김 글도 조회');
    await call(ctrl.listPosts, { params: { board: 'notice' }, query: {} });
    assert.strictEqual(calls.find(c => c[0] === 'listPosts')[2].visibleOnly, false);

    // ── 팝업: 기간·크기 검사 ──
    const popup = { title: '이벤트', imageFileId: 7, linkUrl: '', startsAt: '2026-11-05T00:00', endsAt: '2026-11-30T23:59', posLeft: 10, posTop: 10, width: 400, isVisible: true };
    res = await call(ctrl.savePopup, { body: popup });
    assert.deepStrictEqual(res.body, { ok: true, id: 11 });
    for (const patch of [{ endsAt: '2026-11-01T00:00' }, { startsAt: 'x' }, { width: 50 }, { width: 2000 }, { linkUrl: 'javascript:x' }]) {
        res = await call(ctrl.savePopup, { body: { ...popup, ...patch } });
        assert.strictEqual(res.code, 400, JSON.stringify(patch));
    }

    // ── FAQ 순서·안내 페이지 slug ──
    res = await call(ctrl.moveFaq, { params: { id: '2' }, body: { direction: 'up' } });
    assert.strictEqual(res.code, 404);
    res = await call(ctrl.moveFaq, { params: { id: '1' }, body: { direction: 'left' } });
    assert.strictEqual(res.code, 400);
    res = await call(ctrl.savePage, { params: { slug: '../x' }, body: { title: 't', bodyHtml: '<p>x</p>' } });
    assert.strictEqual(res.code, 404);

    // ── 문의 ──
    res = await call(ctrl.getInquiry, { params: { id: '5' } });
    assert.deepStrictEqual(res.body.files, [{ id: 8, name: '견적.pdf', mime: 'application/pdf', size: 10 }]);
    res = await call(ctrl.updateInquiry, { params: { id: '5' }, body: { status: 'done', adminMemo: '회신 완료' } });
    assert.deepStrictEqual(calls.find(c => c[0] === 'updateInquiry').slice(1), [5, { status: 'done', adminMemo: '회신 완료' }]);
    // 상태만 바꾸면 메모는 그대로 (undefined = 손대지 않음), 숫자 메모는 거절
    await call(ctrl.updateInquiry, { params: { id: '5' }, body: { status: 'in_progress' } });
    assert.deepStrictEqual(calls.filter(c => c[0] === 'updateInquiry').pop().slice(1), [5, { status: 'in_progress', adminMemo: undefined }]);
    res = await call(ctrl.updateInquiry, { params: { id: '5' }, body: { status: 'done', adminMemo: 123 } });
    assert.strictEqual(res.code, 400);
        res = await call(ctrl.updateInquiry, { params: { id: '5' }, body: { status: 'deleted' } });
    assert.strictEqual(res.code, 400);
    // 첨부 내려받기: 그 문의의 파일만, 원본 이름으로
    res = await call(ctrl.downloadInquiryFile, { params: { id: '5', fileId: '8' } });
    assert.ok(res.sent && res.sent.name === '견적.pdf' && res.sent.p.endsWith(files[8].stored_name));
    assert.ok(res.sent.p.replace(/\\/g, '/').includes('/private/'));
    for (const [id, fileId] of [['5', '9'], ['5', '7'], ['6', '8'], ['5', 'x']]) {
        res = await call(ctrl.downloadInquiryFile, { params: { id, fileId } });
        assert.strictEqual(res.code, 404, `${id}/${fileId}`);
        assert.ok(!res.sent);
    }

    // ── 이미지 업로드: 이미지·5MB만, public ──
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    res = await call(ctrl.uploadImage, { file: { originalname: 'a.png', buffer: png, size: 8 } });
    assert.deepStrictEqual(res.body, { ok: true, id: 12, url: '/node/api/public/homepage/files/12' });
    assert.strictEqual(inserted.visibility, 'public');
    for (const file of [undefined, { originalname: 'a.pdf', buffer: Buffer.from('%PDF'), size: 4 }, { originalname: 'a.png', buffer: Buffer.from('<?php'), size: 5 }, { originalname: 'a.png', buffer: png, size: 6 * 1024 * 1024 }]) {
        res = await call(ctrl.uploadImage, { file });
        assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid file']);
    }

    // ── 직원에게 홈페이지 권한 (hibye 관리자 API) ──
    let grant;
    Admin.findByMbNo = async (cpId, mbNo) => (mbNo === 3 ? { mb_no: 3, user_id: 'kim@x', user_name: '김직원' } : undefined);
    Admin.updateHomepageAccess = async (mbNo, access) => (grant = [mbNo, access]);
    const slack = require('../src/utils/slack');
    slack.sendSlackMessage = async () => {};
    const admin = require('../src/controllers/adminController');
    res = await call(admin.changeHomepageAccess, { userRole: 'admin', params: { mbNo: '3' }, body: { access: true } });
    assert.deepStrictEqual([res.body, grant], [{ ok: true }, [3, 1]]);
    res = await call(admin.changeHomepageAccess, { userRole: 'admin', params: { mbNo: '3' }, body: { access: 'yes' } });
    assert.strictEqual(res.code, 400);

    fs.rmSync(process.env.UPLOAD_ROOT, { recursive: true, force: true });
    console.log('checkAdminHomepage ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkAdminHomepage 실패 ❌', err.message);
    process.exit(1);
});

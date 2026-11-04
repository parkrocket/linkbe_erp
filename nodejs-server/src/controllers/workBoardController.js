const { Board } = require('../models/boardModel');
const Admin = require('../models/adminModel');
const { sanitizeHtml } = require('../utils/sanitizeHtml');

// 바이럴 게시판 API — requireAuth·requireWorkDoc 뒤. 게시판 이름은 라우트가 viral로 고정
const BOARD = 'viral';
const MAX_SIZE = 100;
const MAX_TITLE = 200;
const MAX_BODY = 500000; // 본문 HTML 글자 수 상한
const MAX_COMMENT = 2000;

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('work board api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

// 쿼리 정수: 빈 값 = 기본값, 정수가 아니거나 범위 밖이면 null (400 처리)
const intQuery = (v, def, min, max) => {
    if (v === undefined || v === '') return def;
    if (typeof v !== 'string' || !/^\d{1,15}$/.test(v)) return null;
    const n = Number(v);
    return n >= min && n <= max ? n : null;
};

// 요청자(작성자 정보) — 없으면 null
const whoAmI = async req => {
    const me = await Admin.findByUserId(req.userCpId, req.userId);
    return me ? { no: me.mb_no, name: me.user_name } : null;
};

// 수정·삭제 가능: 작성자 본인 또는 관리자 (writer_no가 NULL인 예전 글은 관리자만)
const canEdit = (req, me, writerNo) => req.userRole === 'admin' || (writerNo != null && writerNo === me.no);

// 글 제목·본문 검사 → { ok, value } | { ok:false, error }. 본문은 저장 전 정제
const validatePost = body => {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (title.length < 1 || title.length > MAX_TITLE) return { ok: false, error: 'Invalid title' };
    if (typeof body.bodyHtml !== 'string' || body.bodyHtml.length > MAX_BODY) return { ok: false, error: 'Invalid body' };
    return { ok: true, value: { title, bodyHtml: sanitizeHtml(body.bodyHtml) } };
};

exports.list = handle(async (req, res) => {
    const page = intQuery(req.query.page, 1, 1, 1000000);
    if (page === null) return fail(res, 400, 'Invalid page');
    let size = intQuery(req.query.size, 20, 1, 1000000);
    if (size === null) return fail(res, 400, 'Invalid size');
    size = Math.min(size, MAX_SIZE);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { rows, total } = await Board.list(req.userCpId, BOARD, { q, page, size });
    res.json({
        posts: rows.map(r => ({ id: r.id, title: r.title, writerName: r.writer_name, commentCount: Number(r.comment_count), createdAt: r.created_at })),
        total,
        page,
        size,
    });
});

exports.detail = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const post = id && (await Board.findPost(req.userCpId, BOARD, id));
    if (!post) return notFound(res);
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    const comments = await Board.comments(post.id);
    res.json({
        // 출력도 정제 — 정제 규칙이 바뀌기 전 저장된 글·이전 데이터 대비
        post: { id: post.id, title: post.title, bodyHtml: sanitizeHtml(post.body_html), writerName: post.writer_name, isMine: canEdit(req, me, post.writer_no), createdAt: post.created_at, updatedAt: post.updated_at },
        comments: comments.map(c => ({ id: c.id, body: c.body, writerName: c.writer_name, isMine: canEdit(req, me, c.writer_no), createdAt: c.created_at })),
    });
});

exports.create = handle(async (req, res) => {
    const checked = validatePost(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    res.json({ id: await Board.createPost(req.userCpId, BOARD, checked.value, me) });
});

exports.update = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const post = id && (await Board.findPost(req.userCpId, BOARD, id));
    if (!post) return notFound(res);
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    if (!canEdit(req, me, post.writer_no)) return fail(res, 403, 'Not yours');
    const checked = validatePost(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    if (!(await Board.updatePost(req.userCpId, BOARD, id, checked.value))) return notFound(res);
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const post = id && (await Board.findPost(req.userCpId, BOARD, id));
    if (!post) return notFound(res);
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    if (!canEdit(req, me, post.writer_no)) return fail(res, 403, 'Not yours');
    if (!(await Board.removePost(req.userCpId, BOARD, id))) return notFound(res);
    res.json({ ok: true });
});

exports.createComment = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const post = id && (await Board.findPost(req.userCpId, BOARD, id)); // 다른 회사 글이면 404
    if (!post) return notFound(res);
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (body.length < 1 || body.length > MAX_COMMENT) return fail(res, 400, 'Invalid body');
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    res.json({ id: await Board.createComment(post.id, body, me) });
});

exports.removeComment = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const cid = parseId(req.params.cid);
    const post = id && cid && (await Board.findPost(req.userCpId, BOARD, id));
    if (!post) return notFound(res);
    const comment = await Board.findComment(post.id, cid);
    if (!comment) return notFound(res);
    const me = await whoAmI(req);
    if (!me) return fail(res, 401, 'Unauthorized');
    if (!canEdit(req, me, comment.writer_no)) return fail(res, 403, 'Not yours');
    await Board.removeComment(post.id, cid);
    res.json({ ok: true });
});

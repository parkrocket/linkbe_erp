const path = require('path');
const Homepage = require('../models/homepageModel');
const Admin = require('../models/adminModel');
const { sanitizeHtml } = require('../utils/sanitizeHtml');
const { uploadDir, isStoredName, publicFileUrl, sniffAllowed, saveUpload, extOf, IMAGE_EXTS } = require('../utils/uploads');

// 홈페이지 관리자 API — requireAuth + requireHomepage(관리자 또는 홈페이지 권한) 뒤에서만
// 저장하는 HTML은 항상 정제, 대표·팝업 이미지는 공개 파일만, 문의 첨부는 그 문의의 파일만 내려받기

const BOARDS = ['notice', 'portfolio'];
const STATUSES = ['new', 'in_progress', 'done'];
const MAX_HTML = 500 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

const fail = (res, code, error) => res.status(code).json({ error });
const positiveInt = v => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
const intIn = (v, min, max, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};
const flag = (v, fallback) => (v === undefined ? fallback : v === true || v === 1 || v === '1' ? 1 : 0);
const text = (v, max) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length <= max ? s : null;
};
const optionalUrl = v => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) return null;
    return /^https?:\/\/\S+$/.test(s) && s.length <= 300 ? s : undefined;
};
const html = v => (typeof v === 'string' && v.length <= MAX_HTML ? sanitizeHtml(v) : null);
const boardOf = req => (BOARDS.includes(req.params.board) ? req.params.board : null);
// 'YYYY-MM-DDTHH:mm'(한국 시간) → Date. DB에는 서버 시간대 기준으로 저장되고 조회도 Date로 비교해 일관
const kstDateTime = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}:00+09:00`)) ? new Date(`${v}:00+09:00`) : null);

// 대표·팝업 이미지로 쓸 수 있는 파일인지 (공개 파일만)
async function publicFileOrNull(id) {
    if (id === null || id === undefined || id === '') return null;
    const n = positiveInt(id);
    const file = n && (await Homepage.findFile(n));
    return file && file.visibility === 'public' ? n : undefined;
}

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('admin homepage api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Server error');
    }
};

const actorNo = async req => (await Admin.findByUserId(req.userCpId, req.userId))?.mb_no ?? null;

// ── 글(공지·포트폴리오) ──
exports.listPosts = handle(async (req, res) => {
    const board = boardOf(req);
    if (!board) return fail(res, 404, 'Not found');
    const page = positiveInt(req.query.page) || 1;
    res.json(await Homepage.listPosts(board, { visibleOnly: false, page, size: 30 }));
});

exports.getPost = handle(async (req, res) => {
    const board = boardOf(req);
    const id = positiveInt(req.params.id);
    const post = board && id && (await Homepage.findPost(board, id, { visibleOnly: false }));
    if (!post) return fail(res, 404, 'Not found');
    res.json({ post });
});

exports.savePost = handle(async (req, res) => {
    const board = boardOf(req);
    if (!board) return fail(res, 404, 'Not found');
    const id = req.params.id ? positiveInt(req.params.id) : null;
    if (req.params.id && (!id || !(await Homepage.findPost(board, id, { visibleOnly: false })))) return fail(res, 404, 'Not found');

    const b = req.body || {};
    const title = text(b.title, 200);
    if (!title) return fail(res, 400, 'Invalid title');
    const bodyHtml = html(b.bodyHtml ?? '');
    if (bodyHtml === null) return fail(res, 400, 'Invalid body');
    const siteUrl = optionalUrl(b.siteUrl);
    if (siteUrl === undefined) return fail(res, 400, 'Invalid url');
    const thumbnailFileId = await publicFileOrNull(b.thumbnailFileId);
    if (thumbnailFileId === undefined) return fail(res, 400, 'Invalid file');
    const client = text(b.client, 100);
    const category = text(b.category, 50);
    const sortOrder = intIn(b.sortOrder, -100000, 100000, 0);
    if (client === null || category === null || Number.isNaN(sortOrder)) return fail(res, 400, 'Invalid field');

    const fields = { title, bodyHtml, thumbnailFileId, client: client || null, category: category || null, siteUrl, showOnMain: flag(b.showOnMain, 0), sortOrder, isVisible: flag(b.isVisible, 1) };
    res.json({ ok: true, id: await Homepage.savePost(board, id, fields, await actorNo(req)) });
});

exports.deletePost = handle(async (req, res) => {
    const board = boardOf(req);
    const id = positiveInt(req.params.id);
    if (!board || !id || !(await Homepage.findPost(board, id, { visibleOnly: false }))) return fail(res, 404, 'Not found');
    await Homepage.deletePost(board, id);
    res.json({ ok: true });
});

// ── FAQ ──
exports.listFaqs = handle(async (req, res) => res.json({ faqs: await Homepage.listFaqs({ visibleOnly: false }) }));

exports.saveFaq = handle(async (req, res) => {
    const id = req.params.id ? positiveInt(req.params.id) : null;
    if (req.params.id && !id) return fail(res, 404, 'Not found');
    const question = text(req.body.question, 300);
    const answerHtml = html(req.body.answerHtml ?? '');
    if (!question || answerHtml === null) return fail(res, 400, 'Invalid field');
    res.json({ ok: true, id: await Homepage.saveFaq(id, { question, answerHtml, isVisible: flag(req.body.isVisible, 1) }) });
});

exports.deleteFaq = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    if (!id) return fail(res, 404, 'Not found');
    await Homepage.deleteFaq(id);
    res.json({ ok: true });
});

exports.moveFaq = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') return fail(res, 400, 'Invalid direction');
    if (!id || !(await Homepage.moveFaq(id, direction))) return fail(res, 404, 'Not found');
    res.json({ ok: true });
});

// ── 팝업 ──
exports.listPopups = handle(async (req, res) => res.json({ popups: await Homepage.listPopups({ activeAt: null }) }));

exports.savePopup = handle(async (req, res) => {
    const id = req.params.id ? positiveInt(req.params.id) : null;
    if (req.params.id && !id) return fail(res, 404, 'Not found');
    const b = req.body || {};
    const title = text(b.title, 200);
    const startsAt = kstDateTime(b.startsAt);
    const endsAt = kstDateTime(b.endsAt);
    const linkUrl = optionalUrl(b.linkUrl);
    const imageFileId = await publicFileOrNull(b.imageFileId);
    const width = intIn(b.width, 100, 1200, 400);
    const posLeft = intIn(b.posLeft, 0, 2000, 10);
    const posTop = intIn(b.posTop, 0, 2000, 10);
    if (!title || !startsAt || !endsAt || endsAt <= startsAt) return fail(res, 400, 'Invalid period');
    if (linkUrl === undefined) return fail(res, 400, 'Invalid url');
    if (imageFileId === undefined) return fail(res, 400, 'Invalid file');
    if ([width, posLeft, posTop].some(Number.isNaN)) return fail(res, 400, 'Invalid field');
    res.json({ ok: true, id: await Homepage.savePopup(id, { title, imageFileId, linkUrl, startsAt, endsAt, posLeft, posTop, width, isVisible: flag(b.isVisible, 1) }) });
});

exports.deletePopup = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    if (!id) return fail(res, 404, 'Not found');
    await Homepage.deletePopup(id);
    res.json({ ok: true });
});

// ── 안내 페이지 ──
const slugOf = req => (/^[a-z0-9-]{1,50}$/.test(req.params.slug) ? req.params.slug : null);

exports.listPages = handle(async (req, res) => res.json({ pages: await Homepage.listPages() }));

exports.getPage = handle(async (req, res) => {
    const slug = slugOf(req);
    const page = slug && (await Homepage.getPage(slug));
    if (!page) return fail(res, 404, 'Not found');
    res.json({ page });
});

exports.savePage = handle(async (req, res) => {
    const slug = slugOf(req);
    if (!slug) return fail(res, 404, 'Not found');
    const title = text(req.body.title, 200);
    const bodyHtml = html(req.body.bodyHtml ?? '');
    if (!title || bodyHtml === null) return fail(res, 400, 'Invalid field');
    await Homepage.savePage(slug, title, bodyHtml, await actorNo(req));
    res.json({ ok: true });
});

// ── 문의함 ──
exports.listInquiries = handle(async (req, res) => {
    const kind = ['qna', 'estimate'].includes(req.query.kind) ? req.query.kind : null;
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    res.json(await Homepage.listInquiries({ kind, status, page: positiveInt(req.query.page) || 1 }));
});

exports.getInquiry = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const inquiry = id && (await Homepage.findInquiry(id));
    if (!inquiry) return fail(res, 404, 'Not found');
    const files = await Homepage.listFiles('inquiry', id);
    res.json({ inquiry, files: files.map(f => ({ id: f.id, name: f.original_name, mime: f.mime, size: f.size })) });
});

exports.updateInquiry = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    if (!id || !(await Homepage.findInquiry(id))) return fail(res, 404, 'Not found');
    const { status } = req.body;
    const adminMemo = req.body.adminMemo === undefined || req.body.adminMemo === null ? null : text(req.body.adminMemo, 2000);
    if (!STATUSES.includes(status) || adminMemo === null && req.body.adminMemo) return fail(res, 400, 'Invalid field');
    await Homepage.updateInquiry(id, { status, adminMemo: adminMemo || null });
    res.json({ ok: true });
});

// 첨부 내려받기 — 그 문의에 딸린 비공개 파일만, 원본 이름으로
exports.downloadInquiryFile = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const fileId = positiveInt(req.params.fileId);
    const file = id && fileId && (await Homepage.findFile(fileId));
    if (!file || file.visibility !== 'private' || file.owner_type !== 'inquiry' || file.owner_id !== id || !isStoredName(file.stored_name)) {
        return fail(res, 404, 'Not found');
    }
    res.set('X-Content-Type-Options', 'nosniff');
    res.download(path.join(uploadDir('private'), file.stored_name), file.original_name);
});

// ── 이미지 업로드 (글 본문·대표·팝업) — 공개 파일 ──
exports.uploadImage = handle(async (req, res) => {
    const file = req.file;
    const ext = file && extOf(file.originalname);
    if (!file || file.size > MAX_IMAGE || !IMAGE_EXTS.includes(ext) || !sniffAllowed(file.buffer, ext)) return fail(res, 400, 'Invalid file');
    const stored = saveUpload(file, 'public');
    const id = await Homepage.insertFile({ visibility: 'public', ...stored });
    res.json({ ok: true, id, url: publicFileUrl(id) });
});

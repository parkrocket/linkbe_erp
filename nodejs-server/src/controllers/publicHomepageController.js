const Homepage = require('../models/homepageModel');
const { uploadDir, isStoredName, publicFileUrl, sniffAllowed, saveUpload, removeUpload, extOf, ATTACHMENT_EXTS } = require('../utils/uploads');
const { validateInquiry, KINDS } = require('../utils/inquiryValidation');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIN_FILL_MS = 3000; // 이보다 빨리 제출하면 봇으로 봄
const RATE_WINDOW_MIN = 10;
const RATE_MAX = 5;
const KIND_LABEL = { qna: '1:1 문의', estimate: '견적 요청' };

// 회사 홈페이지(linkbe.kr) 공개 API — 로그인 없음, 읽기 전용(+ 문의 접수)
// 숨김 글·기간 밖 팝업·비공개 파일은 절대 내보내지 않음

const BOARDS = ['notice', 'portfolio'];
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;

const notFound = res => res.status(404).json({ error: 'Not found' });
const positiveInt = (value, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};
const boardOf = req => (BOARDS.includes(req.params.board) ? req.params.board : null);

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('public homepage api error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

// 공개용 글 형태 — 숨김·정렬·작성자 등 내부 칸은 빼고
const toPublicPost = (row, withBody) => ({
    id: row.id,
    title: row.title,
    ...(withBody && { bodyHtml: row.body_html }),
    thumbnailUrl: publicFileUrl(row.thumbnail_file_id),
    ...(row.client !== undefined && { client: row.client ?? null }),
    ...(row.category !== undefined && { category: row.category ?? null }),
    ...(row.site_url !== undefined && { siteUrl: row.site_url ?? null }),
    createdAt: row.created_at,
});

exports.listPosts = handle(async (req, res) => {
    const board = boardOf(req);
    if (!board) return notFound(res);
    const page = positiveInt(req.query.page, 1);
    const size = Math.min(positiveInt(req.query.size, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const { rows, total } = await Homepage.listPosts(board, { visibleOnly: true, mainOnly: req.query.main === '1', page, size });
    res.json({ posts: rows.map(r => toPublicPost(r, false)), total, page, size });
});

exports.getPost = handle(async (req, res) => {
    const board = boardOf(req);
    const id = positiveInt(req.params.id, null);
    if (!board || !id) return notFound(res);
    const post = await Homepage.findPost(board, id, { visibleOnly: true });
    if (!post) return notFound(res);
    res.json({ post: toPublicPost(post, true) });
});

exports.listFaqs = handle(async (req, res) => {
    const faqs = await Homepage.listFaqs({ visibleOnly: true });
    res.json({ faqs: faqs.map(f => ({ id: f.id, question: f.question, answerHtml: f.answer_html })) });
});

exports.listPopups = handle(async (req, res) => {
    const popups = await Homepage.listPopups({ activeAt: new Date() });
    res.json({
        popups: popups.map(p => ({
            id: p.id,
            title: p.title,
            imageUrl: publicFileUrl(p.image_file_id),
            linkUrl: p.link_url,
            posLeft: p.pos_left,
            posTop: p.pos_top,
            width: p.width,
            endsAt: p.ends_at,
        })),
    });
});

exports.getPage = handle(async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-z0-9-]{1,50}$/.test(slug)) return notFound(res);
    const page = await Homepage.getPage(slug);
    if (!page) return notFound(res);
    res.json({ page: { slug: page.slug, title: page.title, bodyHtml: page.body_html, updatedAt: page.updated_at } });
});

// 공개 이미지 — public 파일만, 저장 폴더 밖 접근 불가(root + UUID 이름)
exports.getFile = handle(async (req, res) => {
    const id = positiveInt(req.params.id, null);
    const file = id && (await Homepage.findFile(id));
    if (!file || file.visibility !== 'public' || !isStoredName(file.stored_name)) return notFound(res);
    res.set('Content-Type', file.mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(file.stored_name, { root: uploadDir('public') }, error => error && !res.headersSent && notFound(res));
});

// 문의 접수 — 스팸으로 보이면 저장·알림 없이 같은 성공 응답(봇에게 단서 주지 않음)
// IP는 req.ip(앞단 프록시만 신뢰 — config/trustProxy.js). 대량 요청 차단은 nginx limit_req에서
exports.createInquiry = handle(async (req, res) => {
    const { kind } = req.params;
    if (!KINDS.includes(kind)) return notFound(res);
    const body = req.body || {};
    const files = req.files || [];
    const clientIp = req.ip || '';

    const startedAt = Number(body.startedAt);
    const tooFast = !body.startedAt || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS;
    if (body.website || tooFast || (await Homepage.countRecentByIp(clientIp, RATE_WINDOW_MIN)) >= RATE_MAX) {
        return res.json({ ok: true });
    }

    const input = validateInquiry(body, kind);
    if (input.error) return res.status(400).json({ error: input.error });
    const fileOk = f => f.size <= MAX_FILE_SIZE && ATTACHMENT_EXTS.includes(extOf(f.originalname)) && sniffAllowed(f.buffer, extOf(f.originalname));
    if (files.length > MAX_FILES || !files.every(fileOk)) return res.status(400).json({ error: 'Invalid file' });

    const stored = files.map(f => saveUpload(f, 'private'));
    try {
        await Homepage.createInquiryWithFiles({ ...input.value, ip: clientIp }, stored);
    } catch (error) {
        stored.forEach(f => removeUpload(f.storedName, 'private')); // DB 저장 실패 → 써 둔 파일 정리
        throw error;
    }

    // 알림은 저장 후 — 연락처·내용은 넣지 않음(개인정보), 실패해도 접수는 성공
    try {
        const v = input.value;
        await slack.sendSlackMessage('#hibye-관리', `[${KIND_LABEL[kind]}] ${escapeSlack(v.company)} ${escapeSlack(v.name)}님 → https://hibye.kr/admin?tab=homepage`);
    } catch (error) {
        console.error('inquiry slack notice failed:', error.message);
    }
    res.json({ ok: true });
});

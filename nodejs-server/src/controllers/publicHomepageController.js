const Homepage = require('../models/homepageModel');
const { uploadDir, isStoredName, publicFileUrl } = require('../utils/uploads');

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

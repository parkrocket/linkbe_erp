const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/publicHomepageController');
const router = express.Router();

// 문의 첨부 — 메모리로 받아 내용 검사 후 저장(컨트롤러). 크기·개수 초과는 여기서 400
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 3, fields: 20, fieldSize: 64 * 1024 } });
const attachments = (req, res, next) =>
    upload.array('files', 3)(req, res, error => (error ? res.status(400).json({ error: 'Invalid file' }) : next()));

// /api/public/homepage/* — 로그인 없음 (requireAuth의 PUBLIC_PREFIXES '/public/')
router.get('/posts/:board', ctrl.listPosts);
router.get('/posts/:board/:id', ctrl.getPost);
router.get('/faqs', ctrl.listFaqs);
router.get('/popups', ctrl.listPopups);
router.get('/pages/:slug', ctrl.getPage);
router.get('/files/:id', ctrl.getFile);
router.post('/inquiries/:kind', attachments, ctrl.createInquiry);

module.exports = router;

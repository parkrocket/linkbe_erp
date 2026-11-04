const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/adminHomepageController');
const router = express.Router();

// /api/admin/homepage/* — index.js에서 requireAuth + requireHomepage 뒤에 연결
// defParamCharset: 한글 파일 이름을 UTF-8로 읽음(기본 latin1이면 깨짐)
const upload = multer({ storage: multer.memoryStorage(), defParamCharset: 'utf8', limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const image = (req, res, next) => upload.single('file')(req, res, error => (error ? res.status(400).json({ error: 'Invalid file' }) : next()));

router.get('/posts/:board', ctrl.listPosts);
router.post('/posts/:board', ctrl.savePost);
router.get('/posts/:board/:id', ctrl.getPost);
router.post('/posts/:board/:id', ctrl.savePost);
router.delete('/posts/:board/:id', ctrl.deletePost);

router.get('/faqs', ctrl.listFaqs);
router.post('/faqs', ctrl.saveFaq);
router.post('/faqs/:id', ctrl.saveFaq);
router.post('/faqs/:id/move', ctrl.moveFaq);
router.delete('/faqs/:id', ctrl.deleteFaq);

router.get('/popups', ctrl.listPopups);
router.post('/popups', ctrl.savePopup);
router.post('/popups/:id', ctrl.savePopup);
router.delete('/popups/:id', ctrl.deletePopup);

router.get('/pages', ctrl.listPages);
router.get('/pages/:slug', ctrl.getPage);
router.post('/pages/:slug', ctrl.savePage);

router.get('/inquiries', ctrl.listInquiries);
router.get('/inquiries/:id', ctrl.getInquiry);
router.post('/inquiries/:id', ctrl.updateInquiry);
router.get('/inquiries/:id/files/:fileId', ctrl.downloadInquiryFile);

router.post('/files', image, ctrl.uploadImage);

module.exports = router;

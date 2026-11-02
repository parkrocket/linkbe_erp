const express = require('express');
const ctrl = require('../controllers/publicHomepageController');
const router = express.Router();

// /api/public/homepage/* — 로그인 없음 (requireAuth의 PUBLIC_PREFIXES '/public/')
router.get('/posts/:board', ctrl.listPosts);
router.get('/posts/:board/:id', ctrl.getPost);
router.get('/faqs', ctrl.listFaqs);
router.get('/popups', ctrl.listPopups);
router.get('/pages/:slug', ctrl.getPage);
router.get('/files/:id', ctrl.getFile);

module.exports = router;

const express = require('express');
const work = require('../controllers/workExpenseController');
const router = express.Router();

// /api/work/* — index.js에서 requireAuth(/api 전체) 뒤에 연결. 권한은 컨트롤러에서 확인
router.get('/summary', work.summary);
router.get('/expenses', work.list);
router.post('/expenses', work.create);
router.get('/expenses/:id', work.detail);
router.post('/expenses/:id', work.update);
router.delete('/expenses/:id', work.remove);
router.post('/expenses/:id/status', work.changeStatus);

module.exports = router;

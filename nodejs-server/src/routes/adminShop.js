const express = require('express');
const ctrl = require('../controllers/adminShopController');
const router = express.Router();

// /api/admin/shop/* — index.js에서 requireAuth + requireHomepage 뒤에 연결
router.get('/members', ctrl.listMembers);
router.post('/members/:id/leave', ctrl.leaveMember);

module.exports = router;

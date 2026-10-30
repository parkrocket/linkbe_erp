const express = require('express');
const admin = require('../controllers/adminController');
const router = express.Router();

// /api/admin/* — index.js에서 requireAuth(/api 전체) 뒤에 requireAdmin과 함께 연결
router.get('/users', admin.listUsers);
router.get('/summary', admin.summary);
router.post('/users/:mbNo/status', admin.changeStatus);
router.post('/users/:mbNo/role', admin.changeRole);
router.get('/balances', admin.listBalances);
router.post('/balances', admin.adjustBalances);
router.get('/balances/:mbNo/logs', admin.balanceLogs);

module.exports = router;

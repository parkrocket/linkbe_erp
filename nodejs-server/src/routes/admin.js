const express = require('express');
const admin = require('../controllers/adminController');
const secretKey = require('../controllers/adminSecretKeyController');
const router = express.Router();

// /api/admin/* — index.js에서 requireAuth(/api 전체) 뒤에 requireAdmin과 함께 연결
router.get('/users', admin.listUsers);
router.get('/summary', admin.summary);
router.get('/users/:mbNo', admin.getUser);
router.post('/users/:mbNo/profile', admin.updateProfile);
router.post('/users/:mbNo/status', admin.changeStatus);
router.post('/users/:mbNo/role', admin.changeRole);
router.post('/users/:mbNo/permission', admin.changePermission);
router.get('/balances', admin.listBalances);
router.post('/balances', admin.adjustBalances);
router.get('/balances/:mbNo/logs', admin.balanceLogs);
router.get('/leaves', admin.listLeaves);
router.post('/leaves/:id/cancel', admin.cancelLeave);
router.get('/org', admin.orgList);
router.post('/org/:kind', admin.orgCreate);
router.post('/org/:kind/:id', admin.orgRename);
router.post('/org/:kind/:id/move', admin.orgMove);
router.delete('/org/:kind/:id', admin.orgDelete);
router.post('/client-secret-key/reveal', secretKey.reveal);

module.exports = router;

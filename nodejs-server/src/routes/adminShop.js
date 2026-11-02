const express = require('express');
const ctrl = require('../controllers/adminShopController');
const router = express.Router();

// /api/admin/shop/* — index.js에서 requireAuth + requireHomepage 뒤에 연결
router.get('/members', ctrl.listMembers);
router.post('/members/:id/leave', ctrl.leaveMember);

router.get('/products', ctrl.listProducts);
router.get('/products/:id', ctrl.getProduct);
router.post('/products', ctrl.saveProduct);
router.post('/products/:id', ctrl.saveProduct);
router.delete('/products/:id', ctrl.deleteProduct);

router.get('/summary', ctrl.summary);
router.get('/orders', ctrl.listOrders);
router.get('/orders/:id', ctrl.getOrder);
router.post('/orders/:id/confirm-deposit', ctrl.confirmDeposit);
router.post('/orders/:id/complete', ctrl.completeOrder);
router.post('/orders/:id/memo', ctrl.setOrderMemo);
router.post('/orders/:id/cancel', ctrl.cancelOrder);

module.exports = router;

const express = require('express');
const ctrl = require('../controllers/memberController');
const shop = require('../controllers/shopController');
const { requireMember } = require('../middlewares/requireMember');
const router = express.Router();

// /api/public/shop/* — 직원 로그인 검사 제외(requireAuth의 '/public/'), 고객 회원은 requireMember
router.post('/members/register', ctrl.register);
router.post('/members/login', ctrl.login);
router.post('/members/logout', ctrl.logout);
router.post('/members/password/forgot', ctrl.forgotPassword);
router.post('/members/password/reset', ctrl.resetPassword);
router.get('/members/me', requireMember, ctrl.me);
router.patch('/members/me', requireMember, ctrl.updateMe);
router.post('/members/me/password', requireMember, ctrl.changePassword);
router.post('/members/me/leave', requireMember, ctrl.leave);

// 개인결제 상품·주문
router.get('/products', shop.listProducts);
router.get('/products/:id', shop.getProduct);
router.get('/pay-options', shop.payOptions);
router.post('/orders', requireMember, shop.createOrder);
router.get('/orders', requireMember, shop.listOrders);
router.get('/orders/:orderNo', requireMember, shop.getOrder);

module.exports = router;

const express = require('express');
const ctrl = require('../controllers/memberController');
const { requireMember } = require('../middlewares/requireMember');
const router = express.Router();

// /api/public/shop/* — 직원 로그인 검사 제외(requireAuth의 '/public/'), 고객 회원은 requireMember
router.post('/members/register', ctrl.register);
router.post('/members/login', ctrl.login);
router.post('/members/logout', ctrl.logout);
router.get('/members/me', requireMember, ctrl.me);
router.patch('/members/me', requireMember, ctrl.updateMe);
router.post('/members/me/password', requireMember, ctrl.changePassword);
router.post('/members/me/leave', requireMember, ctrl.leave);

module.exports = router;

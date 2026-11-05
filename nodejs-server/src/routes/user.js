const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/login', userController.login);

router.post('/register', userController.register);

router.post('/auth', userController.auth);

router.post('/logout', userController.logout);

router.post('/refresh', userController.refresh);

// 마이페이지 — requireAuth 통과한 본인만 (PUBLIC_PATHS 아님)
const me = require('../controllers/meController');
router.get('/me', me.get);
router.post('/me/profile', me.updateProfile);
router.post('/me/password', me.changePassword);

module.exports = router;

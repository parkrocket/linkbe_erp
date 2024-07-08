const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/login', userController.login);

router.post('/register', userController.register);

router.post('/auth', userController.auth);

router.post('/logout', userController.logout);

router.post('/refresh', userController.refresh);

module.exports = router;

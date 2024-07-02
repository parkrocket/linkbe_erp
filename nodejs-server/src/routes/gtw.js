const express = require('express');
const router = express.Router();
const gtwController = require('../controllers/gtwController');

router.post('/companyIn', gtwController.companyIn);

module.exports = router;

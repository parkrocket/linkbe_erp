const express = require('express');
const router = express.Router();
const gtwController = require('../controllers/gtwController');
const gtwStatus = require('../controllers/gtwController');

router.post('/companyIn', gtwController.companyIn);
router.post('/gtwStatus', gtwController.gtwStatus);

module.exports = router;

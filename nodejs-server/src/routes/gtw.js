const express = require('express');
const router = express.Router();
const gtwController = require('../controllers/gtwController');

router.post('/companyIn', gtwController.companyIn);
router.post('/gtwStatus', gtwController.gtwStatus);
router.post('/gtwWeeklyStatus', gtwController.gtwWeeklyStatus);
router.post('/gtwStatusAll', gtwController.gtwStatusAllWeb);

module.exports = router;

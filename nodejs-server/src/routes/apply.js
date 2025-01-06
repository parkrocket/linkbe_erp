const express = require('express');
const router = express.Router();
const applyController = require('../controllers/applyController');

router.post('/applyIn', applyController.applyIn);
router.post('/applyCancel', applyController.applyCancel);

module.exports = router;

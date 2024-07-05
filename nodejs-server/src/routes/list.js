const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

router.post('/lists', listController.lists);

module.exports = router;

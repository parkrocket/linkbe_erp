const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

router.post('/lists', listController.lists);

router.post('/listsMember', listController.listsMember);

module.exports = router;

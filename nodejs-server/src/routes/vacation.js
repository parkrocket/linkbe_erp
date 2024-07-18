const express = require('express');
const router = express.Router();
const vacationController = require('../controllers/vacationController');

router.post('/list', vacationController.list);

router.post('/cancel', vacationController.cancel);


module.exports = router;

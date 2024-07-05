const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

router.post('/list', companyController.list);

module.exports = router;

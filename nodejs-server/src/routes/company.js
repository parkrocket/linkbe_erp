const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

router.post('/list', companyController.list);
router.post('/info', companyController.info);

module.exports = router;

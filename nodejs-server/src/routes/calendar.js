const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

router.post('/in', calendarController.insert);
router.get('/events', calendarController.events);

module.exports = router;

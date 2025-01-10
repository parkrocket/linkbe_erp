const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

router.post('/in', calendarController.insert);
router.post('/update', calendarController.update);
router.post('/delete', calendarController.delete);
router.get('/events', calendarController.events);

module.exports = router;

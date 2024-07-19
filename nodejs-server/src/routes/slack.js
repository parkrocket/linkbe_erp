const express = require('express');
const { handleSlackEvents, handleHomeView, handleGtwCheck, handleInteractions } = require('../controllers/slackController');
const router = express.Router();

router.post('/events', handleSlackEvents);
router.post('/home', handleHomeView);
router.get('/gtwCheck', handleGtwCheck);
router.post('/interactions', handleInteractions);

module.exports = router;
const express = require('express');
const { handleSlackEvents, handleHomeView, handleGtwCheck, handleInteractions } = require('../controllers/slackController');
const { verifySlack, keepRawBody } = require('../middlewares/verifySlack');
const router = express.Router();

// Slack 서버가 호출하는 POST는 서명 검증 필수 / gtwCheck는 암호화 링크로 브라우저가 호출
router.post('/events', verifySlack, handleSlackEvents);
router.post('/home', verifySlack, handleHomeView);
router.get('/gtwCheck', handleGtwCheck);
router.post('/interactions', express.urlencoded({ extended: true, verify: keepRawBody }), verifySlack, handleInteractions);

module.exports = router;

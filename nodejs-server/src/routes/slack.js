const express = require('express');
const { handleSlackEvents, handleHomeView, handleInteractions } = require('../controllers/slackController');
const { verifySlack, keepRawBody } = require('../middlewares/verifySlack');
const router = express.Router();

// Slack 서버가 호출하는 POST는 서명 검증 필수 (출근 링크 gtwCheck는 11-05 삭제 — 키가 공개 저장소에 있어 위조 가능)
router.post('/events', verifySlack, handleSlackEvents);
router.post('/home', verifySlack, handleHomeView);
router.post('/interactions', express.urlencoded({ extended: true, verify: keepRawBody }), verifySlack, handleInteractions);

module.exports = router;

const express = require('express');
const router = express.Router();
const slackApp = require('../utils/slack');

router.post('/events', async (req, res) => {
    await slackApp.requestListener()(req, res);
});

module.exports = router;

const crypto = require('crypto');

// 바디 파서의 verify 옵션 — 서명 검증용 원문을 req.rawBody에 보관
function keepRawBody(req, res, buf) {
    req.rawBody = buf;
}

// Slack 요청 서명 검증 (https://api.slack.com/authentication/verifying-requests-from-slack)
// 위조된 요청으로 다른 사람의 출퇴근을 찍는 것을 막기 위함
function verifySlack(req, res, next) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    const secret = process.env.SLACK_SIGNING_SECRET;

    // 5분 이상 지난 요청은 재전송 공격으로 간주
    const isFresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 60 * 5;
    if (!timestamp || !signature || !secret || !req.rawBody || !isFresh) {
        return res.status(401).send('Invalid Slack request');
    }

    const expected =
        'v0=' +
        crypto
            .createHmac('sha256', secret)
            .update(`v0:${timestamp}:${req.rawBody}`)
            .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).send('Invalid Slack request');
    }
    next();
}

module.exports = { verifySlack, keepRawBody };

const crypto = require('crypto');

// 바디 파서의 verify 옵션 — 서명 검증용 원문을 req.rawBody에 보관
function keepRawBody(req, res, buf) {
    req.rawBody = buf;
}

// SLACK_SIGNING_SECRET은 쉼표로 여러 개 지정 가능 — 같은 주소를 쓰는 Slack 앱이 여러 개라 키가 다름
const signingSecrets = () =>
    (process.env.SLACK_SIGNING_SECRET || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

const matches = (secret, timestamp, rawBody, signature) => {
    const expected = Buffer.from('v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex'));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

// Slack 요청 서명 검증 (https://api.slack.com/authentication/verifying-requests-from-slack)
// 위조된 요청으로 다른 사람의 근태를 신청하는 것을 막기 위함
function verifySlack(req, res, next) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    const secrets = signingSecrets();

    // 5분 이상 지난 요청은 재전송 공격으로 간주
    const isFresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 60 * 5;
    if (!timestamp || !signature || !secrets.length || !req.rawBody || !isFresh) {
        return res.status(401).send('Invalid Slack request');
    }
    if (!secrets.some(secret => matches(secret, timestamp, req.rawBody, signature))) {
        return res.status(401).send('Invalid Slack request');
    }
    next();
}

module.exports = { verifySlack, keepRawBody };

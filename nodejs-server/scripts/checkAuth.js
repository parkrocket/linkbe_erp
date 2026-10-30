// 보안 회귀 점검: node scripts/checkAuth.js [BASE_URL]
// 로그인 없는 접근 차단, Slack 서명 검증, 토큰 통과 여부를 확인 (실사용자 데이터 미사용)
// 실행 위치와 무관하게 nodejs-server/.env 로드
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BASE = process.argv[2] || 'http://localhost:5000';

async function call(path, { method = 'POST', cookie, headers = {}, body = '{}' } = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }), ...headers },
        body: method === 'GET' ? undefined : body,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
}

(async () => {
    // 1) 로그인 없이 보호 API → 401
    for (const path of ['/api/users/refresh', '/api/gtw/gtwStatus', '/api/vacation/list', '/api/list/listsMember']) {
        assert.strictEqual((await call(path)).status, 401, `${path} 로그인 없이 열려 있음`);
    }
    assert.strictEqual((await call('/api/calendar/events', { method: 'GET' })).status, 401, 'calendar/events 열려 있음');
    // 관리자 API: 로그인 없으면 401 (연결 순서가 바뀌어 requireAuth를 건너뛰는 회귀 방지)
    assert.strictEqual((await call('/api/admin/users', { method: 'GET' })).status, 401, 'admin/users 열려 있음');
    assert.strictEqual((await call('/api/admin/users/1/status', { body: '{"status":"approved"}' })).status, 401, 'admin 변경 열려 있음');
    assert.strictEqual((await call('/api/admin/balances', { method: 'GET' })).status, 401, 'admin/balances 열려 있음');
    assert.strictEqual((await call('/api/admin/users/1', { method: 'GET' })).status, 401, 'admin 직원 상세 열려 있음');
    assert.strictEqual((await call('/api/admin/org', { method: 'GET' })).status, 401, 'admin/org 열려 있음');
    assert.strictEqual((await call('/api/admin/balances', { body: '{}' })).status, 401, 'admin/balances 조정 열려 있음');

    // 2) 공개 API는 그대로 열림
    assert.strictEqual((await call('/api/test', { method: 'GET' })).status, 200);
    assert.strictEqual((await call('/api/users/auth')).json.isAuth, false);

    // 3) 위조 토큰 → 401, 정상 서명이어도 승인된 계정이 아니면(없는 계정 포함) 401 — 매 요청 상태 확인
    //    (refresh가 바디가 아닌 토큰 주인을 조회하는지는 checkLoginStatus.js 단위 점검)
    const fake = jwt.sign({ userId: 'nobody@check.invalid' }, 'wrong-secret');
    assert.strictEqual((await call('/api/users/refresh', { cookie: `x_auth=${fake}` })).status, 401);
    const valid = jwt.sign({ userId: 'nobody@check.invalid' }, process.env.JWT_SECRET_KEY);
    const refreshed = await call('/api/users/refresh', { cookie: `x_auth=${valid}`, body: '{"userId":"someone@else"}' });
    assert.strictEqual(refreshed.status, 401, '승인된 계정이 아니면 차단');
    assert.strictEqual(refreshed.json.error, 'Account not active');

    // 4) Slack: 서명 없으면 401, 올바른 서명이면 통과
    assert.strictEqual((await call('/api/slack/home')).status, 401, 'Slack 서명 없이 통과됨');
    const ts = Math.floor(Date.now() / 1000);
    const body = '{"type":"url_verification","challenge":"ok"}';
    const sig = 'v0=' + crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update(`v0:${ts}:${body}`).digest('hex');
    const signed = await call('/api/slack/home', { body, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig } });
    assert.strictEqual(signed.json && signed.json.challenge, 'ok', 'Slack 정상 서명이 거부됨');

    // 4-1) 서명 키 여러 개(쉼표 구분) 지원 — 미들웨어 단위 점검 (Slack 앱이 2개라 키가 다름)
    const { verifySlack } = require('../src/middlewares/verifySlack');
    const original = process.env.SLACK_SIGNING_SECRET;
    process.env.SLACK_SIGNING_SECRET = `first-secret, second-secret`;
    const raw = Buffer.from('payload=%7B%7D');
    const sign = secret => 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex');
    const run = sig =>
        new Promise(resolve => {
            const req = { headers: { 'x-slack-request-timestamp': String(ts), 'x-slack-signature': sig }, rawBody: raw };
            const res = { status: code => ({ send: () => resolve(code) }) };
            verifySlack(req, res, () => resolve(200));
        });
    assert.strictEqual(await run(sign('first-secret')), 200, '첫 번째 키 통과');
    assert.strictEqual(await run(sign('second-secret')), 200, '두 번째 키 통과');
    assert.strictEqual(await run(sign('wrong-secret')), 401, '목록에 없는 키는 거부');
    process.env.SLACK_SIGNING_SECRET = original;

    console.log('checkAuth: 모든 점검 통과 ✅', BASE);
})().catch(err => {
    console.error('checkAuth 실패 ❌', err.message);
    process.exit(1);
});

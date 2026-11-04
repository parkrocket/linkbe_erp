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
    for (const path of ['/api/calendar/in', '/api/calendar/update', '/api/calendar/delete']) {
        assert.strictEqual((await call(path)).status, 401, `${path} 열려 있음`);
    }
    // 관리자 API: 로그인 없으면 401 (연결 순서가 바뀌어 requireAuth를 건너뛰는 회귀 방지)
    assert.strictEqual((await call('/api/admin/users', { method: 'GET' })).status, 401, 'admin/users 열려 있음');
    assert.strictEqual((await call('/api/admin/users/1/status', { body: '{"status":"approved"}' })).status, 401, 'admin 변경 열려 있음');
    assert.strictEqual((await call('/api/admin/balances', { method: 'GET' })).status, 401, 'admin/balances 열려 있음');
    assert.strictEqual((await call('/api/admin/users/1', { method: 'GET' })).status, 401, 'admin 직원 상세 열려 있음');
    assert.strictEqual((await call('/api/admin/org', { method: 'GET' })).status, 401, 'admin/org 열려 있음');
    assert.strictEqual((await call('/api/admin/homepage/inquiries', { method: 'GET' })).status, 401, '홈페이지 관리 API 열려 있음');
    assert.strictEqual((await call('/api/admin/shop/members', { method: 'GET' })).status, 401, '고객 회원 관리 API 열려 있음');
    for (const p of ['orders', 'products']) assert.strictEqual((await call(`/api/admin/shop/${p}`, { method: 'GET' })).status, 401, `쇼핑 관리 ${p} API 열려 있음`);
    assert.strictEqual((await call('/api/admin/leaves?from=2026-11-01&to=2026-11-30', { method: 'GET' })).status, 401, 'admin/leaves 열려 있음');
    assert.strictEqual((await call('/api/admin/leaves/1/cancel', { body: '{"reason":"x"}' })).status, 401, 'admin 대신 취소 열려 있음');
    assert.strictEqual((await call('/api/admin/balances', { body: '{}' })).status, 401, 'admin/balances 조정 열려 있음');

    // 업무 도구(경비) API: 로그인 없으면 401
    for (const [method, p] of [['GET', '/api/work/expenses'], ['POST', '/api/work/expenses'], ['GET', '/api/work/summary']]) {
        assert.strictEqual((await call(p, { method })).status, 401, `${p} 업무 API 열려 있음`);
    }

    // 견적·계약서·양식 설정 API: 로그인 없으면 401
    for (const [method, p] of [['GET', '/api/work/contracts'], ['GET', '/api/work/contracts/companies?q=a'], ['POST', '/api/work/contracts'], ['GET', '/api/work/doc-settings'], ['POST', '/api/work/doc-settings/doc-templates'], ['GET', '/api/work/ledger'], ['POST', '/api/work/ledger'], ['GET', '/api/work/accounts'], ['POST', '/api/work/accounts'], ['GET', '/api/work/boards/viral'], ['POST', '/api/work/boards/viral'], ['GET', '/api/work/boards/viral/1'], ['POST', '/api/work/boards/viral/1/comments']]) {
        assert.strictEqual((await call(p, { method })).status, 401, `${p} 계약 API 열려 있음`);
    }

    // 거래처 접속정보 API(보기·첨부 내려받기 포함): 로그인 없으면 401
    for (const [method, p] of [['GET', '/api/work/clients'], ['POST', '/api/work/clients'], ['GET', '/api/work/clients/1'], ['POST', '/api/work/clients/1/credentials/1/reveal'], ['POST', '/api/work/clients/1/legacy-memo/reveal'], ['POST', '/api/work/clients/1/files'], ['GET', '/api/work/clients/1/files/1']]) {
        assert.strictEqual((await call(p, { method })).status, 401, `${p} 접속정보 API 열려 있음`);
    }

    // 2) 공개 API는 그대로 열림
    // 본문 크기: 관리자 글(최대 500KB HTML)이 들어가도록 JSON 한도 1MB (기본 100KB면 413)
    assert.notStrictEqual((await call('/api/test', { body: JSON.stringify({ x: 'a'.repeat(300 * 1024) }) })).status, 413, 'JSON 본문 한도가 너무 작음');
    // 홈페이지 공개 API는 로그인 없이 (테이블 생성 전이면 500일 수 있어 401이 아닌 것만 확인)
    assert.notStrictEqual((await call('/api/public/homepage/faqs', { method: 'GET' })).status, 401, '홈페이지 공개 API가 막힘');
    // '/public'이 들어간 다른 경로까지 열리면 안 됨
    assert.strictEqual((await call('/api/users/public', { method: 'GET' })).status, 401, '/public 접두사가 다른 경로를 엶');
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

    // 3-1) 직원 로그인과 고객 회원 로그인 상호 차단 (서명 검증에서 막혀 DB에 닿지 않음)
    const memberOnly = jwt.sign({ mid: 1 }, process.env.MEMBER_JWT_SECRET || 'member-test'); // 고객 키로 서명해도 직원 API는 열리면 안 됨
    assert.strictEqual((await call('/api/vacation/list', { cookie: `lb_member=${memberOnly}` })).status, 401, '고객 쿠키로 직원 API 통과');
    const staffOnly = jwt.sign({ userId: 'nobody@check.invalid' }, process.env.JWT_SECRET_KEY);
    assert.strictEqual((await call('/api/public/shop/members/me', { method: 'GET', cookie: `x_auth=${staffOnly}` })).status, 401, '직원 쿠키로 고객 API 통과');

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

// 암호화 키 확인 API 점검: node scripts/checkSecretKeyView.js  (모델·Slack·환경변수 가짜 — 운영 DB 호출 없음)
const assert = require('assert');
const bcrypt = require('bcrypt');

const FAKE_KEY = Buffer.alloc(32, 7).toString('base64'); // 가짜 키
const PASSWORD = 'pw-테스트-1234';

// 콘솔 가로채기: 키·비밀번호가 찍히지 않아야 함
const printed = [];
for (const k of ['log', 'error', 'warn', 'info']) console[k] = (...a) => printed.push(a.map(x => (x instanceof Error ? `${x.message} ${x.stack}` : String(x))).join(' '));

const slack = require('../src/utils/slack');
const notices = [];
let slackFail = false;
slack.sendSlackMessage = async (channel, text) => {
    if (slackFail) throw new Error('slack down');
    notices.push({ channel, text });
};

const Admin = require('../src/models/adminModel');
const { CredentialLog } = require('../src/models/clientModel');
const hash = bcrypt.hashSync(PASSWORD, 4);
Admin.findPasswordHash = async (cp, id) => (cp === 1 && id === 'me@x' ? hash : null);
Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍<길동>' });
const logs = [];
let logFail = false;
CredentialLog.insert = async (db, entry) => {
    if (logFail) throw Object.assign(new Error('log failed'), { code: 'ER_X' });
    logs.push(entry);
};

const ctrl = require('../src/controllers/adminSecretKeyController');
const { requireAdmin } = require('../src/middlewares/requireAdmin');
const routes = require('../src/routes/admin');
const rateLimit = require('../src/utils/rateLimit');

const call = async (body, req) => {
    const res = { code: 200, headers: {}, headersSent: false };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.set = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
    await ctrl.reveal({ body, userCpId: 1, userId: 'me@x', ...req }, res);
    return res;
};

(async () => {
    // 라우터에 연결됨 + 관리자 아니면 requireAdmin이 403
    assert.ok(routes.stack.some(l => l.route && l.route.path === '/client-secret-key/reveal' && l.route.methods.post), '라우터 연결 안 됨');
    let r = { code: 0 };
    r.status = c => ((r.code = c), r);
    r.json = () => r;
    requireAdmin({ userRole: 'member' }, r, () => assert.fail('통과하면 안 됨'));
    assert.strictEqual(r.code, 403);

    process.env.CLIENT_SECRET_KEY = FAKE_KEY;
    // 입력 검사
    for (const body of [undefined, {}, { password: 1 }, { password: '' }, { password: 'a'.repeat(201) }]) assert.strictEqual((await call(body)).code, 400);
    assert.strictEqual(logs.length, 0);

    // 틀림 5번 → 403, 6번째 429 (맞는 비밀번호여도 막힘)
    for (let i = 0; i < 5; i++) {
        const w = await call({ password: 'nope' });
        assert.deepStrictEqual([w.code, w.body.error], [403, 'Wrong password']);
    }
    let res = await call({ password: PASSWORD });
    assert.deepStrictEqual([res.code, res.body.error], [429, 'Too many attempts']);
    assert.strictEqual(logs.length + notices.length, 0);
    rateLimit.reset();

    // 맞음: 키 + no-store + 기록 + Slack(이스케이프)
    res = await call({ password: PASSWORD });
    assert.deepStrictEqual([res.code, res.body], [200, { key: FAKE_KEY }]);
    assert.strictEqual(res.headers['cache-control'], 'no-store');
    assert.deepStrictEqual(logs, [{ cpId: 1, clientId: 0, credentialId: null, target: 'key', action: 'view', actor: { no: 7, name: '홍<길동>' } }]);
    assert.deepStrictEqual(notices, [{ channel: '#hibye-관리', text: '홍&lt;길동&gt;님이 거래처 접속정보 암호화 키를 확인했어요' }]);

    // 성공하면 실패 횟수 초기화
    for (let i = 0; i < 4; i++) await call({ password: 'nope' });
    assert.strictEqual((await call({ password: PASSWORD })).code, 200);
    assert.strictEqual((await call({ password: 'nope' })).code, 403);
    rateLimit.reset();

    // Slack 실패는 무시
    slackFail = true;
    assert.strictEqual((await call({ password: PASSWORD })).code, 200);
    slackFail = false;

    // 다른 사용자(해시 없음) 403
    assert.strictEqual((await call({ password: PASSWORD }, { userId: 'x@x' })).code, 403);
    rateLimit.reset();

    // 키 없음/형식 오류 503 — 기록·Slack 없음
    const before = [logs.length, notices.length];
    for (const bad of [undefined, 'short']) {
        if (bad === undefined) delete process.env.CLIENT_SECRET_KEY;
        else process.env.CLIENT_SECRET_KEY = bad;
        res = await call({ password: PASSWORD });
        assert.deepStrictEqual([res.code, res.body.error], [503, 'Secret key missing']);
    }
    assert.deepStrictEqual([logs.length, notices.length], before);
    process.env.CLIENT_SECRET_KEY = FAKE_KEY;

    // 기록 실패 500 — 키 없음, Slack 없음
    logFail = true;
    res = await call({ password: PASSWORD });
    assert.deepStrictEqual([res.code, res.body], [500, { error: 'Database query error' }]);
    assert.deepStrictEqual(notices.length, before[1]);
    logFail = false;

    // 출력에 키·비밀번호 없음
    const out = printed.join('\n');
    assert.ok(!out.includes(FAKE_KEY) && !out.includes(PASSWORD) && !out.includes(hash), '로그에 비밀 노출');
    process.stdout.write('checkSecretKeyView OK\n');
    process.exit(0);
})().catch(e => {
    process.stdout.write(`FAIL ${e.stack}\n`);
    process.exit(1);
});

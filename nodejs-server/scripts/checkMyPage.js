// 마이페이지·로그인 무효화 점검: node scripts/checkMyPage.js  (DB·Slack 가짜)
// - 본인만 조회·수정, 허용 칸만(입사일·부서 등은 무시), 이름 바뀌면 #hibye-관리 알림
// - 비밀번호: 현재 비밀번호 확인, 규칙, 15분 5회 제한, 변경 시각 이전 로그인 거절(다른 기기), 지금 기기는 같은 만료로 새 로그인
// - 비활성 계정·무효 로그인은 401 + 쿠키 삭제
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret';
const assert = require('assert');
const jwt = require('jsonwebtoken');

const slack = require('../src/utils/slack');
const sent = [];
slack.sendSlackMessage = async (channel, text) => sent.push([channel, text]);

const User = require('../src/models/userModel');
const rateLimit = require('../src/utils/rateLimit');
const db = { me: null, profile: null, password: null, hash: 'hash-of-old' };
User.findMe = async id => (id === 'me@linkbe' ? { ...db.me } : undefined);
User.updateSelfProfile = async (id, v) => ((db.profile = { id, ...v }), (db.me = { ...db.me, user_name: v.name }));
User.findPasswordHash = async () => db.hash;
User.comparePassword = (pw, hash, cb) => cb(null, pw === 'OldPass1!' && hash === 'hash-of-old');
User.updatePassword = async (id, pw, sec) => (db.password = { id, pw, sec });
let statusRow;
User.findStatusById = async () => statusRow;

const me = require('../src/controllers/meController');
const { requireAuth } = require('../src/middlewares/requireAuth');
const { isRevoked } = require('../src/utils/authCookie');

const fakeRes = () => {
    const r = { code: 200, headers: {} };
    r.status = c => ((r.code = c), r);
    r.set = (k, v) => ((r.headers[k] = v), r);
    r.json = b => ((r.body = b), r);
    r.cookie = (name, value, options) => (r.cookie = { name, value, options });
    r.clearCookie = name => (r.cleared = name);
    return r;
};
const run = async (fn, req) => {
    const res = fakeRes();
    await fn({ userId: 'me@linkbe', body: {}, ...req }, res);
    return res;
};
const middleware = req =>
    new Promise(resolve => {
        const res = fakeRes();
        res.json = b => (resolve({ code: res.code, body: b, cleared: res.cleared }), res);
        requireAuth(req, res, () => resolve({ code: 'next', req }));
    });

(async () => {
    // 조회: 토큰 주인만, 캐시 금지
    db.me = { user_id: 'me@linkbe', user_name: '김직원', user_phone: '010-1111-2222' };
    let r = await run(me.get, { body: { userId: 'other@linkbe' } });
    assert.strictEqual(r.body.me.user_id, 'me@linkbe', '바디 userId 무시');
    assert.strictEqual(r.headers['Cache-Control'], 'no-store');

    // 수정: 허용 칸만 저장(입사일·부서·고용형태는 무시), 검사 실패는 400
    r = await run(me.updateProfile, { body: { name: ' 김직원 ', phone: '010-3333-4444', gender: 'female', birth: '1995-07-01', doe: '2020-01-01', deptId: 9, employmentType: 'intern', userId: 'other' } });
    assert.strictEqual(r.code, 200);
    assert.deepStrictEqual(db.profile, { id: 'me@linkbe', name: '김직원', phone: '010-3333-4444', gender: 'female', birth: '1995-07-01' });
    assert.strictEqual(sent.length, 0, '이름 그대로면 알림 없음');
    for (const [body, error] of [
        [{ name: '', phone: '010-1111-2222' }, 'Invalid name'],
        [{ name: '김', phone: '12' }, 'Invalid phone'],
        [{ name: '김', phone: '010-1111-2222', gender: 'x' }, 'Invalid gender'],
        [{ name: '김', phone: '010-1111-2222', birth: '2999-01-01' }, 'Invalid birth'],
    ]) {
        r = await run(me.updateProfile, { body });
        assert.deepStrictEqual([r.code, r.body.error], [400, error]);
    }
    // 이름 변경 → #hibye-관리 한 줄, 사용자 입력은 이스케이프
    r = await run(me.updateProfile, { body: { name: '<b>새이름', phone: '010-1111-2222', gender: null, birth: null } });
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0][0], '#hibye-관리');
    assert.ok(sent[0][1].includes('&lt;b&gt;새이름') && !sent[0][1].includes('<b>'), 'Slack 이스케이프');
    assert.ok(!sent[0][1].includes('010-'), '연락처는 알림에 넣지 않음');

    // 비밀번호: 틀림 403, 규칙 400, 같은 비밀번호 400
    rateLimit.reset();
    const exp = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60; // 남은 기간 10일
    r = await run(me.changePassword, { tokenExp: exp, body: { current: 'Wrong1!!', next: 'NewPass2@' } });
    assert.deepStrictEqual([r.code, r.body.error], [403, 'Wrong password']);
    r = await run(me.changePassword, { tokenExp: exp, body: { current: 'OldPass1!', next: 'short' } });
    assert.deepStrictEqual([r.code, r.body.error], [400, 'Invalid new password']);
    r = await run(me.changePassword, { tokenExp: exp, body: { current: 'OldPass1!', next: 'OldPass1!' } });
    assert.deepStrictEqual([r.code, r.body.error], [400, 'Same password']);
    assert.strictEqual(db.password, null, '실패하면 바꾸지 않음');
    // 성공: 저장, 지금 기기는 같은 만료(남은 10일)로 새 로그인, 발급 시각 = 변경 시각
    r = await run(me.changePassword, { tokenExp: exp, body: { current: 'OldPass1!', next: 'NewPass2@' } });
    assert.strictEqual(r.code, 200);
    assert.deepStrictEqual([db.password.id, db.password.pw], ['me@linkbe', 'NewPass2@']);
    const issued = jwt.decode(r.cookie.value);
    assert.strictEqual(issued.userId, 'me@linkbe');
    assert.strictEqual(issued.iat, db.password.sec, '새 로그인 발급 시각 = 변경 시각');
    assert.ok(Math.abs(issued.exp - exp) <= 1, '만료는 원래 로그인과 같음');
    assert.ok(Math.abs(r.cookie.options.maxAge - (exp - db.password.sec) * 1000) <= 1000);
    assert.strictEqual(r.cookie.options.httpOnly, true);

    // 15분 5회 — 시도 전에 셈, 6번째는 맞는 비밀번호여도 429
    rateLimit.reset();
    for (let i = 0; i < 5; i++) await run(me.changePassword, { tokenExp: exp, body: { current: 'Wrong1!!', next: 'NewPass2@' } });
    r = await run(me.changePassword, { tokenExp: exp, body: { current: 'OldPass1!', next: 'NewPass3#' } });
    assert.deepStrictEqual([r.code, r.body.error], [429, 'Too many attempts']);

    // 무효 판정: 변경 시각보다 먼저 발급된 로그인만 거절, 같은 초는 유효, 변경 이력 없으면 유효
    assert.strictEqual(isRevoked(100, 101), true);
    assert.strictEqual(isRevoked(101, 101), false);
    assert.strictEqual(isRevoked(100, null), false);

    // requireAuth: 비밀번호 바꾸기 전 로그인 → 401 Session expired + 쿠키 삭제, 바꾼 뒤 로그인은 통과
    const now = Math.floor(Date.now() / 1000);
    const old = jwt.sign({ userId: 'me@linkbe', iat: now - 100 }, process.env.JWT_SECRET_KEY, { expiresIn: 3600 });
    const fresh = jwt.sign({ userId: 'me@linkbe', iat: now }, process.env.JWT_SECRET_KEY, { expiresIn: 3600 });
    const req = token => ({ path: '/users/me', headers: { cookie: `x_auth=${token}` } });
    statusRow = { user_status: 'approved', user_role: 'member', cp_id: 1, pw_changed_sec: now - 10 };
    let m = await middleware(req(old));
    assert.deepStrictEqual([m.code, m.body.error, m.cleared], [401, 'Session expired', 'x_auth']);
    m = await middleware(req(fresh));
    assert.strictEqual(m.code, 'next');
    assert.ok(m.req.tokenExp > now, '만료 시각 전달(비밀번호 변경 후 새 로그인용)');
    // 비활성 계정 → 401 + 쿠키 삭제
    statusRow = { user_status: 'inactive', user_role: 'member', cp_id: 1 };
    m = await middleware(req(fresh));
    assert.deepStrictEqual([m.code, m.body.error, m.cleared], [401, 'Account not active', 'x_auth']);

    console.log('checkMyPage ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkMyPage 실패 ❌', err);
    process.exit(1);
});

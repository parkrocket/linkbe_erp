// 고객 회원 API 점검: node scripts/checkMember.js  (Member·Slack 가짜, 컨트롤러 직접 호출 — DB 접속 없음)
process.env.MEMBER_JWT_SECRET = 'test-member';
process.env.JWT_SECRET_KEY = 'test-staff';
const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('../src/utils/rateLimit');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => void notices.push({ channel, text });

const Member = require('../src/models/memberModel');
const calls = { leave: [], markLogin: [], create: [], updatePassword: [], updateProfile: [] };
let dupMessage = null;
let byLoginId = {};
let session; // findForSession 결과
let hash;
Member.create = async v => {
    if (dupMessage) throw Object.assign(new Error(dupMessage), { code: 'ER_DUP_ENTRY' });
    calls.create.push(v);
    return 5;
};
Member.findByLoginId = async id => byLoginId[id];
Member.findForSession = async () => session;
Member.markLogin = async (id, h) => void calls.markLogin.push([id, h]);
Member.leave = async id => void calls.leave.push(id);
Member.updatePassword = async (id, h) => void calls.updatePassword.push([id, h]);
Member.updateProfile = async (id, v) => {
    if (dupMessage) throw Object.assign(new Error(dupMessage), { code: 'ER_DUP_ENTRY' });
    calls.updateProfile.push([id, v]);
};
Member.findPasswordHash = async () => hash;

const { requireMember } = require('../src/middlewares/requireMember');
const ctrl = require('../src/controllers/memberController');

const mkRes = () => {
    const res = { code: 200, cookies: [], cleared: [] };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.cookie = (n, v, o) => res.cookies.push({ n, v, o });
    res.clearCookie = (n, o) => res.cleared.push({ n, o });
    return res;
};
const call = async (fn, req) => {
    const res = mkRes();
    await fn({ ip: '1.1.1.1', body: {}, headers: {}, ...req }, res);
    return res;
};
const reg = { loginId: 'newuser', password: 'password1', name: '홍길동', email: 'a@b.co', phone: '010-1234-5678', agree: '1', website: '', startedAt: String(Date.now() - 10000) };
const reset = () => {
    rateLimit.reset();
    notices = [];
    dupMessage = null;
    for (const k of Object.keys(calls)) calls[k] = [];
};
const tokenFor = (mid, secret = 'test-member') => jwt.sign({ mid }, secret);

(async () => {
    // ── 가입 ──
    reset();
    let r = await call(ctrl.register, { body: reg });
    assert.deepStrictEqual(r.body, { ok: true, member: { id: 5, loginId: 'newuser', name: '홍길동' } });
    const ck = r.cookies[0];
    assert.strictEqual(ck.n, 'lb_member');
    assert.ok(ck.o.httpOnly && ck.o.sameSite === 'lax' && ck.o.maxAge === 7 * 24 * 3600 * 1000, '쿠키 속성');
    assert.strictEqual(jwt.verify(ck.v, 'test-member').mid, 5);
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].channel, '#결제');
    assert.ok(notices[0].text.includes('[회원가입]') && notices[0].text.includes('홍길동') && !/a@b\.co|010/.test(notices[0].text));
    assert.ok(calls.create[0].passwordHash.startsWith('$2'), 'bcrypt 해시 저장');

    reset();
    r = await call(ctrl.register, { body: { ...reg, website: 'x' } });
    assert.deepStrictEqual(r.body, { ok: true });
    r = await call(ctrl.register, { body: { ...reg, startedAt: String(Date.now() - 2000) } });
    assert.deepStrictEqual(r.body, { ok: true });
    assert.strictEqual(calls.create.length, 0, '함정은 저장 0건');

    reset();
    for (let i = 0; i < 5; i++) assert.strictEqual((await call(ctrl.register, { body: { ...reg, loginId: 'user' + i + 'abc' } })).code, 200);
    r = await call(ctrl.register, { body: reg });
    assert.strictEqual(r.code, 429);
    assert.deepStrictEqual(r.body, { error: 'Too many requests' });

    reset();
    r = await call(ctrl.register, { body: { ...reg, loginId: 'ab' } });
    assert.strictEqual(r.code, 400);
    dupMessage = "Duplicate entry 'x' for key 'hp_member.login_id'";
    r = await call(ctrl.register, { body: reg });
    assert.deepStrictEqual([r.code, r.body], [409, { error: 'Login id taken' }]);
    dupMessage = "Duplicate entry 'x' for key 'hp_member.email'";
    r = await call(ctrl.register, { body: reg });
    assert.deepStrictEqual([r.code, r.body], [409, { error: 'Email taken' }]);

    // ── 로그인 ──
    reset();
    const bc = await bcrypt.hash('secret-pw1', 4);
    const sha1 = d => crypto.createHash('sha1').update(d).digest();
    const old = '*' + sha1(sha1(Buffer.from('oldpw'))).toString('hex').toUpperCase();
    byLoginId = {
        Old_User: { id: 9, login_id: 'Old_User', name: '예전', password_hash: old },
        bcuser: { id: 8, login_id: 'bcuser', name: '새', password_hash: bc },
    };
    r = await call(ctrl.login, { body: { loginId: ' Old_User ', password: 'oldpw' } });
    assert.deepStrictEqual(r.body, { ok: true, member: { id: 9, loginId: 'Old_User', name: '예전' } });
    assert.strictEqual(calls.markLogin[0][0], 9);
    assert.ok(calls.markLogin[0][1].startsWith('$2'), '예전 형식은 재해시 전달');
    r = await call(ctrl.login, { body: { loginId: 'bcuser', password: 'secret-pw1' } });
    assert.strictEqual(r.body.ok, true);
    assert.strictEqual(calls.markLogin[1][1], null);
    assert.strictEqual(r.cookies[0].n, 'lb_member');

    reset();
    const nouser = await call(ctrl.login, { body: { loginId: 'ghost', password: 'whatever1' } });
    const wrong = await call(ctrl.login, { body: { loginId: 'bcuser', password: 'wrong-pw99' } });
    assert.deepStrictEqual([nouser.code, nouser.body], [401, { error: 'Invalid credentials' }]);
    assert.deepStrictEqual([wrong.code, wrong.body], [401, { error: 'Invalid credentials' }]);
    for (let i = 0; i < 4; i++) await call(ctrl.login, { body: { loginId: 'bcuser', password: 'wrong-pw99' } }); // wrong 포함 총 5번 실패
    r = await call(ctrl.login, { body: { loginId: 'bcuser', password: 'secret-pw1' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many attempts' }], '6번째는 맞아도 429');
    r = await call(ctrl.login, { body: { loginId: 'BCUSER', password: 'secret-pw1' } });
    assert.strictEqual(r.code, 429, '대소문자 달라도 같은 키');
    r = await call(ctrl.login, { ip: '9.9.9.9', body: { loginId: 'bcuser', password: 'secret-pw1' } });
    assert.strictEqual(r.body.ok, true, '다른 IP는 영향 없음');

    // ── 로그아웃 ──
    r = await call(ctrl.logout, {});
    assert.deepStrictEqual(r.body, { ok: true });
    assert.strictEqual(r.cleared[0].n, 'lb_member');

    // ── requireMember ──
    const runMw = async cookie => {
        const res = mkRes();
        const req = { headers: cookie ? { cookie } : {} };
        let passed = false;
        await requireMember(req, res, () => (passed = true));
        return { res, req, passed };
    };
    let m = await runMw();
    assert.deepStrictEqual([m.res.code, m.res.body], [401, { error: 'Login required' }]);
    session = { id: 5, login_id: 'a', name: 'n', email: 'e', phone: 'p', created_at: 'c', token_stale: 0 };
    m = await runMw(`lb_member=${tokenFor(5, 'test-staff')}`);
    assert.strictEqual(m.res.code, 401, '직원 비밀키 토큰 거부');
    m = await runMw(`lb_member=${jwt.sign({ mid: 5 }, 'test-member', { algorithm: 'HS512' })}`);
    assert.strictEqual(m.res.code, 401, 'HS256 외 거부');
    session = undefined;
    m = await runMw(`lb_member=${tokenFor(5)}`);
    assert.strictEqual(m.res.code, 401, '탈퇴/없음');
    session = { id: 5, token_stale: 1 };
    m = await runMw(`lb_member=${tokenFor(5)}`);
    assert.strictEqual(m.res.code, 401, '비밀번호 변경 뒤 옛 토큰');
    session = { id: 5, login_id: 'a', name: 'n', email: 'e', phone: 'p', created_at: 'c', token_stale: 0 };
    m = await runMw(`x=1; lb_member=${tokenFor(5)}`);
    assert.ok(m.passed && m.req.member.id === 5, '정상');
    process.env.MEMBER_JWT_SECRET = '';
    m = await runMw(`lb_member=${tokenFor(5)}`);
    assert.strictEqual(m.res.code, 401, '비밀키 없으면 안전하게 실패');
    reset();
    r = await call(ctrl.register, { body: reg });
    assert.strictEqual(r.code, 500, '비밀키 없으면 쿠키 발급 실패(서버는 유지)');
    process.env.MEMBER_JWT_SECRET = 'test-member';

    // ── me ──
    const member = { id: 5, login_id: 'a', name: 'n', email: 'e', phone: 'p', created_at: 'c' };
    r = await call(ctrl.me, { member });
    assert.deepStrictEqual(r.body, { member: { id: 5, loginId: 'a', name: 'n', email: 'e', phone: 'p', createdAt: 'c' } });
    assert.ok(!('password_hash' in r.body.member) && !('reset_token_hash' in r.body.member));

    reset();
    r = await call(ctrl.updateMe, { member, body: { name: '새이름', email: 'X@B.co', phone: '' } });
    assert.deepStrictEqual(calls.updateProfile[0], [5, { name: '새이름', email: 'x@b.co', phone: null }]);
    assert.strictEqual(r.body.ok, true);
    r = await call(ctrl.updateMe, { member, body: { name: '', email: 'x@b.co' } });
    assert.strictEqual(r.code, 400);
    dupMessage = "Duplicate entry for key 'hp_member.email'";
    r = await call(ctrl.updateMe, { member, body: { name: 'n', email: 'x@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [409, { error: 'Email taken' }]);

    // ── 비밀번호 변경 ──
    reset();
    hash = bc;
    r = await call(ctrl.changePassword, { member, body: { currentPassword: 'nope-nope1', newPassword: 'newpassword1' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Wrong password' }]);
    assert.strictEqual(calls.updatePassword.length, 0);
    r = await call(ctrl.changePassword, { member, body: { currentPassword: 'secret-pw1', newPassword: 'short' } });
    assert.strictEqual(r.code, 400);
    r = await call(ctrl.changePassword, { member, body: { currentPassword: 'secret-pw1', newPassword: 'newpassword1' } });
    assert.strictEqual(r.body.ok, true);
    assert.ok(calls.updatePassword[0][1].startsWith('$2') && r.cookies[0].n === 'lb_member', '새 쿠키 발급');

    // ── 탈퇴 ──
    reset();
    r = await call(ctrl.leave, { member, body: { password: 'wrong-pw99' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Wrong password' }]);
    assert.strictEqual(calls.leave.length, 0);
    assert.strictEqual(notices.length, 0);
    r = await call(ctrl.leave, { member, body: { password: 'secret-pw1' } });
    assert.deepStrictEqual(calls.leave, [5]);
    assert.strictEqual(r.cleared[0].n, 'lb_member');
    assert.ok(notices.length === 1 && notices[0].text.includes('[회원탈퇴]') && notices[0].channel === '#결제');
    hash = old; // 예전 형식 해시도 확인 가능
    r = await call(ctrl.leave, { member, body: { password: 'oldpw' } });
    assert.strictEqual(r.body.ok, true);

    console.log('checkMember OK');
    process.exit(0);
})().catch(err => {
    console.error('checkMember 실패', err);
    process.exit(1);
});

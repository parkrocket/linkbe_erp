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

const mailer = require('../src/utils/mailer');
const mails = [];
let mailFail = false;
mailer.sendMail = async m => {
    if (mailFail) throw Object.assign(new Error(`smtp down for ${m.to}`), { code: 'EENVELOPE' });
    mails.push(m);
};

const Member = require('../src/models/memberModel');
const resetCalls = [];
let resetTarget = { id: 5, name: '홍길동', email: 'a@b.co' };
let resetOk = true;
let resetThrows = false;
Member.setResetToken = async (email, th) => {
    resetCalls.push([email, th]);
    if (resetThrows) throw new Error('db down');
    return resetTarget;
};
const resetByToken = [];
Member.resetPasswordByToken = async (th, h) => (resetByToken.push([th, h]), resetOk);
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
let leaveResult = true;
Member.leave = async id => (calls.leave.push(id), leaveResult);
Member.updatePassword = async (id, h) => void calls.updatePassword.push([id, h]);
Member.updateProfile = async (id, v, emailChanged) => {
    if (dupMessage) throw Object.assign(new Error(dupMessage), { code: 'ER_DUP_ENTRY' });
    calls.updateProfile.push([id, v, emailChanged]);
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
    mails.length = resetCalls.length = resetByToken.length = 0;
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
    dupMessage = "Duplicate entry 'x' for key 'hp_member.uq_email'";
    r = await call(ctrl.register, { body: reg });
    assert.deepStrictEqual([r.code, r.body], [409, { error: 'Email taken' }]);
    dupMessage = "Duplicate entry 'login_id@x.co' for key 'uq_email'"; // 값에 login_id가 있어도 키 이름으로 판단
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

    // 응답 시간 균등화: 세 경우 모두 bcrypt.compare 정확히 1회
    reset();
    const origCompare = bcrypt.compare;
    let compares = 0;
    bcrypt.compare = (...a) => (compares++, origCompare(...a));
    for (const [id, pw, label] of [['ghost', 'x', '없는 아이디'], ['bcuser', 'wrong-pw99', 'bcrypt 사용자'], ['Old_User', 'oldpw', '예전 형식']]) {
        compares = 0;
        await call(ctrl.login, { body: { loginId: id, password: pw } });
        assert.strictEqual(compares, 1, `${label}: bcrypt 1회`);
    }
    bcrypt.compare = origCompare;

    // 병렬 실패 10건 중 5건 초과분은 429 (확인 전에 먼저 센다)
    reset();
    const burst = await Promise.all(Array.from({ length: 10 }, () => call(ctrl.login, { body: { loginId: 'bcuser', password: 'wrong-pw99' } })));
    assert.strictEqual(burst.filter(x => x.code === 429).length, 5, '병렬 10건 중 5건 429');
    assert.strictEqual(burst.filter(x => x.code === 401).length, 5);
    // 같은 IP 총량: 아이디를 바꿔 가며 30회 실패 → 31번째(다른 아이디·맞는 비밀번호여도) 429, 다른 IP는 영향 없음
    reset();
    for (let i = 0; i < 30; i++) assert.strictEqual((await call(ctrl.login, { body: { loginId: 'spray' + i, password: 'x' } })).code, 401, `${i + 1}번째 401`);
    r = await call(ctrl.login, { body: { loginId: 'bcuser', password: 'secret-pw1' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many attempts' }], 'IP 총량 31번째 429');
    r = await call(ctrl.login, { ip: '9.9.9.9', body: { loginId: 'bcuser', password: 'secret-pw1' } });
    assert.strictEqual(r.body.ok, true, '다른 IP는 영향 없음');
    // 성공은 아이디 키만 비움(IP 총량은 유지)
    reset();
    for (let i = 0; i < 29; i++) await call(ctrl.login, { body: { loginId: 'spray' + i, password: 'x' } });
    assert.strictEqual((await call(ctrl.login, { body: { loginId: 'bcuser', password: 'secret-pw1' } })).body.ok, true, '30번째 성공');
    assert.strictEqual((await call(ctrl.login, { body: { loginId: 'bcuser', password: 'secret-pw1' } })).code, 429, '성공해도 IP 총량은 그대로');

    // 너무 긴/빈 아이디는 제한 키를 만들지 않고 401
    reset();
    r = await call(ctrl.login, { body: { loginId: 'a'.repeat(1000), password: 'x' } });
    assert.deepStrictEqual([r.code, r.body], [401, { error: 'Invalid credentials' }]);
    r = await call(ctrl.login, { body: { loginId: '   ', password: 'x' } });
    assert.strictEqual(r.code, 401);
    rateLimit.reset();
    // 키 생성 여부: hit이 한 번도 호출되지 않아야 함
    const origHit = rateLimit.hit;
    let hitCalls = 0;
    rateLimit.hit = (...a) => (hitCalls++, origHit(...a));
    await call(ctrl.login, { body: { loginId: 'a'.repeat(1000), password: 'x' } });
    rateLimit.hit = origHit;
    assert.strictEqual(hitCalls, 0, '긴 아이디는 rateLimit 미사용');

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

    m = await runMw('lb_member=%E0%A4%A');
    assert.strictEqual(m.res.code, 401, '깨진 인코딩 쿠키는 401');

    // ── me ──
    const member = { id: 5, login_id: 'a', name: 'n', email: 'e', phone: 'p', created_at: 'c' };
    r = await call(ctrl.me, { member });
    assert.deepStrictEqual(r.body, { member: { id: 5, loginId: 'a', name: 'n', email: 'e', phone: 'p', createdAt: 'c' } });
    assert.ok(!('password_hash' in r.body.member) && !('reset_token_hash' in r.body.member));

    reset();
    hash = bc;
    const me5 = { ...member, email: 'x@b.co' };
    // 이메일 그대로(대소문자만 다름)면 비밀번호 불필요, 토큰 유지
    r = await call(ctrl.updateMe, { member: me5, body: { name: '새이름', email: 'X@B.co', phone: '' } });
    assert.deepStrictEqual(calls.updateProfile[0], [5, { name: '새이름', email: 'x@b.co', phone: null }, false]);
    assert.strictEqual(r.body.ok, true);
    r = await call(ctrl.updateMe, { member: me5, body: { name: '', email: 'x@b.co' } });
    assert.strictEqual(r.code, 400);
    // 이메일 변경: 현재 비밀번호 없음·틀림 400, 맞으면 200 + 재설정 토큰 비움 요청
    calls.updateProfile = [];
    r = await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'new@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Wrong password' }], '비밀번호 없음');
    r = await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'new@b.co', currentPassword: 'wrong-pw99' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Wrong password' }], '비밀번호 틀림');
    assert.strictEqual(calls.updateProfile.length, 0);
    r = await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'new@b.co', currentPassword: 'secret-pw1' } });
    assert.strictEqual(r.body.ok, true);
    assert.deepStrictEqual(calls.updateProfile[0], [5, { name: 'n', email: 'new@b.co', phone: null }, true]);
    // 같은 pw 키로 시도 제한
    reset();
    for (let i = 0; i < 5; i++) await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'new@b.co', currentPassword: 'bad-bad-bad1' } });
    r = await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'new@b.co', currentPassword: 'secret-pw1' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many attempts' }]);
    reset();
    dupMessage = "Duplicate entry for key 'hp_member.email'";
    r = await call(ctrl.updateMe, { member: me5, body: { name: 'n', email: 'x@b.co' } });
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
    // 이미 탈퇴(leave false) -> Slack 없이 401
    reset();
    leaveResult = false;
    r = await call(ctrl.leave, { member, body: { password: 'secret-pw1' } });
    assert.deepStrictEqual([r.code, r.body], [401, { error: 'Login required' }]);
    assert.strictEqual(notices.length, 0);
    leaveResult = true;
    // 현재 비밀번호 확인 시도 제한: 5번 틀리면 6번째는 맞아도 429, 성공하면 초기화
    reset();
    hash = bc;
    for (let i = 0; i < 5; i++) await call(ctrl.changePassword, { member, body: { currentPassword: 'bad-bad-bad1', newPassword: 'newpassword1' } });
    r = await call(ctrl.changePassword, { member, body: { currentPassword: 'secret-pw1', newPassword: 'newpassword1' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many attempts' }]);
    r = await call(ctrl.leave, { member, body: { password: 'secret-pw1' } });
    assert.strictEqual(r.code, 429, '탈퇴도 같은 키');
    reset();
    await call(ctrl.changePassword, { member, body: { currentPassword: 'bad-bad-bad1', newPassword: 'newpassword1' } });
    r = await call(ctrl.changePassword, { member, body: { currentPassword: 'secret-pw1', newPassword: 'newpassword1' } });
    assert.strictEqual(r.body.ok, true);
    for (let i = 0; i < 5; i++) assert.strictEqual((await call(ctrl.changePassword, { member, body: { currentPassword: 'secret-pw1', newPassword: 'newpassword1' } })).body.ok, true, '성공은 초기화');
    hash = old; // 예전 형식 해시도 확인 가능
    r = await call(ctrl.leave, { member, body: { password: 'oldpw' } });
    assert.strictEqual(r.body.ok, true);

    // ── 비밀번호 재설정 메일 ──
    process.env.SHOP_SITE_URL = 'https://shop.test';
    reset();
    r = await call(ctrl.forgotPassword, { body: { email: ' A@B.Co ' } });
    assert.deepStrictEqual([r.code, r.body], [200, { ok: true }]);
    assert.strictEqual(resetCalls[0][0], 'a@b.co', '이메일 정규화');
    assert.ok(/^[0-9a-f]{64}$/.test(resetCalls[0][1]), '저장은 64자 hex 해시');
    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].subject, '[링크비] 비밀번호 재설정 안내');
    assert.strictEqual(mails[0].to, 'a@b.co');
    const tok = /https:\/\/shop\.test\/password\/reset\?token=([0-9a-f]{64})/.exec(mails[0].text)[1];
    assert.strictEqual(crypto.createHash('sha256').update(tok).digest('hex'), resetCalls[0][1], '메일 토큰의 sha256이 저장값');
    assert.ok(mails[0].text.includes('1시간') && mails[0].text.includes('홍길동') && !/a@b|010/.test(mails[0].text), '이름 외 개인정보 없음');

    // 수신자는 입력값이 아니라 DB 값(정렬 규칙이 다른 값을 같은 것으로 볼 수 있음)
    reset();
    resetTarget = { id: 5, name: '홍길동', email: 'real@b.co' };
    await call(ctrl.forgotPassword, { body: { email: 'REAL@b.co' } });
    assert.strictEqual(mails[0].to, 'real@b.co', '메일 수신자 = DB 이메일');
    resetTarget = { id: 5, name: '홍길동', email: 'a@b.co' };
    // 악센트·특수문자 이메일은 DB 조회 없이 200
    reset();
    for (const email of ['victim@exämple.com', 'a,b@x.co', 'a<b@x.co']) assert.deepStrictEqual((await call(ctrl.forgotPassword, { body: { email } })).body, { ok: true });
    assert.strictEqual(resetCalls.length + mails.length, 0, '규칙 밖 이메일은 DB·메일 없음');
    // 응답을 먼저 보냄: 이후 DB 오류여도 200 { ok: true }
    reset();
    resetThrows = true;
    r = await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [200, { ok: true }], 'DB 오류에도 200');
    resetThrows = false;

    // 없는 이메일·형식 오류·빈 값: 같은 200, 메일 0건
    reset();
    resetTarget = undefined;
    r = await call(ctrl.forgotPassword, { body: { email: 'none@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [200, { ok: true }]);
    assert.strictEqual(mails.length, 0);
    resetCalls.length = 0;
    for (const email of ['bad', '', undefined, 123]) assert.deepStrictEqual((await call(ctrl.forgotPassword, { body: { email } })).body, { ok: true });
    assert.strictEqual(resetCalls.length, 0, '형식 오류는 DB 호출 없음');
    resetTarget = { id: 5, name: '홍길동', email: 'a@b.co' };

    // 메일 실패: 같은 200, 로그에 수신자 없음
    reset();
    mailFail = true;
    const origErr = console.error;
    const logged = [];
    console.error = (...a) => void logged.push(a.join(' '));
    r = await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } });
    console.error = origErr;
    assert.deepStrictEqual([r.code, r.body], [200, { ok: true }]);
    assert.ok(logged.length === 1 && !logged[0].includes('a@b.co'), '메일 실패 로그에 수신자 없음: ' + logged[0]);
    mailFail = false;

    // 운영에서 SHOP_SITE_URL 없으면 보내지 않음(DB 호출도 없음), 로컬은 localhost:3002
    reset();
    delete process.env.SHOP_SITE_URL;
    process.env.NODE_ENV = 'production';
    r = await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [200, { ok: true }]);
    assert.strictEqual(mails.length + resetCalls.length, 0);
    process.env.NODE_ENV = 'development';
    await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } });
    assert.ok(mails[0].text.includes('http://localhost:3002/password/reset?token='));
    process.env.SHOP_SITE_URL = 'https://shop.test';

    // IP당 시간 5회
    reset();
    for (let i = 0; i < 5; i++) assert.strictEqual((await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } })).code, 200);
    r = await call(ctrl.forgotPassword, { body: { email: 'a@b.co' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many requests' }]);

    // reset
    reset();
    const goodTok = 'ab'.repeat(32);
    r = await call(ctrl.resetPassword, { body: { token: goodTok, newPassword: 'short' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid password' }]);
    for (const token of ['abc', 'Z'.repeat(64), 'AB'.repeat(32), undefined, 5]) {
        r = await call(ctrl.resetPassword, { body: { token, newPassword: 'newpassword1' } });
        assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid or expired token' }]);
    }
    assert.strictEqual(resetByToken.length, 0, '형식 오류 토큰은 DB 조회 없음');
    resetOk = false;
    r = await call(ctrl.resetPassword, { body: { token: goodTok, newPassword: 'newpassword1' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid or expired token' }]);
    resetOk = true;
    r = await call(ctrl.resetPassword, { body: { token: goodTok, newPassword: 'newpassword1' } });
    assert.deepStrictEqual(r.body, { ok: true });
    assert.strictEqual(r.cookies.length, 0, '자동 로그인 없음');
    const lastReset = resetByToken[resetByToken.length - 1];
    assert.strictEqual(lastReset[0], crypto.createHash('sha256').update(goodTok).digest('hex'));
    assert.ok(lastReset[1].startsWith('$2'), 'bcrypt 해시 전달');
    reset();
    for (let i = 0; i < 10; i++) await call(ctrl.resetPassword, { body: { token: goodTok, newPassword: 'newpassword1' } });
    r = await call(ctrl.resetPassword, { body: { token: goodTok, newPassword: 'newpassword1' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many requests' }]);

    console.log('checkMember OK');
    process.exit(0);
})().catch(err => {
    console.error('checkMember 실패', err);
    process.exit(1);
});

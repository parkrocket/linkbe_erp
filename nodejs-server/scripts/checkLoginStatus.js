// 계정 상태 점검: node scripts/checkLoginStatus.js  (DB 없이 모델을 가짜로 대체)
// 승인된 계정만 로그인·API 접근, 관리자 API는 admin만
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const jwt = require('jsonwebtoken');

const User = require('../src/models/userModel');
let loginUser;
User.findByEmail = (email, cb) => cb(null, loginUser);
User.comparePassword = (pw, hash, cb) => cb(null, true);
let statusRow;
User.findStatusById = async () => statusRow;

const userController = require('../src/controllers/userController');
const { requireAuth } = require('../src/middlewares/requireAuth');
const { requireAdmin } = require('../src/middlewares/requireAdmin');

const fakeRes = () => {
    const r = { code: 200, cookies: [] };
    r.status = c => ((r.code = c), r);
    r.json = b => ((r.body = b), r);
    r.cookie = (name, value) => r.cookies.push(name);
    return r;
};
const runMiddleware = (mw, req) =>
    new Promise(resolve => {
        const res = fakeRes();
        res.json = b => (resolve({ code: res.code, body: b }), res);
        mw(req, res, () => resolve({ code: 'next', req }));
    });

(async () => {
    // 로그인: 승인 대기·거절·비활성 → 200 + loginSuccess:false + 사유, 쿠키 없음
    for (const [status, reason] of [
        ['pending', 'Pending approval'],
        ['rejected', 'Registration rejected'],
        ['inactive', 'Account inactive'],
    ]) {
        loginUser = { user_id: 'a@b.c', user_password: 'hash', user_status: status };
        const res = fakeRes();
        userController.login({ body: { email: 'a@b.c', password: 'x' } }, res);
        assert.strictEqual(res.code, 200, status);
        assert.strictEqual(res.body.loginSuccess, false, status);
        assert.strictEqual(res.body.error, reason);
        assert.deepStrictEqual(res.cookies, [], `${status}: 쿠키 발급 금지`);
        assert.ok(!res.body.token, `${status}: 토큰 응답 금지`);
    }
    // 승인 → 로그인 성공
    loginUser = { user_id: 'a@b.c', user_password: 'hash', user_status: 'approved' };
    const ok = fakeRes();
    userController.login({ body: { email: 'a@b.c', password: 'x' } }, ok);
    assert.strictEqual(ok.body.loginSuccess, true);
    assert.deepStrictEqual(ok.cookies, ['x_auth']);

    // requireAuth: 유효한 토큰이어도 비활성·없는 계정은 401, 승인이면 통과 + 권한·회사 설정
    const token = jwt.sign({ userId: 'a@b.c' }, process.env.JWT_SECRET_KEY);
    const req = () => ({ path: '/gtw/gtwStatus', headers: { cookie: `x_auth=${token}` } });
    statusRow = { user_status: 'inactive', user_role: 'member', cp_id: 1 };
    let r = await runMiddleware(requireAuth, req());
    assert.strictEqual(r.code, 401);
    assert.strictEqual(r.body.error, 'Account not active');
    statusRow = undefined;
    r = await runMiddleware(requireAuth, req());
    assert.strictEqual(r.code, 401, '삭제된 계정');
    statusRow = { user_status: 'approved', user_role: 'admin', cp_id: 3 };
    r = await runMiddleware(requireAuth, req());
    assert.strictEqual(r.code, 'next');
    assert.strictEqual(r.req.userId, 'a@b.c');
    assert.strictEqual(r.req.userRole, 'admin');
    assert.strictEqual(r.req.userCpId, 3);

    // requireAdmin: member 403, admin 통과
    r = await runMiddleware(requireAdmin, { userRole: 'member' });
    assert.strictEqual(r.code, 403);
    assert.strictEqual(r.body.error, 'Admin only');
    r = await runMiddleware(requireAdmin, { userRole: 'admin' });
    assert.strictEqual(r.code, 'next');

    // refresh: 요청 바디의 userId가 아닌 토큰 주인(req.userId)으로 조회
    let refreshedId;
    User.findByEmail = (id, cb) => ((refreshedId = id), cb(null, { user_id: id, user_password: 'hash' }));
    const rr = fakeRes();
    userController.refresh({ body: { userId: 'someone@else' }, userId: 'me@linkbe' }, rr);
    assert.strictEqual(refreshedId, 'me@linkbe');
    assert.ok(!('user_password' in rr.body.user));

    console.log('checkLoginStatus ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkLoginStatus 실패 ❌', err.message);
    process.exit(1);
});

// 회원 공통 도구 점검 — node scripts/checkMemberUtils.js (DB·네트워크 사용 안 함)
const assert = require('assert');
const { hashPassword, verifyPassword } = require('../src/utils/memberPassword');
const { validateRegister, validateProfile, validateNewPassword } = require('../src/utils/memberValidation');
const rateLimit = require('../src/utils/rateLimit');

(async () => {
    // MySQL PASSWORD('password') 알려진 값
    const old = '*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19';
    assert.deepStrictEqual(await verifyPassword('password', old), { ok: true, needsRehash: true });
    assert.strictEqual((await verifyPassword('wrong', old)).ok, false);
    const h = await hashPassword('abcd1234');
    assert.deepStrictEqual(await verifyPassword('abcd1234', h), { ok: true, needsRehash: false });
    assert.strictEqual((await verifyPassword('x', h)).ok, false);
    assert.strictEqual((await verifyPassword('x', null)).ok, false);
    assert.strictEqual((await verifyPassword('x', 'plain')).ok, false);

    const ok = { loginId: ' Linkbe01 ', password: 'abcd1234', name: ' 홍길동 ', email: ' A@B.CO ', phone: '', agree: '1' };
    assert.deepStrictEqual(validateRegister(ok).value, { loginId: 'linkbe01', password: 'abcd1234', name: '홍길동', email: 'a@b.co', phone: null });
    assert.strictEqual(validateRegister({ ...ok, agree: true }).value.phone, null);
    assert.strictEqual(validateRegister({ ...ok, phone: '010-1234-5678' }).value.phone, '010-1234-5678');
    const err = (patch, msg) => assert.deepStrictEqual(validateRegister({ ...ok, ...patch }), { error: msg });
    err({ loginId: 'abc' }, 'Invalid login id');
    err({ loginId: 'a_b_c' }, 'Invalid login id');
    err({ loginId: 'a'.repeat(21) }, 'Invalid login id');
    err({ password: 'short1' }, 'Invalid password');
    err({ password: 'a'.repeat(73) }, 'Invalid password');
    err({ name: '' }, 'Invalid name');
    err({ name: 'a'.repeat(31) }, 'Invalid name');
    err({ email: 'x@y' }, 'Invalid email');
    err({ phone: '12' }, 'Invalid phone');
    err({ agree: '' }, 'Agreement required');

    assert.deepStrictEqual(validateProfile({ name: ' 김 ', email: 'K@X.KR', phone: '02-123-4567' }).value, { name: '김', email: 'k@x.kr', phone: '02-123-4567' });
    assert.strictEqual(validateProfile({ name: '', email: 'k@x.kr' }).error, 'Invalid name');
    assert.strictEqual(validateNewPassword('abcd1234'), null);
    assert.strictEqual(validateNewPassword('short'), 'Invalid password');

    rateLimit.reset();
    assert.strictEqual(rateLimit.hit('k', 2, 1000), true);
    assert.strictEqual(rateLimit.hit('k', 2, 1000), true);
    assert.strictEqual(rateLimit.hit('k', 2, 1000), false);
    assert.strictEqual(rateLimit.isBlocked('k', 2, 1000), true);
    rateLimit.clear('k');
    assert.strictEqual(rateLimit.isBlocked('k', 2, 1000), false);

    console.log('checkMemberUtils OK');
})().catch(e => { console.error(e); process.exit(1); });

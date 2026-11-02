// 회원 공통 도구 점검 — node scripts/checkMemberUtils.js (DB·네트워크 사용 안 함)
const assert = require('assert');
const { hashPassword, verifyPassword } = require('../src/utils/memberPassword');
const { validateRegister, validateProfile, validateNewPassword, EMAIL_RULE } = require('../src/utils/memberValidation');
const rateLimit = require('../src/utils/rateLimit');

(async () => {
    // MySQL PASSWORD('password') 알려진 값
    const old = '*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19';
    assert.deepStrictEqual(await verifyPassword('password', old), { ok: true, needsRehash: true });
    assert.deepStrictEqual(await verifyPassword('wrong', old), { ok: false, needsRehash: false });
    assert.deepStrictEqual(await verifyPassword('password', '*' + old.slice(1).toLowerCase()), { ok: true, needsRehash: true }); // 소문자 hex 저장분
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
    // 악센트·특수문자 이메일 거부(DB 정렬 규칙이 악센트를 무시해 다른 계정과 일치할 수 있음)
    for (const email of ['victim@exämple.com', 'a,b@x.co', 'a<b@x.co']) err({ email }, 'Invalid email');
    assert.ok(EMAIL_RULE.test('a.b+c_d%e-f@x-y.co.kr'));
    err({ phone: '12' }, 'Invalid phone');
    err({ agree: '' }, 'Agreement required');

    assert.deepStrictEqual(validateProfile({ name: ' 김 ', email: 'K@X.KR', phone: '02-123-4567' }).value, { name: '김', email: 'k@x.kr', phone: '02-123-4567' });
    assert.strictEqual(validateProfile({ name: '', email: 'k@x.kr' }).error, 'Invalid name');
    assert.strictEqual(validateNewPassword('abcd1234'), null);
    assert.strictEqual(validateNewPassword('short'), 'Invalid password');

    // 경계 통과
    const pass = patch => assert.ok(validateRegister({ ...ok, ...patch }).value, JSON.stringify(patch));
    pass({ loginId: 'abcd' });
    pass({ loginId: 'a'.repeat(20) });
    pass({ password: 'a'.repeat(8) });
    pass({ password: 'a'.repeat(72) });
    pass({ password: '가'.repeat(24) }); // 72바이트
    pass({ name: 'a'.repeat(30) });
    pass({ phone: '1'.repeat(9) });
    pass({ phone: '1'.repeat(13) });
    err({ password: '가'.repeat(25) }, 'Invalid password'); // 75바이트
    assert.strictEqual(validateNewPassword('가'.repeat(25)), 'Invalid password');
    assert.ok(validateRegister(null).error);
    assert.ok(validateProfile(null).error);

    rateLimit.reset();
    assert.strictEqual(rateLimit.hit('k', 2, 1000), true);
    assert.strictEqual(rateLimit.hit('k', 2, 1000), true);
    assert.strictEqual(rateLimit.hit('k', 2, 1000), false);
    assert.strictEqual(rateLimit.isBlocked('k', 2, 1000), true);
    rateLimit.clear('k');
    assert.strictEqual(rateLimit.isBlocked('k', 2, 1000), false);

    // 창 만료
    rateLimit.hit('w', 1, 5);
    assert.strictEqual(rateLimit.hit('w', 1, 5), false);
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(rateLimit.hit('w', 1, 5), true);

    // 정리: 마지막 정리 후 60초 지났을 때만, 키별 창 기준(1시간보다 긴 창도 유지)
    rateLimit.reset();
    const realNow = Date.now;
    let now = realNow() + 10 * 60000; // 직전 실제 정리 시각보다 뒤
    Date.now = () => now;
    rateLimit.hit('short', 5, 1000);
    rateLimit.hit('long', 1, 2 * 3600000);
    now += 2000;
    rateLimit.hit('x', 5, 1000);
    assert.strictEqual(rateLimit.size(), 3, '60초 전에는 정리 안 함');
    now += 90 * 60000;
    rateLimit.hit('x', 5, 1000);
    assert.strictEqual(rateLimit.size(), 2, '만료된 short만 정리');
    assert.strictEqual(rateLimit.hit('long', 1, 2 * 3600000), false, '2시간 창은 90분 뒤에도 유지');
    Date.now = realNow;

    console.log('checkMemberUtils OK');
})().catch(e => { console.error(e); process.exit(1); });

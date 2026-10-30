// 회원가입 점검: node scripts/checkRegister.js  (DB·Slack 가짜)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid'; // 실제 Slack으로 새어 나가도 동작하지 않게
const assert = require('assert');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => notices.push({ channel, text });

const User = require('../src/models/userModel');
const Company = require('../src/models/companyModel');
let existing;
let created;
const originalCreate = User.create;
let lookedUp;
User.findStatusById = async id => ((lookedUp = id), existing);
User.create = async input => ((created = input), 99);
Company.existsAsync = async cpId => cpId === 1;

const { register } = require('../src/controllers/userController');

const valid = { email: 'new@linkbe.kr', password: 'abcd1234', name: '홍길동', phone: '010-1234-5678', cpId: 1, doe: '2024-03-04', gender: 'male', birth: '1995-07-01' };
const call = async body => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await register({ body }, res);
    return res;
};
const reset = () => {
    existing = undefined;
    created = undefined;
    notices = [];
};

(async () => {
    // 검증 실패 → 400 + 사유, 저장·알림 없음
    const bad = [
        [{ email: 'not-an-email' }, 'Invalid email'],
        [{ password: 'abc1234' }, 'Invalid password'], // 7자
        [{ password: '12345678' }, 'Invalid password'], // 영문 없음
        [{ password: 'abcdefgh' }, 'Invalid password'], // 숫자·특수문자 없음
        [{ name: '   ' }, 'Invalid name'],
        [{ phone: '010-12' }, 'Invalid phone'],
        [{ cpId: 'x' }, 'Invalid company'],
        [{ cpId: 2 }, 'Invalid company'], // 존재하지 않는 회사
        // 입사일·성별·생년월일 필수 (2026-10-30 사용자 결정)
        [{ doe: undefined }, 'Invalid doe'],
        [{ doe: '2026-02-30' }, 'Invalid doe'],
        [{ gender: undefined }, 'Invalid gender'],
        [{ gender: 'x' }, 'Invalid gender'],
        [{ birth: undefined }, 'Invalid birth'],
        [{ birth: '3000-01-01' }, 'Invalid birth'],
    ];
    for (const [patch, reason] of bad) {
        reset();
        const res = await call({ ...valid, ...patch });
        assert.strictEqual(res.code, 400, JSON.stringify(patch));
        assert.strictEqual(res.body.error, reason, JSON.stringify(patch));
        assert.strictEqual(created, undefined);
        assert.strictEqual(notices.length, 0);
    }

    // 이메일 정규화(공백·대소문자) 후 중복 검사
    reset();
    existing = { user_status: 'approved' };
    let res = await call({ ...valid, email: '  NEW@Linkbe.KR ' });
    assert.strictEqual(res.code, 409);
    assert.strictEqual(res.body.error, 'Email already registered');
    assert.strictEqual(lookedUp, 'new@linkbe.kr', '정규화된 이메일로 중복 조회해야 함');

    // 거절된 이메일 재가입 → 409 Registration rejected
    reset();
    existing = { user_status: 'rejected' };
    res = await call(valid);
    assert.strictEqual(res.code, 409);
    assert.strictEqual(res.body.error, 'Registration rejected');

    // 성공 → 정규화된 이메일로 승인 대기 저장, 관리자 채널 알림 1회, 사용자 정보 응답 안 함
    reset();
    res = await call({ ...valid, email: ' New@Linkbe.kr', name: ' 홍길동 ' });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(res.body, { registerSuccess: true });
    assert.deepStrictEqual(created, { email: 'new@linkbe.kr', password: 'abcd1234', name: '홍길동', phone: '010-1234-5678', cpId: 1, doe: '2024-03-04', gender: 'male', birth: '1995-07-01' });
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].channel, '#hibye-관리');
    assert.ok(notices[0].text.includes('홍길동') && notices[0].text.includes('https://hibye.kr/admin'));

    // 이름의 Slack 문법(<!channel>, <링크|문구>)은 이스케이프해 멘션·피싱 링크로 해석되지 않게
    reset();
    await call({ ...valid, name: '<!channel> <https://evil.example|승인하기>' });
    assert.ok(!notices[0].text.includes('<!channel>') && !notices[0].text.includes('<https://'), '슬랙 문법 주입');
    assert.ok(notices[0].text.includes('&lt;!channel&gt;'));

    // 특수문자 비밀번호 허용
    reset();
    assert.strictEqual((await call({ ...valid, password: 'abcd!@#$' })).code, 200);

    // 실제 User.create: pending·member로 명시 저장, 비밀번호는 해시 (DB는 가짜)
    const pool = require('../src/config/dbPromise');
    let insert;
    pool.query = async (sql, params) => ((insert = { sql, params }), [{ insertId: 7 }]);
    assert.strictEqual(await originalCreate(valid), 7);
    assert.ok(/user_status/.test(insert.sql) && insert.params.includes('pending'), 'pending 저장');
    assert.ok(insert.params.includes('member'), 'member 저장');
    assert.ok(!insert.params.includes('abcd1234'), '비밀번호 평문 저장 금지');
    assert.ok(/user_doe/.test(insert.sql) && /user_gender/.test(insert.sql) && /user_birth/.test(insert.sql), '인사 정보 저장');
    assert.ok(insert.params.includes('2024-03-04') && insert.params.includes('male') && insert.params.includes('1995-07-01'));
    console.log('checkRegister ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkRegister 실패 ❌', err.message);
    process.exit(1);
});

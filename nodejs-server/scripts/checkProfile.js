// 인사 정보 검증·관리자 API 점검: node scripts/checkProfile.js  (DB·Slack 가짜)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');

const rules = require('../src/utils/profileValidation');
// '오늘'을 고정 (KST 2026-10-30)
rules.today = () => '2026-10-30';
const { validateProfile } = rules;

const ok = {
    name: '김직원',
    phone: '010-1234-5678',
    doe: '2024-03-04',
    gender: 'female',
    birth: '1995-07-01',
    deptId: 2,
    positionId: 5,
    employmentType: 'regular',
};

(async () => {
    // ── 검증 ──
    assert.deepStrictEqual(validateProfile({ ...ok, name: '  김직원 ' }), { value: ok });
    // 선택 항목은 null 허용 (이름·연락처는 필수)
    const empty = { ...ok, doe: null, gender: null, birth: null, deptId: null, positionId: null, employmentType: null };
    assert.deepStrictEqual(validateProfile(empty), { value: empty });

    const bad = [
        [{ name: '' }, 'Invalid name'],
        [{ name: 'a'.repeat(51) }, 'Invalid name'],
        [{ phone: '010-12' }, 'Invalid phone'],
        [{ phone: null }, 'Invalid phone'],
        [{ birth: '2026-02-30' }, 'Invalid birth'], // 존재하지 않는 날짜
        [{ birth: '1899-12-31' }, 'Invalid birth'],
        [{ birth: '2026-10-31' }, 'Invalid birth'], // 내일
        [{ birth: '1995/07/01' }, 'Invalid birth'],
        [{ doe: '2027-10-31' }, 'Invalid doe'], // 오늘+366일
        [{ doe: '1899-12-31' }, 'Invalid doe'],
        [{ gender: 'other' }, 'Invalid gender'],
        [{ employmentType: 'parttime' }, 'Invalid employment type'],
        [{ deptId: 0 }, 'Invalid department'],
        [{ deptId: '2' }, 'Invalid department'],
        [{ positionId: 1.5 }, 'Invalid position'],
    ];
    for (const [patch, error] of bad) {
        assert.deepStrictEqual(validateProfile({ ...ok, ...patch }), { error }, JSON.stringify(patch));
    }
    // 경계값 통과
    for (const patch of [{ birth: '1900-01-01' }, { birth: '2026-10-30' }, { doe: '2027-10-30' }, { doe: '1900-01-01' }]) {
        assert.ok(validateProfile({ ...ok, ...patch }).value, JSON.stringify(patch));
    }
    // 한국 시간 오늘: UTC 15:00 = KST 다음 날 00:00
    assert.strictEqual(rules.kstToday(new Date('2026-10-30T15:00:00Z')), '2026-10-31');
    assert.strictEqual(rules.addDays('2026-10-30', 365), '2027-10-30');


    // ── 관리자 API (모델·Slack 가짜) ──
    const slack = require('../src/utils/slack');
    let notices = [];
    let slackFails = false;
    slack.sendSlackMessage = async (channel, text) => {
        if (slackFails) throw new Error('slack down');
        notices.push({ channel, text });
    };
    const Admin = require('../src/models/adminModel');
    const Org = require('../src/models/orgModel');
    const detail = {
        mb_no: 3, user_id: 'kim@x', user_name: '김직원', user_phone: '010-1234-5678', user_email: 'kim@x',
        user_doe: '2024-03-04', user_gender: 'female', user_birth: '1995-07-01', dept_id: 2, position_id: 5, employment_type: 'regular',
    };
    let updates;
    Admin.findByUserId = async (cpId, userId) => (cpId === 1 && userId === 'me@x' ? { mb_no: 1, user_name: '관리자' } : undefined);
    Admin.findDetail = async (cpId, mbNo) => (cpId === 1 && mbNo === 3 ? { ...detail } : cpId === 1 && mbNo === 1 ? { ...detail, mb_no: 1, user_id: 'me@x' } : undefined);
    Admin.updateProfile = async (...args) => updates.push(args);
    // 회사 1의 부서 2·7, 직급 5만 존재
    Org.exists = async (cpId, kind, id) => cpId === 1 && ((kind === 'departments' && [2, 7].includes(id)) || (kind === 'positions' && id === 5));

    const admin = require('../src/controllers/adminController');
    const call = async (fn, req) => {
        const res = { code: 200 };
        res.status = c => ((res.code = c), res);
        res.json = b => ((res.body = b), res);
        await fn({ userId: 'me@x', userCpId: 1, userRole: 'admin', params: {}, query: {}, body: {}, ...req }, res);
        return res;
    };
    const reset = () => ((updates = []), (notices = []));

    // 상세: 같은 회사만, 형식 오류·다른 회사 404
    let res = await call(admin.getUser, { params: { mbNo: '3' } });
    assert.strictEqual(res.body.user.user_name, '김직원');
    for (const mbNo of ['9', 'x', '0']) {
        res = await call(admin.getUser, { params: { mbNo } });
        assert.strictEqual(res.code, 404, mbNo);
        assert.deepStrictEqual(res.body, { error: 'User not found' });
    }

    // 수정: 검증 실패 400, 저장 없음
    reset();
    res = await call(admin.updateProfile, { params: { mbNo: '3' }, body: { ...ok, phone: 'x' } });
    assert.strictEqual(res.code, 400);
    assert.deepStrictEqual(res.body, { error: 'Invalid phone' });
    assert.strictEqual(updates.length, 0);
    // 다른 회사(없는) 부서·직급 → 400
    res = await call(admin.updateProfile, { params: { mbNo: '3' }, body: { ...ok, deptId: 99 } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid department']);
    res = await call(admin.updateProfile, { params: { mbNo: '3' }, body: { ...ok, positionId: 6 } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid position']);
    res = await call(admin.updateProfile, { params: { mbNo: '9' }, body: ok });
    assert.strictEqual(res.code, 404);
    assert.strictEqual(updates.length, 0);

    // 바뀐 것 없음 → 저장·알림 없이 ok
    res = await call(admin.updateProfile, { params: { mbNo: '3' }, body: ok });
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);
    assert.strictEqual(updates.length + notices.length, 0);

    // 이름·부서 변경 → 회사 범위 UPDATE 1회, Slack에 항목 이름만 (값·개인정보 없음)
    reset();
    res = await call(admin.updateProfile, { params: { mbNo: '3' }, body: { ...ok, name: '김<b>직원', deptId: 7 } });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.deepStrictEqual(updates, [[1, 3, { ...ok, name: '김<b>직원', deptId: 7 }]]);
    assert.deepStrictEqual(notices, [{ channel: '#hibye-관리', text: '관리자님이 김직원님 정보를 수정했어요 (이름·부서)' }]);
    // 생년월일 변경 — 값은 알림에 넣지 않음
    reset();
    await call(admin.updateProfile, { params: { mbNo: '3' }, body: { ...ok, birth: '1996-01-01', deptId: null } });
    assert.ok(notices[0].text.endsWith('(생년월일·부서)') && !notices[0].text.includes('1996'));
    // 본인 정보도 수정 가능, Slack 실패해도 200
    reset();
    slackFails = true;
    res = await call(admin.updateProfile, { params: { mbNo: '1' }, body: { ...ok, phone: '010-9999-8888' } });
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);
    assert.strictEqual(updates.length, 1);
    slackFails = false;

    // ── 모델 SQL (pool 가짜) ──
    const pool = require('../src/config/dbPromise');
    const realAdmin = (() => {
        delete require.cache[require.resolve('../src/models/adminModel')];
        return require('../src/models/adminModel');
    })();
    let q;
    pool.query = async (sql, params) => ((q = { sql, params }), [[]]);
    await realAdmin.findDetail(7, 3);
    assert.ok(/cp_id = \?/.test(q.sql) && /mb_no = \?/.test(q.sql) && !/SELECT\s+\*/i.test(q.sql) && !/user_password/.test(q.sql));
    assert.ok(/DATE_FORMAT\(user_birth/.test(q.sql) && /DATE_FORMAT\(user_doe/.test(q.sql), '날짜는 문자열로');
    assert.deepStrictEqual(q.params, [7, 3]);
    await realAdmin.updateProfile(7, 3, ok);
    assert.ok(/WHERE mb_no = \? AND cp_id = \?/.test(q.sql));
    assert.deepStrictEqual(q.params, ['김직원', '010-1234-5678', '2024-03-04', 'female', '1995-07-01', 2, 5, 'regular', 3, 7]);

    console.log('checkProfile ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkProfile 실패 ❌', err.message);
    process.exit(1);
});

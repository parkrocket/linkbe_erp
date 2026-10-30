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

    if (process.argv[2] !== 'all') {
        console.log('checkProfile(검증) ✅');
        process.exit(0);
    }
})().catch(err => {
    console.error('checkProfile 실패 ❌', err.message);
    process.exit(1);
});

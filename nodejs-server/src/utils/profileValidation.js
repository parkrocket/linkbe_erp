// 직원 인사 정보 검증 — 관리자 팝업 저장(validateProfile)과 회원가입(registerValidation)이 같은 규칙 사용
// 바디는 신뢰하지 않음: 문자열 id, 존재하지 않는 날짜, 범위 밖 날짜 모두 거부

const NAME_MAX = 50;
const PHONE_RULE = /^[0-9-]{10,13}$/;
const MIN_DATE = '1900-01-01';
const GENDERS = ['male', 'female'];
const EMPLOYMENT_TYPES = ['regular', 'contract', 'intern', 'freelance'];

// 한국 시간 기준 'YYYY-MM-DD' — 운영 서버 시계는 UTC
const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (date, days) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

// 'YYYY-MM-DD' 형식·실존 날짜(2026-02-30 차단)·범위 — 같은 형식이라 문자열 비교로 충분
const isDateIn = (value, min, max) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= min &&
    value <= max;

const isId = v => Number.isInteger(v) && v > 0;
const orNull = check => v => v === null || check(v);

const rules = { NAME_MAX, PHONE_RULE, GENDERS, EMPLOYMENT_TYPES, kstToday, addDays, isDateIn };
// 테스트에서 고정할 수 있도록 분리
rules.today = () => kstToday();

// 생년월일: 1900-01-01 ~ 오늘, 입사일: 1900-01-01 ~ 오늘+365일 (입사 예정자 가입 허용)
rules.isBirth = v => isDateIn(v, MIN_DATE, rules.today());
rules.isDoe = v => isDateIn(v, MIN_DATE, addDays(rules.today(), 365));
rules.isGender = v => GENDERS.includes(v);

// 관리자 팝업 저장 — 전체 덮어쓰기. 이름·연락처 필수, 나머지는 null(선택 안 함) 허용
rules.validateProfile = (body = {}) => {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const { doe = null, gender = null, birth = null, deptId = null, positionId = null, employmentType = null } = body;

    if (!name || name.length > NAME_MAX) return { error: 'Invalid name' };
    if (!PHONE_RULE.test(phone)) return { error: 'Invalid phone' };
    if (!orNull(rules.isDoe)(doe)) return { error: 'Invalid doe' };
    if (!orNull(rules.isGender)(gender)) return { error: 'Invalid gender' };
    if (!orNull(rules.isBirth)(birth)) return { error: 'Invalid birth' };
    if (!orNull(isId)(deptId)) return { error: 'Invalid department' };
    if (!orNull(isId)(positionId)) return { error: 'Invalid position' };
    if (!orNull(v => EMPLOYMENT_TYPES.includes(v))(employmentType)) return { error: 'Invalid employment type' };

    return { value: { name, phone, doe, gender, birth, deptId, positionId, employmentType } };
};

module.exports = rules;

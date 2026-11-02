// 고객 회원 가입·정보 수정 검증 — 공개 양식이라 서버에서 최종 확인
const LOGIN_RULE = /^[a-z0-9]{4,20}$/;
// ASCII만 — DB 정렬 규칙이 악센트를 무시해 비슷한 주소가 다른 계정과 일치할 수 있음
const EMAIL_RULE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RULE = /^[0-9-]{9,13}$/;

const text = v => (typeof v === 'string' ? v.trim() : '');

// 오류 문자열 또는 null (최대 72는 글자 수가 아니라 바이트 — bcrypt가 72바이트 뒤를 버림)
const validateNewPassword = pw => (typeof pw === 'string' && pw.length >= 8 && Buffer.byteLength(pw, 'utf8') <= 72 ? null : 'Invalid password');

const validateProfile = input => {
    const body = input ?? {};
    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const phone = text(body.phone);
    if (!name || name.length > 30) return { error: 'Invalid name' };
    if (!EMAIL_RULE.test(email) || email.length > 150) return { error: 'Invalid email' };
    if (phone && !PHONE_RULE.test(phone)) return { error: 'Invalid phone' };
    return { value: { name, email, phone: phone || null } };
};

const validateRegister = input => {
    const body = input ?? {};
    const loginId = text(body.loginId).toLowerCase();
    if (!LOGIN_RULE.test(loginId)) return { error: 'Invalid login id' };
    const pwError = validateNewPassword(body.password);
    if (pwError) return { error: pwError };
    const profile = validateProfile(body);
    if (profile.error) return profile;
    if (body.agree !== '1' && body.agree !== true) return { error: 'Agreement required' };
    return { value: { loginId, password: body.password, ...profile.value } };
};

module.exports = { validateRegister, validateProfile, validateNewPassword, EMAIL_RULE };

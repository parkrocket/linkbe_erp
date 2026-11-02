// 고객 회원 가입·정보 수정 검증 — 공개 양식이라 서버에서 최종 확인
const LOGIN_RULE = /^[a-z0-9]{4,20}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RULE = /^[0-9-]{9,13}$/;

const text = v => (typeof v === 'string' ? v.trim() : '');

// 오류 문자열 또는 null
const validateNewPassword = pw => (typeof pw === 'string' && pw.length >= 8 && pw.length <= 72 ? null : 'Invalid password');

const validateProfile = (body = {}) => {
    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const phone = text(body.phone);
    if (!name || name.length > 30) return { error: 'Invalid name' };
    if (!EMAIL_RULE.test(email) || email.length > 150) return { error: 'Invalid email' };
    if (phone && !PHONE_RULE.test(phone)) return { error: 'Invalid phone' };
    return { value: { name, email, phone: phone || null } };
};

const validateRegister = (body = {}) => {
    const loginId = text(body.loginId).toLowerCase();
    if (!LOGIN_RULE.test(loginId)) return { error: 'Invalid login id' };
    const pwError = validateNewPassword(body.password);
    if (pwError) return { error: pwError };
    const profile = validateProfile(body);
    if (profile.error) return profile;
    if (body.agree !== '1' && body.agree !== true) return { error: 'Agreement required' };
    return { value: { loginId, password: body.password, ...profile.value } };
};

module.exports = { validateRegister, validateProfile, validateNewPassword };

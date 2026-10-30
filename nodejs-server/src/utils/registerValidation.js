// 회원가입 입력 검증·정규화 — 화면 검증과 별개로 서버에서 최종 확인 (API 직접 호출 대비)
// 규칙은 기존 react-app 화면과 동일, 인사 정보(입사일·성별·생년월일)는 profileValidation과 공용
const profile = require('./profileValidation');

const EMAIL_RULE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// 8~15자, 영문 포함, 숫자 또는 특수문자 포함
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u;

function validateRegister(body = {}) {
    // 이메일은 대소문자·공백 차이로 중복 가입되지 않도록 정규화
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const cpId = Number(body.cpId);

    if (!EMAIL_RULE.test(email)) return { ok: false, error: 'Invalid email' };
    if (!PASSWORD_RULE.test(password)) return { ok: false, error: 'Invalid password' };
    if (!name || name.length > profile.NAME_MAX) return { ok: false, error: 'Invalid name' };
    if (!profile.PHONE_RULE.test(phone)) return { ok: false, error: 'Invalid phone' };
    if (!Number.isInteger(cpId) || cpId <= 0) return { ok: false, error: 'Invalid company' };

    // 입사일·성별·생년월일 필수 (2026-10-30 사용자 결정 — 기존 react-app 가입 화면은 보내지 않아 실패, 수용)
    if (!profile.isDoe(body.doe)) return { ok: false, error: 'Invalid doe' };
    if (!profile.isGender(body.gender)) return { ok: false, error: 'Invalid gender' };
    if (!profile.isBirth(body.birth)) return { ok: false, error: 'Invalid birth' };

    return { ok: true, value: { email, password, name, phone, cpId, doe: body.doe, gender: body.gender, birth: body.birth } };
}

module.exports = { validateRegister };

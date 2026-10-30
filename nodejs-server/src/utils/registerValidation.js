// 회원가입 입력 검증·정규화 — 화면 검증과 별개로 서버에서 최종 확인 (API 직접 호출 대비)
// 규칙은 기존 react-app 화면과 동일

const EMAIL_RULE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// 8~15자, 영문 포함, 숫자 또는 특수문자 포함
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u;
const PHONE_RULE = /^[0-9-]{10,13}$/;

function validateRegister(body = {}) {
    // 이메일은 대소문자·공백 차이로 중복 가입되지 않도록 정규화
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const cpId = Number(body.cpId);

    if (!EMAIL_RULE.test(email)) return { ok: false, error: 'Invalid email' };
    if (!PASSWORD_RULE.test(password)) return { ok: false, error: 'Invalid password' };
    if (!name || name.length > 50) return { ok: false, error: 'Invalid name' };
    if (!PHONE_RULE.test(phone)) return { ok: false, error: 'Invalid phone' };
    if (!Number.isInteger(cpId) || cpId <= 0) return { ok: false, error: 'Invalid company' };

    return { ok: true, value: { email, password, name, phone, cpId } };
}

module.exports = { validateRegister };

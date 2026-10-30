// 회원가입 화면 검증 — 서버(nodejs-server utils/registerValidation.js)와 같은 규칙, 즉시 안내용

export type RegisterForm = {
    email: string;
    password: string;
    passwordConfirm: string;
    name: string;
    phone: string;
    agree: boolean;
};

export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const EMAIL_RULE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u;
const PHONE_RULE = /^[0-9-]{10,13}$/;

export function validateRegisterForm(form: RegisterForm): RegisterErrors {
    const errors: RegisterErrors = {};
    if (!EMAIL_RULE.test(form.email.trim())) errors.email = '이메일 형식을 확인해 주세요.';
    if (!PASSWORD_RULE.test(form.password)) errors.password = '영문과 숫자 또는 특수문자를 섞어 8~15자로 입력해 주세요.';
    if (form.passwordConfirm !== form.password) errors.passwordConfirm = '비밀번호가 일치하지 않아요.';
    if (!form.name.trim()) errors.name = '이름을 입력해 주세요.';
    if (!PHONE_RULE.test(form.phone.trim())) errors.phone = '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)';
    if (!form.agree) errors.agree = '개인정보 수집·이용에 동의해 주세요.';
    return errors;
}

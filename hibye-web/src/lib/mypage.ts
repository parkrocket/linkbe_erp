// 마이페이지 — 본인 정보·비밀번호 변경 폼 검사와 오류 문구 (서버 meController와 같은 규칙, 즉시 안내용)
import { ApiError } from './api';
import { dateError, PHONE_RULE, todayLocal, type EmploymentType, type Gender } from './profile';
import { PASSWORD_RULE } from './register';

// GET /api/users/me 응답의 me
export type MyInfo = {
    user_id: string;
    user_email: string | null;
    user_name: string;
    user_phone: string | null;
    user_doe: string | null;
    user_gender: Gender | null;
    user_birth: string | null;
    employment_type: EmploymentType | null;
    user_stip: number | string | null;
    user_vaca: number | string | null;
    user_role: 'member' | 'admin';
    dept_name: string | null;
    position_name: string | null;
};

// 본인이 고칠 수 있는 칸만 (입사일·부서·직급·고용형태는 관리자)
export type MyProfileForm = { name: string; phone: string; gender: Gender | ''; birth: string };
export type MyProfileErrors = Partial<Record<keyof MyProfileForm, string>>;

export const toMyProfileForm = (me: MyInfo): MyProfileForm => ({
    name: me.user_name ?? '',
    phone: me.user_phone ?? '',
    gender: me.user_gender ?? '',
    birth: me.user_birth ?? '',
});

export const toMyProfilePayload = (form: MyProfileForm) => ({
    name: form.name.trim(),
    phone: form.phone.trim(),
    gender: form.gender === '' ? null : form.gender,
    birth: form.birth === '' ? null : form.birth,
});

export function validateMyProfile(form: MyProfileForm, today = todayLocal()): MyProfileErrors {
    const errors: MyProfileErrors = {};
    if (!form.name.trim()) errors.name = '이름을 입력해 주세요.';
    else if (form.name.trim().length > 50) errors.name = '이름은 50자까지 입력할 수 있어요.';
    if (!PHONE_RULE.test(form.phone.trim())) errors.phone = '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)';
    if (form.birth) {
        const birthError = dateError('birth', form.birth, today);
        if (birthError) errors.birth = birthError;
    }
    return errors;
}

export type PasswordForm = { current: string; next: string; confirm: string };
export type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

export function validatePasswordForm(form: PasswordForm): PasswordErrors {
    const errors: PasswordErrors = {};
    if (!form.current) errors.current = '현재 비밀번호를 입력해 주세요.';
    if (!PASSWORD_RULE.test(form.next)) errors.next = '영문과 숫자 또는 특수문자를 섞어 8~15자로 입력해 주세요.';
    else if (form.next === form.current) errors.next = '지금과 다른 비밀번호를 입력해 주세요.';
    if (form.confirm !== form.next) errors.confirm = '새 비밀번호가 서로 달라요.';
    return errors;
}

export function myProfileErrorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 400) return '입력한 내용을 확인해 주세요.';
    return '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function passwordErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.reason === 'Wrong password') return '현재 비밀번호가 맞지 않아요.';
        if (error.reason === 'Too many attempts') return '시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요.';
        if (error.reason === 'Same password') return '지금과 다른 비밀번호를 입력해 주세요.';
        if (error.reason === 'Invalid new password') return '영문과 숫자 또는 특수문자를 섞어 8~15자로 입력해 주세요.';
    }
    return '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.';
}

// 직원 인사 정보 — 폼 변환·검사 (서버 utils/profileValidation.js와 같은 규칙, 즉시 안내용)
import { localDay } from './leave';

export const GENDER_LABEL = { male: '남성', female: '여성' } as const;
export const EMPLOYMENT_LABEL = { regular: '정규직', contract: '계약직', intern: '인턴', freelance: '프리랜서·외주' } as const;
export type Gender = keyof typeof GENDER_LABEL;
export type EmploymentType = keyof typeof EMPLOYMENT_LABEL;

// GET /api/admin/users/:mbNo 응답
export type MemberDetail = {
    mb_no: number;
    user_id: string;
    user_email: string;
    user_name: string;
    user_phone: string | null;
    user_role: 'member' | 'admin';
    user_status: 'pending' | 'approved' | 'rejected' | 'inactive';
    user_datetime: string;
    user_doe: string | null;
    user_gender: Gender | null;
    user_birth: string | null;
    dept_id: number | null;
    position_id: number | null;
    employment_type: EmploymentType | null;
    user_stip: number | null;
    user_vaca: number | null;
};

// 폼 값은 모두 문자열, 빈 문자열 = 선택 안 함
export type ProfileForm = {
    name: string;
    phone: string;
    doe: string;
    gender: Gender | '';
    birth: string;
    deptId: string;
    positionId: string;
    employmentType: EmploymentType | '';
};

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

export const PHONE_RULE = /^[0-9-]{10,13}$/;
const MIN_DATE = '1900-01-01';

// 오늘(브라우저 기준) — 서버는 KST, 사내 사용자는 한국이라 같은 날
export const todayLocal = () => localDay(new Date().toISOString());

const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

const isDateIn = (value: string, min: string, max: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= min &&
    value <= max;

// 날짜 칸 오류 — 생년월일 1900-01-01~오늘, 입사일 1900-01-01~오늘+365일
export function dateError(kind: 'birth' | 'doe', value: string, today: string): string | null {
    if (kind === 'birth') return isDateIn(value, MIN_DATE, today) ? null : '생년월일을 확인해 주세요.';
    return isDateIn(value, MIN_DATE, addDays(today, 365)) ? null : '입사일을 확인해 주세요.';
}

// 목록에 없는 부서·직급 번호(그 사이 삭제됨)는 '선택 안 함'으로
export function toProfileForm(user: MemberDetail, deptIds: number[], positionIds: number[]): ProfileForm {
    const pick = (id: number | null, ids: number[]) => (id !== null && ids.includes(id) ? String(id) : '');
    return {
        name: user.user_name ?? '',
        phone: user.user_phone ?? '',
        doe: user.user_doe ?? '',
        gender: user.user_gender ?? '',
        birth: user.user_birth ?? '',
        deptId: pick(user.dept_id, deptIds),
        positionId: pick(user.position_id, positionIds),
        employmentType: user.employment_type ?? '',
    };
}

// POST /api/admin/users/:mbNo/profile 바디
export function toProfilePayload(form: ProfileForm) {
    const orNull = (v: string) => (v === '' ? null : v);
    const idOrNull = (v: string) => (v === '' ? null : Number(v));
    return {
        name: form.name.trim(),
        phone: form.phone.trim(),
        doe: orNull(form.doe),
        gender: orNull(form.gender),
        birth: orNull(form.birth),
        deptId: idOrNull(form.deptId),
        positionId: idOrNull(form.positionId),
        employmentType: orNull(form.employmentType),
    };
}

export function validateProfileForm(form: ProfileForm, today = todayLocal()): ProfileErrors {
    const errors: ProfileErrors = {};
    if (!form.name.trim()) errors.name = '이름을 입력해 주세요.';
    if (!PHONE_RULE.test(form.phone.trim())) errors.phone = '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)';
    if (form.doe) errors.doe = dateError('doe', form.doe, today) ?? undefined;
    if (form.birth) errors.birth = dateError('birth', form.birth, today) ?? undefined;
    // 값이 없는 키는 지움 (오류 없음 = {})
    return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as ProfileErrors;
}

// 저장 안 된 변경 확인용 — 폼 칸이 모두 같은지
export const isSameProfile = (a: ProfileForm, b: ProfileForm) => (Object.keys(a) as (keyof ProfileForm)[]).every(key => a[key] === b[key]);

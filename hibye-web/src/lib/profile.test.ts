import { describe, expect, it } from 'vitest';
import { dateError, toProfileForm, toProfilePayload, validateProfileForm, type MemberDetail, type ProfileForm } from './profile';

const TODAY = '2026-10-30';

const detail: MemberDetail = {
    mb_no: 3,
    user_id: 'kim@x',
    user_email: 'kim@x',
    user_name: '김직원',
    user_phone: '010-1234-5678',
    user_role: 'member',
    user_status: 'approved',
    user_datetime: '2024-03-01T00:00:00.000Z',
    user_doe: '2024-03-04',
    user_gender: 'female',
    user_birth: '1995-07-01',
    dept_id: 2,
    position_id: 5,
    employment_type: 'regular',
    user_stip: 2.5,
    user_vaca: 0,
};

const form: ProfileForm = {
    name: '김직원',
    phone: '010-1234-5678',
    doe: '2024-03-04',
    gender: 'female',
    birth: '1995-07-01',
    deptId: '2',
    positionId: '5',
    employmentType: 'regular',
};

describe('toProfileForm', () => {
    it('서버 값 → 폼 문자열', () => {
        expect(toProfileForm(detail, [2], [5])).toEqual(form);
    });

    it('비어 있는 값과 목록에 없는 부서·직급(삭제됨)은 선택 안 함', () => {
        const empty = { ...detail, user_doe: null, user_gender: null, user_birth: null, employment_type: null, user_phone: null };
        expect(toProfileForm(empty, [7], [])).toEqual({ ...form, phone: '', doe: '', gender: '', birth: '', deptId: '', positionId: '', employmentType: '' });
    });
});

describe('toProfilePayload', () => {
    it('빈 값 → null, 번호 → 숫자, 이름 trim', () => {
        expect(toProfilePayload({ ...form, name: ' 김직원 ', deptId: '', gender: '' })).toEqual({
            name: '김직원',
            phone: '010-1234-5678',
            doe: '2024-03-04',
            gender: null,
            birth: '1995-07-01',
            deptId: null,
            positionId: 5,
            employmentType: 'regular',
        });
    });
});

describe('dateError', () => {
    it('생년월일: 1900-01-01 ~ 오늘', () => {
        expect(dateError('birth', '1900-01-01', TODAY)).toBeNull();
        expect(dateError('birth', TODAY, TODAY)).toBeNull();
        expect(dateError('birth', '2026-10-31', TODAY)).toBe('생년월일을 확인해 주세요.');
        expect(dateError('birth', '1899-12-31', TODAY)).toBe('생년월일을 확인해 주세요.');
        expect(dateError('birth', '2026-02-30', TODAY)).toBe('생년월일을 확인해 주세요.');
    });

    it('입사일: 1900-01-01 ~ 오늘+365일', () => {
        expect(dateError('doe', '2027-10-30', TODAY)).toBeNull();
        expect(dateError('doe', '2027-10-31', TODAY)).toBe('입사일을 확인해 주세요.');
    });
});

describe('validateProfileForm', () => {
    it('올바르면 오류 없음 (선택 항목은 비워도 됨)', () => {
        expect(validateProfileForm(form, TODAY)).toEqual({});
        expect(validateProfileForm({ ...form, doe: '', birth: '', gender: '', deptId: '', positionId: '', employmentType: '' }, TODAY)).toEqual({});
    });

    it('필드별 오류', () => {
        expect(validateProfileForm({ ...form, name: ' ' }, TODAY).name).toBe('이름을 입력해 주세요.');
        expect(validateProfileForm({ ...form, phone: '010' }, TODAY).phone).toBe('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');
        expect(validateProfileForm({ ...form, birth: '2030-01-01' }, TODAY).birth).toBe('생년월일을 확인해 주세요.');
        expect(validateProfileForm({ ...form, doe: '2030-01-01' }, TODAY).doe).toBe('입사일을 확인해 주세요.');
    });
});

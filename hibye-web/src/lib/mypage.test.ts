import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { passwordErrorMessage, toMyProfilePayload, validateMyProfile, validatePasswordForm } from './mypage';

describe('validateMyProfile', () => {
    const ok = { name: '김직원', phone: '010-1234-5678', gender: '' as const, birth: '' };
    it('이름·연락처 필수, 성별·생년월일은 비워도 됨', () => {
        expect(validateMyProfile(ok, '2026-11-05')).toEqual({});
        expect(validateMyProfile({ ...ok, name: '  ' }, '2026-11-05').name).toBeTruthy();
        expect(validateMyProfile({ ...ok, phone: '12' }, '2026-11-05').phone).toBeTruthy();
    });
    it('생년월일은 오늘까지', () => {
        expect(validateMyProfile({ ...ok, birth: '2026-11-06' }, '2026-11-05').birth).toBeTruthy();
        expect(validateMyProfile({ ...ok, birth: '1995-07-01' }, '2026-11-05')).toEqual({});
    });
    it('빈 성별·생년월일은 null로 보냄', () => {
        expect(toMyProfilePayload({ ...ok, name: ' 김 ' })).toEqual({ name: '김', phone: '010-1234-5678', gender: null, birth: null });
    });
});

describe('validatePasswordForm', () => {
    it('규칙·같은 비밀번호·확인 불일치', () => {
        expect(validatePasswordForm({ current: 'Old1234!', next: 'New1234!', confirm: 'New1234!' })).toEqual({});
        expect(validatePasswordForm({ current: '', next: 'New1234!', confirm: 'New1234!' }).current).toBeTruthy();
        expect(validatePasswordForm({ current: 'Old1234!', next: 'short', confirm: 'short' }).next).toBeTruthy();
        expect(validatePasswordForm({ current: 'Old1234!', next: 'Old1234!', confirm: 'Old1234!' }).next).toBeTruthy();
        expect(validatePasswordForm({ current: 'Old1234!', next: 'New1234!', confirm: 'New1234?' }).confirm).toBeTruthy();
    });
    it('서버 오류 사유별 안내', () => {
        expect(passwordErrorMessage(new ApiError(403, 'Wrong password'))).toBe('현재 비밀번호가 맞지 않아요.');
        expect(passwordErrorMessage(new ApiError(429, 'Too many attempts'))).toContain('15분');
        expect(passwordErrorMessage(new Error('x'))).toContain('잠시 후');
    });
});

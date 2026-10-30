import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { adminErrorMessage, loginErrorMessage } from './authMessages';

describe('loginErrorMessage', () => {
    it('계정 상태별 안내', () => {
        expect(loginErrorMessage('Pending approval')).toBe('가입 승인을 기다리고 있어요. 승인 후 로그인할 수 있어요.');
        expect(loginErrorMessage('Registration rejected')).toBe('가입이 승인되지 않았어요. 관리자에게 문의해 주세요.');
        expect(loginErrorMessage('Account inactive')).toBe('비활성화된 계정이에요. 관리자에게 문의해 주세요.');
    });

    it('그 외(계정 없음·비밀번호 틀림)는 구분 없이 같은 문구 — 계정 존재 여부를 드러내지 않음', () => {
        expect(loginErrorMessage('User not found')).toBe('이메일 또는 비밀번호를 확인해 주세요.');
        expect(loginErrorMessage('Invalid credentials')).toBe('이메일 또는 비밀번호를 확인해 주세요.');
        expect(loginErrorMessage(undefined)).toBe('이메일 또는 비밀번호를 확인해 주세요.');
    });
});

describe('adminErrorMessage', () => {
    it('관리 작업 사유별 안내', () => {
        expect(adminErrorMessage(new ApiError(409, 'Cannot change yourself'))).toBe('자기 자신은 변경할 수 없어요.');
        expect(adminErrorMessage(new ApiError(409, 'Last admin'))).toBe('관리자는 최소 1명 있어야 해요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid transition'))).toBe('지금 상태에서는 할 수 없는 작업이에요.');
        expect(adminErrorMessage(new ApiError(403, 'Admin only'))).toBe('관리자만 할 수 있어요.');
        expect(adminErrorMessage(new ApiError(404, 'User not found'))).toBe('대상 직원을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.');
        expect(adminErrorMessage(new Error('x'))).toBe('처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    });
});

import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './authMessages';

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

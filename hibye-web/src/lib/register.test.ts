import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { registerErrorMessage } from './authMessages';
import { validateRegisterForm, type RegisterForm } from './register';

const valid: RegisterForm = {
    email: 'new@linkbe.kr',
    password: 'abcd1234',
    passwordConfirm: 'abcd1234',
    name: '홍길동',
    phone: '010-1234-5678',
    agree: true,
};

describe('validateRegisterForm', () => {
    it('올바르면 오류 없음', () => {
        expect(validateRegisterForm(valid)).toEqual({});
        expect(validateRegisterForm({ ...valid, password: 'abcd!@#$', passwordConfirm: 'abcd!@#$' })).toEqual({});
    });

    it('필드별 오류', () => {
        expect(validateRegisterForm({ ...valid, email: 'nope' }).email).toBe('이메일 형식을 확인해 주세요.');
        expect(validateRegisterForm({ ...valid, password: 'abc123', passwordConfirm: 'abc123' }).password).toBe(
            '영문과 숫자 또는 특수문자를 섞어 8~15자로 입력해 주세요.',
        );
        expect(validateRegisterForm({ ...valid, password: '12345678', passwordConfirm: '12345678' }).password).toBeDefined();
        expect(validateRegisterForm({ ...valid, passwordConfirm: 'different1' }).passwordConfirm).toBe('비밀번호가 일치하지 않아요.');
        expect(validateRegisterForm({ ...valid, name: '  ' }).name).toBe('이름을 입력해 주세요.');
        expect(validateRegisterForm({ ...valid, phone: '010-12' }).phone).toBe('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)');
        expect(validateRegisterForm({ ...valid, agree: false }).agree).toBe('개인정보 수집·이용에 동의해 주세요.');
    });
});

describe('registerErrorMessage', () => {
    it('서버 사유별 안내', () => {
        expect(registerErrorMessage(new ApiError(409, 'Email already registered'))).toBe('이미 가입된 이메일이에요.');
        expect(registerErrorMessage(new ApiError(409, 'Registration rejected'))).toBe(
            '가입이 승인되지 않은 이메일이에요. 관리자에게 문의해 주세요.',
        );
        expect(registerErrorMessage(new ApiError(400, 'Invalid phone'))).toBe('입력한 내용을 확인해 주세요.');
        expect(registerErrorMessage(new Error('x'))).toBe('가입 신청 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    });
});

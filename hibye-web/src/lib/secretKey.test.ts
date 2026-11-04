import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { keyViewErrorText } from './secretKey';

describe('keyViewErrorText', () => {
    it('상태별 문구', () => {
        expect(keyViewErrorText(new ApiError(403))).toBe('비밀번호가 맞지 않아요');
        expect(keyViewErrorText(new ApiError(429))).toBe('시도가 너무 많아요. 15분 뒤 다시 해 주세요.');
        expect(keyViewErrorText(new ApiError(503))).toBe('서버에 키가 설정되어 있지 않아요.');
        expect(keyViewErrorText(new ApiError(500))).toBe('확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
        expect(keyViewErrorText(new Error('x'))).toBe('확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    });
});

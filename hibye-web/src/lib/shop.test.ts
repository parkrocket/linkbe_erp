import { describe, expect, it } from 'vitest';
import { cancelConfirmText, digitsOnly, formatWon, ORDER_STATUS_LABEL, PAY_METHOD_LABEL, validateProductForm } from './shop';

describe('shop', () => {
    it('상태·수단 이름표가 모두 있다', () => {
        expect(Object.keys(ORDER_STATUS_LABEL)).toEqual(['pending', 'awaiting_deposit', 'paid', 'completed', 'cancelled']);
        expect(Object.keys(PAY_METHOD_LABEL)).toEqual(['card', 'bank', 'deposit', 'vbank']);
        expect(Object.values({ ...ORDER_STATUS_LABEL, ...PAY_METHOD_LABEL }).every(Boolean)).toBe(true);
    });
    it('가격 표시·입력', () => {
        expect(formatWon(1234567)).toBe('1,234,567원');
        expect(digitsOnly('1,2a3')).toBe('123');
        const f = { title: '상품', price: '1000', bodyHtml: '', imageFileId: null, isVisible: true, sortOrder: '0' };
        expect(validateProductForm(f)).toEqual({});
        expect(validateProductForm({ ...f, price: '0' }).price).toBeTruthy();
        expect(validateProductForm({ ...f, title: ' ' }).title).toBeTruthy();
    });
    it('취소 문구는 수단별', () => {
        expect(cancelConfirmText('deposit')).toContain('직접 환불');
        expect(cancelConfirmText('vbank')).toContain('직접 환불');
        expect(cancelConfirmText('card')).toContain('KCP');
        expect(cancelConfirmText('card', true)).toContain('예전 사이트 주문이라 KCP 결제는 취소되지 않아요');
    });
});

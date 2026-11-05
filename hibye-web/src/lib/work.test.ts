import { describe, expect, it } from 'vitest';
import { canApproveExpense, commaWonInText, sumWonInText, EXPENSE_STATUS_LABEL, shiftMonth, toExpensePayload, validateExpenseForm, type ExpenseForm } from './work';

const ok: ExpenseForm = { spentOn: '2026-11-03', category: 'etc', amount: '12,000', title: '테스트', body: '' };

describe('validateExpenseForm', () => {
    it('빈 값이면 날짜·분류·금액·제목 오류, 내용은 선택', () => {
        const e = validateExpenseForm({ spentOn: '', category: '', amount: '', title: ' ', body: '' });
        expect(Object.keys(e).sort()).toEqual(['amount', 'category', 'spentOn', 'title']);
    });

    it("금액 '12,000'은 통과하고 12000으로 변환", () => {
        expect(validateExpenseForm(ok)).toEqual({});
        expect(toExpensePayload(ok).amount).toBe(12000);
    });

    it('금액 상한 초과·제목 101자·내용 5001자는 오류', () => {
        expect(validateExpenseForm({ ...ok, amount: '2000000001' }).amount).toBeTruthy();
        expect(validateExpenseForm({ ...ok, title: 'a'.repeat(101) }).title).toBeTruthy();
        expect(validateExpenseForm({ ...ok, body: 'a'.repeat(5001) }).body).toBeTruthy();
    });
});

describe('canApproveExpense', () => {
    it('관리자나 승인 권한자만 true', () => {
        expect(canApproveExpense({ user_role: 'admin', expense_approver: 0 })).toBe(true);
        expect(canApproveExpense({ user_role: 'member', expense_approver: 1 })).toBe(true);
        expect(canApproveExpense({ user_role: 'member' })).toBe(false);
    });
});

describe('shiftMonth', () => {
    it('해를 넘겨 이동', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    });
});

it('상태 라벨 순서', () => {
    expect(Object.keys(EXPENSE_STATUS_LABEL)).toEqual(['pending', 'approved', 'confirmed', 'paid']);
});

describe('sumWonInText·commaWonInText', () => {
    it('숫자+원만 더함, 없으면 null', () => {
        expect(sumWonInText('내역 : 식대\n입금액 : 150,000원\n\n결제액 : 20000 원')).toBe(170000);
        expect(sumWonInText('2. 내역\n카드 1234')).toBeNull();
        expect(sumWonInText('10만원')).toBeNull();
        expect(sumWonInText('0원')).toBe(0);
    });
    it('원 앞 숫자에 콤마', () => {
        expect(commaWonInText('입금액 : 150000원, 1,000원\n카드 1234')).toBe('입금액 : 150,000원, 1,000원\n카드 1234');
    });
});

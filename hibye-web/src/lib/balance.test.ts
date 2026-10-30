import { describe, expect, it } from 'vitest';
import { diffBalances, validateBalance, type BalanceRow } from './balance';

describe('validateBalance', () => {
    it('빈 값·범위·단위 오류', () => {
        expect(validateBalance('stip', '')).toBe('숫자를 입력해 주세요');
        expect(validateBalance('stip', '  ')).toBe('숫자를 입력해 주세요');
        for (const v of ['abc', '-1', '366']) expect(validateBalance('stip', v)).toBe('0~365 사이로 입력해 주세요');
        expect(validateBalance('stip', '15.3')).toBe('0.5일 단위로 입력해 주세요');
        expect(validateBalance('vaca', '1.5')).toBe('정수로 입력해 주세요');
    });

    it('올바른 값은 null', () => {
        expect(validateBalance('stip', '15.5')).toBeNull();
        expect(validateBalance('stip', '0')).toBeNull();
        expect(validateBalance('vaca', '3')).toBeNull();
        expect(validateBalance('vaca', '365')).toBeNull();
    });
});

describe('diffBalances', () => {
    const rows: BalanceRow[] = [
        { mb_no: 3, user_name: '김직원', user_id: 'kim@x', user_stip: 2.5, user_vaca: 0 },
        { mb_no: 5, user_name: '박직원', user_id: 'park@x', user_stip: null, user_vaca: null },
    ];

    it('입력이 없거나 현재값과 같으면 변경 없음', () => {
        expect(diffBalances(rows, {})).toEqual([]);
        expect(diffBalances(rows, { 3: { stip: '2.5', vaca: '0' } })).toEqual([]);
    });

    it('바꾼 쪽만 새 값, 나머지는 현재값 유지 + 화면을 연 때 값(expected)', () => {
        expect(diffBalances(rows, { 3: { stip: '15' } })).toEqual([
            { mbNo: 3, name: '김직원', stip: 15, vaca: 0, expectedStip: 2.5, expectedVaca: 0 },
        ]);
    });

    it('잘못된 값이 있는 행은 제외', () => {
        expect(diffBalances(rows, { 3: { stip: '15.3' } })).toEqual([]);
    });

    it('잔여가 없는(null) 직원은 안 바꾼 쪽을 0으로, expected는 null', () => {
        expect(diffBalances(rows, { 5: { vaca: '3' } })).toEqual([
            { mbNo: 5, name: '박직원', stip: 0, vaca: 3, expectedStip: null, expectedVaca: null },
        ]);
    });
});

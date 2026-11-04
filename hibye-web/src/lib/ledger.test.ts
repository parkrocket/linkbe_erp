import { describe, expect, it } from 'vitest';
import { accountGroups, codeStartsWith, groupTotals, nextTax, selectableAccounts, SIDE_LABEL, type Account } from './ledger';

const acc = (id: number, side: 'sales' | 'purchase', code: string, isGroup: boolean): Account => ({
    id,
    side,
    code,
    label: '',
    name: `계정${id}`,
    sort: 0,
    used: 0,
    isGroup,
});
// 매입: 묶음 2(10·20) + 항목 3, 매출: 항목 2
const ACCOUNTS = [
    acc(1, 'purchase', '10', true),
    acc(2, 'purchase', '1001', false),
    acc(3, 'purchase', '1002', false),
    acc(4, 'purchase', '20', true),
    acc(5, 'purchase', '2001', false),
    acc(6, 'sales', '01', false),
    acc(7, 'sales', '02', false),
];

describe('ledger', () => {
    it('구분 이름', () => expect(SIDE_LABEL).toEqual({ sales: '매출', purchase: '매입' }));

    it('selectableAccounts: 묶음·다른 구분 제외, 코드 순', () => {
        expect(selectableAccounts(ACCOUNTS, 'purchase').map(a => a.id)).toEqual([2, 3, 5]);
        expect(selectableAccounts([...ACCOUNTS].reverse(), 'sales').map(a => a.id)).toEqual([6, 7]);
    });

    it('accountGroups: 매입은 묶음별, 매출은 group null 하나', () => {
        const p = accountGroups(ACCOUNTS, 'purchase');
        expect(p.map(g => [g.group?.id, g.items.map(i => i.id)])).toEqual([
            [1, [2, 3]],
            [4, [5]],
        ]);
        const s = accountGroups(ACCOUNTS, 'sales');
        expect(s).toHaveLength(1);
        expect(s[0].group).toBeNull();
        expect(s[0].items.map(i => i.id)).toEqual([6, 7]);
    });

    it('nextTax: 직접 고친 뒤엔 유지, 아니면 자동(음수 포함)', () => {
        expect(nextTax({ supply: 0, tax: 0, taxEdited: false }, 1000)).toBe(100);
        expect(nextTax({ supply: 1000, tax: 7, taxEdited: true }, 5000)).toBe(7);
        expect(nextTax({ supply: 0, tax: 0, taxEdited: false }, -15)).toBe(-1);
        expect(nextTax({ supply: 0, tax: 0, taxEdited: false }, -5)).toBe(0);
    });

    it('groupTotals: 묶음 합계 = 하위 항목 합', () => {
        const t = groupTotals(ACCOUNTS, [
            { accountId: 2, total: 100 },
            { accountId: 3, total: -30 },
            { accountId: 5, total: 50 },
            { accountId: 6, total: 9 },
        ]);
        expect(t[1]).toBe(70);
        expect(t[4]).toBe(50);
        expect(t[2]).toBe(100);
        expect(t[7]).toBe(0);
    });

    it('3단계 묶음(1·10·1001·1002·20·2001): 항목은 한 번만, 합계 이중 계산 없음', () => {
        const a = [
            acc(1, 'purchase', '1', true),
            acc(2, 'purchase', '10', true),
            acc(3, 'purchase', '1001', false),
            acc(4, 'purchase', '1002', false),
            acc(5, 'purchase', '20', true),
            acc(6, 'purchase', '2001', false),
        ];
        const g = accountGroups(a, 'purchase');
        expect(g.map(x => [x.group?.id, x.items.map(i => i.id)])).toEqual([
            [1, []],
            [2, [3, 4]],
            [5, [6]],
        ]);
        expect(g.flatMap(x => x.items).length).toBe(3);
        const t = groupTotals(a, [
            { accountId: 3, total: 100 },
            { accountId: 4, total: 20 },
            { accountId: 6, total: 5 },
        ]);
        expect(t[1]).toBe(120);
        expect(t[2]).toBe(120);
        expect(t[5]).toBe(5);
    });

    it('codeStartsWith: 대소문자 무시', () => {
        expect(codeStartsWith('p101', 'P1')).toBe(true);
        expect(codeStartsWith('p101', 'P2')).toBe(false);
    });
});

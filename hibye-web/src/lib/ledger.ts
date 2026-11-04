// 매출/매입 화면 공용 규칙 (API 응답 칸 이름은 서버 workLedgerController 그대로)
import { vat } from './contract';

export const SIDE_LABEL = { sales: '매출', purchase: '매입' } as const;
export type Side = keyof typeof SIDE_LABEL;

export type LedgerRow = {
    id: number;
    side: Side;
    entryDate: string;
    accountId: number;
    title: string;
    memo: string;
    supply: number;
    tax: number;
    total: number;
    createdAt: string;
};
export type LedgerDetail = LedgerRow & { updatedAt: string; updatedAtKst: string }; // updatedAt은 동시 수정 검사용
export type Account = { id: number; side: Side; code: string; label: string; name: string; sort: number; used: number; isGroup: boolean };
export type LedgerSummary = {
    sales: number;
    purchase: number;
    diff: number;
    byAccount: { accountId: number; total: number; count: number }[];
};

const byCode = (a: Account, b: Account) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

// 장부에 고를 수 있는 계정 — 해당 구분의 항목만(묶음 제외), 코드 순
export const selectableAccounts = (accounts: Account[], side: Side): Account[] =>
    accounts.filter(a => a.side === side && !a.isGroup).sort(byCode);

// 코드 앞부분 비교 — 서버 DB 비교(대소문자 무시)와 같게
export const codeStartsWith = (code: string, prefix: string): boolean => code.toLowerCase().startsWith(prefix.toLowerCase());

// 묶음이 있으면 묶음별, 없으면 group null 하나
// 항목은 앞부분이 맞는 묶음 중 가장 긴 하나에만 넣음(묶음이 여러 단계여도 한 번만 표시)
export function accountGroups(accounts: Account[], side: Side): { group: Account | null; items: Account[] }[] {
    const items = selectableAccounts(accounts, side);
    const groups = accounts.filter(a => a.side === side && a.isGroup).sort(byCode);
    if (!groups.length) return [{ group: null, items }];
    const owner = (i: Account) =>
        groups.filter(g => codeStartsWith(i.code, g.code)).reduce<Account | null>((best, g) => (!best || g.code.length > best.code.length ? g : best), null);
    const result = groups.map(group => ({ group, items: items.filter(i => owner(i) === group) }));
    // 어느 묶음에도 안 들어간 항목은 맨 끝에 따로(화면에서 사라지지 않도록)
    const rest = items.filter(i => !owner(i));
    return rest.length ? [...result, { group: null, items: rest }] : result;
}

// 부가세 자동값 — 사용자가 직접 고친 뒤(taxEdited)에는 공급가를 바꿔도 그대로 둠
export const nextTax = (prev: { supply: number; tax: number; taxEdited: boolean }, supply: number): number =>
    prev.taxEdited ? prev.tax : vat(supply);

// 계정별 합계 — 항목은 자기 합계, 묶음은 그 아래 전체(여러 단계 포함) 항목 합계 (키 = 계정 id)
export function groupTotals(accounts: Account[], byAccount: { accountId: number; total: number }[]): Record<number, number> {
    const own = new Map(byAccount.map(b => [b.accountId, b.total]));
    const result: Record<number, number> = {};
    for (const a of accounts) {
        result[a.id] = a.isGroup
            ? accounts.filter(c => !c.isGroup && c.side === a.side && codeStartsWith(c.code, a.code)).reduce((sum, c) => sum + (own.get(c.id) ?? 0), 0)
            : (own.get(a.id) ?? 0);
    }
    return result;
}

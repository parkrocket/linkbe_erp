import { describe, expect, it } from 'vitest';
import { WORK_TABS, canClientSecret, canWorkDoc } from './workDoc';

const EXPENSE = { href: '/work/expense', label: '경비' };
const CLIENTS = { href: '/work/clients', label: '거래처 접속정보' };
const DOCS = [
    { href: '/work/contracts', label: '견적·계약서' },
    { href: '/work/ledger', label: '매출/매입' },
];

describe('workDoc', () => {
    it('관리자·권한자·일반', () => {
        expect(canWorkDoc({ user_role: 'admin' })).toBe(true);
        expect(canWorkDoc({ user_role: 'member', work_doc_access: 1 })).toBe(true);
        expect(canWorkDoc({ user_role: 'member', work_doc_access: 0 })).toBe(false);
        expect(canWorkDoc({})).toBe(false);
        expect(WORK_TABS({ user_role: 'admin' })).toEqual([EXPENSE, ...DOCS, CLIENTS]);
        expect(WORK_TABS({ user_role: 'member', work_doc_access: 1 })).toEqual([EXPENSE, ...DOCS]);
        expect(WORK_TABS({ user_role: 'member', client_secret_access: 1 })).toEqual([EXPENSE, CLIENTS]);
        expect(WORK_TABS({ user_role: 'member' })).toEqual([EXPENSE]);
    });

    it('거래처 접속정보 권한은 업무 문서 권한과 별개', () => {
        expect(canClientSecret({ user_role: 'admin' })).toBe(true);
        expect(canClientSecret({ user_role: 'member', client_secret_access: 1 })).toBe(true);
        expect(canClientSecret({ user_role: 'member', work_doc_access: 1 } as never)).toBe(false);
    });
});

import { describe, expect, it } from 'vitest';
import { WORK_TABS, canWorkDoc } from './workDoc';

const EXPENSE = { href: '/work/expense', label: '경비' };
const DOCS = [
    { href: '/work/contracts', label: '견적·계약서' },
    { href: '/work/ledger', label: '매출/매입' },
    { href: '/work/settings', label: '설정' },
];

describe('workDoc', () => {
    it('관리자·권한자·일반', () => {
        expect(canWorkDoc({ user_role: 'admin' })).toBe(true);
        expect(canWorkDoc({ user_role: 'member', work_doc_access: 1 })).toBe(true);
        expect(canWorkDoc({ user_role: 'member', work_doc_access: 0 })).toBe(false);
        expect(canWorkDoc({})).toBe(false);
        expect(WORK_TABS({ user_role: 'admin' })).toEqual([EXPENSE, ...DOCS]);
        expect(WORK_TABS({ user_role: 'member', work_doc_access: 1 })).toEqual([EXPENSE, ...DOCS]);
        expect(WORK_TABS({ user_role: 'member' })).toEqual([EXPENSE]);
    });
});

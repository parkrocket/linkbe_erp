import { describe, expect, it } from 'vitest';
import { adminNavFor, HOMEPAGE_MENUS, isHomepageMenu, isWorkSettingsTab, legacyAdminPath } from './adminNav';

describe('adminNavFor', () => {
    it('관리자: 대시보드·직원·홈페이지·업무 설정·보안, 링크 20개', () => {
        const groups = adminNavFor(true);
        expect(groups.map(g => g.title)).toEqual([null, '직원', '홈페이지', '업무 설정', '보안']);
        expect(groups.flatMap(g => g.items).length).toBe(1 + 5 + 9 + 4 + 1);
        expect(groups[0].items[0].href).toBe('/admin');
        expect(groups[1].items.map(i => i.href)).toEqual(['/admin/pending', '/admin/members', '/admin/leaves', '/admin/balances', '/admin/org']);
        expect(groups[3].items.map(i => [i.href, i.label])).toEqual([
            ['/admin/work/categories', '분류'],
            ['/admin/work/items', '품목 문구'],
            ['/admin/work/docs', '양식'],
            ['/admin/work/accounts', '계정과목'],
        ]);
        expect(groups[4].items[0].href).toBe('/admin/security');
    });
    it('홈페이지 권한자: 홈페이지 묶음만', () => {
        const groups = adminNavFor(false);
        expect(groups.map(g => g.title)).toEqual(['홈페이지']);
        expect(groups[0].items.map(i => i.href)).toEqual(HOMEPAGE_MENUS.map(m => `/admin/homepage/${m.key}`));
    });
    it('배지: 가입 승인·문의함·주문', () => {
        const badges = adminNavFor(true)
            .flatMap(g => g.items)
            .filter(i => i.badge)
            .map(i => [i.href, i.badge]);
        expect(badges).toEqual([
            ['/admin/pending', 'pending'],
            ['/admin/homepage/inquiries', 'inquiries'],
            ['/admin/homepage/orders', 'orders'],
        ]);
    });
});

describe('legacyAdminPath — 예전 /admin?tab= 주소', () => {
    it('탭 이름 → 새 주소, 모르면 대시보드, 없으면 null', () => {
        expect(legacyAdminPath(undefined)).toBeNull();
        expect(legacyAdminPath('homepage')).toBe('/admin/homepage/inquiries');
        expect(legacyAdminPath('members')).toBe('/admin/members');
        expect(legacyAdminPath('security')).toBe('/admin/security');
        expect(legacyAdminPath('x')).toBe('/admin');
        expect(legacyAdminPath('constructor')).toBe('/admin');
    });
});

describe('isWorkSettingsTab', () => {
    it('정해진 이름만', () => {
        expect(isWorkSettingsTab('docs')).toBe(true);
        expect(isWorkSettingsTab('Docs')).toBe(false);
        expect(isWorkSettingsTab('constructor')).toBe(false);
    });
});

describe('isHomepageMenu', () => {
    it('정해진 이름만', () => {
        expect(isHomepageMenu('faq')).toBe(true);
        expect(isHomepageMenu('FAQ')).toBe(false);
        expect(isHomepageMenu('constructor')).toBe(false);
        expect(isHomepageMenu('')).toBe(false);
    });
});

// 관리 화면 메뉴 — 묶음·주소·이름·권한을 한 곳에서 (사이드 메뉴·모바일 선택 상자·예전 주소 이동이 함께 씀)

export const HOMEPAGE_MENUS = [
    { key: 'inquiries', label: '문의함' },
    { key: 'orders', label: '주문' },
    { key: 'products', label: '개인결제 상품' },
    { key: 'customers', label: '고객 회원' },
    { key: 'notice', label: '공지사항' },
    { key: 'portfolio', label: '포트폴리오' },
    { key: 'faq', label: 'FAQ' },
    { key: 'popup', label: '메인 팝업' },
    { key: 'pages', label: '안내 페이지' },
] as const;
export type HomepageMenu = (typeof HOMEPAGE_MENUS)[number]['key'];

// 업무 설정(견적·계약서 분류·품목 문구·양식, 매출/매입 계정과목) — 관리자만 (11-05: 업무 메뉴에서 옮김)
export const WORK_SETTINGS = [
    { key: 'categories', label: '분류' },
    { key: 'items', label: '품목 문구' },
    { key: 'docs', label: '양식' },
    { key: 'accounts', label: '계정과목' },
] as const;
export type WorkSettingsTab = (typeof WORK_SETTINGS)[number]['key'];
export const isWorkSettingsTab = (v: string): v is WorkSettingsTab => WORK_SETTINGS.some(m => m.key === v);

// 홈페이지 권한자의 첫 화면(문의함이 가장 자주 확인하는 곳)
export const HOMEPAGE_HOME = '/admin/homepage/inquiries';

export type AdminBadge = 'pending' | 'inquiries' | 'orders';
export type AdminNavItem = { href: string; label: string; badge?: AdminBadge };
export type AdminNavGroup = { title: string | null; items: AdminNavItem[] };

// 프로토타입 키(constructor 등)가 걸리지 않게 목록에서 직접 찾음
export const isHomepageMenu = (v: string): v is HomepageMenu => HOMEPAGE_MENUS.some(m => m.key === v);

const BADGE: Partial<Record<HomepageMenu, AdminBadge>> = { inquiries: 'inquiries', orders: 'orders' };
const HOMEPAGE_GROUP: AdminNavGroup = {
    title: '홈페이지',
    items: HOMEPAGE_MENUS.map(m => ({ href: `/admin/homepage/${m.key}`, label: m.label, badge: BADGE[m.key] })),
};

// 관리자: 전체 / 홈페이지 권한자: 홈페이지 묶음만
export function adminNavFor(isAdmin: boolean): AdminNavGroup[] {
    if (!isAdmin) return [HOMEPAGE_GROUP];
    return [
        { title: null, items: [{ href: '/admin', label: '대시보드' }] },
        {
            title: '직원',
            items: [
                { href: '/admin/pending', label: '가입 승인', badge: 'pending' },
                { href: '/admin/members', label: '직원 관리' },
                { href: '/admin/leaves', label: '근태' },
                { href: '/admin/balances', label: '연차·휴가' },
                { href: '/admin/org', label: '조직' },
            ],
        },
        HOMEPAGE_GROUP,
        { title: '업무 설정', items: WORK_SETTINGS.map(m => ({ href: `/admin/work/${m.key}`, label: m.label })) },
        { title: '보안', items: [{ href: '/admin/security', label: '암호화 키' }] },
    ];
}

// 예전 주소 /admin?tab=<탭> → 새 주소 (Slack 알림·북마크). tab이 없으면 null
const LEGACY_TABS = ['pending', 'members', 'leaves', 'balances', 'org', 'security'];
export function legacyAdminPath(tab: string | undefined): string | null {
    if (tab === undefined) return null;
    if (tab === 'homepage') return HOMEPAGE_HOME;
    return LEGACY_TABS.includes(tab) ? `/admin/${tab}` : '/admin';
}

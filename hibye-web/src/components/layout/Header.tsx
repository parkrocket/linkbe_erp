import { Suspense } from 'react';
import { getAdminPendingCount, getCurrentUser, getShopAwaitingCount, getWorkPendingCount } from '@/lib/auth';
import { canManageHomepage } from '@/lib/homepage';
import { canApproveExpense } from '@/lib/work';
import { HeaderView, Logo } from './HeaderView';

// 쿠키를 읽는 부분만 Suspense로 감싸 정적 셸을 먼저 보냄 (cacheComponents)
export function Header() {
    return (
        <Suspense fallback={<HeaderFallback />}>
            <HeaderWithUser />
        </Suspense>
    );
}

async function HeaderWithUser() {
    // 루트 레이아웃은 error.tsx가 잡지 못함 → API 장애 시 로고만 있는 헤더 (본문은 error.tsx가 안내)
    const user = await getCurrentUser().catch(() => undefined);
    if (user === undefined) return <HeaderFallback />;
    const isAdmin = user?.user_role === 'admin';
    // '관리' 메뉴: 관리자 + 홈페이지 권한자(홈페이지 탭만)
    const canManage = !!user && canManageHomepage({ user_role: user.user_role ?? 'member', homepage_access: user.homepage_access });
    // 배지 = 가입 대기(관리자만) + 입금 대기 주문(홈페이지 권한자)
    // '업무' 메뉴 배지 = 대기 경비 수(경비 승인 권한자)
    const canApprove = !!user && canApproveExpense({ user_role: user.user_role ?? 'member', expense_approver: user.expense_approver });
    const [pending, awaiting, workPending] = await Promise.all([
        isAdmin ? getAdminPendingCount() : 0,
        canManage ? getShopAwaitingCount() : 0,
        canApprove ? getWorkPendingCount() : 0,
    ]);
    return <HeaderView userName={user?.user_name ?? null} canManage={canManage} pendingCount={pending + awaiting} workBadge={workPending} />;
}

function HeaderFallback() {
    return (
        <header className="sticky top-0 z-20 border-b border-line bg-white">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
                <Logo />
            </div>
        </header>
    );
}

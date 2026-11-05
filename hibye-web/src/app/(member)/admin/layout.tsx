import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminNavFor } from '@/lib/adminNav';
import { getAdminPendingCount, getCurrentUser, getNewInquiryCount, getShopAwaitingCount, loginPath } from '@/lib/auth';
import { canManageHomepage } from '@/lib/homepage';

// /admin/* 공통 틀 — 로그인·관리 권한(관리자 또는 홈페이지 권한) 확인 후 사이드 메뉴. 관리자 전용 화면은 각 page가 다시 확인
export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<AdminFallback />}>
            <Shell>{children}</Shell>
        </Suspense>
    );
}

async function Shell({ children }: { children: ReactNode }) {
    const user = await getCurrentUser();
    if (!user) redirect(await loginPath('/admin'));
    if (!canManageHomepage({ user_role: user.user_role ?? 'member', homepage_access: user.homepage_access })) redirect('/');
    const isAdmin = user.user_role === 'admin';
    const [pending, inquiries, orders] = await Promise.all([isAdmin ? getAdminPendingCount() : 0, getNewInquiryCount(), getShopAwaitingCount()]);
    return (
        <AdminShell groups={adminNavFor(isAdmin)} badges={{ pending, inquiries, orders }}>
            {children}
        </AdminShell>
    );
}

function AdminFallback() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-10">
            <Skeleton className="hidden h-96 w-52 md:block" />
            <Skeleton className="h-96 flex-1" />
        </div>
    );
}

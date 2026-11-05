import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { type TodoItem, TodoCards } from '@/components/admin/TodoCards';
import { Skeleton } from '@/components/ui/Skeleton';
import { HOMEPAGE_HOME, legacyAdminPath } from '@/lib/adminNav';
import { requireAdminPage } from '@/lib/adminPage';
import { getAdminPendingCount, getNewInquiryCount, getShopAwaitingCount, getWorkPendingCount } from '@/lib/auth';
import { canApproveExpense } from '@/lib/work';

export const metadata: Metadata = { title: '관리 — hibye' };

// /admin — 대시보드(처리할 일). 예전 주소 /admin?tab=<탭>은 새 주소로
export default function AdminRoute({ searchParams }: PageProps<'/admin'>) {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Dashboard searchParams={searchParams} />
        </Suspense>
    );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<'/admin'>['searchParams'] }) {
    const { tab } = await searchParams;
    const legacy = legacyAdminPath(typeof tab === 'string' ? tab : undefined);
    if (legacy) redirect(legacy);
    const user = await requireAdminPage();
    const canApprove = canApproveExpense({ user_role: user.user_role ?? 'member', expense_approver: user.expense_approver });
    const [pending, inquiries, orders, expenses] = await Promise.all([
        getAdminPendingCount(),
        getNewInquiryCount(),
        getShopAwaitingCount(),
        canApprove ? getWorkPendingCount() : 0,
    ]);
    const items: TodoItem[] = [
        { label: '가입 승인 대기', desc: '승인을 기다리는 가입 신청', count: pending, href: '/admin/pending' },
        { label: '새 문의', desc: '아직 확인하지 않은 문의', count: inquiries, href: HOMEPAGE_HOME },
        { label: '입금 대기', desc: '무통장 입금 확인이 필요한 주문', count: orders, href: '/admin/homepage/orders' },
        ...(canApprove ? [{ label: '경비 승인 대기', desc: '승인을 기다리는 경비', count: expenses, href: '/work/expense' }] : []),
    ];
    return (
        <>
            <AdminHeading title="처리할 일" desc="관리자가 확인해야 할 일을 모아 봐요." />
            <TodoCards items={items} />
        </>
    );
}

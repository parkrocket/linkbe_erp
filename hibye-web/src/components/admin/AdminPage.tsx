'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminErrorMessage } from '@/lib/authMessages';
import type { AdminUser } from './adminApi';
import { MembersTab } from './MembersTab';
import { PendingTab } from './PendingTab';

type Tab = 'pending' | 'members';
export type RunAction = (action: () => Promise<unknown>, doneText: string) => Promise<void>;

// /admin — 가입 승인·직원 관리. 목록 한 번 불러와 두 탭이 함께 사용
export function AdminPage({ myUserId }: { myUserId: string }) {
    const router = useRouter();
    const { state, reload } = useApiData<{ users?: AdminUser[] }>('/api/admin/users', undefined, 'GET');
    const [tab, setTab] = useState<Tab>('pending');
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const users = state.status === 'ok' ? (state.data.users ?? []) : [];
    const pending = users.filter(u => u.user_status === 'pending');

    // 버튼 공통 처리: 실행 → 결과 안내 → 목록·헤더 배지 갱신
    const run: RunAction = async (action, doneText) => {
        setNotice(null);
        try {
            await action();
            setNotice({ tone: 'ok', text: doneText });
            reload();
            router.refresh();
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
        }
    };

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:py-10">
            <h1 className="text-2xl font-extrabold tracking-tight">관리</h1>
            <p className="mt-1 text-sm text-muted">가입 신청을 승인하고 직원 계정을 관리해요. 모든 조치는 #hibye-관리에 기록돼요.</p>

            <div role="tablist" aria-label="관리 메뉴" className="mt-6 flex gap-1 border-b border-line">
                <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
                    가입 승인{pending.length > 0 && <span className="ml-1 text-primary">{pending.length}</span>}
                </TabButton>
                <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
                    직원 관리
                </TabButton>
            </div>

            {notice && (
                <p
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
                        notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'
                    }`}
                >
                    {notice.text}
                </p>
            )}

            <Card className="mt-4">
                {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
                {state.status === 'error' && <ErrorState onRetry={reload} />}
                {state.status === 'ok' &&
                    (tab === 'pending' ? (
                        <PendingTab users={pending} run={run} />
                    ) : (
                        <MembersTab users={users} myUserId={myUserId} run={run} />
                    ))}
            </Card>
        </main>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                active ? 'border-primary font-bold text-primary' : 'border-transparent text-muted hover:text-ink'
            }`}
        >
            {children}
        </button>
    );
}

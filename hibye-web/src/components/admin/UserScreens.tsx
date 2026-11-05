'use client';

import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { MembersTab } from './MembersTab';
import { PendingTab } from './PendingTab';
import { type AdminNotice, useAdminUsers } from './useAdminUsers';

// /admin/pending — 가입 승인 대기 목록
export function PendingScreen() {
    const { state, users, reload, run, notice } = useAdminUsers();
    return (
        <UsersFrame notice={notice} state={state.status} onRetry={reload}>
            <PendingTab users={users.filter(u => u.user_status === 'pending')} run={run} />
        </UsersFrame>
    );
}

// /admin/members — 직원 관리
export function MembersScreen({ myUserId }: { myUserId: string }) {
    const { state, users, reload, refresh, run, notice } = useAdminUsers();
    return (
        <UsersFrame notice={notice} state={state.status} onRetry={reload}>
            <MembersTab users={users} myUserId={myUserId} run={run} onChanged={refresh} />
        </UsersFrame>
    );
}

function UsersFrame({ notice, state, onRetry, children }: { notice: AdminNotice; state: string; onRetry: () => void; children: React.ReactNode }) {
    return (
        <>
            {notice && (
                <p
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={`mb-4 rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}
                >
                    {notice.text}
                </p>
            )}
            <Card>
                {state === 'loading' && <Skeleton className="h-48 w-full" />}
                {state === 'error' && <ErrorState onRetry={onRetry} />}
                {state === 'ok' && children}
            </Card>
        </>
    );
}

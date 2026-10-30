'use client';

import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RunAction } from './AdminPage';
import { changeRole, changeStatus, joinedAt, STATUS_LABEL, type AdminUser } from './adminApi';

const FILTERS: { value: AdminUser['user_status'] | 'all'; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'approved', label: '승인' },
    { value: 'inactive', label: '비활성' },
    { value: 'rejected', label: '거절' },
    { value: 'pending', label: '승인 대기' },
];

const STATUS_TONE: Record<AdminUser['user_status'], BadgeTone> = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    inactive: 'neutral',
};

// 직원 관리 탭 — 상태 필터, 비활성화·다시 활성화·관리자 지정/해제
export function MembersTab({ users, myUserId, run }: { users: AdminUser[]; myUserId: string; run: RunAction }) {
    const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
    const shown = filter === 'all' ? users : users.filter(u => u.user_status === filter);

    return (
        <>
            <div role="group" aria-label="상태 필터" className="mb-3 flex flex-wrap gap-1.5">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        type="button"
                        aria-pressed={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                            filter === f.value ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-line text-muted hover:text-ink'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {!shown.length ? (
                <EmptyState message="해당하는 직원이 없어요" />
            ) : (
                <ul className="divide-y divide-line">
                    {shown.map(u => (
                        <MemberRow key={u.mb_no} user={u} isMe={u.user_id === myUserId} run={run} />
                    ))}
                </ul>
            )}
        </>
    );
}

function MemberRow({ user: u, isMe, run }: { user: AdminUser; isMe: boolean; run: RunAction }) {
    // 자기 자신은 변경 불가 (서버도 409) — 버튼 대신 이유 안내
    const actions = isMe ? null : (
        <div className="flex flex-wrap gap-2">
            {u.user_status === 'approved' && (
                <Button variant="secondary" onClick={() => run(() => changeStatus(u.mb_no, 'inactive'), `${u.user_name}님을 비활성화했어요.`)}>
                    비활성화
                </Button>
            )}
            {(u.user_status === 'inactive' || u.user_status === 'rejected') && (
                <Button variant="secondary" onClick={() => run(() => changeStatus(u.mb_no, 'approved'), `${u.user_name}님을 다시 활성화했어요.`)}>
                    다시 활성화
                </Button>
            )}
            {u.user_status === 'approved' &&
                (u.user_role === 'admin' ? (
                    <Button variant="ghost" onClick={() => run(() => changeRole(u.mb_no, 'member'), `${u.user_name}님의 관리자 권한을 해제했어요.`)}>
                        관리자 해제
                    </Button>
                ) : (
                    <Button variant="ghost" onClick={() => run(() => changeRole(u.mb_no, 'admin'), `${u.user_name}님을 관리자로 지정했어요.`)}>
                        관리자로 지정
                    </Button>
                ))}
        </div>
    );

    return (
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {u.user_name}
                    {isMe && <span className="text-xs font-normal text-muted">(나)</span>}
                    <Badge tone={STATUS_TONE[u.user_status]}>{STATUS_LABEL[u.user_status]}</Badge>
                    {u.user_role === 'admin' && <Badge tone="info">관리자</Badge>}
                </p>
                <p className="truncate text-xs text-muted">
                    {u.user_id} · {joinedAt(u.user_datetime)} 가입
                </p>
            </div>
            {actions ?? <span className="text-xs text-muted">자기 자신은 변경할 수 없어요</span>}
        </li>
    );
}

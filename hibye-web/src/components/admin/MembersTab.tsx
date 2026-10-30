'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RunAction } from './AdminPage';
import { MemberDialog } from './MemberDialog';
import { changeRole, changeStatus, joinedAt, STATUS_LABEL, STATUS_TONE, type AdminUser } from './adminApi';

const FILTERS: { value: AdminUser['user_status'] | 'all'; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'approved', label: '승인' },
    { value: 'inactive', label: '비활성' },
    { value: 'rejected', label: '거절' },
    { value: 'pending', label: '승인 대기' },
];


// 직원 관리 탭 — 상태 필터, 비활성화·다시 활성화·관리자 지정/해제
export function MembersTab({ users, myUserId, run, onChanged }: { users: AdminUser[]; myUserId: string; run: RunAction; onChanged: () => void }) {
    const [opened, setOpened] = useState<number | null>(null);
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
                        <MemberRow key={u.mb_no} user={u} isMe={u.user_id === myUserId} run={run} onOpen={() => setOpened(u.mb_no)} />
                    ))}
                </ul>
            )}
            {opened !== null && <MemberDialog mbNo={opened} onClose={() => setOpened(null)} onChanged={onChanged} />}
        </>
    );
}

function MemberRow({ user: u, isMe, run, onOpen }: { user: AdminUser; isMe: boolean; run: RunAction; onOpen: () => void }) {
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
            {/* 이름 영역을 누르면 상세 팝업 (버튼이라 키보드로도 열림) */}
            <button
                type="button"
                onClick={onOpen}
                aria-label={`${u.user_name}님 정보 보기`}
                className="-m-1 min-w-0 flex-1 rounded-lg p-1 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {u.user_name}
                    {isMe && <span className="text-xs font-normal text-muted">(나)</span>}
                    <Badge tone={STATUS_TONE[u.user_status]}>{STATUS_LABEL[u.user_status]}</Badge>
                    {u.user_role === 'admin' && <Badge tone="info">관리자</Badge>}
                </span>
                <span className="block truncate text-xs text-muted">
                    {u.user_id} · {joinedAt(u.user_datetime)} 가입
                </span>
            </button>
            {actions ?? <span className="text-xs text-muted">자기 자신은 변경할 수 없어요</span>}
        </li>
    );
}

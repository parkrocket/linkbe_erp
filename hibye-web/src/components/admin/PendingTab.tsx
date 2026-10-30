'use client';

import { useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RunAction } from './AdminPage';
import { changeStatus, joinedAt, type AdminUser } from './adminApi';

// 가입 승인 탭 — 승인은 바로, 거절은 확인 후
export function PendingTab({ users, run }: { users: AdminUser[]; run: RunAction }) {
    const [rejectTarget, setRejectTarget] = useState<AdminUser | null>(null);

    if (!users.length) return <EmptyState message="승인을 기다리는 가입 신청이 없어요" />;

    return (
        <>
            <ul className="divide-y divide-line">
                {users.map(u => (
                    <li key={u.mb_no} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{u.user_name}</p>
                            <p className="truncate text-xs text-muted">
                                {u.user_id} · {u.user_phone ?? '-'} · {joinedAt(u.user_datetime)} 신청
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setRejectTarget(u)}>
                                거절
                            </Button>
                            <Button onClick={() => run(() => changeStatus(u.mb_no, 'approved'), `${u.user_name}님을 승인했어요.`)}>
                                승인
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            <Modal open={rejectTarget !== null} title="가입을 거절할까요?" onClose={() => setRejectTarget(null)}>
                {rejectTarget && (
                    <div className="flex flex-col gap-5">
                        <p className="text-sm">
                            <b>{rejectTarget.user_name}</b>({rejectTarget.user_id})님의 가입을 거절해요. 같은 이메일로는 다시 가입할 수
                            없고, 필요하면 직원 관리에서 다시 승인할 수 있어요.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                                닫기
                            </Button>
                            <Button
                                onClick={async () => {
                                    const target = rejectTarget;
                                    setRejectTarget(null);
                                    await run(() => changeStatus(target.mb_no, 'rejected'), `${target.user_name}님의 가입을 거절했어요.`);
                                }}
                            >
                                거절하기
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

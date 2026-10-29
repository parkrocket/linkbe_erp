'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LeaveBadge } from '@/components/dashboard/LeaveBadge';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch, ApiError } from '@/lib/api';
import { balanceAfter, leaveLabel, toDays } from '@/lib/leave';
import type { User, VacationRecord } from '@/lib/types';
import { ApplyDialog } from './ApplyDialog';
import { Modal } from './Modal';

type Response = { vacationList?: VacationRecord[] };

const DATE_LABEL = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const APPLIED_LABEL = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });

export function LeavePage({ user, openApply }: { user: User; openApply: boolean }) {
    const router = useRouter();
    const { state, reload } = useApiData<Response>('/api/vacation/list', {});
    const [applyOpen, setApplyOpen] = useState(openApply);
    const [cancelTarget, setCancelTarget] = useState<VacationRecord | null>(null);

    // 신청·취소 후: 목록 다시 불러오고, 남은 일수(서버의 사용자 정보)도 새로 그림
    const refresh = () => {
        reload();
        router.refresh();
    };

    const list = state.status === 'ok' ? [...(state.data.vacationList ?? [])].sort((a, b) => a.date.localeCompare(b.date)) : [];

    return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">내 근태</h1>
                    <p className="mt-1 text-sm text-muted">연차·반차·휴가·재택을 신청하고 확인해요.</p>
                </div>
                <Button onClick={() => setApplyOpen(true)}>
                    <Plus aria-hidden className="size-4" />
                    근태 신청
                </Button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3">
                <Balance label="남은 연차" value={toDays(user.user_stip)} />
                <Balance label="남은 휴가" value={toDays(user.user_vaca)} />
            </dl>

            <Card title="예정된 근태" className="mt-4">
                {state.status === 'loading' && <Skeleton className="h-32 w-full" />}
                {state.status === 'error' && <ErrorState onRetry={reload} />}
                {state.status === 'ok' &&
                    (list.length ? (
                        <ul className="divide-y divide-line">
                            {list.map(v => (
                                <li key={v.id ?? v.date} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                                    <span className="min-w-40 text-sm font-medium">{DATE_LABEL.format(new Date(v.date))}</span>
                                    <LeaveBadge type={v.type} />
                                    <span className="text-xs text-muted">
                                        {v.va_datetime && `${APPLIED_LABEL.format(new Date(v.va_datetime))} 신청`}
                                    </span>
                                    <Button variant="ghost" className="ml-auto px-3 py-1.5" onClick={() => setCancelTarget(v)}>
                                        취소
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState message="예정된 근태가 없어요" />
                    ))}
            </Card>

            <ApplyDialog open={applyOpen} user={user} onClose={() => setApplyOpen(false)} onApplied={refresh} />
            <CancelDialog
                target={cancelTarget}
                user={user}
                onClose={() => setCancelTarget(null)}
                onCanceled={refresh}
            />
        </main>
    );
}

function Balance({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-(--radius-card) border border-line bg-white px-5 py-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-3xl font-extrabold tabular-nums">
                {value}
                <span className="ml-0.5 text-base font-medium text-muted">일</span>
            </dd>
        </div>
    );
}

type CancelProps = { target: VacationRecord | null; user: User; onClose: () => void; onCanceled: () => void };

// 취소 확인 — 되돌릴 일수를 보여주고 한 번 더 확인
function CancelDialog({ target, user, onClose, onCanceled }: CancelProps) {
    const router = useRouter();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const restore = target && balanceAfter(user, target.type);

    async function cancel() {
        if (!target) return;
        setSubmitting(true);
        setError('');
        try {
            await apiFetch('/api/apply/applyCancel', { method: 'POST', body: { id: target.id } });
            onCanceled();
            onClose();
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                router.replace('/login?redirect=/vaca');
                return;
            }
            setError(e instanceof ApiError && e.status === 404 ? '이미 취소된 근태예요.' : '취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={target !== null} title="근태를 취소할까요?" onClose={onClose}>
            {target && (
                <div className="flex flex-col gap-5">
                    <p className="text-sm">
                        {DATE_LABEL.format(new Date(target.date))} <b>{leaveLabel(target.type)}</b>을(를) 취소해요.
                        {restore && (
                            <span className="mt-1 block text-muted">
                                남은 {restore.label}에 {restore.days}일이 돌아와요.
                            </span>
                        )}
                    </p>
                    {error && (
                        <p role="alert" className="text-sm text-rejected-fg">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={onClose}>
                            유지하기
                        </Button>
                        <Button onClick={cancel} disabled={submitting}>
                            {submitting ? '취소 중…' : '근태 취소'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

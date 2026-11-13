'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { kstDate } from '@/lib/schedule';
import { formatWon } from '@/lib/shop';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_LABEL, shiftMonth, type ExpenseCategory, type ExpenseForm, type ExpenseItem, type ExpenseStatus } from '@/lib/work';
import { ExpenseDialog } from './ExpenseDialog';
import { StatusBadge } from './StatusBadge';

type Summary = { count: number; total: number; byCategory: Partial<Record<ExpenseCategory, number>> };
type ListResponse = { month: string; expenses: ExpenseItem[]; summary: Summary };

const SELECT_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

// 경비 화면 — 월별 목록·요약·상태 필터, 행을 누르면 상세 팝업, 기안 버튼
export function ExpensePage({ canApprove }: { canApprove: boolean }) {
    const [ym, setYm] = useState(() => kstDate(Date.now()).slice(0, 7));
    const [status, setStatus] = useState<ExpenseStatus | ''>('');
    // 팝업: 'new' = 기안, 숫자 = 상세. copy = 상세에서 '복사'로 연 기안의 처음 값
    const [open, setOpen] = useState<'new' | number | null>(null);
    const [copy, setCopy] = useState<ExpenseForm | null>(null);
    const openDialog = (target: 'new' | number | null, from: ExpenseForm | null = null) => {
        setCopy(from);
        setOpen(target);
    };

    const list = useApiData<ListResponse>(`/api/work/expenses?month=${ym}${status ? `&status=${status}` : ''}`, undefined, 'GET');
    const data = list.state.status === 'ok' ? list.state.data : null;
    const categories = data ? (Object.entries(data.summary.byCategory) as [ExpenseCategory, number][]).filter(([, sum]) => sum > 0) : [];

    return (
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-10">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="flex flex-wrap items-baseline gap-x-3 text-2xl font-bold">
                    경비
                    {!canApprove && <span className="text-sm font-normal text-muted">내 경비만 보여요</span>}
                </h1>
                <Button onClick={() => openDialog('new')}>경비 기안</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                    <IconButton label="이전 달" onClick={() => setYm(shiftMonth(ym, -1))}>
                        <ChevronLeft className="size-4" />
                    </IconButton>
                    <span className="min-w-28 text-center text-base font-bold">
                        {ym.slice(0, 4)}년 {Number(ym.slice(5))}월
                    </span>
                    <IconButton label="다음 달" onClick={() => setYm(shiftMonth(ym, 1))}>
                        <ChevronRight className="size-4" />
                    </IconButton>
                </div>
                <select aria-label="상태" className={SELECT_CLASS} value={status} onChange={e => setStatus(e.target.value as ExpenseStatus | '')}>
                    <option value="">전체 상태</option>
                    {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map(s => (
                        <option key={s} value={s}>
                            {EXPENSE_STATUS_LABEL[s]}
                        </option>
                    ))}
                </select>
            </div>

            {data && (
                <div className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm" aria-live="polite">
                    <p>
                        {data.summary.count}건 · 합계 <strong className="text-base">{formatWon(data.summary.total)}</strong>
                    </p>
                    {categories.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted">
                            {categories.map(([c, sum]) => (
                                <span key={c}>
                                    {EXPENSE_CATEGORY_LABEL[c]} <strong className="text-ink">{formatWon(sum)}</strong>
                                </span>
                            ))}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4">
                {list.state.status === 'loading' && <Skeleton className="h-72 w-full" />}
                {list.state.status === 'error' && <ErrorState onRetry={list.reload} />}
                {data &&
                    (data.expenses.length ? (
                        <ExpenseTable rows={data.expenses} canApprove={canApprove} onPick={id => openDialog(id)} />
                    ) : (
                        <EmptyState message="이 달에는 경비가 없어요" />
                    ))}
            </div>

            {open !== null && (
                <ExpenseDialog
                    key={`${open}${copy ? '-copy' : ''}`}
                    target={open}
                    canApprove={canApprove}
                    copyFrom={copy ?? undefined}
                    onClose={() => openDialog(null)}
                    onChanged={list.refresh}
                    onCopy={form => openDialog('new', form)}
                />
            )}
        </main>
    );
}

function ExpenseTable({ rows, canApprove, onPick }: { rows: ExpenseItem[]; canApprove: boolean; onPick: (id: number) => void }) {
    return (
        <ul className="divide-y divide-line rounded-lg border border-line">
            {rows.map(r => (
                <li key={r.id}>
                    <button
                        type="button"
                        onClick={() => onPick(r.id)}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        <span className="w-12 shrink-0 tabular-nums text-muted">{r.spentOn.slice(5).replace('-', '/')}</span>
                        <span className="w-24 shrink-0 text-xs text-muted">{EXPENSE_CATEGORY_LABEL[r.category]}</span>
                        <span className="min-w-0 flex-1 basis-40 truncate font-semibold">{r.title}</span>
                        {canApprove && <span className="text-xs text-muted">{r.writerName}</span>}
                        <span className="ml-auto w-28 text-right font-bold tabular-nums">{formatWon(r.amount)}</span>
                        <StatusBadge status={r.status} />
                    </button>
                </li>
            ))}
        </ul>
    );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
            {children}
        </button>
    );
}

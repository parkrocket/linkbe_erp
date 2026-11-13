'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { kstDate } from '@/lib/schedule';
import { daysLeft, leftBadge, SOON_DAYS, STATUS_LABEL, type SiteContract, type SiteContractStatus } from '@/lib/siteContract';
import { SiteContractDialog } from './SiteContractDialog';

const FIELD_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

// 주소 칸은 손으로 적는 칸이라 http(s)로 시작할 때만 링크로 (javascript: 등 차단)
const isLink = (url: string) => /^https?:\/\//i.test(url);

// 계약 관리 — 업체별 홈페이지 계약 기간 목록·팝업. 건수가 적어 한 번에 받아 화면에서 걸러 봄
export function SiteContractPage() {
    const list = useApiData<{ contracts: SiteContract[] }>('/api/work/site-contracts', undefined, 'GET');
    const [status, setStatus] = useState<SiteContractStatus | ''>('run');
    const [q, setQ] = useState('');
    const [dialog, setDialog] = useState<'new' | SiteContract | null>(null);

    const all = list.state.status === 'ok' ? list.state.data.contracts : null;
    const [today] = useState(() => kstDate(Date.now())); // KST 오늘 — 화면을 열 때 한 번
    const word = q.trim().toLowerCase();
    const rows = (all ?? []).filter(
        c => (!status || c.status === status) && (!word || [c.companyName, c.code, c.siteUrl, c.memo].some(v => v.toLowerCase().includes(word))),
    );
    const running = (all ?? []).filter(c => c.status === 'run');
    const soon = running.filter(c => {
        const left = daysLeft(c.endDate, today);
        return left !== null && left <= SOON_DAYS;
    }).length;

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">계약 관리</h1>
                <Button disabled={!all} onClick={() => setDialog('new')}>
                    새 계약
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2" role="search" aria-label="계약 검색">
                <select aria-label="상태" className={FIELD_CLASS} value={status} onChange={e => setStatus(e.target.value as SiteContractStatus | '')}>
                    <option value="">전체 상태</option>
                    {(Object.keys(STATUS_LABEL) as SiteContractStatus[]).map(s => (
                        <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                        </option>
                    ))}
                </select>
                <input
                    type="search"
                    aria-label="업체명·코드·메모 검색"
                    placeholder="업체명·코드·메모 검색"
                    maxLength={100}
                    className={`${FIELD_CLASS} w-56`}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
                {all && (
                    <p className="text-sm text-muted" aria-live="polite">
                        진행 {running.length}건 · {SOON_DAYS}일 안 만료(지난 것 포함) <strong className={soon ? 'text-pending-fg' : ''}>{soon}건</strong>
                    </p>
                )}
            </div>

            {list.state.status === 'loading' && <Skeleton className="mt-4 h-72 w-full" />}
            {list.state.status === 'error' && (
                <div className="mt-4">
                    <ErrorState onRetry={list.reload} />
                </div>
            )}

            {all && (
                <div className="mt-4">
                    {rows.length ? (
                        <div className="overflow-x-auto rounded-lg border border-line">
                            <table className="w-full min-w-[48rem] text-left text-sm">
                                <caption className="sr-only">계약 목록</caption>
                                <thead className="bg-surface text-xs text-muted">
                                    <tr>
                                        {['업체명', '코드', '사이트', '계약 기간', '남은 기간', '상태', '메모'].map(h => (
                                            <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {rows.map(c => {
                                        const badge = leftBadge(c, today);
                                        return (
                                            <tr key={c.id} className="hover:bg-surface">
                                                <td className="max-w-48 truncate px-3 py-2.5">
                                                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setDialog(c)}>
                                                        {c.companyName}
                                                    </button>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 text-muted">{c.code || '-'}</td>
                                                <td className="max-w-44 truncate px-3 py-2.5">
                                                    {isLink(c.siteUrl) ? (
                                                        <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                            {c.siteUrl.replace(/^https?:\/\//i, '')}
                                                        </a>
                                                    ) : (
                                                        c.siteUrl || '-'
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                                                    {c.startDate ?? ''} ~ {c.endDate ?? ''}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5">{badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2.5">
                                                    <Badge tone={c.status === 'run' ? 'approved' : 'neutral'}>{STATUS_LABEL[c.status]}</Badge>
                                                </td>
                                                <td className="max-w-56 truncate px-3 py-2.5 text-muted" title={c.memo}>
                                                    {c.memo}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="조건에 맞는 계약이 없어요" />
                    )}
                </div>
            )}

            {dialog !== null && (
                <SiteContractDialog
                    // 대상이 바뀌면 새로 초기화
                    key={dialog === 'new' ? 'new' : dialog.id}
                    target={dialog}
                    onClose={() => setDialog(null)}
                    onChanged={list.refresh}
                />
            )}
        </main>
    );
}

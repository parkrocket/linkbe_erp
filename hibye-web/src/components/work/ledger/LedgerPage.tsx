'use client';

import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountGroups, groupTotals, SIDE_LABEL, type Account, type LedgerRow, type LedgerSummary, type Side } from '@/lib/ledger';
import { kstDate } from '@/lib/schedule';
import { formatWon } from '@/lib/shop';
import { LedgerDialog } from './LedgerDialog';

type ListResponse = { entries: LedgerRow[]; total: number; page: number; size: number; summary: LedgerSummary };

const SELECT_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';
const SIZE = 20;

type Filters = { year: string; month: string; side: string; accountId: string; q: string };

// 음수는 빨강
const Money = ({ n }: { n: number }) => <span className={`tabular-nums ${n < 0 ? 'text-rejected-fg' : ''}`}>{formatWon(n)}</span>;

// 매출/매입 장부 — 필터·요약·계정별 합계·목록·팝업
export function LedgerPage() {
    // 기본 연도는 KST 올해
    const [initial] = useState<Filters>(() => ({ year: kstDate(Date.now()).slice(0, 4), month: '', side: '', accountId: '', q: '' }));
    const [draft, setDraft] = useState<Filters>(initial);
    const [applied, setApplied] = useState<Filters>(initial);
    const [page, setPage] = useState(1);
    const [dialog, setDialog] = useState<'new' | number | null>(null);

    const params = new URLSearchParams({ page: String(page), size: String(SIZE) });
    (Object.keys(applied) as (keyof Filters)[]).forEach(k => applied[k].trim() && params.set(k, applied[k].trim()));

    // 늦게 온 응답이 최신 필터 결과를 덮지 않음 (useApiData가 path가 바뀌면 이전 요청 결과를 버림)
    const list = useApiData<ListResponse>(`/api/work/ledger?${params}`, undefined, 'GET');
    const acc = useApiData<{ accounts: Account[] }>('/api/work/accounts', undefined, 'GET');
    const data = list.state.status === 'ok' ? list.state.data : null;
    const accounts = acc.state.status === 'ok' ? acc.state.data.accounts : [];
    const lastPage = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
    const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? '-';

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setApplied(draft);
        setPage(1);
    };
    // 구분을 바꾸면 계정과목 선택은 초기화 (다른 구분 계정이 남지 않게)
    const set = (key: keyof Filters, value: string) => setDraft(prev => ({ ...prev, [key]: value, ...(key === 'side' ? { accountId: '' } : {}) }));

    // 계정과목 선택지 — 구분을 고르면 그 구분 항목만, 안 고르면 두 구분 모두
    const sides: Side[] = draft.side ? [draft.side as Side] : ['sales', 'purchase'];

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">매출/매입</h1>
                <Button disabled={acc.state.status !== 'ok'} onClick={() => setDialog('new')}>
                    새 장부
                </Button>
            </div>

            <form onSubmit={submit} className="flex flex-wrap items-center gap-2" role="search" aria-label="장부 검색">
                <input
                    type="number"
                    aria-label="연도"
                    min={2000}
                    max={2100}
                    className={`${SELECT_CLASS} w-24`}
                    value={draft.year}
                    onChange={e => set('year', e.target.value)}
                />
                <select aria-label="월" className={SELECT_CLASS} value={draft.month} onChange={e => set('month', e.target.value)}>
                    <option value="">전체 월</option>
                    {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                            {i + 1}월
                        </option>
                    ))}
                </select>
                <select aria-label="구분" className={SELECT_CLASS} value={draft.side} onChange={e => set('side', e.target.value)}>
                    <option value="">전체 구분</option>
                    {(Object.keys(SIDE_LABEL) as Side[]).map(s => (
                        <option key={s} value={s}>
                            {SIDE_LABEL[s]}
                        </option>
                    ))}
                </select>
                <select aria-label="계정과목" className={`${SELECT_CLASS} max-w-48`} value={draft.accountId} onChange={e => set('accountId', e.target.value)}>
                    <option value="">전체 계정과목</option>
                    {sides.flatMap(side =>
                        accountGroups(accounts, side).map(g => {
                            const prefix = draft.side ? '' : `[${SIDE_LABEL[side]}] `;
                            const items = g.items.map(i => (
                                <option key={i.id} value={i.id}>
                                    {prefix}
                                    {i.name}
                                </option>
                            ));
                            return g.group ? (
                                <optgroup key={g.group.id} label={`${prefix}${g.group.name}`}>
                                    {items}
                                </optgroup>
                            ) : (
                                items
                            );
                        }),
                    )}
                </select>
                <input
                    type="search"
                    aria-label="제목 검색"
                    placeholder="제목 검색"
                    maxLength={100}
                    className={`${SELECT_CLASS} w-40`}
                    value={draft.q}
                    onChange={e => set('q', e.target.value)}
                />
                <Button type="submit" variant="secondary">
                    조회
                </Button>
            </form>

            {list.state.status === 'loading' && <Skeleton className="mt-4 h-72 w-full" />}
            {list.state.status === 'error' && (
                <div className="mt-4">
                    <ErrorState onRetry={list.reload} />
                </div>
            )}

            {data && (
                <>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-3" aria-live="polite">
                        {(
                            [
                                ['매출 합계', data.summary.sales],
                                ['매입 합계', data.summary.purchase],
                                ['차액 (매출 − 매입)', data.summary.diff],
                            ] as [string, number][]
                        ).map(([label, n]) => (
                            <div key={label} className="rounded-lg bg-surface px-4 py-3">
                                <dt className="text-xs text-muted">{label}</dt>
                                <dd className="mt-1 text-lg font-bold">
                                    <Money n={n} />
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <ByAccount accounts={accounts} byAccount={data.summary.byAccount} side={applied.side} />

                    <div className="mt-4">
                        {data.entries.length ? (
                            <div className="overflow-x-auto rounded-lg border border-line">
                                <table className="w-full min-w-[44rem] text-left text-sm">
                                    <caption className="sr-only">매출/매입 장부 목록</caption>
                                    <thead className="bg-surface text-xs text-muted">
                                        <tr>
                                            {['날짜', '구분', '계정과목', '제목', '공급가', '부가세', '합계'].map(h => (
                                                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {data.entries.map(r => (
                                            <tr key={r.id} className="hover:bg-surface">
                                                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.entryDate}</td>
                                                <td className="px-3 py-2.5">{SIDE_LABEL[r.side]}</td>
                                                <td className="px-3 py-2.5 text-muted">{accountName(r.accountId)}</td>
                                                <td className="max-w-56 truncate px-3 py-2.5">
                                                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setDialog(r.id)}>
                                                        {r.title}
                                                    </button>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                                    <Money n={r.supply} />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                                    <Money n={r.tax} />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                                                    <Money n={r.total} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState message="조건에 맞는 장부가 없어요" />
                        )}
                    </div>

                    {data.total > data.size && (
                        <nav aria-label="페이지 이동" className="mt-4 flex items-center justify-center gap-3 text-sm">
                            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                이전
                            </Button>
                            <span aria-live="polite">
                                {page} / {lastPage}
                            </span>
                            <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                                다음
                            </Button>
                        </nav>
                    )}
                </>
            )}

            {dialog !== null && (
                <LedgerDialog
                    // 대상이 바뀌면 새로 초기화
                    key={String(dialog)}
                    target={dialog}
                    accounts={accounts}
                    defaultSide={(applied.side as Side) || 'sales'}
                    onClose={() => setDialog(null)}
                    onChanged={list.refresh}
                />
            )}
        </main>
    );
}

// 계정과목별 합계 — 묶음은 묶음 합계 + 펼친 항목
function ByAccount({ accounts, byAccount, side }: { accounts: Account[]; byAccount: LedgerSummary['byAccount']; side: string }) {
    const totals = groupTotals(accounts, byAccount);
    const counts = new Map(byAccount.map(b => [b.accountId, b.count]));
    const sides: Side[] = side ? [side as Side] : ['sales', 'purchase'];
    const blocks = sides.flatMap(s =>
        accountGroups(accounts, s)
            .map(g => ({ side: s, group: g.group, items: g.items.filter(i => counts.has(i.id)) }))
            .filter(g => g.items.length),
    );
    if (!blocks.length) return null;
    return (
        <details className="mt-4 rounded-lg border border-line px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">계정과목별 합계</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {blocks.map(b => (
                    <section key={`${b.side}-${b.group?.id ?? 'x'}`} aria-label={`${SIDE_LABEL[b.side]} ${b.group?.name ?? ''}`}>
                        <p className="flex justify-between font-semibold">
                            <span>
                                {SIDE_LABEL[b.side]}
                                {b.group ? ` · ${b.group.name}` : ''}
                            </span>
                            {b.group && <Money n={totals[b.group.id] ?? 0} />}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-muted">
                            {b.items.map(i => (
                                <li key={i.id} className="flex justify-between gap-2">
                                    <span>
                                        {i.name} ({counts.get(i.id)}건)
                                    </span>
                                    <Money n={totals[i.id] ?? 0} />
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </details>
    );
}

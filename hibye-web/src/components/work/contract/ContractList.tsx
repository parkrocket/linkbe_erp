'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CONTRACT_STATUS_LABEL, deliveryDday, type Category, type ContractRow, type ContractStatus, vat } from '@/lib/contract';
import { kstDate } from '@/lib/schedule';
import { formatWon } from '@/lib/shop';

type ListResponse = {
    contracts: ContractRow[];
    total: number;
    page: number;
    size: number;
    // 업체명 검색일 때만 (서버 workContractController.list)
    companyTotals: { paid: number; receivable: number } | null;
};

const STATUS_TONE: Record<ContractStatus, BadgeTone> = { active: 'info', unpaid: 'pending', paid: 'approved', hold: 'neutral', cancelled: 'rejected' };
const SELECT_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';
const SIZE = 20;

type Filters = { categoryId: string; status: string; from: string; to: string; q: string };
const EMPTY: Filters = { categoryId: '', status: '', from: '', to: '', q: '' };

// 견적·계약서 목록 — 필터·업체 합계·페이지 이동
export function ContractList() {
    // draft = 입력 중, applied = 조회에 쓰는 값 (조회 버튼·Enter로 반영)
    const [draft, setDraft] = useState<Filters>(EMPTY);
    const [applied, setApplied] = useState<Filters>(EMPTY);
    const [page, setPage] = useState(1);

    const params = new URLSearchParams({ page: String(page), size: String(SIZE) });
    (Object.keys(applied) as (keyof Filters)[]).forEach(k => applied[k].trim() && params.set(k, applied[k].trim()));

    const list = useApiData<ListResponse>(`/api/work/contracts?${params}`, undefined, 'GET');
    const cats = useApiData<{ categories: Category[] }>('/api/work/doc-settings', undefined, 'GET');
    const data = list.state.status === 'ok' ? list.state.data : null;
    const categories = cats.state.status === 'ok' ? cats.state.data.categories : [];
    const [today] = useState(() => kstDate(Date.now())); // 화면을 연 시점의 KST 오늘
    const lastPage = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setApplied(draft);
        setPage(1);
    };
    const set = (key: keyof Filters, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

    return (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">견적·계약서</h1>
                <Link href="/work/contracts/new" className={buttonClass('primary')}>
                    새 계약
                </Link>
            </div>

            <form onSubmit={submit} className="flex flex-wrap items-center gap-2" role="search" aria-label="계약 검색">
                <select aria-label="분류" className={SELECT_CLASS} value={draft.categoryId} onChange={e => set('categoryId', e.target.value)}>
                    <option value="">전체 분류</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <select aria-label="상태" className={SELECT_CLASS} value={draft.status} onChange={e => set('status', e.target.value)}>
                    <option value="">전체 상태</option>
                    {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map(s => (
                        <option key={s} value={s}>
                            {CONTRACT_STATUS_LABEL[s]}
                        </option>
                    ))}
                </select>
                <span className="flex items-center gap-1 text-sm text-muted">
                    계약일
                    <input type="date" aria-label="계약일 시작" className={SELECT_CLASS} value={draft.from} onChange={e => set('from', e.target.value)} />~
                    <input type="date" aria-label="계약일 끝" className={SELECT_CLASS} value={draft.to} onChange={e => set('to', e.target.value)} />
                </span>
                <input
                    type="search"
                    aria-label="업체명"
                    placeholder="업체명"
                    maxLength={100}
                    className={`${SELECT_CLASS} w-40`}
                    value={draft.q}
                    onChange={e => set('q', e.target.value)}
                />
                <Button type="submit" variant="secondary">
                    조회
                </Button>
            </form>

            {data?.companyTotals && (
                <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm" aria-live="polite">
                    이 업체 입금 합계 <strong>{formatWon(data.companyTotals.paid)}</strong> · 미수 합계 <strong>{formatWon(data.companyTotals.receivable)}</strong>
                </p>
            )}

            <div className="mt-4">
                {list.state.status === 'loading' && <Skeleton className="h-72 w-full" />}
                {list.state.status === 'error' && <ErrorState onRetry={list.reload} />}
                {data &&
                    (data.contracts.length ? (
                        <div className="overflow-x-auto rounded-lg border border-line">
                            <table className="w-full min-w-[56rem] text-left text-sm">
                                <caption className="sr-only">견적·계약서 목록</caption>
                                <thead className="bg-surface text-xs text-muted">
                                    <tr>
                                        {['문서번호', '분류', '업체명', '프로젝트명', '계약일', '총액(VAT 포함)', '입금', '미수', '상태', '계산서', '납품'].map(h => (
                                            <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {data.contracts.map(r => (
                                        <tr key={r.id} className="hover:bg-surface">
                                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                                                <Link href={`/work/contracts/${r.id}`} className="font-semibold text-primary hover:underline">
                                                    {r.docNo}
                                                </Link>
                                            </td>
                                            <td className="max-w-36 truncate whitespace-nowrap px-3 py-2.5 text-muted" title={r.categoryName || undefined}>{r.categoryName || '-'}</td>
                                            <td className="max-w-48 truncate whitespace-nowrap px-3 py-2.5 font-semibold" title={r.companyName}>{r.companyName}</td>
                                            <td className="max-w-64 truncate whitespace-nowrap px-3 py-2.5" title={r.projectName}>{r.projectName}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.contractDate || '-'}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatWon(r.total + vat(r.total))}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatWon(r.paidAmount)}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatWon(r.receivable)}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5">
                                                <Badge tone={STATUS_TONE[r.status]}>{CONTRACT_STATUS_LABEL[r.status]}</Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2.5">{r.invoiceIssued ? '발행' : '-'}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{deliveryDday(r, today)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="조건에 맞는 계약이 없어요" />
                    ))}
            </div>

            {data && data.total > data.size && (
                <nav aria-label="페이지 이동" className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:gap-3">
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(1)}>
                        처음
                    </Button>
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        이전
                    </Button>
                    <span aria-live="polite">
                        {page} / {lastPage}
                    </span>
                    <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                        다음
                    </Button>
                    <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage(lastPage)}>
                        마지막
                    </Button>
                </nav>
            )}
        </main>
    );
}

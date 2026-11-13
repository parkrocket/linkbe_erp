'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button, buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

type Post = {
    id: number;
    title: string;
    writerName: string;
    commentCount: number;
    createdAt: string;
};
type ListResponse = {
    posts: Post[];
    total: number;
    page: number;
    size: number;
};

const SIZE = 20;

// 바이럴 게시판 목록 — 검색·페이지 이동
export function BoardList() {
    const [draft, setDraft] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);

    const params = new URLSearchParams({
        page: String(page),
        size: String(SIZE),
    });
    if (q.trim()) params.set('q', q.trim());
    const list = useApiData<ListResponse>(
        `/api/work/boards/viral?${params}`,
        undefined,
        'GET',
    );
    const data = list.state.status === 'ok' ? list.state.data : null;
    const lastPage = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setQ(draft);
        setPage(1);
    };

    return (
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">바이럴</h1>
                <Link href="/work/viral/new" className={buttonClass('primary')}>
                    글쓰기
                </Link>
            </div>

            <form
                onSubmit={submit}
                className="flex gap-2"
                role="search"
                aria-label="바이럴 글 검색"
            >
                <input
                    type="search"
                    aria-label="검색어"
                    placeholder="검색어"
                    maxLength={100}
                    className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                />
                <Button type="submit" variant="secondary">
                    검색
                </Button>
            </form>

            <div className="mt-4">
                {list.state.status === 'loading' && (
                    <Skeleton className="h-72 w-full" />
                )}
                {list.state.status === 'error' && (
                    <ErrorState onRetry={list.reload} />
                )}
                {data &&
                    (data.posts.length ? (
                        <div className="overflow-x-auto rounded-lg border border-line">
                            <table className="w-full min-w-[32rem] text-left text-sm">
                                <caption className="sr-only">
                                    바이럴 글 목록
                                </caption>
                                <thead className="bg-surface text-xs text-muted">
                                    <tr>
                                        {['제목', '작성자', '작성일'].map(h => (
                                            <th
                                                key={h}
                                                scope="col"
                                                className="whitespace-nowrap px-3 py-2 font-semibold"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {data.posts.map(p => (
                                        <tr
                                            key={p.id}
                                            className="hover:bg-surface"
                                        >
                                            <td className="px-3 py-2.5">
                                                <Link
                                                    href={`/work/viral/${p.id}`}
                                                    className="font-semibold text-primary hover:underline"
                                                >
                                                    {p.title}
                                                </Link>
                                                {p.commentCount > 0 && (
                                                    <span className="ml-1.5 text-xs text-muted">
                                                        [{p.commentCount}]
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2.5">
                                                {p.writerName || '-'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">
                                                {p.createdAt}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="글이 없어요" />
                    ))}
            </div>

            {data && data.total > data.size && (
                <nav
                    aria-label="페이지 이동"
                    className="mt-4 flex items-center justify-center gap-3 text-sm"
                >
                    <Button
                        variant="secondary"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        이전
                    </Button>
                    <span aria-live="polite">
                        {page} / {lastPage}
                    </span>
                    <Button
                        variant="secondary"
                        disabled={page >= lastPage}
                        onClick={() => setPage(page + 1)}
                    >
                        다음
                    </Button>
                </nav>
            )}
        </main>
    );
}

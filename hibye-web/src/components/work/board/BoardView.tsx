'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch, ApiError } from '@/lib/api';
import { BoardForm } from './BoardForm';

type Post = {
    id: number;
    title: string;
    bodyHtml: string;
    writerName: string;
    isMine: boolean;
    createdAt: string;
    updatedAt: string;
};
type Comment = {
    id: number;
    body: string;
    writerName: string;
    isMine: boolean;
    createdAt: string;
};

// 바이럴 글 보기 — 본문·댓글·수정·삭제
export function BoardView({ id }: { id: string }) {
    const router = useRouter();
    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadState, setLoadState] = useState<
        'loading' | 'ok' | 'notFound' | 'error'
    >('loading');
    const [editing, setEditing] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [newComment, setNewComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    // 처음 불러오기 실패만 화면 상태를 바꿈 (다시 불러오기 실패가 내용을 지우지 않게)
    const load = useCallback(async (): Promise<boolean> => {
        try {
            const r = await apiFetch<{ post: Post; comments: Comment[] }>(
                `/api/work/boards/viral/${encodeURIComponent(id)}`,
            );
            setPost(r.post);
            setComments(r.comments);
            setLoadState('ok');
            setFormKey(k => k + 1);
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.status === 401)
                router.replace('/login?redirect=/');
            else
                setLoadState(prev =>
                    prev === 'ok'
                        ? prev
                        : e instanceof ApiError && e.status === 404
                          ? 'notFound'
                          : 'error',
                );
            return false;
        }
    }, [id, router]);

    useEffect(() => {
        // 마운트 때 글 불러오기 (상태 갱신은 응답 뒤)
        void load();
    }, [load]);

    // 삭제·댓글 공통: 실패 문구만 다름
    const run = async (fn: () => Promise<void>, failText: string) => {
        setBusy(true);
        setMessage('');
        try {
            await fn();
        } catch (e) {
            if (e instanceof ApiError && e.status === 404)
                setMessage('이미 삭제됐어요. 새로고침해 주세요.');
            else if (e instanceof ApiError && e.status === 403)
                setMessage('내가 쓴 것만 지울 수 있어요.');
            else setMessage(failText);
        } finally {
            setBusy(false);
        }
    };

    const removePost = () => {
        if (
            !post ||
            !window.confirm(
                '이 글을 삭제할까요? 댓글도 함께 지워지고 되돌릴 수 없어요.',
            )
        )
            return;
        void run(async () => {
            await apiFetch(`/api/work/boards/viral/${post.id}`, {
                method: 'DELETE',
            });
            router.push('/work/viral');
        }, '삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    };

    const removeComment = (cid: number) => {
        if (!window.confirm('이 댓글을 삭제할까요?')) return;
        void run(async () => {
            await apiFetch(
                `/api/work/boards/viral/${encodeURIComponent(id)}/comments/${cid}`,
                { method: 'DELETE' },
            );
            await load();
        }, '댓글을 지우지 못했어요.');
    };

    const addComment = (e: FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        void run(async () => {
            await apiFetch(
                `/api/work/boards/viral/${encodeURIComponent(id)}/comments`,
                { method: 'POST', body: { body: newComment.trim() } },
            );
            setNewComment('');
            await load();
        }, '댓글을 등록하지 못했어요. (2,000자 이내)');
    };

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <p className="mb-3 text-sm">
                <Link
                    href="/work/viral"
                    className="text-muted hover:text-ink hover:underline"
                >
                    ← 목록으로
                </Link>
            </p>
            {loadState === 'loading' && <Skeleton className="h-96 w-full" />}
            {loadState === 'error' && (
                <ErrorState onRetry={() => void load()} />
            )}
            {loadState === 'notFound' && (
                <ErrorState message="글을 찾을 수 없어요. 삭제됐거나 주소가 틀렸을 수 있어요." />
            )}
            {post && loadState === 'ok' && (
                <div className="flex flex-col gap-6 text-sm">
                    {message && (
                        <p
                            role="alert"
                            className="rounded-lg bg-rejected-bg px-3 py-2.5 text-rejected-fg"
                        >
                            {message}
                        </p>
                    )}
                    {editing ? (
                        <>
                            <h1 className="text-2xl font-bold">글 수정</h1>
                            <BoardForm
                                key={formKey}
                                initial={post}
                                onCancel={() => setEditing(false)}
                                onSaved={async () => {
                                    if (!(await load()))
                                        setMessage(
                                            '저장은 됐지만 최신 내용을 불러오지 못했어요. 새로고침해 주세요.',
                                        );
                                    setEditing(false);
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h1 className="text-2xl font-bold">
                                        {post.title}
                                    </h1>
                                    <p className="mt-1 text-muted">
                                        {post.writerName || '-'} ·{' '}
                                        {post.createdAt}
                                    </p>
                                </div>
                                {/* 서버도 작성자·관리자가 아니면 403 — 화면은 버튼만 숨김 */}
                                {post.isMine && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            disabled={busy}
                                            onClick={() => setEditing(true)}
                                        >
                                            수정
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="text-rejected-fg"
                                            disabled={busy}
                                            onClick={removePost}
                                        >
                                            삭제
                                        </Button>
                                    </div>
                                )}
                            </div>
                            {/* bodyHtml은 서버가 sanitizeHtml(허용 태그만)로 저장·출력 양쪽 정제한 값이라 그대로 넣음 */}
                            <div
                                className="min-h-24 break-words rounded-lg border border-line p-4 leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                                dangerouslySetInnerHTML={{
                                    __html: post.bodyHtml,
                                }}
                            />

                            <section aria-label="댓글">
                                <h2 className="mb-2 text-sm font-bold">
                                    댓글 {comments.length}
                                </h2>
                                {comments.length > 0 && (
                                    <ul className="divide-y divide-line rounded-lg border border-line">
                                        {comments.map(c => (
                                            <li
                                                key={c.id}
                                                className="flex items-start justify-between gap-3 px-3 py-2.5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs text-muted">
                                                        {c.writerName || '-'} ·{' '}
                                                        {c.createdAt}
                                                    </p>
                                                    {/* 댓글은 평문 — React가 이스케이프하고 줄바꿈만 보존 */}
                                                    <p className="mt-0.5 whitespace-pre-wrap break-words">
                                                        {c.body}
                                                    </p>
                                                </div>
                                                {c.isMine && (
                                                    <Button
                                                        variant="ghost"
                                                        className="shrink-0 px-2 py-1 text-rejected-fg"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            removeComment(c.id)
                                                        }
                                                    >
                                                        삭제
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <form
                                    onSubmit={addComment}
                                    className="mt-3 flex flex-col gap-2"
                                >
                                    <textarea
                                        aria-label="댓글 내용"
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="댓글을 입력하세요"
                                        className="rounded-lg border border-line bg-white px-3 py-2 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                                        value={newComment}
                                        onChange={e =>
                                            setNewComment(e.target.value)
                                        }
                                    />
                                    <div className="flex justify-end">
                                        <Button
                                            type="submit"
                                            disabled={
                                                busy || !newComment.trim()
                                            }
                                        >
                                            댓글 등록
                                        </Button>
                                    </div>
                                </form>
                            </section>
                        </>
                    )}
                </div>
            )}
        </main>
    );
}

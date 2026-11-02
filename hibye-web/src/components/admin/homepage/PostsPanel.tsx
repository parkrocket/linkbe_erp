'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { BOARD_LABEL, validatePostForm, type Board, type FormErrors, type PostForm, type PostRow } from '@/lib/homepage';
import { NoticeLine } from './HomepageTab';
import { deletePost, homepageErrorMessage, savePost } from './homepageApi';
import { ImageField } from './ImageField';
import { RichTextEditor } from './RichTextEditor';

const DATE = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
type Notice = { tone: 'ok' | 'error'; text: string } | null;

// 공지사항·포트폴리오 목록 — 숨김 글도 보임(관리용)
export function PostsPanel({ board }: { board: Board }) {
    const { state, reload, refresh } = useApiData<{ rows?: PostRow[] }>(`/api/admin/homepage/posts/${board}`, undefined, 'GET');
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const rows = state.status === 'ok' ? (state.data.rows ?? []) : [];

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => setEditing('new')}>{BOARD_LABEL[board]} 쓰기</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!rows.length ? (
                    <EmptyState message="글이 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map(r => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => setEditing(r.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                                    {!r.is_visible && <Badge tone="neutral">숨김</Badge>}
                                    {board === 'portfolio' && r.show_on_main === 1 && <Badge tone="info">메인</Badge>}
                                    <span className="text-xs text-muted">{DATE.format(new Date(r.created_at))}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ))}
            {editing !== null && (
                <PostDialog
                    board={board}
                    id={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                    onDone={text => {
                        setEditing(null);
                        setNotice({ tone: 'ok', text });
                        refresh();
                    }}
                />
            )}
        </>
    );
}

function PostDialog({
    board,
    id,
    onClose,
    onDone,
}: {
    board: Board;
    id: number | null;
    onClose: () => void;
    onDone: (text: string) => void;
}) {
    return (
        <Modal open size="lg" title={`${BOARD_LABEL[board]} ${id ? '수정' : '쓰기'}`} onClose={onClose}>
            {id === null ? <PostEditor board={board} onDone={onDone} /> : <ExistingPost board={board} id={id} onDone={onDone} />}
        </Modal>
    );
}

// 수정: 본문까지 불러온 뒤 편집기 표시
function ExistingPost({ board, id, onDone }: { board: Board; id: number; onDone: (text: string) => void }) {
    const { state, reload } = useApiData<{ post?: PostRow }>(`/api/admin/homepage/posts/${board}/${id}`, undefined, 'GET');
    if (state.status === 'loading') return <Skeleton className="h-64 w-full" />;
    if (state.status === 'error' || !state.data.post) return <ErrorState onRetry={reload} />;
    return <PostEditor board={board} post={state.data.post} onDone={onDone} />;
}

const toForm = (p?: PostRow): PostForm => ({
    title: p?.title ?? '',
    bodyHtml: p?.body_html ?? '',
    isVisible: p ? p.is_visible === 1 : true,
    client: p?.client ?? '',
    category: p?.category ?? '',
    siteUrl: p?.site_url ?? '',
    showOnMain: p?.show_on_main === 1,
    sortOrder: String(p?.sort_order ?? 0),
    thumbnailFileId: p?.thumbnail_file_id ?? null,
});

function PostEditor({ board, post, onDone }: { board: Board; post?: PostRow; onDone: (text: string) => void }) {
    const [form, setForm] = useState<PostForm>(() => toForm(post));
    const [errors, setErrors] = useState<FormErrors<PostForm>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof PostForm>(key: K, value: PostForm[K]) => setForm(prev => ({ ...prev, [key]: value }));

    const save = async () => {
        const found = validatePostForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        setError('');
        try {
            await savePost(board, post?.id ?? null, form);
            onDone('저장했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!post || !window.confirm(`'${post.title}' 글을 삭제할까요?`)) return;
        try {
            await deletePost(board, post.id);
            onDone('삭제했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="제목"
                name="title"
                maxLength={200}
                value={form.title}
                onChange={e => set('title', e.target.value)}
                error={errors.title}
            />
            {board === 'portfolio' && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                            label="고객사"
                            name="client"
                            maxLength={100}
                            value={form.client}
                            onChange={e => set('client', e.target.value)}
                        />
                        <TextField
                            label="분류"
                            name="category"
                            maxLength={50}
                            value={form.category}
                            onChange={e => set('category', e.target.value)}
                        />
                        <TextField
                            label="사이트 주소"
                            name="siteUrl"
                            placeholder="https://"
                            value={form.siteUrl}
                            onChange={e => set('siteUrl', e.target.value)}
                            error={errors.siteUrl}
                        />
                        <TextField
                            label="순서 (클수록 앞)"
                            name="sortOrder"
                            inputMode="numeric"
                            value={form.sortOrder}
                            onChange={e => set('sortOrder', e.target.value)}
                            error={errors.sortOrder}
                        />
                    </div>
                    <ImageField label="대표 이미지" fileId={form.thumbnailFileId} onChange={id => set('thumbnailFileId', id)} />
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                            type="checkbox"
                            checked={form.showOnMain}
                            onChange={e => set('showOnMain', e.target.checked)}
                            className="size-4 accent-primary"
                        />
                        메인 화면에 보이기
                    </label>
                </>
            )}
            <RichTextEditor label="본문" value={form.bodyHtml} onChange={html => set('bodyHtml', html)} />
            <label className="flex items-center gap-2 text-sm font-medium">
                <input
                    type="checkbox"
                    checked={form.isVisible}
                    onChange={e => set('isVisible', e.target.checked)}
                    className="size-4 accent-primary"
                />
                홈페이지에 보이기
            </label>
            {error && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                {post && (
                    <Button variant="ghost" className="mr-auto text-rejected-fg" onClick={remove}>
                        삭제
                    </Button>
                )}
                <Button disabled={saving} onClick={save}>
                    {saving ? '저장 중…' : '저장'}
                </Button>
            </div>
        </div>
    );
}

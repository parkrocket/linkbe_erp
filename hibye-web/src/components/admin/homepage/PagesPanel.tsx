'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import type { PageRow } from '@/lib/homepage';
import { NoticeLine } from './HomepageTab';
import { homepageErrorMessage, savePage } from './homepageApi';
import { RichTextEditor } from './RichTextEditor';

type Notice = { tone: 'ok' | 'error'; text: string } | null;
const DATE = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

// 안내 페이지(개인정보처리방침·이메일무단수집거부 등) — 주소는 linkbe.kr/policy/{영문 이름}
export function PagesPanel() {
    const { state, reload, refresh } = useApiData<{ pages?: PageRow[] }>('/api/admin/homepage/pages', undefined, 'GET');
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const pages = state.status === 'ok' ? (state.data.pages ?? []) : [];

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => setEditing('new')}>페이지 추가</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-32 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!pages.length ? (
                    <EmptyState message="안내 페이지가 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {pages.map(p => (
                            <li key={p.slug}>
                                <button
                                    type="button"
                                    onClick={() => setEditing(p.slug)}
                                    className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                                    <span className="text-xs text-muted">/policy/{p.slug}</span>
                                    <span className="text-xs text-muted">{DATE.format(new Date(p.updated_at))}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ))}
            {editing !== null && (
                <Modal open size="lg" title={editing === 'new' ? '안내 페이지 추가' : '안내 페이지 수정'} onClose={() => setEditing(null)}>
                    {editing === 'new' ? <PageEditor onDone={done} /> : <ExistingPage slug={editing} onDone={done} />}
                </Modal>
            )}
        </>
    );

    function done(text: string) {
        setEditing(null);
        setNotice({ tone: 'ok', text });
        refresh();
    }
}

function ExistingPage({ slug, onDone }: { slug: string; onDone: (text: string) => void }) {
    const { state, reload } = useApiData<{ page?: PageRow }>(`/api/admin/homepage/pages/${slug}`, undefined, 'GET');
    if (state.status === 'loading') return <Skeleton className="h-64 w-full" />;
    if (state.status === 'error' || !state.data.page) return <ErrorState onRetry={reload} />;
    return <PageEditor page={state.data.page} onDone={onDone} />;
}

function PageEditor({ page, onDone }: { page?: PageRow; onDone: (text: string) => void }) {
    const [slug, setSlug] = useState(page?.slug ?? '');
    const [title, setTitle] = useState(page?.title ?? '');
    const [bodyHtml, setBodyHtml] = useState(page?.body_html ?? '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!/^[a-z0-9-]{1,50}$/.test(slug)) return setError('주소 이름은 영문 소문자·숫자·-만 쓸 수 있어요. (예: privacy)');
        if (!title.trim()) return setError('제목을 입력해 주세요.');
        setSaving(true);
        setError('');
        try {
            await savePage(slug, { title: title.trim(), bodyHtml });
            onDone('저장했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="주소 이름 (linkbe.kr/policy/…)"
                name="slug"
                maxLength={50}
                value={slug}
                disabled={!!page}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                hint={page ? '만든 뒤에는 바꿀 수 없어요' : '예: privacy'}
            />
            <TextField label="제목" name="title" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} />
            <RichTextEditor label="내용" value={bodyHtml} onChange={setBodyHtml} />
            {error && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <Button className="self-end" disabled={saving} onClick={save}>
                {saving ? '저장 중…' : '저장'}
            </Button>
        </div>
    );
}

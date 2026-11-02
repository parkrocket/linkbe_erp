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
import { kstInput, validatePopupForm, type FormErrors, type PopupForm, type PopupRow } from '@/lib/homepage';
import { NoticeLine } from './HomepageTab';
import { deletePopup, homepageErrorMessage, savePopup } from './homepageApi';
import { ImageField } from './ImageField';

type Notice = { tone: 'ok' | 'error'; text: string } | null;
const WHEN = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// 메인 팝업 — 기간 안이고 '보이기'일 때만 홈페이지 메인에 뜸
export function PopupPanel() {
    const { state, reload, refresh } = useApiData<{ popups?: PopupRow[] }>('/api/admin/homepage/popups', undefined, 'GET');
    const [editing, setEditing] = useState<PopupRow | 'new' | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const [dirty, setDirty] = useState(false);
    const popups = state.status === 'ok' ? (state.data.popups ?? []) : [];
    // 노출 중 표시 기준 시각 — 화면을 연 시점 (렌더마다 시계를 읽지 않게)
    const [now] = useState(() => Date.now());

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => (setDirty(false), setEditing('new'))}>팝업 추가</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!popups.length ? (
                    <EmptyState message="팝업이 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {popups.map(p => {
                            const live = p.is_visible === 1 && Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) >= now;
                            return (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => (setDirty(false), setEditing(p))}
                                        className="flex w-full flex-wrap items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                    >
                                        <Badge tone={live ? 'approved' : 'neutral'}>{live ? '노출 중' : '노출 안 함'}</Badge>
                                        <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                                        <span className="text-xs text-muted">
                                            {WHEN.format(new Date(p.starts_at))} ~ {WHEN.format(new Date(p.ends_at))}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ))}
            {editing !== null && (
                <Modal
                    open
                    size="lg"
                    title={editing === 'new' ? '팝업 추가' : '팝업 수정'}
                    onClose={() => setEditing(null)}
                    canClose={() => !dirty || window.confirm('저장하지 않은 변경이 있어요. 닫을까요?')}
                >
                    <PopupEditor
                        onDirty={() => setDirty(true)}
                        popup={editing === 'new' ? undefined : editing}
                        onDone={text => {
                            setEditing(null);
                            setNotice({ tone: 'ok', text });
                            refresh();
                        }}
                    />
                </Modal>
            )}
        </>
    );
}

const toForm = (p?: PopupRow): PopupForm => ({
    title: p?.title ?? '',
    imageFileId: p?.image_file_id ?? null,
    linkUrl: p?.link_url ?? '',
    startsAt: p ? kstInput(p.starts_at) : '',
    endsAt: p ? kstInput(p.ends_at) : '',
    posLeft: String(p?.pos_left ?? 10),
    posTop: String(p?.pos_top ?? 10),
    width: String(p?.width ?? 400),
    isVisible: p ? p.is_visible === 1 : true,
});

function PopupEditor({ popup, onDone, onDirty }: { popup?: PopupRow; onDone: (text: string) => void; onDirty: () => void }) {
    const [form, setForm] = useState<PopupForm>(() => toForm(popup));
    const [errors, setErrors] = useState<FormErrors<PopupForm>>({});
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = <K extends keyof PopupForm>(key: K, value: PopupForm[K]) => {
        onDirty();
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const save = async () => {
        const found = validatePopupForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        setError('');
        try {
            await savePopup(popup?.id ?? null, form);
            onDone('저장했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!popup || !window.confirm(`'${popup.title}' 팝업을 삭제할까요?`)) return;
        try {
            await deletePopup(popup.id);
            onDone('삭제했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="제목 (관리용)"
                name="title"
                maxLength={200}
                value={form.title}
                onChange={e => set('title', e.target.value)}
                error={errors.title}
            />
            <ImageField label="팝업 이미지" fileId={form.imageFileId} onChange={id => set('imageFileId', id)} error={errors.imageFileId} />
            <TextField
                label="누르면 이동할 주소 (선택)"
                name="linkUrl"
                placeholder="https://"
                value={form.linkUrl}
                onChange={e => set('linkUrl', e.target.value)}
                error={errors.linkUrl}
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="시작"
                    name="startsAt"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={e => set('startsAt', e.target.value)}
                    error={errors.startsAt}
                />
                <TextField
                    label="끝"
                    name="endsAt"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={e => set('endsAt', e.target.value)}
                    error={errors.endsAt}
                />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                    label="가로 크기(px)"
                    name="width"
                    inputMode="numeric"
                    value={form.width}
                    onChange={e => set('width', e.target.value)}
                    error={errors.width}
                />
                <TextField
                    label="왼쪽 위치(px)"
                    name="posLeft"
                    inputMode="numeric"
                    value={form.posLeft}
                    onChange={e => set('posLeft', e.target.value)}
                    error={errors.posLeft}
                />
                <TextField
                    label="위쪽 위치(px)"
                    name="posTop"
                    inputMode="numeric"
                    value={form.posTop}
                    onChange={e => set('posTop', e.target.value)}
                    error={errors.posTop}
                />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
                <input
                    type="checkbox"
                    checked={form.isVisible}
                    onChange={e => set('isVisible', e.target.checked)}
                    className="size-4 accent-primary"
                />
                보이기 (기간 안일 때만 노출)
            </label>
            {error && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                {popup && (
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

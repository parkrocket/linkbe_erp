'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import type { FaqRow } from '@/lib/homepage';
import { NoticeLine } from './HomepageTab';
import { deleteFaq, homepageErrorMessage, moveFaq, saveFaq } from './homepageApi';
import { RichTextEditor } from './RichTextEditor';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

// FAQ — 질문·답·순서(▲▼)·보이기
export function FaqPanel() {
    const { state, reload, refresh } = useApiData<{ faqs?: FaqRow[] }>('/api/admin/homepage/faqs', undefined, 'GET');
    const [editing, setEditing] = useState<FaqRow | 'new' | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const [dirty, setDirty] = useState(false);
    const faqs = state.status === 'ok' ? (state.data.faqs ?? []) : [];

    const move = async (id: number, direction: 'up' | 'down') => {
        try {
            await moveFaq(id, direction);
            refresh();
        } catch (e) {
            setNotice({ tone: 'error', text: homepageErrorMessage(e) });
        }
    };

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => (setDirty(false), setEditing('new'))}>FAQ 추가</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!faqs.length ? (
                    <EmptyState message="FAQ가 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {faqs.map((f, i) => (
                            <li key={f.id} className="flex items-center gap-2 py-2">
                                <button
                                    type="button"
                                    onClick={() => (setDirty(false), setEditing(f))}
                                    className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    {f.question}
                                </button>
                                {!f.is_visible && <Badge tone="neutral">숨김</Badge>}
                                <IconButton label="위로" disabled={i === 0} onClick={() => move(f.id, 'up')}>
                                    <ChevronUp className="size-4" />
                                </IconButton>
                                <IconButton label="아래로" disabled={i === faqs.length - 1} onClick={() => move(f.id, 'down')}>
                                    <ChevronDown className="size-4" />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                ))}
            {editing !== null && (
                <Modal
                    open
                    size="lg"
                    title={editing === 'new' ? 'FAQ 추가' : 'FAQ 수정'}
                    onClose={() => setEditing(null)}
                    canClose={() => !dirty || window.confirm('저장하지 않은 변경이 있어요. 닫을까요?')}
                >
                    <FaqEditor
                        onDirty={() => setDirty(true)}
                        faq={editing === 'new' ? undefined : editing}
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

function FaqEditor({ faq, onDone, onDirty }: { faq?: FaqRow; onDone: (text: string) => void; onDirty: () => void }) {
    const [question, setQuestion] = useState(faq?.question ?? '');
    const [answerHtml, setAnswerHtml] = useState(faq?.answer_html ?? '');
    const [isVisible, setIsVisible] = useState(faq ? faq.is_visible === 1 : true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!question.trim()) return setError('질문을 입력해 주세요.');
        setSaving(true);
        setError('');
        try {
            await saveFaq(faq?.id ?? null, { question: question.trim(), answerHtml, isVisible });
            onDone('저장했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!faq || !window.confirm('이 FAQ를 삭제할까요?')) return;
        try {
            await deleteFaq(faq.id);
            onDone('삭제했어요.');
        } catch (e) {
            setError(homepageErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <TextField
                label="질문"
                name="question"
                maxLength={300}
                value={question}
                onChange={e => (onDirty(), setQuestion(e.target.value))}
            />
            <RichTextEditor label="답변" value={answerHtml} onChange={html => (onDirty(), setAnswerHtml(html))} />
            <label className="flex items-center gap-2 text-sm font-medium">
                <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={e => (onDirty(), setIsVisible(e.target.checked))}
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
                {faq && (
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

export function IconButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
        >
            {children}
        </button>
    );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { RichTextEditor } from '@/components/admin/homepage/RichTextEditor';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';

// 바이럴 글 쓰기·수정 — initial이 있으면 수정. 본문은 서버가 저장 전 정제
export function BoardForm({
    initial,
    onCancel,
    onSaved,
}: {
    initial?: { id: number; title: string; bodyHtml: string };
    onCancel?: () => void;
    onSaved?: () => void;
}) {
    const router = useRouter();
    const [title, setTitle] = useState(initial?.title ?? '');
    const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return setError('제목을 입력해 주세요.');
        setBusy(true);
        setError('');
        try {
            const payload = { title: title.trim(), bodyHtml };
            if (initial) {
                await apiFetch(`/api/work/boards/viral/${initial.id}`, {
                    method: 'POST',
                    body: payload,
                });
                onSaved?.();
            } else {
                const r = await apiFetch<{ id: number }>(
                    '/api/work/boards/viral',
                    { method: 'POST', body: payload },
                );
                router.push(`/work/viral/${r.id}`);
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 401)
                router.replace('/login?redirect=/work/viral');
            else if (err instanceof ApiError && err.status === 403)
                setError('내가 쓴 글만 고칠 수 있어요.');
            else if (err instanceof ApiError && err.status === 400)
                setError('제목(200자 이내)과 본문 길이를 확인해 주세요.');
            else setError('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
            {error && (
                <p
                    role="alert"
                    className="rounded-lg bg-rejected-bg px-3 py-2.5 text-rejected-fg"
                >
                    {error}
                </p>
            )}
            <label className="flex flex-col gap-1 font-semibold">
                제목
                <input
                    className="rounded-lg border border-line bg-white px-3 py-2 font-normal focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    value={title}
                    maxLength={200}
                    onChange={e => setTitle(e.target.value)}
                />
            </label>
            {/* 첨부 없는 게시판이라 이미지 버튼은 끔 */}
            <RichTextEditor
                label="본문"
                value={bodyHtml}
                onChange={setBodyHtml}
                allowImage={false}
            />
            <div className="flex justify-end gap-2">
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={onCancel ?? (() => router.push('/work/viral'))}
                >
                    취소
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? '저장 중…' : '저장'}
                </Button>
            </div>
        </form>
    );
}

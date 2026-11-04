'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ApiError, apiFetch } from '@/lib/api';
import { clientErrorText, formatSize, MAX_FILE_MB, type ClientFileRow } from '@/lib/clients';

// 첨부 — 목록·올리기·내려받기(같은 출처 링크, 쿠키로 인증)·삭제
export function ClientFiles({ clientId, files, onChanged }: { clientId: number; files: ClientFileRow[]; onChanged: () => void }) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const upload = async (file: File) => {
        if (file.size > MAX_FILE_MB * 1024 * 1024) return setMessage(`파일은 ${MAX_FILE_MB}MB까지 올릴 수 있어요.`);
        setBusy(true);
        setMessage('');
        try {
            const body = new FormData();
            body.append('file', file);
            // FormData는 content-type을 브라우저가 정해야 해서 apiFetch(JSON) 대신 직접 호출
            const res = await fetch(`/node/api/work/clients/${clientId}/files`, { method: 'POST', body, cache: 'no-store' });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
                throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : undefined);
            }
            onChanged();
        } catch (e) {
            setMessage(clientErrorText(e));
        }
        setBusy(false);
        if (input.current) input.current.value = '';
    };

    const remove = async (f: ClientFileRow) => {
        if (!window.confirm(`'${f.originalName}' 파일을 삭제할까요? 되돌릴 수 없어요.`)) return;
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(`/api/work/clients/${clientId}/files/${f.id}`, { method: 'DELETE' });
            onChanged();
        } catch (e) {
            setMessage(clientErrorText(e));
        }
        setBusy(false);
    };

    return (
        <section aria-labelledby="client-files" className="mt-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="client-files" className="text-lg font-bold">
                    첨부
                </h2>
                <div>
                    <input ref={input} type="file" className="sr-only" id="client-file-input" disabled={busy} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
                    <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
                        {busy ? '처리 중…' : '파일 올리기'}
                    </Button>
                </div>
            </div>
            <p className="mb-2 text-xs text-muted">파일 하나 {MAX_FILE_MB}MB, 업체당 20개까지 (pdf·이미지·문서·zip). 파일은 암호화되지 않고 내려받기 기록만 남아요.</p>
            {message && (
                <p role="alert" className="mb-2 rounded-lg bg-rejected-bg px-3 py-2 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            {files.length ? (
                <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                    {files.map(f => (
                        <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                            <span className="break-all font-medium">{f.originalName}</span>
                            <span className="text-xs text-muted">
                                {formatSize(f.size)} · {f.createdAt.slice(0, 10)}
                            </span>
                            <span className="ml-auto flex gap-1">
                                <a
                                    href={`/node/api/work/clients/${clientId}/files/${f.id}`}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    내려받기
                                </a>
                                <Button variant="ghost" className="px-2 py-1 text-xs text-rejected-fg" disabled={busy} onClick={() => remove(f)}>
                                    삭제
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted">첨부가 없어요.</p>
            )}
        </section>
    );
}

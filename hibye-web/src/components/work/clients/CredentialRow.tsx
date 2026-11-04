'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { clientErrorText, CREDENTIAL_KIND_LABEL, isWebUrl, maskedLabel, REVEAL_MS, type Credential } from '@/lib/clients';

type Field = 'secret' | 'memo';
type Action = 'view' | 'copy';

// 항목 한 줄 — 평문은 '보기' 응답만 React state에 두고 30초 뒤·화면을 떠나면 지움 (저장소·주소·콘솔에 남기지 않음)
export function CredentialRow({ clientId, credential: c, onEdit, onDelete }: { clientId: number; credential: Credential; onEdit: () => void; onDelete: () => void }) {
    const [plain, setPlain] = useState<Partial<Record<Field, string>>>({});
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const timers = useRef<Partial<Record<Field, number>>>({});

    // 화면을 떠나면 타이머 정리 (state는 컴포넌트와 함께 사라짐)
    useEffect(() => {
        const t = timers.current;
        return () => Object.values(t).forEach(id => window.clearTimeout(id));
    }, []);

    const hide = (field: Field) => {
        window.clearTimeout(timers.current[field]);
        setPlain(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    // 서버가 기록을 남긴 뒤에만 값을 줌 — 실패하면 값 없음
    const reveal = (field: Field, action: Action) =>
        apiFetch<{ value: string | null; unreadable?: boolean }>(`/api/work/clients/${clientId}/credentials/${c.id}/reveal`, { method: 'POST', body: { field, action } });

    const view = async (field: Field) => {
        setBusy(true);
        setNotice('');
        try {
            const res = await reveal(field, 'view');
            if (res.value === null) return setNotice('저장된 값을 읽을 수 없어요. 암호화 키를 확인해 주세요.');
            window.clearTimeout(timers.current[field]);
            setPlain(prev => ({ ...prev, [field]: res.value as string }));
            timers.current[field] = window.setTimeout(() => hide(field), REVEAL_MS);
        } catch (e) {
            setNotice(clientErrorText(e));
        }
        setBusy(false);
    };

    // 복사: 받은 값은 클립보드에만 쓰고 state에 남기지 않음
    const copy = async (field: Field) => {
        setBusy(true);
        setNotice('');
        try {
            const res = await reveal(field, 'copy');
            if (res.value === null) setNotice('저장된 값을 읽을 수 없어요. 암호화 키를 확인해 주세요.');
            else {
                await navigator.clipboard.writeText(res.value);
                setNotice('복사했어요');
            }
        } catch (e) {
            // clipboard 거부(권한·http 등)는 ApiError가 아님
            setNotice(e instanceof DOMException || e instanceof TypeError ? '복사하지 못했어요. 보기로 확인해서 직접 복사해 주세요.' : clientErrorText(e));
        }
        setBusy(false);
    };

    const copyLoginId = async () => {
        try {
            await navigator.clipboard.writeText(c.loginId);
            setNotice('복사했어요');
        } catch {
            setNotice('복사하지 못했어요. 직접 선택해서 복사해 주세요.');
        }
    };

    return (
        <li className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">{CREDENTIAL_KIND_LABEL[c.kind]}</span>
                <strong>{c.label || '(이름 없음)'}</strong>
                <span className="ml-auto flex gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onEdit}>
                        고치기
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs text-rejected-fg" onClick={onDelete}>
                        삭제
                    </Button>
                </span>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-[4rem_1fr]">
                <dt className="text-xs text-muted">주소</dt>
                <dd className="break-all">
                    {c.url ? (
                        isWebUrl(c.url) ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {c.url}
                            </a>
                        ) : (
                            c.url
                        )
                    ) : (
                        '-'
                    )}
                </dd>
                <dt className="text-xs text-muted">아이디</dt>
                <dd className="flex flex-wrap items-center gap-2">
                    <span className="break-all">{c.loginId || '-'}</span>
                    {c.loginId && (
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={copyLoginId}>
                            복사
                        </Button>
                    )}
                </dd>
                <dt className="text-xs text-muted">비밀번호</dt>
                <dd className="flex flex-wrap items-center gap-2">
                    {c.hasSecret ? (
                        <>
                            <span className="break-all font-mono">{plain.secret ?? maskedLabel}</span>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => (plain.secret === undefined ? view('secret') : hide('secret'))}>
                                {plain.secret === undefined ? '보기' : '가리기'}
                            </Button>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => copy('secret')}>
                                복사
                            </Button>
                        </>
                    ) : (
                        '-'
                    )}
                </dd>
                {c.hasMemo && (
                    <>
                        <dt className="text-xs text-muted">메모</dt>
                        <dd className="flex flex-wrap items-start gap-2">
                            {plain.memo !== undefined ? <pre className="max-w-full whitespace-pre-wrap break-words font-sans">{plain.memo}</pre> : <span className="font-mono">{maskedLabel}</span>}
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => (plain.memo === undefined ? view('memo') : hide('memo'))}>
                                {plain.memo === undefined ? '보기' : '가리기'}
                            </Button>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => copy('memo')}>
                                복사
                            </Button>
                        </dd>
                    </>
                )}
            </dl>
            {(plain.secret !== undefined || plain.memo !== undefined) && <p className="mt-1.5 text-xs text-muted">{REVEAL_MS / 1000}초 뒤 다시 가려져요</p>}
            {notice && (
                <p role="status" className="mt-1.5 text-xs text-primary">
                    {notice}
                </p>
            )}
        </li>
    );
}

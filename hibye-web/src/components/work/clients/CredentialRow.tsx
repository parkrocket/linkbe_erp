'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { useClearOnHide } from '@/lib/clearOnHide';
import { clientErrorText, CREDENTIAL_KIND_LABEL, isLongMemo, isWebUrl, maskedLabel, REVEAL_MS, type Credential } from '@/lib/clients';

type Field = 'secret'; // 가리는 칸은 비밀번호뿐 — 메모는 화면에 바로 보임(11-04)
type Action = 'view' | 'copy';
const UNREADABLE = '저장된 값을 읽을 수 없어요. 암호화 키를 확인해 주세요.';

// 항목 한 줄 — 평문은 '보기' 응답만 React state에 두고 30초 뒤·화면을 떠나거나 탭이 숨겨지면 지움 (저장소·주소·콘솔에 남기지 않음)
export function CredentialRow({ clientId, credential: c, onEdit, onDelete }: { clientId: number; credential: Credential; onEdit: () => void; onDelete: () => void }) {
    const [plain, setPlain] = useState<Partial<Record<Field, string>>>({});
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const timers = useRef<Partial<Record<Field, number>>>({});
    const mounted = useRef(true);

    // 화면을 떠나거나(숨긴 Activity로 보관돼도 state는 남으므로) 탭이 숨겨지면 평문·타이머 모두 지움
    const clearPlain = useCallback(() => {
        Object.values(timers.current).forEach(id => window.clearTimeout(id));
        timers.current = {};
        setPlain({});
    }, []);
    useClearOnHide(clearPlain);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
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
            if (res.value === null) {
                setNotice(UNREADABLE);
                return;
            }
            // 응답이 오기 전에 화면을 떠났거나 탭이 숨겨졌으면 값도 타이머도 두지 않음
            if (!mounted.current || document.visibilityState === 'hidden') return;
            window.clearTimeout(timers.current[field]);
            setPlain(prev => ({ ...prev, [field]: res.value as string }));
            timers.current[field] = window.setTimeout(() => hide(field), REVEAL_MS);
        } catch (e) {
            setNotice(clientErrorText(e));
        } finally {
            setBusy(false);
        }
    };

    // 클립보드 쓰기만 따로 시도 — reveal 실패와 복사 실패를 구분
    const write = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setNotice('복사했어요');
        } catch {
            setNotice('복사하지 못했어요. 보기로 확인해서 직접 복사해 주세요.');
        }
    };

    // 복사: 받은 값은 클립보드에만 쓰고 state에 남기지 않음
    const copy = async (field: Field) => {
        setBusy(true);
        setNotice('');
        try {
            const res = await reveal(field, 'copy');
            if (res.value === null) setNotice(UNREADABLE);
            else await write(res.value);
        } catch (e) {
            setNotice(clientErrorText(e));
        } finally {
            setBusy(false);
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
                        <Button variant="ghost" className="px-2 py-1 text-xs" aria-label="아이디 복사" onClick={() => write(c.loginId)}>
                            복사
                        </Button>
                    )}
                </dd>
                <dt className="text-xs text-muted">비밀번호</dt>
                <dd className="flex flex-wrap items-center gap-2">
                    {c.hasSecret ? (
                        <>
                            {plain.secret === undefined ? <Masked /> : <span className="break-all font-mono">{plain.secret}</span>}
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} aria-label={plain.secret === undefined ? '비밀번호 보기' : '비밀번호 가리기'} onClick={() => (plain.secret === undefined ? view('secret') : hide('secret'))}>
                                {plain.secret === undefined ? '보기' : '가리기'}
                            </Button>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} aria-label="비밀번호 복사" onClick={() => copy('secret')}>
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
                        <dd className="min-w-0">{c.memoUnreadable ? <span className="text-rejected-fg">{UNREADABLE}</span> : <MemoText memo={c.memo ?? ''} />}</dd>
                    </>
                )}
            </dl>
            {plain.secret !== undefined && <p className="mt-1.5 text-xs text-muted">{REVEAL_MS / 1000}초 뒤 다시 가려져요</p>}
            {notice && (
                <p role="status" className="mt-1.5 text-xs text-primary">
                    {notice}
                </p>
            )}
        </li>
    );
}

// 메모 — 그대로 보여 주고, 길면 4줄로 접었다가 펼치기
function MemoText({ memo }: { memo: string }) {
    const [open, setOpen] = useState(false);
    const long = isLongMemo(memo);
    return (
        <div className="flex flex-col items-start gap-1">
            <p className={`max-w-full whitespace-pre-wrap break-words ${long && !open ? 'line-clamp-4' : ''}`}>{memo}</p>
            {long && (
                <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                    {open ? '접기' : '펼치기'}
                </button>
            )}
        </div>
    );
}

// 가림 표시 — 화면에는 점, 화면 낭독기에는 '가려짐'
function Masked() {
    return (
        <span className="font-mono">
            <span aria-hidden>{maskedLabel}</span>
            <span className="sr-only">가려짐</span>
        </span>
    );
}

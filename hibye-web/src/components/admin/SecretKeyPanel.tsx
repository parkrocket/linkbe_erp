'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch } from '@/lib/api';
import { useClearOnHide } from '@/lib/clearOnHide';
import { REVEAL_MS } from '@/lib/clients';
import { keyViewErrorText } from '@/lib/secretKey';

// 거래처 접속정보 암호화 키 확인 — 키는 React state에만 두고 30초 뒤·팝업을 닫거나 탭이 숨겨지면 지움
export function SecretKeyPanel() {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const timer = useRef<number | undefined>(undefined);
    const mounted = useRef(true);
    const gen = useRef(0); // 요청 세대 — 팝업을 닫으면 올려서 늦은 응답을 버림

    // 키·비밀번호·타이머 모두 지움
    const clearAll = useCallback(() => {
        window.clearTimeout(timer.current);
        setSecretKey('');
        setPassword('');
        setNotice('');
    }, []);
    useClearOnHide(clearAll);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const close = () => {
        gen.current += 1;
        clearAll();
        setError('');
        setOpen(false);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || !password) return;
        const mine = gen.current;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const res = await apiFetch<{ key: string }>('/api/admin/client-secret-key/reveal', { method: 'POST', body: { password } });
            // 응답이 오기 전에 화면을 떠났거나 탭이 숨겨졌으면 키를 두지 않음
            if (!mounted.current || mine !== gen.current || document.visibilityState === 'hidden') return;
            window.clearTimeout(timer.current);
            setSecretKey(res.key);
            timer.current = window.setTimeout(clearAll, REVEAL_MS);
        } catch (e) {
            if (mine === gen.current) setError(keyViewErrorText(e));
        } finally {
            if (mine === gen.current) {
                setPassword('');
                setBusy(false);
            }
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(secretKey);
            setNotice('복사했어요');
        } catch {
            setNotice('복사하지 못했어요. 직접 선택해서 복사해 주세요.');
        }
    };

    return (
        <section>
            <h2 className="text-lg font-bold">거래처 접속정보 암호화 키</h2>
            <p className="mt-1 text-sm text-muted">거래처 접속정보를 암호화하는 키예요. 이 키를 잃어버리면 접속정보를 복구할 수 없어요. 확인할 때마다 기록이 남고 #hibye-관리에 알림이 가요.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
                키 보기
            </Button>
            <Modal open={open} title="암호화 키 보기" onClose={close}>
                {secretKey ? (
                    <div>
                        <p className="break-all rounded-lg bg-surface p-3 font-mono text-sm" aria-label="암호화 키">
                            {secretKey}
                        </p>
                        <p className="mt-2 text-xs text-muted">{REVEAL_MS / 1000}초 뒤 자동으로 지워져요</p>
                        <div className="mt-4 flex gap-2">
                            <Button onClick={copy}>복사</Button>
                            <Button variant="ghost" onClick={close}>
                                닫기
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="flex flex-col gap-4">
                        <TextField
                            label="내 비밀번호"
                            name="keyview-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            error={error || undefined}
                            hint="확인을 위해 비밀번호를 다시 입력해 주세요."
                            maxLength={200}
                        />
                        <Button type="submit" disabled={busy || !password}>
                            확인
                        </Button>
                    </form>
                )}
                {notice && (
                    <p role="status" className="mt-3 text-xs text-primary">
                        {notice}
                    </p>
                )}
            </Modal>
        </section>
    );
}

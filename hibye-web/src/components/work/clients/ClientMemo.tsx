'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { clientErrorText, MAX_CLIENT_MEMO } from '@/lib/clients';

const FIELD_CLASS = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft disabled:bg-surface';

// 업체 메모 — 화면에 그대로 보이는 칸(저장은 암호화). 비밀번호는 항목의 비밀번호 칸에
export function ClientMemo({ clientId, memo, unreadable, onChanged }: { clientId: number; memo: string | null; unreadable: boolean; onChanged: () => void }) {
    const saved = memo ?? '';
    const [text, setText] = useState(saved);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [done, setDone] = useState(false);

    const save = async () => {
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(`/api/work/clients/${clientId}/memo`, { method: 'POST', body: { memo: text } });
            setDone(true);
            onChanged(); // 상세를 다시 받아 저장된 값(memo)·최근 기록('메모 수정') 갱신
        } catch (e) {
            setMessage(clientErrorText(e));
        }
        setBusy(false);
    };

    return (
        <section aria-labelledby="client-memo" className="mt-8">
            <h2 id="client-memo" className="mb-2 text-lg font-bold">
                메모
            </h2>
            {message && (
                <p role="alert" className="mb-2 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            {unreadable ? (
                // 못 읽는 메모를 빈 값으로 덮어써 지우지 않도록 고치기를 막음
                <p className="text-sm text-rejected-fg">메모를 읽을 수 없어요. 암호화 키를 확인해 주세요.</p>
            ) : (
                <>
                    <textarea
                        aria-labelledby="client-memo"
                        rows={5}
                        maxLength={MAX_CLIENT_MEMO}
                        autoComplete="off"
                        placeholder="작업 시 주의할 점, 담당자, 진행 상황 등"
                        className={FIELD_CLASS}
                        disabled={busy}
                        value={text}
                        onChange={e => {
                            setText(e.target.value);
                            setDone(false);
                        }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Button disabled={busy || text === saved} onClick={save}>
                            {busy ? '저장 중…' : '메모 저장'}
                        </Button>
                        <span className="text-xs text-muted" role="status">
                            {done && text === saved ? '저장했어요.' : '메모는 화면에 그대로 보여요 — 비밀번호는 항목의 비밀번호 칸에 넣어 주세요'}
                        </span>
                    </div>
                </>
            )}
        </section>
    );
}

'use client';

import { useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch } from '@/lib/api';
import {
    clientErrorText,
    credentialBody,
    CREDENTIAL_KIND_LABEL,
    emptyCredentialForm,
    validateCredentialForm,
    type Credential,
    type CredentialErrors,
    type CredentialForm,
    type CredentialKind,
} from '@/lib/clients';

// 비밀번호 칸은 type=password 대신 글자만 가림 — 브라우저가 다른 회사 비밀번호를 저장하자고 제안하지 않게 (미지원 브라우저는 그대로 보임)
const MASK_STYLE = { WebkitTextSecurity: 'disc' } as React.CSSProperties;
const FIELD_CLASS = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft';

// 접속정보 항목 추가·고치기 — 고칠 때 비밀번호는 현재 값을 불러오지 않음(비워 두면 그대로), 메모는 보이는 칸이라 현재 값을 채워 둠
export function CredentialDialog({ clientId, credential, onClose, onChanged }: { clientId: number; credential?: Credential; onClose: () => void; onChanged: () => void }) {
    const [form, setForm] = useState<CredentialForm>(() =>
        credential ? { ...emptyCredentialForm(), kind: credential.kind, label: credential.label, url: credential.url, loginId: credential.loginId, memo: credential.memo ?? '' } : emptyCredentialForm(),
    );
    const [errors, setErrors] = useState<CredentialErrors>({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);

    const set = <K extends keyof CredentialForm>(key: K, value: CredentialForm[K]) => {
        setDirty(true);
        setForm(prev => ({ ...prev, [key]: value }));
    };
    const canClose = () => !busy && (!dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?'));

    const save = async () => {
        const found = validateCredentialForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(credential ? `/api/work/clients/${clientId}/credentials/${credential.id}` : `/api/work/clients/${clientId}/credentials`, {
                method: 'POST',
                // 지금 메모를 읽을 수 없으면 메모는 보내지 않음(서버: 그대로) — 빈 값으로 덮어써 지워지지 않게
                body: credential?.memoUnreadable ? { ...credentialBody(form), memo: undefined } : credentialBody(form),
            });
            // 입력한 평문이 화면 상태에 남지 않게 바로 비움
            setForm(emptyCredentialForm());
            onChanged();
            onClose();
        } catch (e) {
            setMessage(clientErrorText(e));
            setBusy(false);
        }
    };

    return (
        <Modal open title={credential ? '항목 고치기' : '항목 추가'} size="lg" onClose={onClose} canClose={canClose}>
            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm font-medium">
                    구분
                    <select className={FIELD_CLASS} value={form.kind} onChange={e => set('kind', e.target.value as CredentialKind)}>
                        {(Object.keys(CREDENTIAL_KIND_LABEL) as CredentialKind[]).map(k => (
                            <option key={k} value={k}>
                                {CREDENTIAL_KIND_LABEL[k]}
                            </option>
                        ))}
                    </select>
                </label>
                <TextField label="이름" name="credLabel" maxLength={100} value={form.label} error={errors.label} onChange={e => set('label', e.target.value)} />
                <TextField label="주소" name="credUrl" maxLength={500} placeholder="https://" value={form.url} error={errors.url} onChange={e => set('url', e.target.value)} />
                <TextField label="아이디" name="credLogin" maxLength={200} autoComplete="off" data-1p-ignore data-lpignore="true" value={form.loginId} error={errors.loginId} onChange={e => set('loginId', e.target.value)} />
                <div className="flex flex-col gap-1.5">
                    <TextField
                        label="비밀번호"
                        name="credSecret"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        data-1p-ignore
                        data-lpignore="true"
                        style={MASK_STYLE}
                        maxLength={500}
                        disabled={form.clearSecret}
                        value={form.secret}
                        error={errors.secret}
                        hint={credential?.hasSecret ? '비워 두면 지금 값이 그대로예요' : undefined}
                        onChange={e => set('secret', e.target.value)}
                    />
                    {credential?.hasSecret && (
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" className="size-4 accent-primary" checked={form.clearSecret} onChange={e => set('clearSecret', e.target.checked)} />
                            비밀번호 지우기
                        </label>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        메모
                        <textarea
                            rows={4}
                            maxLength={5000}
                            autoComplete="off"
                            disabled={Boolean(credential?.memoUnreadable)}
                            className={FIELD_CLASS}
                            value={form.memo}
                            onChange={e => set('memo', e.target.value)}
                        />
                        {errors.memo && <span className="text-xs font-normal text-rejected-fg">{errors.memo}</span>}
                        <span className="text-xs font-normal text-muted">메모는 화면에 그대로 보여요 — 비밀번호는 비밀번호 칸에 넣어 주세요</span>
                        {credential?.memoUnreadable && <span className="text-xs font-normal text-rejected-fg">지금 메모를 읽을 수 없어 고칠 수 없어요(암호화 키 확인 필요)</span>}
                    </label>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" disabled={busy} onClick={() => canClose() && onClose()}>
                        취소
                    </Button>
                    <Button disabled={busy} onClick={save}>
                        {busy ? '저장 중…' : '저장'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

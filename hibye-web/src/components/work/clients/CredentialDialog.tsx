'use client';

import { useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch } from '@/lib/api';
import {
    clientErrorText,
    credentialBody,
    credentialToForm,
    CREDENTIAL_KIND_LABEL,
    DEFAULT_PORT,
    emptyCredentialForm,
    validateCredentialForm,
    type Credential,
    type CredentialErrors,
    type CredentialForm,
    type CredentialKind,
    type Protocol,
} from '@/lib/clients';

// 비밀번호 칸은 type=password 대신 글자만 가림 — 브라우저가 다른 회사 비밀번호를 저장하자고 제안하지 않게 (미지원 브라우저는 그대로 보임)
const MASK_STYLE = { WebkitTextSecurity: 'disc' } as React.CSSProperties;
const FIELD_CLASS = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft';
const NO_FILL = { autoComplete: 'off', 'data-1p-ignore': true, 'data-lpignore': 'true' } as const;

type SecretKey = 'secret' | 'adminSecret' | 'dbSecret';
const CLEAR_KEY: Record<SecretKey, 'clearSecret' | 'clearAdminSecret' | 'clearDbSecret'> = { secret: 'clearSecret', adminSecret: 'clearAdminSecret', dbSecret: 'clearDbSecret' };

// 접속정보 항목 추가·고치기 — 고칠 때 비밀번호는 현재 값을 불러오지 않음(비워 두면 그대로), 메모는 보이는 칸이라 현재 값을 채워 둠
export function CredentialDialog({ clientId, credential, onClose, onChanged }: { clientId: number; credential?: Credential; onClose: () => void; onChanged: () => void }) {
    const [form, setForm] = useState<CredentialForm>(() => (credential ? credentialToForm(credential) : emptyCredentialForm()));
    const [errors, setErrors] = useState<CredentialErrors>({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);

    const set = <K extends keyof CredentialForm>(key: K, value: CredentialForm[K]) => {
        setDirty(true);
        setForm(prev => ({ ...prev, [key]: value }));
    };
    // 방식을 바꾸면 포트가 비었거나 이전 방식 기본값일 때만 새 기본값으로
    const setProtocol = (protocol: Protocol) => {
        setDirty(true);
        setForm(prev => ({ ...prev, protocol, port: !prev.port.trim() || prev.port.trim() === DEFAULT_PORT[prev.protocol] ? DEFAULT_PORT[protocol] : prev.port }));
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

    const text = (key: 'label' | 'url' | 'loginId' | 'host' | 'port' | 'adminUrl' | 'adminId' | 'dbHost' | 'dbName' | 'dbId', label: string, max: number, extra: Record<string, unknown> = {}) => (
        <TextField label={label} name={`cred-${key}`} maxLength={max} {...NO_FILL} value={form[key]} error={errors[key]} onChange={e => set(key, e.target.value)} {...extra} />
    );

    // 비밀번호 칸 + (저장된 값이 있으면) 지우기
    const secret = (key: SecretKey, label: string, hasValue: boolean) => {
        const clearKey = CLEAR_KEY[key];
        return (
            <div className="flex flex-col gap-1.5">
                <TextField
                    label={label}
                    name={`cred-${key}`}
                    type="text"
                    spellCheck={false}
                    {...NO_FILL}
                    style={MASK_STYLE}
                    maxLength={500}
                    disabled={form[clearKey]}
                    value={form[key]}
                    error={errors[key]}
                    hint={hasValue ? '비워 두면 지금 값이 그대로예요' : undefined}
                    onChange={e => set(key, e.target.value)}
                />
                {hasValue && (
                    <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" className="size-4 accent-primary" checked={form[clearKey]} onChange={e => set(clearKey, e.target.checked)} />
                        {label} 지우기
                    </label>
                )}
            </div>
        );
    };

    const isSite = form.kind === 'site';

    return (
        <Modal open title={credential ? '항목 고치기' : '항목 추가'} size="lg" onClose={onClose} canClose={canClose}>
            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                    {text('label', '이름', 100, { placeholder: isSite ? '예: 메인 사이트' : undefined })}
                </div>

                {isSite ? (
                    <>
                        <Section title="서버">
                            <div className="grid gap-4 sm:grid-cols-[7rem_1fr_6rem]">
                                <label className="flex flex-col gap-1 text-sm font-medium">
                                    방식
                                    <select className={FIELD_CLASS} value={form.protocol} onChange={e => setProtocol(e.target.value as Protocol)}>
                                        <option value="ftp">FTP</option>
                                        <option value="sftp">SFTP</option>
                                    </select>
                                </label>
                                {text('host', '서버 주소', 480, { placeholder: 'example.cafe24.com' })}
                                {text('port', '포트', 5, { inputMode: 'numeric' })}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {text('loginId', '아이디', 200)}
                                {secret('secret', '비밀번호', Boolean(credential?.hasSecret))}
                            </div>
                        </Section>
                        <Section title="사이트 관리자">
                            {text('adminUrl', '관리자 주소', 500, { placeholder: 'https://' })}
                            <div className="grid gap-4 sm:grid-cols-2">
                                {text('adminId', '아이디', 200)}
                                {secret('adminSecret', '비밀번호', Boolean(credential?.hasAdminSecret))}
                            </div>
                        </Section>
                        <Section title="DB">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {text('dbHost', 'DB 호스트', 200, { placeholder: 'localhost' })}
                                {text('dbName', 'DB 이름', 100)}
                                {text('dbId', '아이디', 200)}
                                {secret('dbSecret', '비밀번호', Boolean(credential?.hasDbSecret))}
                            </div>
                        </Section>
                    </>
                ) : (
                    <>
                        {text('url', '주소', 500, { placeholder: 'https://… 또는 아이피·도메인' })}
                        {text('loginId', '아이디', 200)}
                        {secret('secret', '비밀번호', Boolean(credential?.hasSecret))}
                    </>
                )}

                <label className="flex flex-col gap-1 text-sm font-medium">
                    메모
                    <textarea
                        rows={3}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            {children}
        </fieldset>
    );
}

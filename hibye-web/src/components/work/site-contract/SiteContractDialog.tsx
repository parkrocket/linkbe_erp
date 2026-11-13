'use client';

import { useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch, ApiError } from '@/lib/api';
import { STATUS_LABEL, type SiteContract, type SiteContractStatus } from '@/lib/siteContract';

const FIELD_CLASS = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft';

type Form = { companyName: string; code: string; siteUrl: string; startDate: string; endDate: string; status: SiteContractStatus; email: string; memo: string };
type Errors = Partial<Record<'companyName' | 'endDate', string>>;

const EMPTY: Form = { companyName: '', code: '', siteUrl: '', startDate: '', endDate: '', status: 'run', email: '', memo: '' };
const toForm = (c: SiteContract): Form => ({
    companyName: c.companyName,
    code: c.code,
    siteUrl: c.siteUrl,
    startDate: c.startDate ?? '',
    endDate: c.endDate ?? '',
    status: c.status,
    email: c.email,
    memo: c.memo,
});

// 서버 검사와 같은 규칙(업체명 필수, 종료일은 시작일 이후)
function validate(f: Form): Errors {
    const e: Errors = {};
    if (!f.companyName.trim()) e.companyName = '업체명을 입력해 주세요';
    if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = '종료일이 시작일보다 앞이에요';
    return e;
}

function errorText(e: unknown) {
    if (e instanceof ApiError) {
        if (e.status === 409) return '다른 사람이 먼저 고쳤어요. 닫고 다시 열어 최신 내용을 확인해 주세요.';
        if (e.status === 404) return '계약을 찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '권한이 없어요.';
    }
    return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

// 계약 팝업 — target이 'new'면 새 계약, 아니면 보기·수정·삭제(목록에서 받은 값 그대로 사용)
export function SiteContractDialog({ target, onClose, onChanged }: { target: 'new' | SiteContract; onClose: () => void; onChanged: () => void }) {
    const isNew = target === 'new';
    const [initial] = useState<Form>(() => (isNew ? EMPTY : toForm(target)));
    const [form, setForm] = useState<Form>(initial);
    const [errors, setErrors] = useState<Errors>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const dirty = (Object.keys(form) as (keyof Form)[]).some(k => form[k] !== initial[k]);
    // 저장 중에는 닫지 않고, 변경이 있으면 확인
    const canClose = () => !busy && (!dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?'));
    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(prev => ({ ...prev, [key]: value }));

    // 저장·삭제 공통: 성공하면 목록 새로고침 후 닫기. 다른 사람이 먼저 고쳤거나 지웠으면 목록만 최신으로
    const run = async (request: () => Promise<unknown>) => {
        setBusy(true);
        setMessage('');
        try {
            await request();
            onChanged();
            onClose();
        } catch (e) {
            if (e instanceof ApiError && (e.status === 409 || e.status === 404)) onChanged();
            setMessage(errorText(e));
            setBusy(false);
        }
    };

    const save = () => {
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        void run(() =>
            apiFetch(isNew ? '/api/work/site-contracts' : `/api/work/site-contracts/${target.id}`, {
                method: 'POST',
                body: {
                    ...form,
                    companyName: form.companyName.trim(),
                    startDate: form.startDate || null,
                    endDate: form.endDate || null,
                    ...(isNew ? {} : { updatedAt: target.updatedAt }),
                },
            }),
        );
    };

    const remove = () => {
        if (isNew || !window.confirm('이 계약을 삭제할까요? 되돌릴 수 없어요.')) return;
        void run(() => apiFetch(`/api/work/site-contracts/${target.id}`, { method: 'DELETE' }));
    };

    return (
        <Modal open title={isNew ? '새 계약' : '계약 수정'} size="lg" onClose={onClose} canClose={canClose}>
            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            <div className="flex flex-col gap-4">
                <TextField label="업체명" name="companyName" maxLength={200} value={form.companyName} error={errors.companyName} onChange={e => set('companyName', e.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="업체 코드" name="code" maxLength={100} value={form.code} onChange={e => set('code', e.target.value)} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        상태
                        <select className={FIELD_CLASS} value={form.status} onChange={e => set('status', e.target.value as SiteContractStatus)}>
                            {(Object.keys(STATUS_LABEL) as SiteContractStatus[]).map(s => (
                                <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <TextField label="계약 시작일" name="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                    <TextField label="계약 종료일" name="endDate" type="date" value={form.endDate} error={errors.endDate} onChange={e => set('endDate', e.target.value)} />
                </div>
                <TextField label="사이트 주소" name="siteUrl" maxLength={255} placeholder="https://" value={form.siteUrl} onChange={e => set('siteUrl', e.target.value)} />
                <TextField label="담당자 이메일" name="email" type="email" maxLength={200} value={form.email} onChange={e => set('email', e.target.value)} />
                <label className="flex flex-col gap-1 text-sm font-medium">
                    메모
                    <textarea
                        rows={4}
                        maxLength={5000}
                        placeholder="계약서 전달 일정, 갱신 조건 등"
                        className={FIELD_CLASS}
                        value={form.memo}
                        onChange={e => set('memo', e.target.value)}
                    />
                </label>
                <div className="flex justify-end gap-2">
                    {!isNew && (
                        <Button variant="ghost" className="text-rejected-fg" disabled={busy} onClick={remove}>
                            삭제
                        </Button>
                    )}
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

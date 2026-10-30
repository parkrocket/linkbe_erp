'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiFetch, hasFailedFlag } from '@/lib/api';
import { registerErrorMessage } from '@/lib/authMessages';
import { validateRegisterForm, type RegisterErrors, type RegisterForm as Form } from '@/lib/register';

type Company = { cp_id: number; cp_name: string };

const EMPTY: Form = { email: '', password: '', passwordConfirm: '', name: '', phone: '', agree: false };

export function RegisterForm() {
    const [form, setForm] = useState<Form>(EMPTY);
    const [errors, setErrors] = useState<RegisterErrors>({});
    const [companies, setCompanies] = useState<Company[] | null>(null);
    const [cpId, setCpId] = useState<number | null>(null);
    const [serverError, setServerError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    // 회사 목록(공개 API) — 1개면 자동 선택하고 선택 칸을 숨김
    useEffect(() => {
        let active = true;
        apiFetch<{ list?: Company[] }>('/api/company/list', { method: 'POST' })
            .then(res => {
                if (!active) return;
                const list = hasFailedFlag(res) ? [] : (res.list ?? []);
                setCompanies(list);
                if (list.length === 1) setCpId(list[0].cp_id);
            })
            .catch(() => active && setCompanies([]));
        return () => {
            active = false;
        };
    }, []);

    const update = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = key === 'agree' ? event.target.checked : event.target.value;
        setForm(prev => ({ ...prev, [key]: value }));
        // 고친 칸의 오류는 바로 지움
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setServerError('');
        const found = validateRegisterForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        if (!cpId) {
            setServerError('회사를 선택해 주세요.');
            return;
        }
        setSubmitting(true);
        try {
            await apiFetch('/api/users/register', {
                method: 'POST',
                body: { email: form.email, password: form.password, name: form.name, phone: form.phone, cpId },
            });
            setDone(true);
        } catch (error) {
            setServerError(registerErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 aria-hidden className="size-10 text-approved-fg" />
                <p className="text-base font-bold text-ink">가입 신청이 완료됐어요</p>
                <p className="text-sm text-muted">관리자 승인 후 로그인할 수 있어요.</p>
                <Link href="/login" className={buttonClass('primary', 'mt-2 w-full')}>
                    로그인 화면으로
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <TextField label="이메일" name="email" type="email" autoComplete="email" value={form.email} onChange={update('email')} error={errors.email} />
            <TextField
                label="비밀번호"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={update('password')}
                error={errors.password}
                hint="영문과 숫자 또는 특수문자를 섞어 8~15자"
            />
            <TextField
                label="비밀번호 확인"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                value={form.passwordConfirm}
                onChange={update('passwordConfirm')}
                error={errors.passwordConfirm}
            />
            <TextField label="이름" name="name" autoComplete="name" value={form.name} onChange={update('name')} error={errors.name} />
            <TextField
                label="휴대폰 번호"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="010-1234-5678"
                value={form.phone}
                onChange={update('phone')}
                error={errors.phone}
            />

            {/* 회사가 여러 개일 때만 선택 칸 표시 */}
            {companies && companies.length > 1 && (
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                    회사
                    <select
                        value={cpId ?? ''}
                        onChange={e => setCpId(Number(e.target.value) || null)}
                        className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary-soft"
                    >
                        <option value="">회사를 선택해 주세요</option>
                        {companies.map(c => (
                            <option key={c.cp_id} value={c.cp_id}>
                                {c.cp_name}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {/* 개인정보 수집·이용 동의 (필수) — 문구는 회사 정책 검토 필요 */}
            <fieldset className="rounded-lg bg-surface p-3 text-xs leading-5 text-muted">
                <legend className="sr-only">개인정보 수집·이용 동의</legend>
                <p>수집 항목: 이메일·이름·휴대폰 번호 / 목적: 사내 근태 관리 / 보유 기간: 퇴사 시까지</p>
                <label className="mt-2 flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                        type="checkbox"
                        checked={form.agree}
                        onChange={update('agree')}
                        aria-invalid={errors.agree ? true : undefined}
                        className="size-4 accent-primary"
                    />
                    개인정보 수집·이용에 동의합니다 (필수)
                </label>
                {errors.agree && <p className="mt-1 text-xs text-rejected-fg">{errors.agree}</p>}
            </fieldset>

            {serverError && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {serverError}
                </p>
            )}

            <Button type="submit" disabled={submitting || companies === null} className="w-full">
                {submitting ? '신청 중…' : '가입 신청'}
            </Button>
            <p className="text-center text-xs text-muted">가입 신청 후 관리자가 승인하면 로그인할 수 있어요.</p>
        </form>
    );
}

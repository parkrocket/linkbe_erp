'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { apiFetch, ApiError } from '@/lib/api';
import { toDays } from '@/lib/leave';
import {
    myProfileErrorMessage,
    passwordErrorMessage,
    toMyProfileForm,
    toMyProfilePayload,
    validateMyProfile,
    validatePasswordForm,
    type MyInfo,
    type MyProfileErrors,
    type MyProfileForm,
    type PasswordErrors,
    type PasswordForm,
} from '@/lib/mypage';
import { EMPLOYMENT_LABEL, GENDER_LABEL } from '@/lib/profile';

// 마이페이지 — 내 정보(일부 본인 수정), 연차·휴가, 비밀번호 변경. 데이터는 언제나 로그인한 본인 것(/api/users/me)
export function MyPage() {
    const { state, reload, refresh } = useApiData<{ me: MyInfo }>('/api/users/me', undefined, 'GET');

    return (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">마이페이지</h1>
            <p className="mt-1 text-sm text-muted">내 정보를 확인하고 바꿀 수 있어요.</p>
            <div className="mt-6 flex flex-col gap-4">
                {state.status === 'loading' && (
                    <>
                        <Skeleton className="h-72" />
                        <Skeleton className="h-40" />
                    </>
                )}
                {state.status === 'error' && (
                    <Card>
                        <ErrorState onRetry={reload} />
                    </Card>
                )}
                {state.status === 'ok' && (
                    <>
                        {/* 저장 후 서버 값으로 폼을 다시 채우도록 key에 값 포함 */}
                        <ProfileCard key={JSON.stringify(state.data.me)} me={state.data.me} onSaved={refresh} />
                        <WorkInfoCard me={state.data.me} />
                        <PasswordCard />
                    </>
                )}
            </div>
        </main>
    );
}

function ProfileCard({ me, onSaved }: { me: MyInfo; onSaved: () => void }) {
    const router = useRouter();
    const [form, setForm] = useState<MyProfileForm>(() => toMyProfileForm(me));
    const [errors, setErrors] = useState<MyProfileErrors>({});
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const set = (patch: Partial<MyProfileForm>) => setForm(prev => ({ ...prev, ...patch }));

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const found = validateMyProfile(form);
        setErrors(found);
        setMessage(null);
        if (Object.keys(found).length > 0) return;
        setSaving(true);
        try {
            await apiFetch('/api/users/me/profile', { method: 'POST', body: toMyProfilePayload(form) });
            setMessage({ ok: true, text: '저장했어요.' });
            onSaved();
            router.refresh(); // 헤더 이름 갱신
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) return router.replace('/login?redirect=/mypage');
            setMessage({ ok: false, text: myProfileErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card title="내 정보">
            <form onSubmit={save} className="flex flex-col gap-4" noValidate>
                <div>
                    <p className="text-sm font-medium text-ink">이메일</p>
                    <p className="mt-1 text-sm text-muted">{me.user_email ?? me.user_id} (로그인 아이디라 바꿀 수 없어요)</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="이름" name="name" value={form.name} maxLength={50} autoComplete="name" error={errors.name} onChange={e => set({ name: e.target.value })} />
                    <TextField label="연락처" name="phone" type="tel" value={form.phone} autoComplete="tel" placeholder="010-1234-5678" error={errors.phone} onChange={e => set({ phone: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <RadioGroup
                        label="성별"
                        name="gender"
                        value={form.gender}
                        options={Object.entries(GENDER_LABEL).map(([value, label]) => ({ value, label }))}
                        onChange={v => set({ gender: v as MyProfileForm['gender'] })}
                    />
                    <TextField label="생년월일" name="birth" type="date" value={form.birth} error={errors.birth} onChange={e => set({ birth: e.target.value })} />
                </div>
                <div className="flex items-center justify-end gap-3">
                    {message && (
                        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-approved-fg' : 'text-rejected-fg'}`}>
                            {message.text}
                        </p>
                    )}
                    <Button type="submit" disabled={saving}>
                        {saving ? '저장 중…' : '저장'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

// 관리자가 정하는 정보 — 보기만 (입사일·고용형태는 월차 자동 부여에 쓰임)
function WorkInfoCard({ me }: { me: MyInfo }) {
    const rows: [string, string][] = [
        ['입사일', me.user_doe ?? '-'],
        ['부서', me.dept_name ?? '-'],
        ['직급', me.position_name ?? '-'],
        ['고용형태', me.employment_type ? EMPLOYMENT_LABEL[me.employment_type] : '-'],
        ['남은 연차', `${toDays(me.user_stip)}일`],
        ['남은 휴가', `${toDays(me.user_vaca)}일`],
    ];
    return (
        <Card
            title="회사 정보"
            action={
                <Link href="/vaca" className="text-sm font-medium text-primary hover:underline">
                    근태 신청
                </Link>
            }
        >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {rows.map(([label, value]) => (
                    <div key={label}>
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
                    </div>
                ))}
            </dl>
            <p className="mt-4 text-xs text-muted">입사일·부서·직급·고용형태를 바꾸려면 관리자에게 요청해 주세요.</p>
        </Card>
    );
}

const EMPTY_PASSWORD: PasswordForm = { current: '', next: '', confirm: '' };

function PasswordCard() {
    const router = useRouter();
    const [form, setForm] = useState<PasswordForm>(EMPTY_PASSWORD);
    const [errors, setErrors] = useState<PasswordErrors>({});
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const set = (patch: Partial<PasswordForm>) => setForm(prev => ({ ...prev, ...patch }));

    async function change(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const found = validatePasswordForm(form);
        setErrors(found);
        setMessage(null);
        if (Object.keys(found).length > 0) return;
        setSaving(true);
        try {
            await apiFetch('/api/users/me/password', { method: 'POST', body: { current: form.current, next: form.next } });
            setForm(EMPTY_PASSWORD);
            setMessage({ ok: true, text: '비밀번호를 바꿨어요. 다른 기기에서는 로그아웃돼요.' });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) return router.replace('/login?redirect=/mypage');
            setMessage({ ok: false, text: passwordErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card title="비밀번호 변경">
            <form onSubmit={change} className="flex flex-col gap-4" noValidate>
                <TextField label="현재 비밀번호" name="current" type="password" autoComplete="current-password" value={form.current} error={errors.current} onChange={e => set({ current: e.target.value })} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label="새 비밀번호"
                        name="next"
                        type="password"
                        autoComplete="new-password"
                        value={form.next}
                        error={errors.next}
                        hint="영문과 숫자 또는 특수문자를 섞어 8~15자"
                        onChange={e => set({ next: e.target.value })}
                    />
                    <TextField label="새 비밀번호 확인" name="confirm" type="password" autoComplete="new-password" value={form.confirm} error={errors.confirm} onChange={e => set({ confirm: e.target.value })} />
                </div>
                <div className="flex items-center justify-end gap-3">
                    {message && (
                        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-approved-fg' : 'text-rejected-fg'}`}>
                            {message.text}
                        </p>
                    )}
                    <Button type="submit" disabled={saving}>
                        {saving ? '바꾸는 중…' : '비밀번호 변경'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

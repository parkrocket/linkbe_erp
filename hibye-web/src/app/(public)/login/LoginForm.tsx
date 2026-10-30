'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { loginErrorMessage } from '@/lib/authMessages';
import { safeRedirect } from '@/lib/redirect';

type LoginResponse = { loginSuccess: boolean; error?: string };

const INPUT_CLASS =
    'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setSubmitting(true);
        setError('');

        try {
            // 로그인 쿠키(x_auth)는 API 응답(Set-Cookie)이 설정 — 화면 코드는 토큰을 다루지 않음
            const res = await apiFetch<LoginResponse>('/api/users/login', {
                method: 'POST',
                body: { email: form.get('email'), password: form.get('password') },
            });
            if (!res.loginSuccess) {
                // 승인 대기·거절·비활성은 사유 안내, 그 외는 계정 존재 여부를 드러내지 않는 단일 문구
                setError(loginErrorMessage(res.error));
                return;
            }
            router.replace(safeRedirect(searchParams.get('redirect')));
            router.refresh();
        } catch {
            setError('로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                이메일
                <input name="email" type="email" required autoComplete="email" className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                비밀번호
                <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className={INPUT_CLASS}
                />
            </label>
            {error && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={submitting} className="mt-2 w-full">
                {submitting ? '로그인 중…' : '로그인'}
            </Button>
        </form>
    );
}

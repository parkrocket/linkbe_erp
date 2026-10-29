import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: '로그인 — hibye' };

export default function LoginPage() {
    return (
        <main className="flex flex-1 items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(94,43,184,0.10)]">
                <Link href="/" className="text-xl font-extrabold text-primary">
                    LinkBe <span className="font-semibold text-ink">hibye</span>
                </Link>
                <p className="mt-1 mb-6 text-sm text-muted">링크비 구성원 관리 플랫폼</p>
                {/* useSearchParams 사용 컴포넌트는 Suspense 경계 필요 (cacheComponents) */}
                <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                    <LoginForm />
                </Suspense>
                <p className="mt-6 text-center text-sm text-muted">
                    계정이 없나요?{' '}
                    <Link href="/register" className="font-semibold text-primary hover:underline">
                        회원가입
                    </Link>
                </p>
            </div>
        </main>
    );
}

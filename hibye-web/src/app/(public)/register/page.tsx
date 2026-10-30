import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: '회원가입 — hibye' };

// /register — 공개 페이지. 가입은 승인 대기로 저장되고 관리자 승인 후 로그인 가능
export default function RegisterPage() {
    return (
        <main className="flex flex-1 items-start justify-center px-4 py-12 md:py-16">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(94,43,184,0.10)]">
                <Link href="/" className="text-xl font-extrabold text-primary">
                    LinkBe <span className="font-semibold text-ink">hibye</span>
                </Link>
                <h1 className="mt-4 mb-6 text-lg font-bold text-ink">회원가입</h1>
                <RegisterForm />
                <p className="mt-6 text-center text-sm text-muted">
                    이미 계정이 있나요?{' '}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        로그인
                    </Link>
                </p>
            </div>
        </main>
    );
}

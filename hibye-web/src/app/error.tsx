'use client';

// 페이지 수준 오류 화면 — 로그인 확인 API 장애 등. 로그아웃처럼 보이지 않게 장애임을 알리고 다시 시도 제공
import { ErrorState } from '@/components/ui/ErrorState';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
            <div className="w-full max-w-md rounded-(--radius-card) border border-line bg-white p-6">
                <ErrorState message="hibye 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." onRetry={reset} />
            </div>
        </main>
    );
}

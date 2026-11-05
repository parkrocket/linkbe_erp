import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { MyPage } from '@/components/mypage/MyPage';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser, loginPath } from '@/lib/auth';

export const metadata: Metadata = { title: '마이페이지 — hibye' };

// /mypage — 내 정보·비밀번호 변경 (proxy는 쿠키 유무만 → 만료·비활성이면 여기서 로그인으로)
export default function MyPageRoute() {
    return (
        <Suspense fallback={<Skeleton className="mx-auto my-10 h-96 w-full max-w-3xl" />}>
            <Body />
        </Suspense>
    );
}

async function Body() {
    if (!(await getCurrentUser())) redirect(await loginPath('/mypage'));
    return <MyPage />;
}

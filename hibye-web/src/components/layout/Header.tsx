import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { HeaderView, Logo } from './HeaderView';

// 쿠키를 읽는 부분만 Suspense로 감싸 정적 셸을 먼저 보냄 (cacheComponents)
export function Header() {
    return (
        <Suspense fallback={<HeaderFallback />}>
            <HeaderWithUser />
        </Suspense>
    );
}

async function HeaderWithUser() {
    const user = await getCurrentUser();
    return <HeaderView userName={user?.user_name ?? null} />;
}

function HeaderFallback() {
    return (
        <header className="sticky top-0 z-20 border-b border-line bg-white">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
                <Logo />
            </div>
        </header>
    );
}

'use client';

import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';

// 로그인 후 메뉴 — 경로는 기존 react-app과 동일
const NAV = [
    { href: '/', label: '홈' },
    { href: '/work', label: '근태' },
    { href: '/vaca', label: '휴가' },
    { href: '/sent', label: '결재' },
    { href: '/calendar', label: '일정' },
];

const isActive = (pathname: string, href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

export function HeaderView({ userName }: { userName: string | null }) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    async function logout() {
        // 쿠키 삭제는 API가 수행 → 서버 컴포넌트 다시 그려 소개 랜딩으로
        await apiFetch('/api/users/logout', { method: 'POST' }).catch(() => undefined);
        setUserMenuOpen(false);
        router.replace('/');
        router.refresh();
    }

    return (
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-4">
                <Logo />

                {userName ? (
                    <>
                        <nav aria-label="주요 메뉴" className="hidden h-full items-stretch gap-6 md:flex">
                            {NAV.map(item => (
                                <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
                            ))}
                        </nav>

                        <div className="relative ml-auto hidden md:block">
                            <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={userMenuOpen}
                                onClick={() => setUserMenuOpen(open => !open)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                <Avatar name={userName} />
                                {userName}
                                <ChevronDown aria-hidden className="size-4 text-muted" />
                            </button>
                            {userMenuOpen && (
                                <div role="menu" className="absolute right-0 mt-2 w-40 rounded-lg border border-line bg-white p-1 shadow-lg">
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={logout}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-surface"
                                    >
                                        <LogOut aria-hidden className="size-4" />
                                        로그아웃
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
                            aria-expanded={menuOpen}
                            aria-controls="mobile-menu"
                            onClick={() => setMenuOpen(open => !open)}
                            className="ml-auto rounded-lg p-2 text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary md:hidden"
                        >
                            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                        </button>
                    </>
                ) : (
                    <div className="ml-auto flex items-center gap-2">
                        <Link href="/login" className={buttonClass('ghost')}>
                            로그인
                        </Link>
                        <Link href="/register" className={buttonClass('secondary')}>
                            회원가입
                        </Link>
                    </div>
                )}
            </div>

            {userName && menuOpen && (
                <nav id="mobile-menu" aria-label="주요 메뉴" className="border-t border-line bg-white px-4 py-2 md:hidden">
                    {NAV.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                            className={`block rounded-md px-3 py-3 text-sm ${
                                isActive(pathname, item.href) ? 'bg-primary-soft font-bold text-primary' : 'text-ink'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <button
                        type="button"
                        onClick={logout}
                        className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm text-muted"
                    >
                        <LogOut aria-hidden className="size-4" />
                        로그아웃 ({userName})
                    </button>
                </nav>
            )}
        </header>
    );
}

export function Logo() {
    return (
        <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight text-primary">
            LinkBe
            <span className="sr-only"> hibye 홈</span>
        </Link>
    );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    // 현재 위치는 대표색 + 밑줄 (색만으로 구분하지 않도록 굵기·밑줄 병행)
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center border-b-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                active ? 'border-primary font-bold text-primary' : 'border-transparent text-muted hover:text-ink'
            }`}
        >
            {label}
        </Link>
    );
}

function Avatar({ name }: { name: string }) {
    return (
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {name.slice(0, 1)}
        </span>
    );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AdminBadge, AdminNavGroup } from '@/lib/adminNav';

type Props = { groups: AdminNavGroup[]; badges: Record<AdminBadge, number>; children: ReactNode };

// 대시보드(/admin)는 정확히 그 주소일 때만, 나머지는 하위 주소까지 선택 표시
const isActive = (pathname: string, href: string) => (href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

// 관리 화면 틀 — 데스크톱은 왼쪽 사이드 메뉴, 모바일은 위쪽 선택 상자
export function AdminShell({ groups, badges, children }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const current = groups.flatMap(g => g.items).find(i => isActive(pathname, i.href))?.href ?? '';

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:py-10">
            <div className="md:hidden">
                <select
                    aria-label="관리 메뉴"
                    value={current}
                    onChange={e => router.push(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold"
                >
                    {/* 메뉴에 없는 주소(404 등)에서 첫 메뉴가 선택된 것처럼 보이지 않게 */}
                    {current === '' && (
                        <option value="" disabled>
                            메뉴 선택
                        </option>
                    )}
                    {groups.map(g => {
                        const options = g.items.map(i => (
                            <option key={i.href} value={i.href}>
                                {i.label}
                                {i.badge && badges[i.badge] > 0 ? ` (${badges[i.badge]})` : ''}
                            </option>
                        ));
                        return g.title ? (
                            <optgroup key={g.title} label={g.title}>
                                {options}
                            </optgroup>
                        ) : (
                            options
                        );
                    })}
                </select>
            </div>

            <aside aria-label="관리 메뉴" className="hidden w-52 shrink-0 md:block">
                <nav className="sticky top-6 flex flex-col gap-5">
                    {groups.map((g, gi) => (
                        <div key={g.title ?? gi}>
                            {g.title && <p className="mb-1.5 px-3 text-xs font-semibold text-muted">{g.title}</p>}
                            <ul className="flex flex-col gap-0.5">
                                {g.items.map(i => {
                                    const active = isActive(pathname, i.href);
                                    const count = i.badge ? badges[i.badge] : 0;
                                    return (
                                        <li key={i.href}>
                                            <Link
                                                href={i.href}
                                                aria-current={active ? 'page' : undefined}
                                                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary ${
                                                    active ? 'bg-primary-soft font-bold text-primary' : 'text-ink hover:bg-surface'
                                                }`}
                                            >
                                                {i.label}
                                                {count > 0 && (
                                                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{count}</span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="min-w-0 flex-1">{children}</main>
        </div>
    );
}

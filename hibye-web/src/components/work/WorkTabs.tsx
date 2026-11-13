'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WORK_TABS } from '@/lib/workDoc';

// 업무 하위 탭 — 경비는 모두, 견적·계약서·매출/매입·설정은 업무 문서 권한자만
export function WorkTabs({ user }: { user: Parameters<typeof WORK_TABS>[0] }) {
    const pathname = usePathname();
    return (
        <nav aria-label="업무 메뉴" className="mx-auto w-full max-w-page px-4 pt-6">
            {/* 모바일: 탭 글자가 줄바꿈되지 않게 하고, 넘치면 가로로 밀어 봄 */}
            <ul className="flex gap-1 overflow-x-auto border-b border-line">
                {WORK_TABS(user).map(tab => {
                    const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                        <li key={tab.href}>
                            <Link
                                href={tab.href}
                                aria-current={active ? 'page' : undefined}
                                className={`inline-block whitespace-nowrap border-b-2 px-3 sm:px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${
                                    active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

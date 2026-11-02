'use client';

import { useState } from 'react';
import { CustomersPanel } from './CustomersPanel';
import { FaqPanel } from './FaqPanel';
import { InquiriesPanel } from './InquiriesPanel';
import { PagesPanel } from './PagesPanel';
import { PopupPanel } from './PopupPanel';
import { PostsPanel } from './PostsPanel';

const MENUS = [
    ['inquiries', '문의함'],
    ['customers', '고객 회원'],
    ['notice', '공지사항'],
    ['portfolio', '포트폴리오'],
    ['faq', 'FAQ'],
    ['popup', '메인 팝업'],
    ['pages', '안내 페이지'],
] as const;
type Menu = (typeof MENUS)[number][0];

// 홈페이지(linkbe.kr) 관리 — 문의함이 기본(가장 자주 확인)
export function HomepageTab() {
    const [menu, setMenu] = useState<Menu>('inquiries');
    return (
        <>
            <div role="group" aria-label="홈페이지 메뉴" className="mb-4 flex flex-wrap gap-1.5">
                {MENUS.map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={menu === value}
                        onClick={() => setMenu(value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                            menu === value
                                ? 'border-primary bg-primary-soft font-bold text-primary'
                                : 'border-line text-muted hover:text-ink'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {menu === 'inquiries' && <InquiriesPanel />}
            {menu === 'customers' && <CustomersPanel />}
            {(menu === 'notice' || menu === 'portfolio') && <PostsPanel key={menu} board={menu} />}
            {menu === 'faq' && <FaqPanel />}
            {menu === 'popup' && <PopupPanel />}
            {menu === 'pages' && <PagesPanel />}
        </>
    );
}

export function NoticeLine({ notice }: { notice: { tone: 'ok' | 'error'; text: string } | null }) {
    if (!notice) return null;
    return (
        <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`mb-3 rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}
        >
            {notice.text}
        </p>
    );
}

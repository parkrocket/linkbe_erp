'use client';

import type { HomepageMenu } from '@/lib/adminNav';
import { CustomersPanel } from './CustomersPanel';
import { FaqPanel } from './FaqPanel';
import { InquiriesPanel } from './InquiriesPanel';
import { OrdersPanel } from './OrdersPanel';
import { PagesPanel } from './PagesPanel';
import { PopupPanel } from './PopupPanel';
import { PostsPanel } from './PostsPanel';
import { ProductsPanel } from './ProductsPanel';

// 홈페이지(linkbe.kr) 관리 — 메뉴는 주소(/admin/homepage/<메뉴>)로 고름(lib/adminNav.ts HOMEPAGE_MENUS)
export function HomepagePanel({ menu }: { menu: HomepageMenu }) {
    switch (menu) {
        case 'inquiries':
            return <InquiriesPanel />;
        case 'orders':
            return <OrdersPanel />;
        case 'products':
            return <ProductsPanel />;
        case 'customers':
            return <CustomersPanel />;
        case 'notice':
        case 'portfolio':
            return <PostsPanel key={menu} board={menu} />;
        case 'faq':
            return <FaqPanel />;
        case 'popup':
            return <PopupPanel />;
        case 'pages':
            return <PagesPanel />;
    }
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

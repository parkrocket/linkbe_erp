'use client';

import { Button } from '@/components/ui/Button';
import { pageCount } from '@/lib/homepage';

// 이전·다음 — 서버가 30건씩 돌려줌(관리 목록)
export const PAGE_SIZE = 30;

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
    const pages = pageCount(total, PAGE_SIZE);
    if (pages <= 1) return null;
    return (
        <nav aria-label="페이지" className="mt-3 flex items-center justify-center gap-2 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                이전
            </Button>
            <span className="tabular-nums text-muted">
                {page} / {pages} (총 {total}건)
            </span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                다음
            </Button>
        </nav>
    );
}

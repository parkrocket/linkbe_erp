import type { ReactNode } from 'react';

export type BadgeTone = 'pending' | 'approved' | 'rejected' | 'info' | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
    pending: 'bg-pending-bg text-pending-fg',
    approved: 'bg-approved-bg text-approved-fg',
    rejected: 'bg-rejected-bg text-rejected-fg',
    info: 'bg-primary-soft text-primary',
    neutral: 'bg-neutral-bg text-muted',
};

// 상태 표시는 색만으로 구분하지 않도록 글자(children)를 필수로 받음 — 색약 대응
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>
            {children}
        </span>
    );
}

import type { ReactNode } from 'react';

type Props = {
    title?: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
};

// 대시보드 등에서 쓰는 기본 카드 — 제목 + 우측 액션(더보기 등)
export function Card({ title, action, className = '', children }: Props) {
    return (
        <section className={`rounded-(--radius-card) border border-line bg-white p-5 ${className}`}>
            {(title || action) && (
                <div className="mb-3 flex items-center justify-between gap-2">
                    {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

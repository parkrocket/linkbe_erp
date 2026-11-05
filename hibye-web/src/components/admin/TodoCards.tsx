import Link from 'next/link';

export type TodoItem = { label: string; desc: string; count: number; href: string };

// 대시보드 '처리할 일' — 건수 + 바로가기. 0건이면 흐리게 '처리할 일 없음'
export function TodoCards({ items }: { items: TodoItem[] }) {
    return (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map(i => (
                <li key={i.href}>
                    <Link
                        href={i.href}
                        className={`flex h-full flex-col rounded-(--radius-card) border border-line bg-white p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${
                            i.count > 0 ? '' : 'opacity-60'
                        }`}
                    >
                        <span className="text-sm font-bold text-ink">{i.label}</span>
                        <span className="mt-0.5 text-xs text-muted">{i.desc}</span>
                        <span className={`mt-4 font-extrabold tabular-nums ${i.count > 0 ? 'text-3xl text-primary' : 'text-base text-muted'}`}>
                            {i.count > 0 ? `${i.count}건` : '처리할 일 없음'}
                        </span>
                        <span className="mt-3 text-xs font-semibold text-primary">바로가기 →</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

// 대표색은 primary 하나에만 — 화면당 핵심 행동 1개 원칙
const VARIANT_CLASS: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'border border-line bg-white text-ink hover:bg-surface',
    ghost: 'text-muted hover:bg-surface hover:text-ink',
};

export const BUTTON_BASE =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';

export function buttonClass(variant: Variant = 'primary', extra = '') {
    return `${BUTTON_BASE} ${VARIANT_CLASS[variant]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: Props) {
    return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

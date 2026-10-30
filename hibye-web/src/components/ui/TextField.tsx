import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

// 라벨 + 입력 + 오류/도움말 — 오류는 aria-invalid·aria-describedby로 화면 낭독기에도 전달
export function TextField({ label, error, hint, id, name, className = '', ...props }: Props) {
    const fieldId = id ?? name;
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
    return (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {label}
            <input
                id={fieldId}
                name={name}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary-soft ${
                    error ? 'border-rejected-fg' : 'border-line focus-visible:border-primary'
                } ${className}`}
                {...props}
            />
            {error ? (
                <span id={`${fieldId}-error`} className="text-xs font-normal text-rejected-fg">
                    {error}
                </span>
            ) : (
                hint && (
                    <span id={`${fieldId}-hint`} className="text-xs font-normal text-muted">
                        {hint}
                    </span>
                )
            )}
        </label>
    );
}

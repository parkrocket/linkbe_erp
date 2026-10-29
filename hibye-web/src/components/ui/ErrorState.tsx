'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

type Props = { message?: string; onRetry?: () => void };

// 불러오기 실패 안내 + 다시 시도 — 실패를 빈 화면이나 런타임 에러로 남기지 않기 위함
export function ErrorState({ message = '정보를 불러오지 못했어요.', onRetry }: Props) {
    return (
        <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted">
            <AlertCircle aria-hidden className="size-6 text-rejected-fg" />
            <p>{message}</p>
            {onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                    다시 시도
                </Button>
            )}
        </div>
    );
}

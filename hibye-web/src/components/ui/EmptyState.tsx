import { Inbox } from 'lucide-react';

// 데이터가 없을 때의 안내
export function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
            <Inbox aria-hidden className="size-6" />
            <p>{message}</p>
        </div>
    );
}

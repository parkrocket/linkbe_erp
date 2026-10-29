import { Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

// API가 아직 없는 기능의 자리 — 가짜 데이터 대신 준비 중 안내 (스펙 결정 B)
export function ComingSoonCard({ title }: { title: string }) {
    return (
        <Card title={title} action={<Badge tone="neutral">준비 중</Badge>}>
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
                <Hourglass aria-hidden className="size-6" />
                <p>곧 hibye에서 바로 확인할 수 있어요.</p>
            </div>
        </Card>
    );
}

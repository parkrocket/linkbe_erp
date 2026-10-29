// 개발 확인용 — 공통 UI 상태 미리보기 (운영 배포 전 삭제)
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function UiPreviewPage() {
    return (
        <main className="mx-auto grid w-full max-w-5xl gap-4 p-6 md:grid-cols-2">
            <Card title="버튼">
                <div className="flex flex-wrap gap-2">
                    <Button>퇴근하기</Button>
                    <Button variant="secondary">재택 전환</Button>
                    <Button variant="ghost">취소</Button>
                    <Button disabled>준비 중</Button>
                </div>
            </Card>
            <Card title="배지" action={<a className="text-xs text-muted">더보기 ›</a>}>
                <div className="flex flex-wrap gap-2">
                    <Badge tone="pending">대기</Badge>
                    <Badge tone="approved">승인</Badge>
                    <Badge tone="rejected">반려</Badge>
                    <Badge tone="info">출근 중 · 사무실</Badge>
                    <Badge tone="neutral">준비 중</Badge>
                </div>
            </Card>
            <Card title="로딩">
                <Skeleton className="mb-2 h-6 w-1/2" />
                <Skeleton className="h-10 w-full" />
            </Card>
            <Card title="빈 데이터">
                <EmptyState message="아직 출근 기록이 없어요" />
            </Card>
            <Card title="에러">
                <ErrorState />
            </Card>
        </main>
    );
}

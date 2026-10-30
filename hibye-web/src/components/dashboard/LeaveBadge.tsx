import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { leaveLabel } from '@/lib/leave';
import type { LeaveType } from '@/lib/types';

// 근태 종류별 배지 — 색과 함께 항상 글자 표시
export const LEAVE_TONE: Record<LeaveType, BadgeTone> = {
    day: 'info',
    half: 'pending',
    vacation: 'approved',
    home: 'neutral',
};

export function LeaveBadge({ type }: { type: LeaveType }) {
    return <Badge tone={LEAVE_TONE[type]}>{leaveLabel(type)}</Badge>;
}

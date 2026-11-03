import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EXPENSE_STATUS_LABEL, type ExpenseStatus } from '@/lib/work';

const STATUS_TONE: Record<ExpenseStatus, BadgeTone> = { pending: 'pending', approved: 'info', confirmed: 'approved', paid: 'neutral' };

// 대기는 강조색, 나머지는 차분하게
export const StatusBadge = ({ status }: { status: ExpenseStatus }) => <Badge tone={STATUS_TONE[status]}>{EXPENSE_STATUS_LABEL[status]}</Badge>;

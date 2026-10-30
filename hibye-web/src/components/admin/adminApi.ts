import { apiFetch } from '@/lib/api';

// 관리자 API 형태 (nodejs-server adminController)
export type AdminUser = {
    mb_no: number;
    user_id: string;
    user_name: string;
    user_phone: string | null;
    user_role: 'member' | 'admin';
    user_status: 'pending' | 'approved' | 'rejected' | 'inactive';
    user_datetime: string;
};

export const STATUS_LABEL: Record<AdminUser['user_status'], string> = {
    pending: '승인 대기',
    approved: '승인',
    rejected: '거절',
    inactive: '비활성',
};

export const changeStatus = (mbNo: number, status: AdminUser['user_status']) =>
    apiFetch(`/api/admin/users/${mbNo}/status`, { method: 'POST', body: { status } });

export const changeRole = (mbNo: number, role: AdminUser['user_role']) =>
    apiFetch(`/api/admin/users/${mbNo}/role`, { method: 'POST', body: { role } });

const DATE = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
export const joinedAt = (value: string) => (value ? DATE.format(new Date(value)) : '-');

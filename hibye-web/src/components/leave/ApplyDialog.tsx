'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { todayString } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { applyErrorMessage, balanceAfter, HOME_LIMIT_PER_MONTH, LEAVE_TYPES } from '@/lib/leave';
import type { LeaveType, User } from '@/lib/types';
import { Modal } from './Modal';

const COST_LABEL: Record<LeaveType, string> = {
    day: '연차 −1일',
    half: '연차 −0.5일',
    vacation: '휴가 −1일',
    home: `월 ${HOME_LIMIT_PER_MONTH}회 · 차감 없음`,
};

type Props = { open: boolean; user: User; onClose: () => void; onApplied: () => void };

export function ApplyDialog({ open, user, onClose, onApplied }: Props) {
    const router = useRouter();
    const [date, setDate] = useState(todayString());
    const [type, setType] = useState<LeaveType>('day');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const preview = balanceAfter(user, type);
    const blocked = preview !== null && !preview.enough;

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            // 사용자는 서버가 토큰으로 결정 — 날짜·종류만 보냄
            await apiFetch('/api/apply/applyIn', { method: 'POST', body: { date, type } });
            onApplied();
            onClose();
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                router.replace('/login?redirect=/vaca');
                return;
            }
            setError(applyErrorMessage(e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={open} title="근태 신청" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                    날짜
                    <input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="rounded-lg border border-line px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    />
                </label>

                <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">종류</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {LEAVE_TYPES.map(({ type: value, label }) => (
                            <label
                                key={value}
                                className="flex cursor-pointer flex-col rounded-lg border border-line px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
                            >
                                <input
                                    type="radio"
                                    name="type"
                                    value={value}
                                    checked={type === value}
                                    onChange={() => setType(value)}
                                    className="sr-only"
                                />
                                <span className="font-bold">{label}</span>
                                <span className="text-xs text-muted">{COST_LABEL[value]}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {/* 신청 후 남는 일수 미리보기 — 부족하면 이유와 함께 신청 막기 */}
                <p aria-live="polite" className={`rounded-lg px-3 py-2.5 text-sm ${blocked ? 'bg-rejected-bg text-rejected-fg' : 'bg-surface text-muted'}`}>
                    {preview
                        ? blocked
                            ? `남은 ${preview.label}가 ${preview.before}일이라 신청할 수 없어요.`
                            : `신청 후 남은 ${preview.label}: ${preview.before}일 → ${preview.after}일`
                        : `재택은 남은 일수가 차감되지 않고, 한 달에 최대 ${HOME_LIMIT_PER_MONTH}회까지 신청할 수 있어요.`}
                </p>

                {error && (
                    <p role="alert" className="text-sm text-rejected-fg">
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        닫기
                    </Button>
                    <Button type="submit" disabled={submitting || blocked}>
                        {submitting ? '신청 중…' : '신청하기'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

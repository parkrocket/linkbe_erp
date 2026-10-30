'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { LeaveBadge, LEAVE_TONE } from '@/components/dashboard/LeaveBadge';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { TONE_CLASS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import {
    calendarWeeks,
    cellLeaves,
    countByType,
    filterLeaves,
    groupByDate,
    monthRange,
    shiftMonth,
    yearRange,
    type AdminLeave,
    type LeaveFilter,
} from '@/lib/adminLeaves';
import { adminErrorMessage } from '@/lib/authMessages';
import { LEAVE_TYPES, leaveLabel } from '@/lib/leave';
import { todayLocal } from '@/lib/profile';
import type { LeaveType } from '@/lib/types';
import { cancelLeaveByAdmin, type AdminUser, type OrgLists } from './adminApi';

type Period = 'month' | 'year';
type View = 'calendar' | 'list';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_IN_CELL = 2; // 달력 칸에 보이는 최대 인원, 나머지는 +N
const SELECT_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
const SUBMITTED = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// 근태 탭 — 회사 전체 근태를 월 달력·목록으로, 필터·건수 요약, 오늘 이후 근태 대신 취소 (관리자 3단계)
export function LeavesTab() {
    const today = todayLocal();
    const [ym, setYm] = useState(today.slice(0, 7));
    const [period, setPeriod] = useState<Period>('month');
    const [view, setView] = useState<View>('calendar');
    const [filter, setFilter] = useState<LeaveFilter>({ mbNo: null, deptId: null, type: null });
    const [day, setDay] = useState<string | null>(null);
    const [canceling, setCanceling] = useState<AdminLeave | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const range = period === 'month' ? monthRange(ym) : yearRange(Number(ym.slice(0, 4)));
    const leaves = useApiData<{ leaves?: AdminLeave[] }>(`/api/admin/leaves?from=${range.from}&to=${range.to}`, undefined, 'GET');
    const users = useApiData<{ users?: AdminUser[] }>('/api/admin/users', undefined, 'GET');
    const org = useApiData<Partial<OrgLists>>('/api/admin/org', undefined, 'GET');

    const departments = org.state.status === 'ok' ? (org.state.data.departments ?? []) : [];
    const deptName = (id: number | null) => departments.find(d => d.id === id)?.name ?? '-';
    // 필터용 직원 — 거절·승인 대기는 근태가 없으므로 제외
    const people =
        users.state.status === 'ok'
            ? (users.state.data.users ?? []).filter(u => u.user_status === 'approved' || u.user_status === 'inactive')
            : [];
    const rows = leaves.state.status === 'ok' ? filterLeaves(leaves.state.data.leaves ?? [], filter) : [];
    const counts = countByType(rows);
    // 올해 전체는 달력이 의미 없어 목록으로
    const shownView: View = period === 'year' ? 'list' : view;

    const move = (delta: number) =>
        setYm(prev => (period === 'month' ? shiftMonth(prev, delta) : `${Number(prev.slice(0, 4)) + delta}${prev.slice(4)}`));

    return (
        <>
            {notice && (
                <p role="status" className="mb-3 rounded-lg bg-approved-bg px-3 py-2.5 text-sm text-approved-fg">
                    {notice}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                    <IconButton label="이전" onClick={() => move(-1)}>
                        <ChevronLeft className="size-4" />
                    </IconButton>
                    <span className="min-w-28 text-center text-base font-bold">
                        {period === 'month' ? `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월` : `${ym.slice(0, 4)}년 전체`}
                    </span>
                    <IconButton label="다음" onClick={() => move(1)}>
                        <ChevronRight className="size-4" />
                    </IconButton>
                </div>
                <Segmented
                    label="기간"
                    value={period}
                    options={[
                        { value: 'month', label: '월' },
                        { value: 'year', label: '올해 전체' },
                    ]}
                    onChange={v => setPeriod(v as Period)}
                />
                {period === 'month' && (
                    <Segmented
                        label="보기"
                        value={view}
                        options={[
                            { value: 'calendar', label: '달력' },
                            { value: 'list', label: '목록' },
                        ]}
                        onChange={v => setView(v as View)}
                    />
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <select
                    aria-label="직원"
                    className={SELECT_CLASS}
                    value={filter.mbNo ?? ''}
                    onChange={e => setFilter({ ...filter, mbNo: e.target.value ? Number(e.target.value) : null })}
                >
                    <option value="">전체 직원</option>
                    {people.map(u => (
                        <option key={u.mb_no} value={u.mb_no}>
                            {u.user_name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="부서"
                    className={SELECT_CLASS}
                    value={filter.deptId ?? ''}
                    onChange={e => setFilter({ ...filter, deptId: e.target.value ? Number(e.target.value) : null })}
                >
                    <option value="">전체 부서</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="종류"
                    className={SELECT_CLASS}
                    value={filter.type ?? ''}
                    onChange={e => setFilter({ ...filter, type: (e.target.value || null) as LeaveType | null })}
                >
                    <option value="">전체 종류</option>
                    {LEAVE_TYPES.map(t => (
                        <option key={t.type} value={t.type}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* 건수 요약 (필터 적용) */}
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite">
                {LEAVE_TYPES.map(t => (
                    <span key={t.type}>
                        {t.label} <strong className="text-ink">{counts[t.type]}</strong>
                    </span>
                ))}
            </p>

            <div className="mt-4">
                {leaves.state.status === 'loading' && <Skeleton className="h-72 w-full" />}
                {leaves.state.status === 'error' && <ErrorState onRetry={leaves.reload} />}
                {leaves.state.status === 'ok' &&
                    (shownView === 'calendar' ? (
                        <MonthCalendar ym={ym} today={today} rows={rows} onPick={setDay} />
                    ) : (
                        <LeaveList rows={rows} today={today} deptName={deptName} onCancel={setCanceling} />
                    ))}
            </div>

            {day && (
                <Modal open title={`${md(day)} (${weekday(day)}) 근태`} onClose={() => setDay(null)}>
                    <LeaveList
                        rows={rows.filter(r => r.date === day)}
                        today={today}
                        deptName={deptName}
                        compact
                        onCancel={leave => {
                            setDay(null);
                            setCanceling(leave);
                        }}
                    />
                </Modal>
            )}
            {canceling && (
                <CancelDialog
                    leave={canceling}
                    onClose={() => setCanceling(null)}
                    onDone={text => {
                        setCanceling(null);
                        setNotice(text);
                        leaves.refresh(); // 화면 유지한 채 새로고침
                    }}
                />
            )}
        </>
    );
}

function MonthCalendar({ ym, today, rows, onPick }: { ym: string; today: string; rows: AdminLeave[]; onPick: (date: string) => void }) {
    const byDate = groupByDate(rows);
    return (
        <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-7 border-b border-line bg-surface text-center text-xs font-semibold text-muted">
                {WEEKDAYS.map((w, i) => (
                    <div key={w} className={`py-2 ${i === 0 ? 'text-rejected-fg' : ''}`}>
                        {w}
                    </div>
                ))}
            </div>
            {calendarWeeks(ym).map(week => (
                <div key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
                    {week.map(date => {
                        // 이웃 달 칸은 날짜만 흐리게 (이번 달만 조회 — 근태 없음으로 오해하지 않게)
                        const cell = cellLeaves(byDate, date, ym);
                        const items = cell ?? [];
                        const inMonth = cell !== null;
                        return (
                            <button
                                key={date}
                                type="button"
                                disabled={!items.length}
                                onClick={() => onPick(date)}
                                aria-label={`${md(date)} ${items.map(r => `${r.user_name} ${leaveLabel(r.type)}`).join(', ') || '근태 없음'}`}
                                className={`flex min-h-20 flex-col gap-1 border-r border-line p-1.5 text-left last:border-r-0 enabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary sm:min-h-24 ${
                                    inMonth ? 'bg-white' : 'bg-surface/60'
                                }`}
                            >
                                <span
                                    className={`text-xs ${date === today ? 'flex size-5 items-center justify-center rounded-full bg-primary font-bold text-white' : inMonth ? 'text-ink' : 'text-muted/60'}`}
                                >
                                    {Number(date.slice(8))}
                                </span>
                                {items.slice(0, MAX_IN_CELL).map(r => (
                                    <span
                                        key={r.id}
                                        title={`${r.user_name} ${leaveLabel(r.type)}`}
                                        className={`truncate rounded px-1 py-0.5 text-[11px] font-semibold ${TONE_CLASS[LEAVE_TONE[r.type]]}`}
                                    >
                                        {r.user_name}
                                        <span className="hidden sm:inline"> {leaveLabel(r.type)}</span>
                                    </span>
                                ))}
                                {items.length > MAX_IN_CELL && (
                                    <span className="text-[11px] text-muted">+{items.length - MAX_IN_CELL}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

function LeaveList({
    rows,
    today,
    deptName,
    compact = false,
    onCancel,
}: {
    rows: AdminLeave[];
    today: string;
    deptName: (id: number | null) => string;
    compact?: boolean;
    onCancel: (leave: AdminLeave) => void;
}) {
    if (!rows.length) return <EmptyState message="해당하는 근태가 없어요" />;
    return (
        <ul className="divide-y divide-line">
            {rows.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    {!compact && (
                        <span className="w-20 shrink-0 tabular-nums">
                            {md(r.date)} ({weekday(r.date)})
                        </span>
                    )}
                    <span className="font-bold">{r.user_name}</span>
                    <span className="text-muted">{deptName(r.dept_id)}</span>
                    <LeaveBadge type={r.type} />
                    <span className="hidden text-xs text-muted sm:inline">신청 {SUBMITTED.format(new Date(r.va_datetime))}</span>
                    <span className="ml-auto">
                        {/* 오늘 이후만 대신 취소 (서버도 지난 날짜 거절) */}
                        {r.date >= today ? (
                            <Button variant="ghost" className="px-2 py-1 text-rejected-fg" onClick={() => onCancel(r)}>
                                대신 취소
                            </Button>
                        ) : (
                            <span className="text-xs text-muted">지난 근태</span>
                        )}
                    </span>
                </li>
            ))}
        </ul>
    );
}

// 대신 취소 확인 — 사유 필수
function CancelDialog({ leave, onClose, onDone }: { leave: AdminLeave; onClose: () => void; onDone: (text: string) => void }) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setSaving(true);
        setError('');
        try {
            await cancelLeaveByAdmin(leave.id, reason.trim());
            onDone(`${leave.user_name}님의 ${md(leave.date)} ${leaveLabel(leave.type)}을(를) 취소했어요.`);
        } catch (e) {
            setError(adminErrorMessage(e));
            setSaving(false);
        }
    };

    return (
        <Modal open title="근태를 대신 취소할까요?" onClose={() => !saving && onClose()}>
            <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2.5 text-sm">
                <strong>{leave.user_name}</strong> {md(leave.date)} ({weekday(leave.date)}) <LeaveBadge type={leave.type} />
            </p>
            <TextField
                label="취소 사유 (필수)"
                name="cancel-reason"
                maxLength={200}
                placeholder="예: 날짜를 잘못 신청"
                value={reason}
                onChange={e => setReason(e.target.value)}
                hint="일수는 직원에게 복원되고, 장부와 #hibye-관리에 기록돼요."
            />
            {error && (
                <p role="alert" className="mt-3 text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" disabled={saving} onClick={onClose}>
                    닫기
                </Button>
                <Button disabled={saving || !reason.trim()} onClick={submit}>
                    {saving ? '취소 중…' : '대신 취소'}
                </Button>
            </div>
        </Modal>
    );
}

function Segmented({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                        value === o.value ? 'bg-primary-soft font-bold text-primary' : 'text-muted hover:text-ink'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
            {children}
        </button>
    );
}

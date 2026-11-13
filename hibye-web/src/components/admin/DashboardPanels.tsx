'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { LeaveBadge } from '@/components/dashboard/LeaveBadge';
import { useApiData } from '@/components/dashboard/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { dayLabel, leaveUsage, upcomingAnniversaries, weekdaysOf, type AnniversaryUser } from '@/lib/adminDashboard';
import type { AdminLeave } from '@/lib/adminLeaves';
import type { ApiState } from '@/lib/apiState';
import type { BalanceRow } from '@/lib/balance';
import { addDays } from '@/lib/calendar';
import type { Holiday } from '@/lib/leave';
import { kstDate, kstTime, type CalendarItem } from '@/lib/schedule';
import { leftBadge, type SiteContract } from '@/lib/siteContract';
import type { AdminUser, OrgLists } from './adminApi';

const UPCOMING_DAYS = 14;
const MAX_ROWS = 8;

// 카드 한 장 — 제목 + '전체 보기' 링크, 불러오는 중·실패는 카드 안에서만 표시(다른 카드는 그대로)
function Panel({ title, href, states, children, className }: { title: string; href: string; states: ApiState<unknown>[]; children: () => ReactNode; className?: string }) {
    const loading = states.some(s => s.status === 'loading');
    const failed = states.some(s => s.status === 'error');
    return (
        <Card
            title={title}
            className={className}
            action={
                <Link href={href} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                    전체 보기 →
                </Link>
            }
        >
            {failed ? <p className="py-4 text-sm text-muted">불러오지 못했어요. 새로고침해 주세요.</p> : loading ? <Skeleton className="h-28 w-full" /> : children()}
        </Card>
    );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="py-4 text-sm text-muted">{children}</p>;
const More = ({ n }: { n: number }) => (n > 0 ? <p className="mt-2 text-xs text-muted">외 {n}건</p> : null);

// 관리 대시보드 현황 카드 — 기존 관리 API를 읽기만 함(값을 바꾸는 버튼 없음)
export function DashboardPanels() {
    // KST 오늘 — 화면을 열 때 한 번
    const [today] = useState(() => kstDate(Date.now()));
    return (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WeekLeaves today={today} />
            <LeaveUsage />
            <Upcoming today={today} />
            <Staff today={today} />
            <ExpiringContracts today={today} />
        </div>
    );
}

// 오늘·이번 주(월~금) 근태
function WeekLeaves({ today }: { today: string }) {
    const days = weekdaysOf(today);
    const { state } = useApiData<{ leaves?: AdminLeave[] }>(`/api/admin/leaves?from=${days[0]}&to=${days[4]}`, undefined, 'GET');
    return (
        <Panel title="이번 주 근태" href="/admin/leaves" states={[state]} className="lg:col-span-2">
            {() => {
                const leaves = state.status === 'ok' ? (state.data.leaves ?? []) : [];
                return (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                        {days.map(d => {
                            const rows = leaves.filter(l => l.date === d);
                            const isToday = d === today;
                            return (
                                <li key={d} className={`rounded-lg border p-3 ${isToday ? 'border-primary bg-primary-soft' : 'border-line'}`}>
                                    <p className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted'}`}>
                                        {dayLabel(d)}
                                        {isToday && ' · 오늘'}
                                    </p>
                                    {rows.length ? (
                                        <ul className="mt-2 flex flex-col gap-1.5">
                                            {rows.map(l => (
                                                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                                                    <span className="truncate">{l.user_name}</span>
                                                    <LeaveBadge type={l.type} />
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted">전원 출근</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                );
            }}
        </Panel>
    );
}

// 연차 사용 현황 — 남은 연차가 적은 순
function LeaveUsage() {
    const { state } = useApiData<{ users?: BalanceRow[] }>('/api/admin/balances', undefined, 'GET');
    return (
        <Panel title="연차 사용 현황" href="/admin/balances" states={[state]}>
            {() => {
                const rows = (state.status === 'ok' ? (state.data.users ?? []) : [])
                    .filter(r => r.user_status !== 'inactive')
                    .map(r => ({ row: r, usage: leaveUsage(r) }))
                    .sort((a, b) => a.usage.left - b.usage.left);
                if (!rows.length) return <Empty>직원이 없어요.</Empty>;
                return (
                    <>
                        <ul className="flex flex-col gap-3">
                            {rows.map(({ row, usage }) => (
                                <li key={row.mb_no}>
                                    <div className="flex items-baseline justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            {row.user_name}
                                            {usage.low && <Badge tone="pending">얼마 안 남음</Badge>}
                                        </span>
                                        <span className="text-xs tabular-nums text-muted">
                                            사용 {usage.used} · 예정 {usage.planned} · <strong className="text-ink">남음 {usage.left}</strong>
                                        </span>
                                    </div>
                                    {/* 막대: 진한 색 = 사용, 연한 색 = 예정, 바탕 = 남음 (숫자는 위 글자로도 표시) */}
                                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
                                        <span className="bg-primary" style={{ width: `${usage.usedPct}%` }} />
                                        <span className="bg-primary/35" style={{ width: `${usage.plannedPct}%` }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-xs text-muted">올해 기준 · 진한 색 사용, 연한 색 예정, 바탕 남음 (일)</p>
                    </>
                );
            }}
        </Panel>
    );
}

// 다가오는 공휴일·회사 일정(2주)
function Upcoming({ today }: { today: string }) {
    const to = addDays(today, UPCOMING_DAYS);
    const holidays = useApiData<{ holidays?: Holiday[] }>(`/api/holidays?from=${today}&to=${to}`, undefined, 'GET');
    const query = new URLSearchParams({ timeMin: `${today}T00:00:00+09:00`, timeMax: `${addDays(to, 1)}T00:00:00+09:00` });
    const events = useApiData<CalendarItem[]>(`/api/calendar/events?${query}`, undefined, 'GET');
    return (
        <Panel title={`다가오는 공휴일·일정 (${UPCOMING_DAYS}일)`} href="/calendar" states={[holidays.state, events.state]}>
            {() => {
                const items = [
                    ...(holidays.state.status === 'ok' ? (holidays.state.data.holidays ?? []) : []).map(h => ({ key: `h-${h.date}`, date: h.date, time: '', title: h.name, holiday: true })),
                    // 근태·공휴일은 다른 카드·위 목록에 있어 회사 일정만. 이미 시작한 여러 날 일정은 오늘 날짜로
                    ...(events.state.status === 'ok' && Array.isArray(events.state.data) ? events.state.data : [])
                        .filter(e => e.kind === 'event')
                        .map(e => {
                            const start = e.allDay ? e.startDate! : kstDate(e.start);
                            return { key: e.id, date: start < today ? today : start, time: e.allDay ? '' : kstTime(e.start), title: e.title, holiday: false };
                        }),
                ].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
                if (!items.length) return <Empty>{UPCOMING_DAYS}일 안에 공휴일·일정이 없어요.</Empty>;
                return (
                    <>
                        <ul className="divide-y divide-line text-sm">
                            {items.slice(0, MAX_ROWS).map(i => (
                                <li key={i.key} className="flex items-center gap-3 py-2">
                                    <span className="w-20 shrink-0 text-xs tabular-nums text-muted">{dayLabel(i.date)}</span>
                                    <span className="min-w-0 flex-1 truncate" title={i.title}>
                                        {i.time && <span className="mr-1.5 tabular-nums text-muted">{i.time}</span>}
                                        {i.title}
                                    </span>
                                    {i.holiday && <Badge tone="rejected">공휴일</Badge>}
                                </li>
                            ))}
                        </ul>
                        <More n={items.length - MAX_ROWS} />
                    </>
                );
            }}
        </Panel>
    );
}

// 직원 현황(재직·부서별)과 30일 안 생일·입사 기념일
function Staff({ today }: { today: string }) {
    const users = useApiData<{ users?: AdminUser[] }>('/api/admin/users', undefined, 'GET');
    const org = useApiData<Partial<OrgLists>>('/api/admin/org', undefined, 'GET');
    const ann = useApiData<{ users?: AnniversaryUser[] }>('/api/admin/anniversaries', undefined, 'GET');
    return (
        <Panel title="직원 현황·기념일" href="/admin/members" states={[users.state, org.state, ann.state]}>
            {() => {
                const active = (users.state.status === 'ok' ? (users.state.data.users ?? []) : []).filter(u => u.user_status === 'approved');
                const depts = org.state.status === 'ok' ? (org.state.data.departments ?? []) : [];
                // 부서별 인원은 재직(승인) 직원만 다시 셈 — 조직 탭의 인원은 비활성 포함
                const byDept = [...depts.map(d => ({ name: d.name, n: active.filter(u => u.dept_id === d.id).length })), { name: '부서 없음', n: active.filter(u => u.dept_id === null).length }].filter(d => d.n > 0);
                const list = upcomingAnniversaries(ann.state.status === 'ok' ? (ann.state.data.users ?? []) : [], today);
                return (
                    <>
                        <p className="text-sm">
                            재직 <strong className="text-2xl font-extrabold tabular-nums text-primary">{active.length}</strong>명
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                            {byDept.map(d => (
                                <li key={d.name}>
                                    <Badge tone="neutral">
                                        {d.name} {d.n}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                        <h3 className="mt-4 text-xs font-semibold text-muted">30일 안 생일·입사 기념일</h3>
                        {list.length ? (
                            <ul className="mt-1 divide-y divide-line text-sm">
                                {list.slice(0, MAX_ROWS).map(a => (
                                    <li key={`${a.kind}-${a.mbNo}`} className="flex items-center gap-3 py-2">
                                        <span className="w-20 shrink-0 text-xs tabular-nums text-muted">{dayLabel(a.date)}</span>
                                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                                        <Badge tone={a.kind === 'birth' ? 'info' : 'approved'}>{a.kind === 'birth' ? '생일' : `입사 ${a.years}주년`}</Badge>
                                        {a.date === today && <span className="text-xs font-semibold text-primary">오늘</span>}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <Empty>30일 안에 기념일이 없어요.</Empty>
                        )}
                        <More n={list.length - MAX_ROWS} />
                    </>
                );
            }}
        </Panel>
    );
}

// 계약 만료 임박 — 진행 중이면서 60일 안에 끝나거나 이미 지난 계약
function ExpiringContracts({ today }: { today: string }) {
    const { state } = useApiData<{ contracts?: SiteContract[] }>('/api/work/site-contracts', undefined, 'GET');
    return (
        <Panel title="계약 만료 임박" href="/work/site-contracts" states={[state]}>
            {() => {
                // 서버가 진행 중·종료일 가까운 순으로 주므로 그대로 걸러 씀
                const rows = (state.status === 'ok' ? (state.data.contracts ?? []) : []).flatMap(c => {
                    const badge = leftBadge(c, today);
                    return badge && badge.tone !== 'neutral' ? [{ c, badge }] : [];
                });
                if (!rows.length) return <Empty>60일 안에 끝나는 계약이 없어요.</Empty>;
                return (
                    <>
                        <ul className="divide-y divide-line text-sm">
                            {rows.slice(0, MAX_ROWS).map(({ c, badge }) => (
                                <li key={c.id} className="flex items-center gap-3 py-2">
                                    <span className="min-w-0 flex-1 truncate font-semibold">{c.companyName}</span>
                                    <span className="shrink-0 text-xs tabular-nums text-muted">~ {c.endDate}</span>
                                    <Badge tone={badge.tone}>{badge.text}</Badge>
                                </li>
                            ))}
                        </ul>
                        <More n={rows.length - MAX_ROWS} />
                    </>
                );
            }}
        </Panel>
    );
}

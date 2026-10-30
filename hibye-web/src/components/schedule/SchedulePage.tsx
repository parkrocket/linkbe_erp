'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { LEAVE_TONE } from '@/components/dashboard/LeaveBadge';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge, TONE_CLASS } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { calendarWeeks, shiftMonth } from '@/lib/calendar';
import { todayLocal } from '@/lib/profile';
import { gridQuery, kstTime, periodText, placeByDate, scheduleErrorMessage, type CalendarItem } from '@/lib/schedule';
import type { LeaveType } from '@/lib/types';
import { EventDialog } from './EventDialog';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_IN_CELL = 3; // 칸에 보이는 최대 일정, 나머지는 +N
const KIND_LABEL = { event: '일정', leave: '근태', holiday: '공휴일' } as const;

// 근태 일정 제목 '[홍길동] 반차'에서 종류를 찾아 같은 색으로 (못 찾으면 연차 색)
const LEAVE_BY_LABEL: Record<string, LeaveType> = { 연차: 'day', 반차: 'half', 휴가: 'vacation', 재택: 'home' };
const leaveTone = (title: string) => LEAVE_TONE[LEAVE_BY_LABEL[title.split(' ').pop() ?? ''] ?? 'day'];

const chipClass = (item: CalendarItem) =>
    item.kind === 'holiday'
        ? 'text-rejected-fg'
        : item.kind === 'leave'
          ? TONE_CLASS[leaveTone(item.title)]
          : 'bg-primary-soft text-primary';

type Editing = { mode: 'add'; date: string } | { mode: 'edit'; item: CalendarItem };

// 일정 화면 — 월 달력(이웃 달 칸까지 조회), 일정 추가·상세·수정·삭제 (권한은 서버가 판단해 canEdit로 내려줌)
export function SchedulePage() {
    const today = todayLocal();
    const [ym, setYm] = useState(today.slice(0, 7));
    const [day, setDay] = useState<string | null>(null);
    const [detail, setDetail] = useState<CalendarItem | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    // 상세 팝업 안 오류 — 팝업이 화면 맨 위에 떠 있어 페이지 안내는 가려지므로 팝업 안에 표시
    const [detailError, setDetailError] = useState('');
    const openDetail = (item: CalendarItem) => {
        setDetailError('');
        setDetail(item);
    };

    // +09:00의 '+'가 공백으로 바뀌지 않게 인코딩
    const query = new URLSearchParams(gridQuery(ym)).toString();
    const { state, reload, refresh } = useApiData<CalendarItem[]>(`/api/calendar/events?${query}`, undefined, 'GET');
    const byDate = state.status === 'ok' && Array.isArray(state.data) ? placeByDate(state.data) : new Map<string, CalendarItem[]>();

    const done = (text: string) => {
        setNotice({ tone: 'ok', text });
        refresh(); // 화면 유지한 채 새로고침
    };

    const remove = async (item: CalendarItem) => {
        if (!window.confirm(`'${item.title}' 일정을 삭제할까요?`)) return;
        try {
            await apiFetch('/api/calendar/delete', { method: 'POST', body: { id: item.id } });
            setDetail(null);
            done('일정을 삭제했어요.');
        } catch (error) {
            setDetailError(scheduleErrorMessage(error));
        }
    };

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight">일정</h1>
                <Button onClick={() => setEditing({ mode: 'add', date: ym === today.slice(0, 7) ? today : `${ym}-01` })}>
                    <Plus aria-hidden className="size-4" />
                    일정 추가
                </Button>
            </div>
            <p className="mt-1 text-sm text-muted">
                회사 캘린더 일정·근태·공휴일을 한눈에 봐요. 일정은 만든 사람과 관리자만 고칠 수 있어요.
            </p>

            {notice && (
                <p
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}
                >
                    {notice.text}
                </p>
            )}

            <Card className="mt-4">
                <div className="mb-3 flex items-center gap-1">
                    <IconButton label="이전 달" onClick={() => setYm(shiftMonth(ym, -1))}>
                        <ChevronLeft className="size-4" />
                    </IconButton>
                    <span className="min-w-28 text-center text-base font-bold">
                        {ym.slice(0, 4)}년 {Number(ym.slice(5))}월
                    </span>
                    <IconButton label="다음 달" onClick={() => setYm(shiftMonth(ym, 1))}>
                        <ChevronRight className="size-4" />
                    </IconButton>
                    {ym !== today.slice(0, 7) && (
                        <Button variant="ghost" className="ml-1 px-2 py-1 text-xs" onClick={() => setYm(today.slice(0, 7))}>
                            오늘
                        </Button>
                    )}
                </div>

                {state.status === 'loading' && <Skeleton className="h-[30rem] w-full" />}
                {state.status === 'error' && <ErrorState onRetry={reload} />}
                {state.status === 'ok' && (
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
                                {week.map((date, i) => {
                                    const items = byDate.get(date) ?? [];
                                    const inMonth = date.startsWith(ym);
                                    const holiday = items.some(it => it.kind === 'holiday');
                                    return (
                                        <div
                                            key={date}
                                            className={`flex min-h-24 min-w-0 flex-col gap-0.5 border-r border-line p-1 last:border-r-0 sm:min-h-28 ${inMonth ? 'bg-white' : 'bg-surface/60'}`}
                                        >
                                            {/* 날짜를 누르면 그날 목록(추가 가능) */}
                                            <button
                                                type="button"
                                                onClick={() => setDay(date)}
                                                aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 일정 ${items.length}건`}
                                                className={`self-start rounded px-1 text-xs hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary ${
                                                    date === today
                                                        ? 'bg-primary font-bold text-white hover:bg-primary-hover'
                                                        : i === 0 || holiday
                                                          ? 'text-rejected-fg'
                                                          : inMonth
                                                            ? 'text-ink'
                                                            : 'text-muted/60'
                                                }`}
                                            >
                                                {Number(date.slice(8))}
                                            </button>
                                            {items.slice(0, MAX_IN_CELL).map(it => (
                                                <button
                                                    key={it.id}
                                                    type="button"
                                                    onClick={() => openDetail(it)}
                                                    title={it.title}
                                                    className={`truncate rounded px-1 py-0.5 text-left text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-primary ${chipClass(it)}`}
                                                >
                                                    {!it.allDay && <span className="mr-0.5 font-normal">{kstTime(it.start)}</span>}
                                                    {it.title}
                                                </button>
                                            ))}
                                            {items.length > MAX_IN_CELL && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDay(date)}
                                                    className="self-start px-1 text-[11px] text-muted hover:text-ink"
                                                >
                                                    +{items.length - MAX_IN_CELL}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {day && (
                <Modal open title={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`} onClose={() => setDay(null)}>
                    {!(byDate.get(day) ?? []).length ? (
                        <EmptyState message="일정이 없어요" />
                    ) : (
                        <ul className="divide-y divide-line">
                            {(byDate.get(day) ?? []).map(it => (
                                <li key={it.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDay(null);
                                            openDetail(it);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                    >
                                        <span
                                            className={`size-2 shrink-0 rounded-full ${it.kind === 'holiday' ? 'bg-rejected-fg' : it.kind === 'leave' ? 'bg-pending-fg' : 'bg-primary'}`}
                                        />
                                        <span className="w-12 shrink-0 text-xs text-muted">{it.allDay ? '종일' : kstTime(it.start)}</span>
                                        <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Button
                        variant="secondary"
                        className="mt-4 w-full"
                        onClick={() => {
                            setEditing({ mode: 'add', date: day });
                            setDay(null);
                        }}
                    >
                        <Plus aria-hidden className="size-4" />이 날 일정 추가
                    </Button>
                </Modal>
            )}

            {detail && (
                <Modal open title={detail.title} onClose={() => setDetail(null)}>
                    <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-muted">종류</dt>
                        <dd>
                            <Badge
                                tone={detail.kind === 'holiday' ? 'rejected' : detail.kind === 'leave' ? leaveTone(detail.title) : 'info'}
                            >
                                {KIND_LABEL[detail.kind]}
                            </Badge>
                        </dd>
                        <dt className="text-muted">기간</dt>
                        <dd>{periodText(detail)}</dd>
                        {detail.description && (
                            <>
                                <dt className="text-muted">메모</dt>
                                <dd className="whitespace-pre-wrap break-words">{detail.description}</dd>
                            </>
                        )}
                        {detail.creatorName && (
                            <>
                                <dt className="text-muted">만든 사람</dt>
                                <dd>{detail.creatorName}</dd>
                            </>
                        )}
                    </dl>
                    {detail.kind === 'leave' && (
                        <p className="mt-4 rounded-lg bg-surface px-3 py-2.5 text-sm text-muted">
                            근태 일정은 여기서 바꿀 수 없어요. 취소는{' '}
                            <Link href="/vaca" className="font-semibold text-primary underline-offset-2 hover:underline">
                                근태 화면
                            </Link>
                            에서 해주세요.
                        </p>
                    )}
                    {detail.kind === 'event' && !detail.canEdit && (
                        <p className="mt-4 text-xs text-muted">일정을 만든 사람과 관리자만 수정·삭제할 수 있어요.</p>
                    )}
                    {detailError && (
                        <p role="alert" className="mt-4 text-sm text-rejected-fg">
                            {detailError}
                        </p>
                    )}
                    {detail.canEdit && (
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="ghost" className="text-rejected-fg" onClick={() => remove(detail)}>
                                삭제
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setEditing({ mode: 'edit', item: detail });
                                    setDetail(null);
                                }}
                            >
                                수정
                            </Button>
                        </div>
                    )}
                </Modal>
            )}

            {editing && (
                <EventDialog
                    editing={editing}
                    onClose={() => setEditing(null)}
                    onSaved={text => {
                        setEditing(null);
                        done(text);
                    }}
                />
            )}
            {/* 근태 신청 바로가기 — 근태는 일정 추가가 아니라 근태 화면에서 */}
            <p className="mt-4 text-center text-xs text-muted">
                연차·반차·휴가·재택은{' '}
                <Link href="/vaca" className={buttonClass('ghost', 'px-1 py-0 text-xs text-primary')}>
                    근태 화면
                </Link>
                에서 신청해요.
            </p>
        </main>
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

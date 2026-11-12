'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import { DayButton, DayPicker, type DayButtonProps } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { LEAVE_TONE } from '@/components/dashboard/LeaveBadge';
import { todayString, useApiData } from '@/components/dashboard/useApiData';
import { TONE_CLASS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import {
    applyErrorMessage,
    balanceAfter,
    fromLocalDay,
    groupTeamByDate,
    HOME_LIMIT_PER_MONTH,
    LEAVE_TYPES,
    leaveLabel,
    monthBounds,
    type Holiday,
    type TeamLeaveDay,
} from '@/lib/leave';
import type { LeaveType, User } from '@/lib/types';
import { Modal } from './Modal';

// 팀원 근태 점은 한 가지 색(사람 수만) — 종류별 색을 쓰면 '이미 신청'(주황 점)·공휴일(빨강)과 헷갈림.
// 종류는 툴팁과 아래 명단(배지 색)에서 보여 줌
const MAX_DOTS = 3; // 칸 하나에 찍는 최대 점, 나머지는 +N

// 날짜별 팀원 근태 — 날짜 칸(TeamDayButton)이 읽음. 칸 컴포넌트를 렌더마다 새로 만들면
// 버튼이 다시 마운트돼 키보드 포커스가 풀리므로, 컴포넌트는 고정하고 데이터만 context로 전달
const TeamContext = createContext<Map<string, TeamLeaveDay[]>>(new Map());

function TeamDayButton({ day, modifiers, children, ...props }: DayButtonProps) {
    const team = useContext(TeamContext).get(todayString(day.date)) ?? [];
    // 이미 신청한 날은 주황 점(내 근태)만 — 팀원 점과 겹치지 않게
    const show = team.length > 0 && !modifiers.taken && !modifiers.outside;
    return (
        <DayButton day={day} modifiers={modifiers} {...props} title={show ? team.map(t => `${t.name} ${leaveLabel(t.type)}`).join(', ') : undefined}>
            {children}
            {show && (
                <>
                    <span className="sr-only">, 팀원 {team.length}명 근태</span>
                    <span aria-hidden className="hibye-team-dots">
                        {team.slice(0, MAX_DOTS).map((_, i) => (
                            <span key={i} className="hibye-team-dot" />
                        ))}
                        {team.length > MAX_DOTS && <span className="hibye-team-more">+{team.length - MAX_DOTS}</span>}
                    </span>
                </>
            )}
        </DayButton>
    );
}

const COST_LABEL: Record<LeaveType, string> = {
    day: '−1일',
    half: '−0.5일',
    vacation: '−1일',
    home: `월 ${HOME_LIMIT_PER_MONTH}회`,
};
const MAX_DATES = 31; // 서버 MAX_DATES_PER_REQUEST와 동일
// 오늘 0시 (로컬) — 달력의 '오늘 이전' 기준
const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
const DATE_LABEL = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
});

type Props = {
    open: boolean;
    user: User;
    // 이미 신청한 날 — 달력에서 표시·선택 불가 (서버도 중복을 다시 검사)
    takenDates: Date[];
    onClose: () => void;
    onApplied: () => void;
};

// 1단계: 종류 + 달력에서 여러 날 선택 → 2단계: 최종 확인 후 신청 (사용자 요청)
export function ApplyDialog({ open, user, takenDates, onClose, onApplied }: Props) {
    const router = useRouter();
    const [step, setStep] = useState<'select' | 'confirm'>('select');
    const [type, setType] = useState<LeaveType>('day');
    const [selected, setSelected] = useState<Date[]>([]);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // 공휴일(오늘부터 1년) — 달력에 빨갛게 표시·선택 불가. 못 불러와도 신청은 가능(서버가 다시 검사)
    const start = startOfToday();
    const holidayRange = `from=${todayString(start)}&to=${todayString(new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()))}`;
    const holidays = useApiData<{ holidays?: Holiday[] }>(`/api/holidays?${holidayRange}`, undefined, 'GET');
    const holidayDates = holidays.state.status === 'ok' ? (holidays.state.data.holidays ?? []).map(h => fromLocalDay(h.date)) : [];

    // 팀원 근태 — 달력에 보이는 달만 (달을 넘기면 다시 불러옴). 못 불러와도 신청에는 영향 없음
    const [month, setMonth] = useState(start);
    const bounds = monthBounds(month);
    const teamData = useApiData<{ leaves?: TeamLeaveDay[] }>(`/api/vacation/team?from=${bounds.from}&to=${bounds.to}`, undefined, 'GET');
    const team = groupTeamByDate(teamData.state.status === 'ok' ? (teamData.state.data.leaves ?? []) : []);

    const dates = [...selected].sort((a, b) => a.getTime() - b.getTime());
    // 고른 날 중 팀원이 쉬는 날 — 요약 아래 명단
    const overlaps = dates.map(d => ({ date: d, people: team.get(todayString(d)) ?? [] })).filter(o => o.people.length);
    const preview = balanceAfter(user, type, Math.max(dates.length, 1));
    const blocked = dates.length > 0 && preview !== null && !preview.enough;

    function close() {
        setStep('select');
        setSelected([]);
        setMonth(startOfToday());
        setError('');
        onClose();
    }

    async function submit() {
        setSubmitting(true);
        setError('');
        try {
            // 사용자는 서버가 토큰으로 결정 — 날짜·종류만 보냄. 하루라도 안 되면 서버가 전체 거절
            await apiFetch('/api/apply/applyIn', {
                method: 'POST',
                body: { dates: dates.map(d => todayString(d)), type },
            });
            onApplied();
            close();
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                router.replace('/login?redirect=/vaca');
                return;
            }
            setError(applyErrorMessage(e));
            setStep('select');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={open} title={step === 'select' ? '근태 신청' : '이대로 신청할까요?'} onClose={close}>
            {step === 'select' ? (
                <div className="flex flex-col gap-4">
                    <fieldset>
                        <legend className="mb-1.5 text-sm font-medium">종류</legend>
                        <div className="grid grid-cols-4 gap-2">
                            {LEAVE_TYPES.map(({ type: value, label }) => (
                                <label
                                    key={value}
                                    className="flex cursor-pointer flex-col items-center rounded-lg border border-line px-2 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
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

                    <div>
                        <p className="mb-1 text-sm font-medium">날짜 (여러 날 선택 가능)</p>
                        <TeamContext.Provider value={team}>
                            <DayPicker
                                className="hibye-calendar"
                                mode="multiple"
                                locale={ko}
                                max={MAX_DATES}
                                selected={selected}
                                onSelect={days => setSelected(days ?? [])}
                                month={month}
                                onMonthChange={setMonth}
                                components={{ DayButton: TeamDayButton }}
                                // 주말·공휴일·오늘 이전·이미 신청한 날은 선택 불가 (서버도 같은 규칙으로 다시 검사)
                                disabled={[{ dayOfWeek: [0, 6] }, { before: startOfToday() }, ...takenDates, ...holidayDates]}
                                // 지난 달로는 이동하지 않음
                                startMonth={startOfToday()}
                                modifiers={{
                                    taken: takenDates,
                                    holiday: holidayDates,
                                }}
                                modifiersClassNames={{
                                    taken: 'hibye-taken',
                                    holiday: 'hibye-holiday',
                                }}
                            />
                        </TeamContext.Provider>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                            <span>
                                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-primary" />
                                선택
                            </span>
                            <span>
                                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-pending-fg" />
                                이미 신청
                            </span>
                            <span>
                                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-rejected-fg" />
                                공휴일
                            </span>
                            <span className="inline-flex items-center">
                                <span aria-hidden className="mr-1 inline-flex gap-0.5">
                                    <span className="hibye-team-dot" />
                                    <span className="hibye-team-dot" />
                                </span>
                                팀원 근태
                            </span>
                            <span>주말·공휴일·지난 날짜 선택 불가</span>
                        </p>
                    </div>

                    <Summary count={dates.length} preview={preview} blocked={blocked} type={type} />
                    {overlaps.length > 0 && <TeamOverlap overlaps={overlaps} />}

                    {error && (
                        <p role="alert" className="text-sm text-rejected-fg">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={close}>
                            닫기
                        </Button>
                        <Button disabled={dates.length === 0 || blocked} onClick={() => setStep('confirm')}>
                            다음
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <ul className="max-h-60 divide-y divide-line overflow-y-auto">
                        {dates.map(d => (
                            <li key={d.getTime()} className="flex justify-between py-2.5 text-sm">
                                <span>{DATE_LABEL.format(d)}</span>
                                <b className="text-primary">{leaveLabel(type)}</b>
                            </li>
                        ))}
                    </ul>
                    <p className="rounded-lg bg-surface px-3 py-2.5 text-sm">
                        {preview ? (
                            <>
                                총 <b>{preview.days}일</b> 차감 · 남은 {preview.label}{' '}
                                <b>
                                    {preview.before}일 → {preview.after}일
                                </b>
                            </>
                        ) : (
                            <>재택 {dates.length}일 · 남은 일수 차감 없음</>
                        )}
                        <span className="mt-0.5 block text-xs text-muted">회사 캘린더에 {dates.length}건이 등록돼요.</span>
                    </p>
                    <div className="flex justify-between gap-2">
                        <Button variant="ghost" onClick={() => setStep('select')}>
                            <ChevronLeft aria-hidden className="size-4" />
                            날짜 다시 고르기
                        </Button>
                        <Button onClick={submit} disabled={submitting}>
                            {submitting ? '신청 중…' : `${dates.length}일 신청하기`}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

const SHORT_DATE = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
});

// 고른 날 중 팀원이 쉬는 날 — 날짜별 '이름 종류' 칩 (일정 겹침을 신청 전에 확인)
function TeamOverlap({ overlaps }: { overlaps: { date: Date; people: TeamLeaveDay[] }[] }) {
    return (
        <section aria-label="고른 날 함께 쉬는 팀원" className="rounded-lg border border-line px-3 py-2.5">
            <p className="text-xs font-semibold text-muted">고른 날 함께 쉬는 팀원</p>
            <ul className="mt-1.5 flex max-h-36 flex-col gap-1.5 overflow-y-auto">
                {overlaps.map(({ date, people }) => (
                    <li key={date.getTime()} className="flex items-start gap-2 text-sm">
                        <span className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{SHORT_DATE.format(date)}</span>
                        <span className="flex flex-wrap gap-1">
                            {people.map((p, i) => (
                                <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[LEAVE_TONE[p.type]]}`}>
                                    {p.name} <span className="font-normal">{leaveLabel(p.type)}</span>
                                </span>
                            ))}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

type SummaryProps = {
    count: number;
    preview: ReturnType<typeof balanceAfter>;
    blocked: boolean;
    type: LeaveType;
};

// 선택 요약 — 몇 일, 신청 후 남는 일수, 부족하면 이유
function Summary({ count, preview, blocked, type }: SummaryProps) {
    const tone = blocked ? 'bg-rejected-bg text-rejected-fg' : 'bg-surface text-muted';
    let text: string;
    if (count === 0) text = '달력에서 날짜를 눌러 선택해 주세요.';
    else if (!preview) text = `${count}일 선택 · 재택은 한 달에 최대 ${HOME_LIMIT_PER_MONTH}회까지 신청할 수 있어요.`;
    else if (blocked) text = `${count}일 선택 · 남은 ${preview.label}가 ${preview.before}일이라 신청할 수 없어요.`;
    else text = `${count}일 선택 · 남은 ${preview.label} ${preview.before}일 → ${preview.after}일`;
    return (
        <p aria-live="polite" className={`rounded-lg px-3 py-2.5 text-sm ${tone}`}>
            {text}
            {type === 'half' && count > 0 && <span className="block text-xs">반차는 하루 0.5일씩 차감돼요.</span>}
        </p>
    );
}

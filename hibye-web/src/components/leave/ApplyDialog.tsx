'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { todayString } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { applyErrorMessage, balanceAfter, HOME_LIMIT_PER_MONTH, LEAVE_TYPES, leaveLabel } from '@/lib/leave';
import type { LeaveType, User } from '@/lib/types';
import { Modal } from './Modal';

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
const DATE_LABEL = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

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

    const dates = [...selected].sort((a, b) => a.getTime() - b.getTime());
    const preview = balanceAfter(user, type, Math.max(dates.length, 1));
    const blocked = dates.length > 0 && preview !== null && !preview.enough;

    function close() {
        setStep('select');
        setSelected([]);
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
                        <DayPicker
                            className="hibye-calendar"
                            mode="multiple"
                            locale={ko}
                            max={MAX_DATES}
                            selected={selected}
                            onSelect={days => setSelected(days ?? [])}
                            // 주말·오늘 이전·이미 신청한 날은 선택 불가 (서버도 같은 규칙으로 다시 검사)
                            disabled={[{ dayOfWeek: [0, 6] }, { before: startOfToday() }, ...takenDates]}
                            // 지난 달로는 이동하지 않음
                            startMonth={startOfToday()}
                            modifiers={{ taken: takenDates }}
                            modifiersClassNames={{ taken: 'hibye-taken' }}
                        />
                        <p className="mt-1 flex gap-3 text-xs text-muted">
                            <span>
                                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-primary" />
                                선택
                            </span>
                            <span>
                                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-pending-fg" />
                                이미 신청
                            </span>
                            <span>주말·지난 날짜 선택 불가</span>
                        </p>
                    </div>

                    <Summary count={dates.length} preview={preview} blocked={blocked} type={type} />

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

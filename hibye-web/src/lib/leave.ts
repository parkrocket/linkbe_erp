// 근태(연차·반차·휴가·재택) 계산
import { ApiError } from './api';
import type { GtwRecord, LeaveType, User, VacationRecord } from './types';

// 표시 순서 = 이 배열 순서
export const LEAVE_TYPES: { type: LeaveType; label: string }[] = [
    { type: 'day', label: '연차' },
    { type: 'half', label: '반차' },
    { type: 'vacation', label: '휴가' },
    { type: 'home', label: '재택' },
];
const ORDER = new Map(LEAVE_TYPES.map((t, i) => [t.type, i]));
export const leaveLabel = (type: LeaveType) => LEAVE_TYPES[ORDER.get(type) ?? 0].label;
const isLeaveType = (v: unknown): v is LeaveType => typeof v === 'string' && ORDER.has(v as LeaveType);

export type TeamLeave = {
    counts: Record<LeaveType, number>;
    people: { name: string; type: LeaveType }[];
    total: number;
};

// gtwStatusAll(직원별 오늘 근태) → 종류별 인원 + 오늘 근태자 목록
export function summarizeTeamLeave(records: GtwRecord[]): TeamLeave {
    const counts: Record<LeaveType, number> = { day: 0, half: 0, vacation: 0, home: 0 };
    const people: TeamLeave['people'] = [];
    // 한 직원에 근태가 여러 건이면 조인 행이 중복되므로 직원 기준으로 한 번만
    const seen = new Set<string>();

    for (const r of records) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        if (!isLeaveType(r.type)) continue;
        counts[r.type]++;
        people.push({ name: r.user_name ?? '', type: r.type });
    }
    people.sort((a, b) => (ORDER.get(a.type) ?? 0) - (ORDER.get(b.type) ?? 0));
    return { counts, people, total: seen.size };
}

// 날짜 값(ISO)을 로컬 'YYYY-MM-DD'로 — DB DATE가 서버 시간대 자정 기준 ISO로 오기 때문
export function localDay(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 오늘 이후 내 근태를 날짜순으로 최대 limit개
export function upcomingLeaves(list: VacationRecord[], today: string, limit = 5): VacationRecord[] {
    return list
        .filter(v => localDay(v.date) >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, limit);
}

// 신청 시 차감 미리보기 — 연차·반차는 남은 연차(user_stip), 휴가는 남은 휴가(user_vaca), 재택은 차감 없음
const COST: Record<LeaveType, { field: 'user_stip' | 'user_vaca'; label: string; days: number } | null> = {
    day: { field: 'user_stip', label: '연차', days: 1 },
    half: { field: 'user_stip', label: '연차', days: 0.5 },
    vacation: { field: 'user_vaca', label: '휴가', days: 1 },
    home: null,
};

export function balanceAfter(user: User, type: LeaveType) {
    const cost = COST[type];
    if (!cost) return null;
    const before = toDays(user[cost.field]);
    const after = before - cost.days;
    return { label: cost.label, before, after, days: cost.days, enough: after >= 0 };
}

// DECIMAL 문자열('8.5')·null 대응
export function toDays(value: unknown) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

// 재택 월 최대 횟수 — 서버(applyModel HOME_LIMIT_PER_MONTH)가 실제로 검사, 화면은 안내용
export const HOME_LIMIT_PER_MONTH = 2;

// 근태 신청 API 오류 사유 → 안내 문구
export function applyErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.reason === 'Monthly home limit exceeded') return `재택은 한 달에 최대 ${HOME_LIMIT_PER_MONTH}회까지 신청할 수 있어요.`;
        if (error.reason === 'Insufficient balance') return '남은 일수가 부족해요.';
        if (error.reason === 'Already applied on this date') return '이미 근태를 신청한 날짜예요. 한 날짜에 하나만 신청할 수 있어요.';
        if (error.status === 400) return '날짜와 종류를 확인해 주세요.';
    }
    return '신청하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

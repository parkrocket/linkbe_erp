// 관리자 근태 현황 — 기간·달력·필터·집계 (GET /api/admin/leaves 응답을 화면에서 가공)
import type { LeaveType } from './types';

export type AdminLeave = {
    id: number;
    date: string; // 'YYYY-MM-DD'
    type: LeaveType;
    va_datetime: string;
    mb_no: number;
    user_name: string;
    dept_id: number | null;
    position_id: number | null;
    user_status: string;
};

export type LeaveFilter = { mbNo: number | null; deptId: number | null; type: LeaveType | null };

const pad = (n: number) => String(n).padStart(2, '0');
// 'YYYY-MM-DD' 계산은 UTC 날짜로 (시간대 영향 없음)
const toDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function monthRange(ym: string) {
    const [y, m] = ym.split('-').map(Number);
    return { from: `${ym}-01`, to: toDate(new Date(Date.UTC(y, m, 0))) }; // 다음 달 0일 = 이번 달 말일
}

export const yearRange = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31` });

export function shiftMonth(ym: string, delta: number) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// 달력 칸 — 일요일 시작, 1일 앞과 말일 뒤는 이웃 달 날짜로 채운 주 단위 배열
export function calendarWeeks(ym: string): string[][] {
    const { from, to } = monthRange(ym);
    const start = new Date(`${from}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
    const weeks: string[][] = [];
    for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === 0) weeks.push([]);
        weeks[weeks.length - 1].push(toDate(d));
    }
    return weeks;
}

export const filterLeaves = (rows: AdminLeave[], f: LeaveFilter) =>
    rows.filter(r => (f.mbNo === null || r.mb_no === f.mbNo) && (f.deptId === null || r.dept_id === f.deptId) && (f.type === null || r.type === f.type));

export function countByType(rows: AdminLeave[]): Record<LeaveType, number> {
    const counts: Record<LeaveType, number> = { day: 0, half: 0, vacation: 0, home: 0 };
    for (const r of rows) counts[r.type] += 1;
    return counts;
}

export function groupByDate(rows: AdminLeave[]) {
    const map = new Map<string, AdminLeave[]>();
    for (const r of rows) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return map;
}

// 달력 칸의 근태 — 이웃 달 칸은 null (이번 달만 조회하므로 '근태 없음'과 구분해 표시하지 않음)
export const cellLeaves = (byDate: Map<string, AdminLeave[]>, date: string, ym: string): AdminLeave[] | null =>
    date.startsWith(ym) ? (byDate.get(date) ?? []) : null;

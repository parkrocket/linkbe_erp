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

// 기간·달력 계산은 일정 화면과 공용 (lib/calendar.ts)
export { calendarWeeks, monthRange, shiftMonth, yearRange } from './calendar';

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

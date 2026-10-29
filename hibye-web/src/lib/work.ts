// 근태 계산 — 기존 react-app WorkStatus.js / GtwStatus.js 규칙을 순수 함수로 옮김
import type { GtwRecord } from './types';

export const STANDARD_WORK_MINUTES = 9 * 60; // 근무 기준 9시간
const LATE_AFTER = '10:01:00'; // 지각 기준 (기존 코드 값)
const VACATION_TYPES = new Set(['vacation', 'day', 'half']);

// 'YYYY-MM-DD HH:mm:ss'와 ISO 문자열 모두 로컬 시각으로 해석
const toDate = (value: string) => new Date(value.includes('T') ? value : value.replace(' ', 'T'));
const minutesBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / 60000);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export type WorkSummary = {
    office: number;
    home: number;
    left: number;
    vacation: number;
    late: number;
    overtime: number;
    underwork: number;
};

export function summarizeWorkStatus(records: GtwRecord[], date: string): WorkSummary {
    const lateThreshold = toDate(`${date}T${LATE_AFTER}`);
    const summary: WorkSummary = { office: 0, home: 0, left: 0, vacation: 0, late: 0, overtime: 0, underwork: 0 };

    for (const r of records) {
        if (r.type && VACATION_TYPES.has(r.type)) summary.vacation++;
        // 출근 기록 없는 직원은 이후 집계 제외 (기존 코드는 지각으로 잘못 셈)
        if (!r.start_time) continue;

        const start = toDate(r.start_time);
        if (start > lateThreshold) summary.late++;

        if (!r.end_time) {
            if (r.gtw_location === 'office') summary.office++;
            else if (r.gtw_location === 'home') summary.home++;
            continue;
        }

        summary.left++;
        const worked = minutesBetween(start, toDate(r.end_time));
        if (worked > STANDARD_WORK_MINUTES) summary.overtime++;
        else if (worked < STANDARD_WORK_MINUTES) summary.underwork++;
    }
    return summary;
}

export function todayWorkProgress(
    start: string | null,
    end: string | null,
    now: Date,
): { workedMinutes: number; expectedEnd: string | null; percent: number } {
    if (!start) return { workedMinutes: 0, expectedEnd: null, percent: 0 };

    const startAt = toDate(start);
    const endAt = end ? toDate(end) : null;
    const workedMinutes = minutesBetween(startAt, endAt ?? now);
    const expectedEnd = hhmm(endAt ?? new Date(startAt.getTime() + STANDARD_WORK_MINUTES * 60000));
    const percent = Math.min(100, Math.floor((workedMinutes / STANDARD_WORK_MINUTES) * 100));

    return { workedMinutes, expectedEnd, percent };
}

import { describe, expect, it } from 'vitest';
import { calendarWeeks, countByType, filterLeaves, groupByDate, monthRange, shiftMonth, yearRange, type AdminLeave } from './adminLeaves';

const leave = (id: number, date: string, type: AdminLeave['type'], mb_no: number, dept_id: number | null): AdminLeave => ({
    id,
    date,
    type,
    va_datetime: '2026-10-01T00:00:00.000Z',
    mb_no,
    user_name: `직원${mb_no}`,
    dept_id,
    position_id: null,
    user_status: 'approved',
});

describe('기간', () => {
    it('월 범위 (말일·윤년)', () => {
        expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
        expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
        expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });
    it('올해 전체', () => {
        expect(yearRange(2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    });
    it('월 이동 (해 넘김)', () => {
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    });
});

describe('calendarWeeks', () => {
    it('일요일 시작, 앞뒤 달 날짜로 채움', () => {
        const weeks = calendarWeeks('2026-10'); // 10/1 목요일, 10/31 토요일
        expect(weeks).toHaveLength(5);
        expect(weeks[0]).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
        expect(weeks[4][6]).toBe('2026-10-31');
    });
    it('1일이 일요일인 달', () => {
        const weeks = calendarWeeks('2026-11');
        expect(weeks[0][0]).toBe('2026-11-01');
        expect(weeks.at(-1)?.at(-1)).toBe('2026-12-05');
    });
});

describe('필터·집계', () => {
    const rows = [leave(1, '2026-11-02', 'day', 3, 10), leave(2, '2026-11-02', 'home', 4, 11), leave(3, '2026-11-05', 'half', 3, 10)];

    it('직원·부서·종류 필터 (null = 전체)', () => {
        expect(filterLeaves(rows, { mbNo: null, deptId: null, type: null })).toHaveLength(3);
        expect(filterLeaves(rows, { mbNo: 3, deptId: null, type: null }).map(r => r.id)).toEqual([1, 3]);
        expect(filterLeaves(rows, { mbNo: null, deptId: 11, type: null }).map(r => r.id)).toEqual([2]);
        expect(filterLeaves(rows, { mbNo: null, deptId: null, type: 'half' }).map(r => r.id)).toEqual([3]);
    });
    it('종류별 건수', () => {
        expect(countByType(rows)).toEqual({ day: 1, half: 1, vacation: 0, home: 1 });
    });
    it('날짜별 묶기', () => {
        const byDate = groupByDate(rows);
        expect(byDate.get('2026-11-02')?.map(r => r.id)).toEqual([1, 2]);
        expect(byDate.get('2026-11-03')).toBeUndefined();
    });
});

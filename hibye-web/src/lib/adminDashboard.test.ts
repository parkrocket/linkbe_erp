import { describe, expect, it } from 'vitest';
import { dayLabel, leaveUsage, upcomingAnniversaries, weekdaysOf } from './adminDashboard';

describe('adminDashboard', () => {
    it('이번 주 평일 — 일요일도 그 주(월~금)로, 월·연 경계', () => {
        expect(weekdaysOf('2026-11-13')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
        expect(weekdaysOf('2026-11-15')[0]).toBe('2026-11-09'); // 일요일
        expect(weekdaysOf('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
        expect(dayLabel('2026-11-13')).toBe('11/13 (금)');
    });

    it('기념일 — 오늘 포함 30일, 해 넘김, 입사 1주년부터, 2/29', () => {
        const u = (mbNo: number, joinDate: string | null, birthMd: string | null) => ({ mbNo, name: `직원${mbNo}`, deptId: null, joinDate, birthMd });
        const list = upcomingAnniversaries([u(1, '2024-11-13', '12-13'), u(2, '2026-11-20', '12-14'), u(3, '2020-01-02', null), u(4, null, '11-12')], '2026-11-13');
        expect(list).toEqual([
            { date: '2026-11-13', mbNo: 1, name: '직원1', kind: 'join', years: 2 }, // 오늘
            { date: '2026-12-13', mbNo: 1, name: '직원1', kind: 'birth' }, // 30일째 포함
        ]); // 직원2: 입사 당일(0주년)·31일째 생일 제외, 직원3: 1/2는 범위 밖, 직원4: 어제 생일은 내년
        expect(upcomingAnniversaries([u(3, '2020-01-02', null)], '2026-12-20')).toEqual([{ date: '2027-01-02', mbNo: 3, name: '직원3', kind: 'join', years: 7 }]);
        expect(upcomingAnniversaries([u(5, null, '02-29')], '2027-02-10')[0].date).toBe('2027-02-28');
        expect(upcomingAnniversaries([u(5, null, '02-29')], '2028-02-10')[0].date).toBe('2028-02-29');
    });

    it('연차 막대 — 사용·예정·남음 비율, 값이 없으면 0', () => {
        expect(leaveUsage({ user_stip: 0.5, used_stip: 19.5, planned_stip: 2 })).toEqual({ used: 19.5, planned: 2, left: 0.5, usedPct: 88.6, plannedPct: 9.1, low: true });
        expect(leaveUsage({ user_stip: 8, used_stip: 10, planned_stip: 1 }).low).toBe(false);
        expect(leaveUsage({ user_stip: null })).toEqual({ used: 0, planned: 0, left: 0, usedPct: 0, plannedPct: 0, low: true });
    });
});

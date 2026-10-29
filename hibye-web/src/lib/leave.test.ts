import { describe, expect, it } from 'vitest';
import { balanceAfter, summarizeTeamLeave, upcomingLeaves } from './leave';
import type { GtwRecord, VacationRecord } from './types';

const member = (user_id: string, user_name: string, type: string | null): GtwRecord => ({
    user_id,
    user_name,
    type,
    start_time: null,
    end_time: null,
    gtw_location: null,
});

describe('summarizeTeamLeave', () => {
    it('근태 종류별 인원과 오늘 근태자 목록을 만든다', () => {
        const s = summarizeTeamLeave([
            member('a', '김링크', 'day'),
            member('b', '이비', 'half'),
            member('c', '박하이', 'home'),
            member('d', '최바이', 'vacation'),
            member('e', '정출근', null),
        ]);
        expect(s.counts).toEqual({ day: 1, half: 1, vacation: 1, home: 1 });
        expect(s.people).toEqual([
            { name: '김링크', type: 'day' },
            { name: '이비', type: 'half' },
            { name: '최바이', type: 'vacation' },
            { name: '박하이', type: 'home' },
        ]);
        expect(s.total).toBe(5);
    });

    it('같은 직원이 여러 행이어도 한 번만 센다', () => {
        const s = summarizeTeamLeave([member('a', '김링크', 'day'), member('a', '김링크', 'day')]);
        expect(s.counts.day).toBe(1);
        expect(s.total).toBe(1);
    });

    it('알 수 없는 근태 종류는 무시한다', () => {
        expect(summarizeTeamLeave([member('a', '김링크', 'gtw')]).people).toEqual([]);
    });
});

describe('upcomingLeaves', () => {
    const leave = (date: string, type: VacationRecord['type']): VacationRecord => ({ date, type });

    it('오늘 이후 일정만 날짜순으로 최대 5개', () => {
        const list = [
            leave('2026-11-12T00:00:00.000Z', 'home'),
            leave('2026-10-20T00:00:00.000Z', 'day'),
            leave('2026-11-03T00:00:00.000Z', 'day'),
            ...Array.from({ length: 6 }, (_, i) => leave(`2026-12-0${i + 1}T00:00:00.000Z`, 'half')),
        ];
        const result = upcomingLeaves(list, '2026-10-29');
        expect(result).toHaveLength(5);
        expect(result[0].date.startsWith('2026-11-03')).toBe(true);
        expect(result[1].date.startsWith('2026-11-12')).toBe(true);
    });
});

describe('balanceAfter', () => {
    const user = { user_id: 'me', user_name: '홍', cp_id: 1, user_stip: '1.5', user_vaca: 0 };

    it('연차·반차는 연차에서, 휴가는 휴가에서 차감한다', () => {
        expect(balanceAfter(user, 'day')).toEqual({ label: '연차', before: 1.5, after: 0.5, days: 1, enough: true });
        expect(balanceAfter(user, 'half')).toEqual({ label: '연차', before: 1.5, after: 1, days: 0.5, enough: true });
        expect(balanceAfter(user, 'vacation')).toEqual({ label: '휴가', before: 0, after: -1, days: 1, enough: false });
    });

    it('재택은 차감이 없다', () => {
        expect(balanceAfter(user, 'home')).toBeNull();
    });
});

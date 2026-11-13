import { describe, expect, it } from 'vitest';
import { daysLeft, leftBadge } from './siteContract';

describe('siteContract', () => {
    it('남은 날 수 — 월·연 경계, 종료일 없음', () => {
        expect(daysLeft('2026-12-31', '2026-11-13')).toBe(48);
        expect(daysLeft('2027-01-01', '2026-12-31')).toBe(1);
        expect(daysLeft('2026-11-12', '2026-11-13')).toBe(-1);
        expect(daysLeft(null, '2026-11-13')).toBeNull();
    });

    it('표시 — 진행 중만, 지남·오늘·임박(60일)·여유', () => {
        const today = '2026-11-13';
        const run = (endDate: string | null) => leftBadge({ status: 'run', endDate }, today);
        expect(run('2026-11-12')).toEqual({ tone: 'rejected', text: '1일 지남' });
        expect(run('2026-11-13')).toEqual({ tone: 'rejected', text: '오늘 만료' });
        expect(run('2027-01-12')).toEqual({ tone: 'pending', text: '60일 남음' });
        expect(run('2027-01-13')).toEqual({ tone: 'neutral', text: '61일 남음' });
        expect(run(null)).toBeNull();
        expect(leftBadge({ status: 'stop', endDate: '2026-11-12' }, today)).toBeNull();
    });
});

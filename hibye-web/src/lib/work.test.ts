import { describe, expect, it } from 'vitest';
import type { GtwRecord } from './types';
import { summarizeWorkStatus, todayWorkProgress } from './work';

const DATE = '2026-10-29';
const rec = (r: Partial<GtwRecord>): GtwRecord => ({
    user_id: 'u',
    start_time: null,
    end_time: null,
    gtw_location: null,
    type: null,
    ...r,
});

describe('summarizeWorkStatus', () => {
    it('출근 기록이 없는 직원은 지각으로 세지 않는다', () => {
        expect(summarizeWorkStatus([rec({})], DATE).late).toBe(0);
    });

    it('10:01 이후 출근은 지각', () => {
        expect(summarizeWorkStatus([rec({ start_time: `${DATE} 10:05:00` })], DATE).late).toBe(1);
        expect(summarizeWorkStatus([rec({ start_time: `${DATE} 09:59:00` })], DATE).late).toBe(0);
    });

    it('9시간 넘게 일하고 퇴근하면 퇴근·초과', () => {
        const s = summarizeWorkStatus([rec({ start_time: `${DATE} 09:00:00`, end_time: `${DATE} 18:30:00` })], DATE);
        expect(s.left).toBe(1);
        expect(s.overtime).toBe(1);
        expect(s.underwork).toBe(0);
    });

    it('9시간 미만 근무 후 퇴근하면 미달', () => {
        const s = summarizeWorkStatus([rec({ start_time: `${DATE} 09:00:00`, end_time: `${DATE} 17:00:00` })], DATE);
        expect(s.underwork).toBe(1);
        expect(s.overtime).toBe(0);
    });

    it('근무 중인 직원은 장소별로 센다', () => {
        const s = summarizeWorkStatus(
            [
                rec({ start_time: `${DATE} 09:00:00`, gtw_location: 'home' }),
                rec({ start_time: `${DATE} 09:00:00`, gtw_location: 'office' }),
                rec({ start_time: `${DATE} 09:00:00`, gtw_location: 'office' }),
            ],
            DATE,
        );
        expect(s.home).toBe(1);
        expect(s.office).toBe(2);
    });

    it('반차·연차·휴가는 휴가로 센다', () => {
        const s = summarizeWorkStatus([rec({ type: 'half' }), rec({ type: 'day' }), rec({ type: 'vacation' })], DATE);
        expect(s.vacation).toBe(3);
    });
});

describe('todayWorkProgress', () => {
    it('9시간을 넘겨도 100%에서 멈춘다', () => {
        const p = todayWorkProgress(`${DATE} 09:00:00`, null, new Date(`${DATE}T20:00:00`));
        expect(p.percent).toBe(100);
    });

    it('예상 퇴근은 출근 + 9시간', () => {
        const p = todayWorkProgress(`${DATE} 09:00:00`, null, new Date(`${DATE}T12:00:00`));
        expect(p.expectedEnd).toBe('18:00');
        expect(p.workedMinutes).toBe(180);
        expect(p.percent).toBe(33);
    });

    it('퇴근했으면 퇴근 시각 기준', () => {
        const p = todayWorkProgress(`${DATE} 09:00:00`, `${DATE} 17:30:00`, new Date(`${DATE}T20:00:00`));
        expect(p.expectedEnd).toBe('17:30');
        expect(p.workedMinutes).toBe(510);
    });

    it('출근 전이면 0', () => {
        expect(todayWorkProgress(null, null, new Date())).toEqual({ workedMinutes: 0, expectedEnd: null, percent: 0 });
    });
});

import { describe, expect, it } from 'vitest';
import { emptyForm, fromItem, gridQuery, itemDays, placeByDate, toEventPayload, validateEventForm, type CalendarItem, type EventForm } from './schedule';

const item = (patch: Partial<CalendarItem>): CalendarItem => ({
    id: 'e1',
    title: '회의',
    start: '2026-11-05',
    end: '2026-11-06',
    allDay: true,
    className: 'user-event',
    kind: 'event',
    canEdit: true,
    creatorName: '김직원',
    description: '',
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    ...patch,
});

describe('itemDays', () => {
    it('하루 종일 여러 날 — 끝 날짜 포함', () => {
        expect(itemDays(item({ startDate: '2026-11-30', endDate: '2026-12-02' }))).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    });
    it('시간 일정 — 한국 시간 날짜 (UTC로 받아도)', () => {
        expect(itemDays(item({ allDay: false, start: '2026-11-05T01:00:00Z', end: '2026-11-05T02:00:00Z', startDate: undefined, endDate: undefined }))).toEqual([
            '2026-11-05',
        ]);
        // KST 23:00 ~ 다음 날 01:00 → 이틀
        expect(itemDays(item({ allDay: false, start: '2026-11-05T23:00:00+09:00', end: '2026-11-06T01:00:00+09:00', startDate: undefined, endDate: undefined }))).toEqual([
            '2026-11-05',
            '2026-11-06',
        ]);
        // 끝이 정확히 자정이면 다음 날에 표시하지 않음
        expect(itemDays(item({ allDay: false, start: '2026-11-05T22:00:00+09:00', end: '2026-11-06T00:00:00+09:00', startDate: undefined, endDate: undefined }))).toEqual([
            '2026-11-05',
        ]);
    });
});

describe('placeByDate', () => {
    it('날짜별로 공휴일 → 하루 종일 → 시간 순', () => {
        const items = [
            item({ id: 't', allDay: false, start: '2026-11-05T14:00:00+09:00', end: '2026-11-05T15:00:00+09:00', startDate: undefined, endDate: undefined }),
            item({ id: 't2', allDay: false, start: '2026-11-05T09:00:00+09:00', end: '2026-11-05T10:00:00+09:00', startDate: undefined, endDate: undefined }),
            item({ id: 'a' }),
            item({ id: 'h', kind: 'holiday', canEdit: false }),
        ];
        expect(placeByDate(items).get('2026-11-05')?.map(i => i.id)).toEqual(['h', 'a', 't2', 't']);
    });
});

describe('gridQuery', () => {
    it('달력에 보이는 전체 칸 범위(이웃 달 포함)를 한국 시간으로', () => {
        expect(gridQuery('2026-11')).toEqual({ timeMin: '2026-11-01T00:00:00+09:00', timeMax: '2026-12-06T00:00:00+09:00' });
    });
});

describe('폼', () => {
    const allDay: EventForm = { ...emptyForm('2026-11-05'), title: '워크숍', endDate: '2026-11-06' };

    it('빈 폼은 그날 하루 종일, 시간은 10~11시 기본', () => {
        expect(emptyForm('2026-11-05')).toEqual({
            title: '',
            allDay: true,
            startDate: '2026-11-05',
            endDate: '2026-11-05',
            startTime: '10:00',
            endTime: '11:00',
            description: '',
        });
    });

    it('검사', () => {
        expect(validateEventForm(allDay)).toEqual({});
        expect(validateEventForm({ ...allDay, title: ' ' }).title).toBe('제목을 입력해 주세요.');
        expect(validateEventForm({ ...allDay, endDate: '2026-11-04' }).endDate).toBe('끝 날짜가 시작보다 빨라요.');
        expect(validateEventForm({ ...allDay, endDate: '2026-12-06' }).endDate).toBe('최대 31일까지 등록할 수 있어요.');
        expect(validateEventForm({ ...allDay, allDay: false, endDate: '2026-11-05', startTime: '11:00', endTime: '11:00' }).endTime).toBe(
            '끝 시각이 시작보다 늦어야 해요.',
        );
    });

    it('요청 데이터', () => {
        expect(toEventPayload(allDay)).toEqual({ summary: '워크숍', description: '', allDay: true, startDate: '2026-11-05', endDate: '2026-11-06' });
        expect(toEventPayload({ ...allDay, allDay: false, endDate: '2026-11-05', description: ' 메모 ' })).toEqual({
            summary: '워크숍',
            description: '메모',
            allDay: false,
            startDateTime: '2026-11-05T10:00',
            endDateTime: '2026-11-05T11:00',
        });
    });

    it('기존 일정 → 폼 (시간 일정은 한국 시간)', () => {
        expect(fromItem(item({ startDate: '2026-11-05', endDate: '2026-11-06', description: '안건' }))).toMatchObject({
            title: '회의',
            allDay: true,
            startDate: '2026-11-05',
            endDate: '2026-11-06',
            description: '안건',
        });
        expect(fromItem(item({ allDay: false, start: '2026-11-05T01:30:00Z', end: '2026-11-05T03:00:00Z', startDate: undefined, endDate: undefined }))).toMatchObject({
            allDay: false,
            startDate: '2026-11-05',
            startTime: '10:30',
            endDate: '2026-11-05',
            endTime: '12:00',
        });
    });
});

describe('scheduleErrorMessage·periodText', () => {
    it('서버 사유별 안내', async () => {
        const { ApiError } = await import('./api');
        const { scheduleErrorMessage } = await import('./schedule');
        expect(scheduleErrorMessage(new ApiError(403, 'Not allowed'))).toBe('일정을 만든 사람과 관리자만 수정·삭제할 수 있어요.');
        expect(scheduleErrorMessage(new ApiError(403, 'Leave event'))).toBe('근태 일정은 근태 화면에서 취소해 주세요.');
        expect(scheduleErrorMessage(new ApiError(404, 'Event not found'))).toBe('이미 삭제된 일정이에요. 새로고침해 주세요.');
        expect(scheduleErrorMessage(new ApiError(400, 'Invalid date'))).toBe('입력값을 확인해 주세요.');
        expect(scheduleErrorMessage(new Error('x'))).toBe('처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    });

    it('기간 문구', async () => {
        const { periodText } = await import('./schedule');
        expect(periodText(item({}))).toBe('11/5 (목)');
        expect(periodText(item({ endDate: '2026-11-06' }))).toBe('11/5 (목) ~ 11/6 (금)');
        expect(periodText(item({ allDay: false, start: '2026-11-05T10:00:00+09:00', end: '2026-11-05T11:30:00+09:00', startDate: undefined, endDate: undefined }))).toBe(
            '11/5 (목) 10:00 ~ 11:30',
        );
    });
});

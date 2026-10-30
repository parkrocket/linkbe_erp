// 일정 화면 — 회사 Google 캘린더 일정을 날짜 칸에 배치, 입력 폼 검사·요청 데이터 (서버 utils/eventValidation.js와 같은 규칙)
import { addDays, calendarWeeks } from './calendar';

// GET /api/calendar/events 응답 항목
export type CalendarItem = {
    id: string;
    title: string;
    start: string; // 하루 종일 'YYYY-MM-DD', 시간 일정 ISO
    end: string;
    allDay: boolean;
    className: string;
    kind: 'event' | 'leave' | 'holiday';
    canEdit: boolean;
    creatorName: string | null;
    description: string;
    startDate?: string; // 하루 종일만 (끝 포함)
    endDate?: string;
};

export type EventForm = {
    title: string;
    allDay: boolean;
    startDate: string;
    endDate: string;
    startTime: string; // 'HH:mm'
    endTime: string;
    description: string;
};
export type EventErrors = Partial<Record<keyof EventForm, string>>;

const MAX_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

// 한국 시간 날짜·시각 (사용자 PC 시간대와 무관하게)
const KST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const KST_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const kstDate = (iso: string | number) => KST_DATE.format(new Date(iso));
export const kstTime = (iso: string) => KST_TIME.format(new Date(iso));

// 일정이 걸친 날짜들 — 시간 일정은 끝 시각 직전까지(자정에 끝나면 다음 날 제외)
export function itemDays(item: CalendarItem): string[] {
    const first = item.allDay ? item.startDate! : kstDate(item.start);
    const last = item.allDay ? item.endDate! : kstDate(Date.parse(item.end) - 1);
    const days: string[] = [];
    for (let d = first; d <= last && days.length <= MAX_DAYS; d = addDays(d, 1)) days.push(d);
    return days;
}

const KIND_ORDER = { holiday: 0, leave: 1, event: 1 };

// 날짜 → 그날 일정 (공휴일 → 하루 종일 → 시간 순)
export function placeByDate(items: CalendarItem[]) {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) for (const day of itemDays(item)) map.set(day, [...(map.get(day) ?? []), item]);
    const rank = (i: CalendarItem) => [KIND_ORDER[i.kind], i.allDay ? 0 : 1, i.allDay ? '' : i.start] as const;
    for (const list of map.values()) {
        list.sort((a, b) => {
            const [x, y] = [rank(a), rank(b)];
            return x[0] - y[0] || x[1] - y[1] || Date.parse(x[2] || '0') - Date.parse(y[2] || '0');
        });
    }
    return map;
}

// 달력에 보이는 칸 전체(이웃 달 포함) 조회 범위 — 한국 시간 자정 기준
export function gridQuery(ym: string) {
    const weeks = calendarWeeks(ym);
    const last = weeks[weeks.length - 1][6];
    return { timeMin: `${weeks[0][0]}T00:00:00+09:00`, timeMax: `${addDays(last, 1)}T00:00:00+09:00` };
}

export const emptyForm = (date: string): EventForm => ({
    title: '',
    allDay: true,
    startDate: date,
    endDate: date,
    startTime: '10:00',
    endTime: '11:00',
    description: '',
});

export function fromItem(item: CalendarItem): EventForm {
    if (item.allDay) return { ...emptyForm(item.startDate!), title: item.title, endDate: item.endDate!, description: item.description };
    return {
        title: item.title,
        allDay: false,
        startDate: kstDate(item.start),
        endDate: kstDate(item.end),
        startTime: kstTime(item.start),
        endTime: kstTime(item.end),
        description: item.description,
    };
}

export function validateEventForm(form: EventForm): EventErrors {
    const errors: EventErrors = {};
    if (!form.title.trim()) errors.title = '제목을 입력해 주세요.';
    else if (form.title.trim().length > 100) errors.title = '제목은 100자까지 입력할 수 있어요.';
    if (form.description.length > 500) errors.description = '메모는 500자까지 입력할 수 있어요.';
    if (!form.startDate || !form.endDate) errors.endDate = '날짜를 입력해 주세요.';
    else if (form.endDate < form.startDate) errors.endDate = '끝 날짜가 시작보다 빨라요.';
    else if ((Date.parse(form.endDate) - Date.parse(form.startDate)) / DAY_MS >= MAX_DAYS) errors.endDate = '최대 31일까지 등록할 수 있어요.';
    else if (!form.allDay && `${form.endDate}T${form.endTime}` <= `${form.startDate}T${form.startTime}`) errors.endTime = '끝 시각이 시작보다 늦어야 해요.';
    return errors;
}

// POST /api/calendar/in·update 바디 (수정은 id를 더해 보냄)
export function toEventPayload(form: EventForm) {
    const base = { summary: form.title.trim(), description: form.description.trim() };
    return form.allDay
        ? { ...base, allDay: true, startDate: form.startDate, endDate: form.endDate }
        : { ...base, allDay: false, startDateTime: `${form.startDate}T${form.startTime}`, endDateTime: `${form.endDate}T${form.endTime}` };
}

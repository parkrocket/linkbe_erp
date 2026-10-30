// 일정 입력 검증 — 새 화면 형식과 기존 react-app 형식을 모두 받아 Google 저장 형태로 변환
// 하루 종일: 화면은 끝 날짜 포함, Google은 끝 미포함 → +1일 / 시간 지정: 한국 시간(timeZone)으로 저장
const { isDateIn, addDays } = require('./profileValidation');

const SUMMARY_MAX = 100;
const DESCRIPTION_MAX = 500;
const MAX_DAYS = 31; // 한 일정의 최대 기간
const TIME_ZONE = 'Asia/Seoul';
const DAY_MS = 24 * 60 * 60 * 1000;

const isDate = v => isDateIn(v, '1900-01-01', '2999-12-31');
// 'YYYY-MM-DDTHH:mm' — 날짜는 실존, 시각은 00:00~23:59
const isDateTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v) && isDate(v.slice(0, 10));
const daysBetween = (a, b) => (Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS;

exports.validateEvent = (body = {}) => {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (!summary || summary.length > SUMMARY_MAX) return { error: 'Invalid summary' };
    const description = body.description ?? '';
    if (typeof description !== 'string' || description.length > DESCRIPTION_MAX) return { error: 'Invalid description' };

    // 기존 react-app 형식 { start: { date }, end: { date } } → 하루 종일
    // 추가는 끝 = 시작(하루), 수정은 FullCalendar의 끝 날짜(미포함)를 보냄 → 끝 > 시작이면 Google 형식 그대로 사용
    const legacy = body.start && typeof body.start === 'object';
    const allDay = legacy || body.allDay !== false;

    if (allDay) {
        const startDate = legacy ? body.start.date : body.startDate;
        const legacyEnd = legacy ? body.end?.date : undefined;
        const exclusiveEnd = legacy && isDate(legacyEnd) && legacyEnd > startDate;
        const endDate = legacy ? (exclusiveEnd ? addDays(legacyEnd, -1) : legacyEnd) : body.endDate;
        if (!isDate(startDate) || !isDate(endDate) || endDate < startDate || daysBetween(startDate, endDate) >= MAX_DAYS) {
            return { error: 'Invalid date' };
        }
        return { value: { summary, description, start: { date: startDate }, end: { date: addDays(endDate, 1) } } };
    }

    const { startDateTime, endDateTime } = body;
    if (!isDateTime(startDateTime) || !isDateTime(endDateTime) || endDateTime <= startDateTime || daysBetween(startDateTime, endDateTime) >= MAX_DAYS) {
        return { error: 'Invalid date' };
    }
    return {
        value: {
            summary,
            description,
            start: { dateTime: `${startDateTime}:00`, timeZone: TIME_ZONE },
            end: { dateTime: `${endDateTime}:00`, timeZone: TIME_ZONE },
        },
    };
};

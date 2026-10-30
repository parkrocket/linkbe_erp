const { google } = require('googleapis');
const pool = require('../config/dbPromise');
const Admin = require('../models/adminModel');
const { validateEvent } = require('../utils/eventValidation');
const { addDays } = require('../utils/profileValidation');

// 회사 Google 캘린더 일정 — 기존 react-app과 새 화면이 함께 사용 (응답은 필드 추가만)
// 권한(2026-10-30): 추가는 누구나, 수정·삭제는 만든 사람 + 관리자. 만든 사람 정보 없는 기존 일정은 관리자만,
// 근태 신청으로 생긴 일정은 아무도 수정·삭제 불가 (취소는 근태 화면 — 캘린더와 근태 기록·잔여가 어긋나지 않게)
// (기존: 로그인한 누구나 모든 일정 수정·삭제 가능)

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);
const calendar = () => google.calendar({ version: 'v3', auth: auths }); // 호출 시점 생성 (점검 스크립트에서 가짜 교체)

const HOLIDAY_CALENDAR_ID = 'ko.south_korea#holiday@group.v.calendar.google.com';
const MAX_RANGE_DAYS = 62; // 조회 최대 기간 (월 달력 6주 + 여유)
const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (res, code, error) => res.status(code).json({ error });

// 만든 사람(직원 번호) — 새로 만든 일정에만 있음
const creatorOf = event => Number(event.extendedProperties?.private?.hibyeCreator) || null;

// 근태 신청으로 생긴 일정 id (lk_vacation.calendar_id)
async function leaveEventIds(ids) {
    if (!ids.length) return new Set();
    const [rows] = await pool.query('SELECT calendar_id FROM lk_vacation WHERE calendar_id IN (?)', [ids]);
    return new Set(rows.map(r => r.calendar_id));
}

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('calendar api error:', error.response?.data || error.message);
        if (!res.headersSent) fail(res, 500, 'Calendar error');
    }
};

// 조회 — 회사 일정 + 한국 공휴일
exports.events = handle(async (req, res) => {
    const { timeMin, timeMax } = req.query;
    const min = Date.parse(timeMin);
    const max = Date.parse(timeMax);
    if (Number.isNaN(min) || Number.isNaN(max) || max < min || (max - min) / DAY_MS > MAX_RANGE_DAYS) {
        return fail(res, 400, 'Invalid range');
    }

    const list = calendarId => calendar().events.list({ calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime' });
    const [user, holiday, me] = await Promise.all([
        list(process.env.GOOGLE_CALENDAR_ID),
        list(HOLIDAY_CALENDAR_ID),
        Admin.findByUserId(req.userCpId, req.userId),
    ]);
    const events = user.data.items ?? [];
    const leaves = await leaveEventIds(events.map(e => e.id));

    // 만든 사람 이름 (같은 회사 직원만)
    const creators = [...new Set(events.map(creatorOf).filter(Boolean))];
    const [nameRows] = creators.length
        ? await pool.query('SELECT mb_no, user_name FROM lk_user WHERE cp_id = ? AND mb_no IN (?)', [req.userCpId, creators])
        : [[]];
    const names = new Map(nameRows.map(r => [r.mb_no, r.user_name]));
    const isAdmin = req.userRole === 'admin';

    const toItem = (event, kind) => {
        const allDay = !!event.start.date;
        const creator = creatorOf(event);
        // 기존 화면은 설명에 제목을, 근태 일정은 종류 코드(day 등)를 넣어 둠 → 보여주지 않음
        const description = kind === 'event' && event.description && event.description !== event.summary ? event.description : '';
        return {
            id: event.id,
            title: event.summary,
            start: event.start.date || event.start.dateTime,
            end: event.end.date || event.end.dateTime,
            allDay,
            className: kind === 'holiday' ? 'holiday-event' : 'user-event',
            kind,
            canEdit: kind === 'event' && (isAdmin || (creator !== null && creator === me?.mb_no)),
            creatorName: (creator && names.get(creator)) || null,
            description,
            // 하루 종일: Google 끝 날짜는 미포함 → 화면용 끝 날짜(포함). 시작=끝으로 저장된 옛 일정은 그대로
            ...(allDay && {
                startDate: event.start.date,
                endDate: event.end.date > event.start.date ? addDays(event.end.date, -1) : event.start.date,
            }),
        };
    };

    res.status(200).json([
        ...events.map(e => toItem(e, leaves.has(e.id) ? 'leave' : 'event')),
        ...(holiday.data.items ?? []).map(e => toItem(e, 'holiday')),
    ]);
});

exports.insert = handle(async (req, res) => {
    const input = validateEvent(req.body);
    if (input.error) return fail(res, 400, input.error);
    const me = await Admin.findByUserId(req.userCpId, req.userId);

    const created = await calendar().events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: { ...input.value, extendedProperties: { private: { hibyeCreator: String(me.mb_no) } } },
    });
    res.status(201).json({ eventId: created.data.id });
});

// 수정·삭제 전 권한 확인 — Google에서 다시 읽어 판단 (요청 바디의 정보는 신뢰하지 않음)
async function loadEditable(req, res) {
    const { id } = req.body;
    if (!id || typeof id !== 'string') return fail(res, 404, 'Event not found') && null;

    let event;
    try {
        ({ data: event } = await calendar().events.get({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId: id }));
    } catch (error) {
        if (error.code === 404 || error.code === 410) return fail(res, 404, 'Event not found') && null;
        throw error;
    }
    if ((await leaveEventIds([id])).size) return fail(res, 403, 'Leave event') && null;

    const me = await Admin.findByUserId(req.userCpId, req.userId);
    const creator = creatorOf(event);
    if (req.userRole !== 'admin' && !(creator !== null && creator === me?.mb_no)) return fail(res, 403, 'Not allowed') && null;
    return event;
}

// 하루 종일(date) ↔ 시간(dateTime) 전환 시 반대쪽 칸을 null로 비움 — patch가 하위 칸을 합쳐 둘 다 남지 않게
const clearOther = t => (t.date ? { date: t.date, dateTime: null } : { date: null, ...t });

exports.update = handle(async (req, res) => {
    const input = validateEvent(req.body);
    if (input.error) return fail(res, 400, input.error);
    const event = await loadEditable(req, res);
    if (!event) return;

    // 부분 수정(patch) — 보낸 칸만 바뀜. 만든 사람 정보와 Google에서 직접 넣은 위치·참석자 등은 그대로 유지
    // (events.update는 전체 교체라 보내지 않은 칸이 지워짐)
    const updated = await calendar().events.patch({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId: event.id,
        resource: { ...input.value, start: clearOther(input.value.start), end: clearOther(input.value.end) },
    });
    res.status(200).json({ updatedEvent: updated.data });
});

exports.delete = handle(async (req, res) => {
    const event = await loadEditable(req, res);
    if (!event) return;
    await calendar().events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId: event.id });
    res.status(200).json({ message: 'Event deleted successfully' });
});

// 일정(회사 Google 캘린더) 점검: node scripts/checkCalendar.js  (Google·DB 가짜)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { validateEvent } = require('../src/utils/eventValidation');

const KST = 'Asia/Seoul';

(async () => {
    // ── 입력 검증·Google 저장 형태 ──
    // 하루 종일(새 형식): 끝 날짜 포함 → Google은 끝 미포함이라 +1
    assert.deepStrictEqual(validateEvent({ summary: ' 워크숍 ', allDay: true, startDate: '2026-11-05', endDate: '2026-11-06', description: '메모' }), {
        value: { summary: '워크숍', description: '메모', start: { date: '2026-11-05' }, end: { date: '2026-11-07' } },
    });
    // 기존 react-app 형식 { start: { date }, end: { date } } — 끝 포함으로 해석
    assert.deepStrictEqual(validateEvent({ summary: '회의', start: { date: '2026-11-05' }, end: { date: '2026-11-05' } }), {
        value: { summary: '회의', description: '', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } },
    });
    // 기존 react-app 수정: FullCalendar의 끝 날짜(미포함)를 그대로 보냄 → 그대로 저장 (+1 하면 수정할 때마다 하루씩 늘어남)
    assert.deepStrictEqual(validateEvent({ summary: '회의', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } }).value.end, { date: '2026-11-06' });
    assert.deepStrictEqual(validateEvent({ summary: '회의', start: { date: '2026-11-05' }, end: { date: '2026-11-08' } }).value.end, { date: '2026-11-08' });
    // 시간 지정: KST
    assert.deepStrictEqual(validateEvent({ summary: '주간회의', allDay: false, startDateTime: '2026-11-05T10:00', endDateTime: '2026-11-05T11:30' }), {
        value: {
            summary: '주간회의',
            description: '',
            start: { dateTime: '2026-11-05T10:00:00', timeZone: KST },
            end: { dateTime: '2026-11-05T11:30:00', timeZone: KST },
        },
    });
    // 월말·연말 넘김
    assert.deepStrictEqual(validateEvent({ summary: 'x', allDay: true, startDate: '2026-12-31', endDate: '2026-12-31' }).value.end, { date: '2027-01-01' });

    const bad = [
        [{ summary: '' }, 'Invalid summary'],
        [{ summary: '   ' }, 'Invalid summary'],
        [{ summary: 'a'.repeat(101) }, 'Invalid summary'],
        [{ description: 'a'.repeat(501) }, 'Invalid description'],
        [{ description: 3 }, 'Invalid description'],
        [{ startDate: '2026-02-30' }, 'Invalid date'],
        [{ endDate: '2026-11-04' }, 'Invalid date'], // 끝 < 시작
        [{ endDate: '2026-12-06' }, 'Invalid date'], // 31일 초과
        [{ startDate: '2026-11-05T00:00:00.000Z' }, 'Invalid date'], // ISO 시각은 받지 않음
        [{ allDay: false, startDateTime: '2026-11-05T11:00', endDateTime: '2026-11-05T11:00' }, 'Invalid date'], // 시작 = 끝
        [{ allDay: false, startDateTime: '2026-11-05T25:00', endDateTime: '2026-11-05T26:00' }, 'Invalid date'],
        [{ allDay: false, startDateTime: '2026-11-05 10:00', endDateTime: '2026-11-05T11:00' }, 'Invalid date'],
        [{ allDay: false, startDateTime: '2026-11-01T10:00', endDateTime: '2026-12-05T10:00' }, 'Invalid date'],
    ];
    const base = { summary: '일정', allDay: true, startDate: '2026-11-05', endDate: '2026-11-05' };
    for (const [patch, error] of bad) {
        assert.deepStrictEqual(validateEvent({ ...base, ...patch }), { error }, JSON.stringify(patch));
    }
    assert.deepStrictEqual(validateEvent({ summary: 'x', start: { date: '2026-11-05' } }), { error: 'Invalid date' }, '기존 형식 끝 없음');


    // ── API (Google 캘린더·DB 가짜) ──
    const { google } = require('googleapis');
    const pool = require('../src/config/dbPromise');
    const Admin = require('../src/models/adminModel');
    let calls, store, leaveCalendarIds;
    google.calendar = () => ({
        events: {
            list: async ({ calendarId }) => (calls.push(['list', calendarId]), { data: { items: calendarId.includes('holiday') ? store.holidays : store.events } }),
            get: async ({ eventId }) => {
                calls.push(['get', eventId]);
                const e = store.events.find(x => x.id === eventId);
                if (!e) throw Object.assign(new Error('Not Found'), { code: 404 });
                return { data: e };
            },
            insert: async ({ resource }) => (calls.push(['insert', resource]), { data: { id: 'new-1' } }),
            update: async ({ eventId, resource }) => (calls.push(['replace', eventId, resource]), { data: { id: eventId } }),
            patch: async ({ eventId, resource }) => (calls.push(['update', eventId, resource]), { data: { id: eventId } }),
            delete: async ({ eventId }) => calls.push(['delete', eventId]),
        },
    });
    pool.query = async (sql, params) => {
        if (/FROM lk_vacation/.test(sql)) return [params[0].filter(id => leaveCalendarIds.includes(id)).map(calendar_id => ({ calendar_id }))];
        if (/FROM lk_user/.test(sql)) return [[{ mb_no: 3, user_name: '김직원' }, { mb_no: 1, user_name: '관리자' }].filter(u => params[1].includes(u.mb_no))];
        return [[]];
    };
    const people = { 'me@x': { mb_no: 3, user_name: '김직원' }, 'admin@x': { mb_no: 1, user_name: '관리자' }, 'other@x': { mb_no: 4, user_name: '박직원' } };
    Admin.findByUserId = async (cpId, userId) => people[userId];

    const cal = require('../src/controllers/calendarController');
    const call = async (fn, req) => {
        const res = { code: 200 };
        res.status = c => ((res.code = c), res);
        res.json = b => ((res.body = b), res);
        await fn({ userId: 'me@x', userCpId: 1, userRole: 'member', query: {}, body: {}, ...req }, res);
        return res;
    };
    const mine = { id: 'e1', summary: '회의', description: '안건', start: { date: '2026-11-05' }, end: { date: '2026-11-07' }, extendedProperties: { private: { hibyeCreator: '3' } } };
    const legacy = { id: 'e2', summary: '옛 일정', description: '옛 일정', start: { date: '2026-11-10' }, end: { date: '2026-11-10' } };
    const leaveEvent = { id: 'e3', summary: '[김직원] 연차', description: 'day', start: { date: '2026-11-12' }, end: { date: '2026-11-12' } };
    const timed = { id: 'e4', summary: '주간회의', start: { dateTime: '2026-11-09T10:00:00+09:00' }, end: { dateTime: '2026-11-09T11:00:00+09:00' }, extendedProperties: { private: { hibyeCreator: '1' } } };
    const reset = () => {
        calls = [];
        store = { events: [mine, legacy, leaveEvent, timed], holidays: [{ id: 'h1', summary: '개천절', start: { date: '2026-10-03' }, end: { date: '2026-10-04' } }] };
        leaveCalendarIds = ['e3'];
    };
    const range = { timeMin: '2026-10-26T00:00:00+09:00', timeMax: '2026-12-07T00:00:00+09:00' };

    // 조회: 기존 필드 + kind·canEdit·만든 사람·끝 날짜(포함)
    reset();
    let res = await call(cal.events, { query: range });
    const byId = Object.fromEntries(res.body.map(e => [e.id, e]));
    assert.deepStrictEqual(byId.e1, {
        id: 'e1',
        title: '회의',
        start: '2026-11-05',
        end: '2026-11-07',
        allDay: true,
        className: 'user-event',
        kind: 'event',
        canEdit: true,
        creatorName: '김직원',
        description: '안건',
        startDate: '2026-11-05',
        endDate: '2026-11-06',
    });
    assert.deepStrictEqual([byId.e2.kind, byId.e2.canEdit, byId.e2.creatorName, byId.e2.description, byId.e2.endDate], ['event', false, null, '', '2026-11-10']);
    assert.deepStrictEqual([byId.e3.kind, byId.e3.canEdit, byId.e3.description], ['leave', false, ''], '근태 일정은 보기만, 종류 코드 노출 안 함');
    assert.deepStrictEqual([byId.e4.kind, byId.e4.canEdit, byId.e4.allDay, byId.e4.creatorName], ['event', false, false, '관리자']);
    assert.deepStrictEqual([byId.h1.kind, byId.h1.canEdit, byId.h1.className], ['holiday', false, 'holiday-event']);
    // 관리자는 기존(만든 사람 없음) 일정도 수정 가능, 근태 일정은 불가
    res = await call(cal.events, { query: range, userId: 'admin@x', userRole: 'admin' });
    assert.deepStrictEqual(Object.fromEntries(res.body.map(e => [e.id, e.canEdit])), { e1: true, e2: true, e3: false, e4: true, h1: false });
    // 범위: 62일 이하, 올바른 시각
    const badRanges = [
        {},
        { timeMin: 'x', timeMax: 'y' },
        { timeMin: '2026-12-01T00:00:00Z', timeMax: '2026-11-01T00:00:00Z' },
        { timeMin: '2026-01-01T00:00:00Z', timeMax: '2026-06-01T00:00:00Z' },
    ];
    for (const query of badRanges) {
        res = await call(cal.events, { query });
        assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid range'], JSON.stringify(query));
    }

    // 추가: 누구나, 만든 사람 기록, 검증
    reset();
    res = await call(cal.insert, { body: { summary: '점심', allDay: true, startDate: '2026-11-20', endDate: '2026-11-20' } });
    assert.deepStrictEqual([res.code, res.body], [201, { eventId: 'new-1' }]);
    assert.deepStrictEqual(calls[0][1], {
        summary: '점심',
        description: '',
        start: { date: '2026-11-20' },
        end: { date: '2026-11-21' },
        extendedProperties: { private: { hibyeCreator: '3' } },
    });
    res = await call(cal.insert, { body: { summary: '' } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid summary']);

    // 수정·삭제 권한
    const body = { summary: '회의(변경)', allDay: true, startDate: '2026-11-05', endDate: '2026-11-05' };
    const cases = [
        ['본인 일정', 'me@x', 'member', 'e1', 200],
        ['남의 일정', 'other@x', 'member', 'e1', 403, 'Not allowed'],
        ['만든 사람 없는 기존 일정(직원)', 'me@x', 'member', 'e2', 403, 'Not allowed'],
        ['만든 사람 없는 기존 일정(관리자)', 'admin@x', 'admin', 'e2', 200],
        ['남의 일정(관리자)', 'admin@x', 'admin', 'e1', 200],
        ['근태 일정(관리자도)', 'admin@x', 'admin', 'e3', 403, 'Leave event'],
        ['없는 일정', 'me@x', 'member', 'nope', 404, 'Event not found'],
    ];
    for (const fn of ['update', 'delete']) {
        for (const [name, userId, userRole, id, code, error] of cases) {
            reset();
            res = await call(cal[fn], { userId, userRole, body: { ...body, id } });
            assert.strictEqual(res.code, code, `${fn} ${name}`);
            if (error) assert.strictEqual(res.body.error, error, `${fn} ${name}`);
            assert.strictEqual(calls.some(c => c[0] === fn), code === 200, `${fn} ${name}: 실제 반영 여부`);
        }
    }
    // 수정은 만든 사람 정보 유지 (관리자가 고쳐도 원래 만든 사람)
    reset();
    await call(cal.update, { userId: 'admin@x', userRole: 'admin', body: { ...body, id: 'e1' } });
    // 부분 수정(patch) — 보낸 칸만 바뀌고 만든 사람·위치·참석자 등 다른 칸은 Google이 유지 (전체 교체 update 금지)
    assert.ok(!calls.some(c => c[0] === 'replace'), 'events.update(전체 교체) 사용 금지');
    const updated = calls.find(c => c[0] === 'update');
    assert.deepStrictEqual(Object.keys(updated[2]).sort(), ['description', 'end', 'start', 'summary']);
    assert.deepStrictEqual(updated[2].end, { date: '2026-11-06', dateTime: null });
    // 하루 종일 ↔ 시간 지정 전환 시 반대쪽 칸을 비움 (patch는 하위 칸을 합칠 수 있어 date·dateTime이 함께 남지 않게)
    reset();
    await call(cal.update, { body: { id: 'e1', summary: '회의', allDay: false, startDateTime: '2026-11-05T10:00', endDateTime: '2026-11-05T11:00' } });
    assert.deepStrictEqual(calls.find(c => c[0] === 'update')[2].start, { date: null, dateTime: '2026-11-05T10:00:00', timeZone: 'Asia/Seoul' });
    // 수정 검증 실패는 Google 호출 전
    reset();
    res = await call(cal.update, { body: { id: 'e1', summary: '' } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid summary']);
    assert.ok(!calls.some(c => c[0] === 'update'));

    console.log('checkCalendar ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkCalendar 실패 ❌', err.message);
    process.exit(1);
});

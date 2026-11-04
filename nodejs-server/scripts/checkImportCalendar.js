// 예전 업무 일정 → Google 캘린더 이전 스크립트 점검: node scripts/checkImportCalendar.js  (calendar 가짜 — Google 호출 없음)
const assert = require('assert');
const { run } = require('./importLegacyCalendar');

const ev = (id, extra = {}) => ({
    summary: `테스트 일정${id}`,
    description: '(예전 업무 일정에서 이전)',
    start: { date: '2019-05-01' },
    end: { date: '2019-05-02' },
    extendedProperties: { private: { hibyeLegacyId: `calendar:${id}` } },
    ...extra,
});

let lists;
let inserts;
const makeCalendar = (existing, failInsert = new Set()) => ({
    events: {
        list: async params => {
            lists.push(params);
            const id = params.privateExtendedProperty.split('=')[1];
            return { data: { items: existing.has(id) ? [{ id: 'x' }] : [] } };
        },
        insert: async params => {
            const id = params.resource.extendedProperties.private.hibyeLegacyId;
            if (failInsert.has(id)) throw Object.assign(new Error('가짜 실패 테스트 일정'), { code: 500 });
            inserts.push(params);
            existing.add(id);
            return { data: { id: 'new' } };
        },
    },
});
const out = [];
const log = (...a) => out.push(a.join(' '));

(async () => {
    const existing = new Set(['calendar:1']);
    const calendar = makeCalendar(existing, new Set(['calendar:3']));
    const events = [ev(1), ev(2, { colorId: '5', attendees: [{ email: 'x@example.com' }] }), ev(3)];

    // dry-run: 조회만, 추가 없음
    lists = [];
    inserts = [];
    assert.deepStrictEqual(await run({ calendar, calendarId: 'cal-1', events, dryRun: true, log }), { added: 0, toAdd: 2, skipped: 1, failed: 0 });
    assert.strictEqual(inserts.length, 0);
    assert.deepStrictEqual(lists[0], { calendarId: 'cal-1', privateExtendedProperty: 'hibyeLegacyId=calendar:1', maxResults: 1 });

    // 실제: 있으면 건너뜀, 없으면 추가, 실패는 세고 계속
    lists = [];
    assert.deepStrictEqual(await run({ calendar, calendarId: 'cal-1', events, dryRun: false, log }), { added: 1, toAdd: 0, skipped: 1, failed: 1 });
    assert.strictEqual(inserts.length, 1);
    // 넣는 칸은 정해진 것만 (JSON의 다른 칸은 버림)
    assert.deepStrictEqual(inserts[0], { calendarId: 'cal-1', resource: { ...ev(2) } });

    // 실패 원인은 코드 건수만 출력
    assert.strictEqual(out.at(-1), '실패 원인: 500×1');

    // 실패 원인: HTTP 상태·코드별 건수, 이상한 코드는 UNKNOWN
    const errs = [Object.assign(new Error('x'), { response: { status: 404 } }), Object.assign(new Error('x'), { code: 404 }), Object.assign(new Error('x'), { code: 403 }), Object.assign(new Error('x'), { code: '테스트 일정 내용' }), new Error('x')];
    const failing = { events: { list: async () => Promise.reject(errs.shift()) } };
    out.length = 0;
    assert.strictEqual((await run({ calendar: failing, calendarId: 'cal-1', events: [ev(11), ev(12), ev(13), ev(14), ev(15)], log })).failed, 5);
    assert.strictEqual(out.at(-1), '실패 원인: 404×2, 403×1, UNKNOWN×2');

    // 다시 실행 — 중복 없음(3은 실패했으므로 다시 시도)
    inserts = [];
    assert.deepStrictEqual(await run({ calendar: makeCalendar(existing), calendarId: 'cal-1', events, dryRun: false, log }), { added: 1, toAdd: 0, skipped: 2, failed: 0 });
    assert.deepStrictEqual(inserts.map(i => i.resource.extendedProperties.private.hibyeLegacyId), ['calendar:3']);

    // 모양 오류·캘린더 ID 없음 → Google 호출 전에 멈춤
    for (const bad of [[ev(1, { extendedProperties: {} })], [ev(1, { summary: ' ' })], [ev(1), ev(1)], [ev(1, { start: 'x' })], 'x']) {
        lists = [];
        await assert.rejects(run({ calendar, calendarId: 'cal-1', events: bad, dryRun: true, log }), e => e.code === 'BAD_JSON');
        assert.strictEqual(lists.length, 0);
    }
    await assert.rejects(run({ calendar, calendarId: '', events, dryRun: true, log }), e => e.code === 'NO_CALENDAR');

    // 출력: 건수만 (제목 없음)
    assert.ok(out.length > 0 && out.every(l => !l.includes('테스트 일정')));
    console.log('checkImportCalendar 통과');
})().catch(e => {
    console.error(e);
    process.exit(1);
});

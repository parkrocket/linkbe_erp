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

    if (process.argv[2] !== 'api') {
        console.log('checkCalendar(검증) ✅');
        process.exit(0);
    }
})().catch(err => {
    console.error('checkCalendar 실패 ❌', err.message);
    process.exit(1);
});

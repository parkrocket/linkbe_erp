// 예전 업무 일정 → 회사 Google 캘린더 이전 (서버에서 1회 실행 — 여러 번 실행해도 중복 없음)
// 실행: cd nodejs-server && NODE_ENV=production node scripts/importLegacyCalendar.js <calendar-import.json> [--dry-run]
// - 일정마다 private 속성 hibyeLegacyId('calendar:{예전 번호}')로 찾아 있으면 건너뜀, 없으면 추가 (--dry-run은 조회만)
// - 만든 사람(hibyeCreator) 없음 → 수정·삭제는 관리자만 (calendarController 규칙)
// - 출력은 건수만
const fs = require('fs');
const path = require('path');

const fail = (code, hint) => Object.assign(new Error(hint), { code, hint });
const isWhen = v => v && typeof v === 'object' && (typeof v.date === 'string' || typeof v.dateTime === 'string');

// 넣을 칸만 골라냄 — JSON에 다른 칸(참석자 등)이 있어도 버림
function pick(e) {
    const legacyId = e?.extendedProperties?.private?.hibyeLegacyId;
    if (typeof legacyId !== 'string' || !/^calendar:\d+$/.test(legacyId)) return null;
    if (typeof e.summary !== 'string' || !e.summary.trim() || typeof e.description !== 'string' || !isWhen(e.start) || !isWhen(e.end)) return null;
    return { summary: e.summary, description: e.description, start: e.start, end: e.end, extendedProperties: { private: { hibyeLegacyId: legacyId } } };
}

async function run({ calendar, calendarId, events, dryRun = false, log = console.log }) {
    if (!calendarId) throw fail('NO_CALENDAR', 'GOOGLE_CALENDAR_ID 없음');
    if (!Array.isArray(events)) throw fail('BAD_JSON', 'events 배열 없음');
    const ids = new Set();
    const resources = events.map((e, i) => {
        const r = pick(e);
        if (!r || ids.has(r.extendedProperties.private.hibyeLegacyId)) throw fail('BAD_JSON', `${i + 1}번째 일정 모양 오류`);
        ids.add(r.extendedProperties.private.hibyeLegacyId);
        return r;
    });

    const counts = { added: 0, toAdd: 0, skipped: 0, failed: 0 };
    for (const resource of resources) {
        try {
            const { data } = await calendar.events.list({ calendarId, privateExtendedProperty: `hibyeLegacyId=${resource.extendedProperties.private.hibyeLegacyId}`, maxResults: 1 });
            if (data.items?.length) counts.skipped++;
            else if (dryRun) counts.toAdd++;
            else {
                await calendar.events.insert({ calendarId, resource });
                counts.added++;
            }
        } catch {
            counts.failed++; // 오류 내용은 출력하지 않음 — 다시 실행하면 빠진 것만 추가
        }
    }
    log(dryRun ? `[dry-run] 추가 예정 ${counts.toAdd} · 이미 있음 ${counts.skipped} · 실패 ${counts.failed}` : `일정 추가 ${counts.added} · 이미 있음 ${counts.skipped} · 실패 ${counts.failed}`);
    return counts;
}

module.exports = { run };

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const [jsonPath] = args.filter(a => a !== '--dry-run');
    if (!jsonPath) {
        console.error('사용법: node scripts/importLegacyCalendar.js <calendar-import.json> [--dry-run]');
        process.exit(1);
    }
    require('dotenv').config({ path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });
    // calendarController와 같은 서비스 계정 연결
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(process.env.GOOGLE_CLIENT_EMAIL, null, (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'), ['https://www.googleapis.com/auth/calendar']);
    let events;
    try {
        ({ events } = JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
    } catch {
        console.error('실패: BAD_JSON — 파일을 읽거나 해석할 수 없음');
        process.exit(1);
    }
    run({ calendar: google.calendar({ version: 'v3', auth }), calendarId: process.env.GOOGLE_CALENDAR_ID, events, dryRun })
        .then(counts => process.exit(counts.failed ? 1 : 0))
        .catch(error => {
            console.error(`실패: ${error.code ?? 'UNKNOWN'}${error.hint ? ` — ${error.hint}` : ''}`);
            process.exit(1);
        });
}

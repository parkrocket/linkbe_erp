// 공휴일(특일정보 API → lk_holiday) 점검: node scripts/checkHolidayModel.js  (API·DB·Slack 가짜 — 실제 호출 없음)
const assert = require('assert');
const path = require('path');
const axios = require('axios');
const pool = require('../src/config/dbPromise');

// Slack은 가짜 (require.cache 교체 — 직접 대입은 무시됨)
const sent = [];
const slackPath = path.resolve(__dirname, '../src/utils/slack.js');
require.cache[slackPath] = { id: slackPath, filename: slackPath, loaded: true, exports: { sendSlackMessage: async (ch, text) => sent.push([ch, text]) } };

// ── 가짜 API: 연도별 응답, 받은 요청 기록 ──
const ok = item => ({ response: { header: { resultCode: '00' }, body: { items: item === undefined ? '' : { item } } } });
const row = (locdate, dateName, isHoliday = 'Y') => ({ dateKind: '01', dateName, isHoliday, locdate, seq: 1 });
let requests, responses;
axios.get = async (url, options) => {
    requests.push({ url, ...options });
    const data = responses[options.params.solYear];
    if (data instanceof Error) throw data;
    return { data };
};

// ── 가짜 DB ──
let queries, state, failOn;
pool.getConnection = async () => ({
    beginTransaction: async () => (state += 'B'),
    commit: async () => (state += 'C'),
    rollback: async () => (state += 'R'),
    release: () => (state += 'L'),
    query: async (sql, params) => {
        if (failOn && failOn.test(sql)) throw new Error('db down');
        queries.push({ sql, params });
        return [{ affectedRows: 1 }];
    },
});
pool.query = async (sql, params) => (queries.push({ sql, params }), [[{ date: '2026-10-03', name: '개천절' }]]);

const reset = byYear => {
    requests = [];
    responses = byYear;
    queries = [];
    state = '';
    failOn = null;
    sent.length = 0;
};

process.env.HOLIDAY_API_KEY = 'abc+/=';
const Holiday = require('../src/models/holidayModel');

(async () => {
    // 받기: 공휴일(Y)만, 날짜 형식 변환·정렬, 같은 날 겹치면 이름 합침
    reset({
        2026: ok([
            row(20260525, '대체공휴일(부처님오신날)'),
            row(20260101, '1월1일'),
            row(20260505, '어린이날'),
            row(20260505, '부처님오신날'),
            row(20260405, '식목일', 'N'),
        ]),
    });
    assert.deepStrictEqual(await Holiday.fetchYear(2026), [
        { date: '2026-01-01', name: '1월1일' },
        { date: '2026-05-05', name: '어린이날, 부처님오신날' },
        { date: '2026-05-25', name: '대체공휴일(부처님오신날)' },
    ]);
    assert.ok(requests[0].url.startsWith('https://apis.data.go.kr/') && requests[0].url.endsWith('/getRestDeInfo'));
    assert.deepStrictEqual(requests[0].params, { ServiceKey: 'abc+/=', solYear: 2026, numOfRows: 100, _type: 'json' });
    assert.ok(requests[0].timeout > 0, '응답 없는 API에 매달리지 않음');

    // 인코딩된 키(%2B 등)는 풀어서 보냄 — axios가 다시 인코딩하므로 이중 인코딩 방지
    process.env.HOLIDAY_API_KEY = 'abc%2B%2F%3D';
    reset({ 2026: ok(row(20260101, '1월1일')) });
    // 1건이면 배열이 아니라 객체로 옴
    assert.deepStrictEqual(await Holiday.fetchYear(2026), [{ date: '2026-01-01', name: '1월1일' }]);
    assert.strictEqual(requests[0].params.ServiceKey, 'abc+/=');
    // 0건이면 items가 빈 문자열
    reset({ 2027: ok() });
    assert.deepStrictEqual(await Holiday.fetchYear(2027), []);

    // 실패로 처리: 키 오류(XML 문자열), 오류 코드, 이상한 날짜·다른 해 날짜, 키 없음
    const bad = [
        '<OpenAPI_ServiceResponse><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></OpenAPI_ServiceResponse>',
        { response: { header: { resultCode: '99' }, body: { items: '' } } },
        ok([row('2026-01-01', '1월1일')]),
        ok([row(20250101, '1월1일')]),
        ok([row(20260101, '')]),
        new Error('timeout'),
    ];
    for (const data of bad) {
        reset({ 2026: data });
        await assert.rejects(Holiday.fetchYear(2026), undefined, JSON.stringify(data));
    }
    delete process.env.HOLIDAY_API_KEY;
    reset({ 2026: ok(row(20260101, '1월1일')) });
    await assert.rejects(Holiday.fetchYear(2026), /HOLIDAY_API_KEY missing/);
    assert.strictEqual(requests.length, 0, '키 없으면 호출하지 않음');
    process.env.HOLIDAY_API_KEY = 'key';

    // 저장: 그 해만 지우고 다시 넣기, 한 트랜잭션
    reset({ 2026: ok([row(20260101, '1월1일'), row(20261003, '개천절')]) });
    assert.strictEqual(await Holiday.sync(2026), 2);
    assert.ok(/DELETE FROM lk_holiday WHERE holiday_date BETWEEN \? AND \?/.test(queries[0].sql));
    assert.deepStrictEqual(queries[0].params, ['2026-01-01', '2026-12-31']);
    assert.ok(/INSERT INTO lk_holiday/.test(queries[1].sql));
    assert.deepStrictEqual(queries[1].params, [[['2026-01-01', '1월1일'], ['2026-10-03', '개천절']]]);
    assert.strictEqual(state, 'BCL');

    // 0건·API 실패 → 기존 데이터에 손대지 않음
    reset({ 2026: ok() });
    assert.strictEqual(await Holiday.sync(2026), 0);
    assert.deepStrictEqual([queries, state], [[], '']);
    reset({ 2026: new Error('timeout') });
    await assert.rejects(Holiday.sync(2026));
    assert.deepStrictEqual([queries, state], [[], '']);
    // 넣다가 실패 → 되돌림(지운 것도 복구)
    reset({ 2026: ok(row(20260101, '1월1일')) });
    failOn = /INSERT INTO lk_holiday/;
    await assert.rejects(Holiday.sync(2026), /db down/);
    assert.strictEqual(state, 'BRL');

    // 조회: 기간(양 끝 포함), 날짜는 문자열
    reset({});
    assert.deepStrictEqual(await Holiday.list('2026-10-01', '2026-10-31'), [{ date: '2026-10-03', name: '개천절' }]);
    assert.ok(/DATE_FORMAT\(holiday_date, '%Y-%m-%d'\) AS date/.test(queries[0].sql) && /BETWEEN \? AND \?/.test(queries[0].sql));
    assert.deepStrictEqual(queries[0].params, ['2026-10-01', '2026-10-31']);

    // ── 매일 갱신 (holidayCron) — 불러올 때 1회 실행되므로 가짜를 먼저 준비 ──
    reset({ 2026: ok(row(20260101, '1월1일')), 2027: ok() });
    const { syncHolidays } = require('../src/controllers/holidayCron');
    await new Promise(resolve => setTimeout(resolve, 20));

    // 올해 + 내년, 내년 0건은 정상(알림 없음)
    reset({ 2026: ok([row(20260101, '1월1일'), row(20261003, '개천절')]), 2027: ok() });
    assert.deepStrictEqual(await syncHolidays('2026-11-12'), { 2026: 2, 2027: 0 });
    assert.deepStrictEqual(requests.map(r => r.params.solYear), [2026, 2027]);
    assert.deepStrictEqual(sent, []);
    // 내년 실패도 올해 결과는 유지, 알림 없음
    reset({ 2026: ok(row(20260101, '1월1일')), 2027: new Error('timeout') });
    assert.deepStrictEqual(await syncHolidays('2026-11-12'), { 2026: 1, 2027: 0 });
    assert.deepStrictEqual(sent, []);
    // 올해 실패·0건 → 기존 데이터 유지 + #hibye-관리 알림 (서버는 안 죽음)
    for (const data of [new Error('timeout'), ok()]) {
        reset({ 2026: data, 2027: ok() });
        assert.strictEqual(await syncHolidays('2026-11-12'), null);
        assert.deepStrictEqual(queries, []);
        assert.ok(sent.length === 1 && sent[0][0] === '#hibye-관리' && /공휴일 갱신/.test(sent[0][1]));
    }

    // ── API (holidayController) ──
    const { list } = require('../src/controllers/holidayController');
    const call = async query => {
        const res = { code: 200 };
        res.status = c => ((res.code = c), res);
        res.json = b => ((res.body = b), res);
        await list({ query }, res);
        return res;
    };
    reset({});
    let res = await call({ from: '2026-01-01', to: '2026-12-31' });
    assert.deepStrictEqual([res.code, res.body], [200, { holidays: [{ date: '2026-10-03', name: '개천절' }] }]);
    for (const query of [{}, { from: 'x', to: 'y' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-12-01', to: '2026-11-01' }, { from: '2026-01-01', to: '2027-06-01' }]) {
        reset({});
        res = await call(query);
        assert.deepStrictEqual([res.code, res.body.error, queries.length], [400, 'Invalid range', 0], JSON.stringify(query));
    }

    console.log('checkHolidayModel ✅');
    process.exit(0);
})().catch(error => {
    console.error('checkHolidayModel 실패 ❌', error);
    process.exit(1);
});

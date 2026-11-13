// 계약 관리 API·모델 점검: node scripts/checkSiteContract.js  (pool 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');

const calls = [];
let answers = []; // [정규식, 결과] — 맞는 첫 번째를 돌려줌
pool.query = async (sql, params) => {
    calls.push({ sql, params });
    const hit = answers.find(([re]) => re.test(sql));
    if (!hit) throw new Error('boom');
    return hit[1];
};
const ctrl = require('../src/controllers/workSiteContractController');

const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 3, userId: 'a@x.kr', ...req }, res);
    return res;
};
const body = { code: 'zz_a', companyName: ' 가나다 ', siteUrl: 'https://a.kr', startDate: '2026-01-01', endDate: '2026-12-31', status: 'run', email: '', memo: '메모\n', updatedAt: 'u' };
const expect = (res, code, error) => assert.deepStrictEqual([res.code, res.body.error], [code, error]);
const last = () => calls[calls.length - 1];

(async () => {
    // 검사: 이름 필수·trim, 날짜는 비워도 됨, 종료일 < 시작일 거절, 상태는 run·stop만
    assert.strictEqual(ctrl.validate(body).value.companyName, '가나다');
    assert.deepStrictEqual([ctrl.validate({ ...body, startDate: '', endDate: null }).value.startDate, ctrl.validate({ ...body, endDate: null }).value.endDate], [null, null]);
    for (const [patch, error] of [
        [{ companyName: '  ' }, 'Invalid companyName'], [{ companyName: 'a'.repeat(201) }, 'Invalid companyName'], [{ code: 1 }, 'Invalid code'],
        [{ siteUrl: 'a'.repeat(256) }, 'Invalid siteUrl'], [{ email: 'a'.repeat(201) }, 'Invalid email'], [{ memo: 'a'.repeat(5001) }, 'Invalid memo'],
        [{ startDate: '2026-02-30' }, 'Invalid startDate'], [{ endDate: 'x' }, 'Invalid endDate'], [{ endDate: '2025-12-31' }, 'Invalid endDate'],
        [{ status: 'x' }, 'Invalid status'], [{ updatedAt: 1 }, 'Invalid updatedAt'],
    ]) assert.deepStrictEqual(ctrl.validate({ ...body, ...patch }), { error }, error);

    // 목록: 회사 범위, 칸 이름
    answers = [[/SELECT id, code/, [[{ id: 1, code: 'zz_a', company_name: '가나다', site_url: '', start_date: '2026-01-01', end_date: null, status: 'run', email: '', memo: '', updated_at: 'u' }]]]];
    let res = await call(ctrl.list, {});
    assert.deepStrictEqual(Object.keys(res.body.contracts[0]), ['id', 'code', 'companyName', 'siteUrl', 'startDate', 'endDate', 'status', 'email', 'memo', 'updatedAt']);
    assert.ok(/WHERE cp_id = \?/.test(last().sql));
    assert.deepStrictEqual(last().params, [3]);

    // 작성: cp_id는 로그인한 회사
    answers = [[/INSERT INTO wk_site_contract/, [{ insertId: 9 }]]];
    assert.deepStrictEqual((await call(ctrl.create, { body: { ...body, cpId: 99 } })).body, { id: 9 });
    assert.deepStrictEqual(last().params, [3, 'zz_a', '가나다', 'https://a.kr', '2026-01-01', '2026-12-31', 'run', '', '메모\n']);
    expect(await call(ctrl.create, { body: { ...body, status: 'x' } }), 400, 'Invalid status');

    // 수정: 회사·id·화면의 수정 시각이 모두 맞아야 저장
    answers = [[/UPDATE wk_site_contract/, [{ affectedRows: 1 }]]];
    assert.deepStrictEqual((await call(ctrl.update, { params: { id: '5' }, body })).body, { ok: true });
    assert.deepStrictEqual(last().params.slice(-3), [3, 5, 'u']);
    answers = [[/UPDATE wk_site_contract/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_site_contract/, [[{ id: 5 }]]]];
    expect(await call(ctrl.update, { params: { id: '5' }, body }), 409, 'Site contract changed');
    answers = [[/UPDATE wk_site_contract/, [{ affectedRows: 0 }]], [/SELECT id FROM wk_site_contract/, [[]]]];
    expect(await call(ctrl.update, { params: { id: '5' }, body }), 404, 'Not found');
    expect(await call(ctrl.update, { params: { id: 'x' }, body }), 404, 'Not found');
    expect(await call(ctrl.update, { params: { id: '5' }, body: { ...body, companyName: '' } }), 400, 'Invalid companyName');

    // 삭제: 회사 범위
    answers = [[/DELETE FROM wk_site_contract/, [{ affectedRows: 1 }]]];
    assert.deepStrictEqual((await call(ctrl.remove, { params: { id: '5' } })).body, { ok: true });
    assert.deepStrictEqual(last().params, [3, 5]);
    answers = [[/DELETE FROM wk_site_contract/, [{ affectedRows: 0 }]]];
    expect(await call(ctrl.remove, { params: { id: '5' } }), 404, 'Not found');
    expect(await call(ctrl.remove, { params: { id: '0' } }), 404, 'Not found');

    // DB 오류면 500
    answers = [];
    const origErr = console.error;
    console.error = () => {};
    expect(await call(ctrl.list, {}), 500, 'Database query error');
    console.error = origErr;

    // 업무 문서 권한 없이는 접근 불가(라우터에 requireWorkDoc 연결)
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/routes/work.js'), 'utf8');
    assert.ok(/router\.use\(\[[^\]]*'\/site-contracts'[^\]]*\], requireWorkDoc\)/.test(src));

    console.log('checkSiteContract OK');
    process.exit(0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});

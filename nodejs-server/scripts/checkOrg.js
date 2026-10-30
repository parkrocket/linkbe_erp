// 부서·직급 목록 API 점검: node scripts/checkOrg.js  (가짜 DB, 실행된 쿼리 기록)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../src/config/dbPromise');

// ── 가짜 DB: 회사 1 부서 [10 개발(1), 11 디자인(2), 12 영업(3)], 회사 2 부서 [20] ──
let rows;
let queries;
let members; // id → 소속 인원
const reset = () => {
    queries = [];
    members = { 10: 2 };
    rows = [
        { id: 10, cp_id: 1, name: '개발', sort_order: 1 },
        { id: 11, cp_id: 1, name: '디자인', sort_order: 2 },
        { id: 12, cp_id: 1, name: '영업', sort_order: 3 },
        { id: 20, cp_id: 2, name: '타사', sort_order: 1 },
    ];
};
const run = async (sql, params) => {
    queries.push({ sql, params });
    if (/^SELECT o\.id/.test(sql)) {
        return [rows.filter(r => r.cp_id === params[0]).map(r => ({ ...r, member_count: members[r.id] ?? 0 }))];
    }
    if (/^SELECT COUNT\(\*\) AS n FROM lk_user/.test(sql)) return [[{ n: members[params[1]] ?? 0 }]];
    if (/^SELECT id, sort_order/.test(sql)) return [rows.filter(r => r.cp_id === params[0]).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)];
    if (/^INSERT INTO/.test(sql)) {
        if (rows.some(r => r.cp_id === params[0] && r.name === params[1])) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        return [{ insertId: 99 }];
    }
    if (/^UPDATE \w+ SET name/.test(sql)) {
        if (rows.some(r => r.cp_id === params[2] && r.name === params[0] && r.id !== params[1])) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        return [{ affectedRows: rows.filter(r => r.id === params[1] && r.cp_id === params[2]).length }];
    }
    if (/^UPDATE \w+ SET sort_order/.test(sql)) {
        const row = rows.find(r => r.id === params[1] && r.cp_id === params[2]);
        if (row) row.sort_order = params[0];
        return [{ affectedRows: row ? 1 : 0 }];
    }
    if (/^DELETE FROM/.test(sql)) return [{ affectedRows: rows.filter(r => r.id === params[0] && r.cp_id === params[1]).length }];
    return [[]];
};
pool.query = run;
pool.getConnection = async () => ({
    beginTransaction: async () => queries.push('BEGIN'),
    commit: async () => queries.push('COMMIT'),
    rollback: async () => queries.push('ROLLBACK'),
    release: () => {},
    query: run,
});

const admin = require('../src/controllers/adminController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ userId: 'me@x', userCpId: 1, userRole: 'admin', params: {}, query: {}, body: {}, ...req }, res);
    return res;
};
const order = () => rows.filter(r => r.cp_id === 1).sort((a, b) => a.sort_order - b.sort_order).map(r => r.id);

(async () => {
    // 목록: 같은 회사, 소속 인원, 부서·직급 둘 다
    reset();
    let res = await call(admin.orgList, {});
    assert.deepStrictEqual(res.body.departments.map(d => [d.id, d.member_count]), [[10, 2], [11, 0], [12, 0]]);
    assert.ok(Array.isArray(res.body.positions));
    const listSql = queries.find(q => /lk_department/.test(q.sql)).sql;
    assert.ok(/u\.cp_id = o\.cp_id/.test(listSql) && /u\.dept_id = o\.id/.test(listSql), '같은 회사 직원만 셈');
    assert.ok(queries.some(q => /lk_position/.test(q.sql) && /u\.position_id = o\.id/.test(q.sql)));

    // kind는 고정 표만 (테이블명 주입 방지)
    for (const kind of ['lk_user', 'constructor', '__proto__', 'departments; DROP']) {
        res = await call(admin.orgCreate, { params: { kind }, body: { name: 'x' } });
        assert.deepStrictEqual([res.code, res.body.error], [404, 'Not found'], kind);
    }

    // 생성: trim, 1~50자, 중복 409, 맨 뒤 순서
    reset();
    for (const name of ['', '   ', 'a'.repeat(51), 3]) {
        res = await call(admin.orgCreate, { params: { kind: 'departments' }, body: { name } });
        assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid name'], String(name));
    }
    res = await call(admin.orgCreate, { params: { kind: 'departments' }, body: { name: ' 개발 ' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'Duplicate name']);
    res = await call(admin.orgCreate, { params: { kind: 'positions' }, body: { name: ' 대리 ' } });
    assert.deepStrictEqual(res.body, { ok: true, id: 99 });
    const insert = queries.find(q => /^INSERT INTO lk_position/.test(q.sql));
    assert.deepStrictEqual(insert.params, [1, '대리', 1]);
    assert.ok(/MAX\(sort_order\)/.test(insert.sql), '맨 뒤 순서');

    // 이름 변경: 같은 회사만, 중복 409
    reset();
    res = await call(admin.orgRename, { params: { kind: 'departments', id: '11' }, body: { name: '브랜드디자인' } });
    assert.deepStrictEqual(res.body, { ok: true });
    res = await call(admin.orgRename, { params: { kind: 'departments', id: '20' }, body: { name: 'x' } });
    assert.deepStrictEqual([res.code, res.body.error], [404, 'Not found'], '다른 회사');
    res = await call(admin.orgRename, { params: { kind: 'departments', id: 'abc' }, body: { name: 'x' } });
    assert.strictEqual(res.code, 404);
    res = await call(admin.orgRename, { params: { kind: 'departments', id: '11' }, body: { name: '개발' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'Duplicate name']);

    // 순서: 이웃과 교환, 끝이면 그대로, 다른 회사 404, 잘못된 방향 400
    reset();
    res = await call(admin.orgMove, { params: { kind: 'departments', id: '12' }, body: { direction: 'up' } });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.deepStrictEqual(order(), [10, 12, 11]);
    assert.ok(queries.includes('COMMIT') && queries.some(q => q.sql && /FOR UPDATE/.test(q.sql)));
    await call(admin.orgMove, { params: { kind: 'departments', id: '10' }, body: { direction: 'up' } });
    assert.deepStrictEqual(order(), [10, 12, 11], '맨 위는 그대로');
    res = await call(admin.orgMove, { params: { kind: 'departments', id: '20' }, body: { direction: 'down' } });
    assert.strictEqual(res.code, 404);
    res = await call(admin.orgMove, { params: { kind: 'departments', id: '10' }, body: { direction: 'left' } });
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid direction']);
    // 같은 순서값(예전 데이터)도 정상 교환 — 전체를 1부터 다시 매김
    reset();
    rows.forEach(r => (r.sort_order = 0));
    await call(admin.orgMove, { params: { kind: 'departments', id: '11' }, body: { direction: 'down' } });
    assert.deepStrictEqual(order(), [10, 12, 11]);

    // 삭제: 소속 직원 있으면 409, 없으면 삭제, 다른 회사 404
    reset();
    res = await call(admin.orgDelete, { params: { kind: 'departments', id: '10' } });
    assert.deepStrictEqual([res.code, res.body.error], [409, 'In use']);
    assert.ok(!queries.some(q => q.sql && /^DELETE/.test(q.sql)));
    const count = queries.find(q => q.sql && /COUNT\(\*\) AS n FROM lk_user/.test(q.sql));
    assert.ok(/cp_id = \?/.test(count.sql) && /dept_id = \?/.test(count.sql));
    res = await call(admin.orgDelete, { params: { kind: 'departments', id: '11' } });
    assert.deepStrictEqual(res.body, { ok: true });
    res = await call(admin.orgDelete, { params: { kind: 'departments', id: '20' } });
    assert.deepStrictEqual([res.code, res.body.error], [404, 'Not found']);

    console.log('checkOrg ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkOrg 실패 ❌', err.message);
    process.exit(1);
});

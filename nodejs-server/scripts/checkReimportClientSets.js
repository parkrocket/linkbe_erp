// 호스팅 세트 다시 넣기 스크립트 점검: node scripts/checkReimportClientSets.js [client-sets.json]  (pool 가짜 — DB 접속 없음)
// JSON 경로를 주면 그 파일이 검사(validateCredential)를 통과하는지만 보고 건수만 출력
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
process.env.CLIENT_SECRET_KEY = crypto.randomBytes(32).toString('base64');

const { run, MARK } = require('./reimportClientSets');
const { encrypt, decrypt } = require('../src/utils/secretBox');

// 가짜 pool — 업체 5(예전 글 1)에 자동 정리 항목 1·직접 넣은 항목 1·못 읽는 메모 1
const makePool = () => {
    const calls = [];
    const events = [];
    const conn = {
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release'),
        query: async (sql, params) => {
            calls.push({ sql, params });
            if (sql.includes('FROM wk_client WHERE cp_id')) return [params[1] === 1 ? [{ id: 5 }] : []];
            if (sql.startsWith('SELECT id, memo_enc')) return [[{ id: 1, memo_enc: encrypt(`${MARK}\n예전`) }, { id: 2, memo_enc: encrypt('직접 넣음') }, { id: 3, memo_enc: 'v1:깨짐' }]];
            if (sql.includes('MAX(sort)')) return [[{ next: 2 }]];
            if (sql.startsWith('INSERT INTO wk_client_credential')) return [{ insertId: 100 + calls.length }];
            return [{ affectedRows: 1 }];
        },
    };
    return { calls, events, pool: { query: async () => [[{ 1: 1 }]], getConnection: async () => conn } };
};

const site = { kind: 'site', label: '세트', url: 'sftp://h.kr', port: 22, loginId: 'f', secret: 'PW1', memo: `${MARK}\n메모`, adminUrl: 'https://a.kr/adm', adminId: 'adm', adminSecret: 'PW2', dbHost: 'localhost', dbName: 'n', dbId: 'd', dbSecret: '' };
const data = { clients: [{ legacyWrId: 1, items: [site, { kind: 'etc', label: '기타', url: '', loginId: '', secret: '', memo: MARK }] }, { legacyWrId: 9, items: [] }] };

(async () => {
    if (process.argv[2]) {
        const real = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
        await run({ ...makePool(), data: real, cpId: 1, dryRun: true, out: () => {} });
        console.log(`JSON 검사 통과: 업체 ${real.clients.length} · 항목 ${real.clients.reduce((s, c) => s + c.items.length, 0)}`);
        return;
    }
    // dry-run: 쓰기 없음
    let f = makePool();
    let counts = await run({ ...f, data, cpId: 1, dryRun: true, out: () => {} });
    assert.deepStrictEqual(counts, { clients: 1, missing: 1, deleted: 1, kept: 2, inserted: 2 });
    assert.ok(!f.calls.some(c => /^(INSERT|DELETE)/.test(c.sql)), 'dry-run에서 씀');

    // 실행: 자동 정리분만 삭제, 직접·못 읽는 항목은 유지, 새 항목은 암호화해 뒤에 이어 붙임, 기록 남김
    f = makePool();
    await run({ ...f, data, cpId: 1, out: () => {} });
    const deletes = f.calls.filter(c => c.sql.startsWith('DELETE'));
    assert.deepStrictEqual(deletes.map(c => c.params), [[5, 1]]);
    const inserts = f.calls.filter(c => c.sql.startsWith('INSERT INTO wk_client_credential'));
    assert.strictEqual(inserts.length, 2);
    const p = inserts[0].params;
    assert.deepStrictEqual([p[0], p[1], p[3], p[4], p[7], p[8], p[9], p[10], p[12], p[13], p[14], p[15]], [5, 'site', 'sftp://h.kr', 'f', 2, 22, 'https://a.kr/adm', 'adm', 'localhost', 'n', 'd', null]);
    assert.deepStrictEqual([decrypt(p[5]), decrypt(p[6]), decrypt(p[11])], ['PW1', `${MARK}\n메모`, 'PW2']);
    assert.ok(!JSON.stringify(inserts.map(c => c.params)).includes('PW1'), '평문 저장');
    assert.strictEqual(inserts[1].params[7], 3);
    const logs = f.calls.filter(c => c.sql.startsWith('INSERT INTO wk_credential_log'));
    assert.deepStrictEqual(logs.map(c => c.params[3]), ['delete', 'create', 'create']);
    assert.strictEqual(f.events.filter(e => e === 'commit').length, 1);

    // 잘못된 항목·표시 없는 메모 → 쓰기 전에 거절
    for (const bad of [{ ...site, url: 'https://h.kr' }, { ...site, port: 0 }, { ...site, memo: '표시 없음' }]) {
        f = makePool();
        await assert.rejects(run({ ...f, data: { clients: [{ legacyWrId: 1, items: [bad] }] }, cpId: 1, out: () => {} }), e => e.code === 'BAD_ITEM');
        assert.strictEqual(f.calls.length, 0);
    }
    await assert.rejects(run({ ...makePool(), data: { clients: [{ legacyWrId: 1, items: [] }, { legacyWrId: 1, items: [] }] }, cpId: 1 }), e => e.code === 'BAD_JSON');
    console.log('checkReimportClientSets ✅');
})().catch(error => {
    console.error('checkReimportClientSets 실패 ❌', error.code ?? '', error.hint ?? error.message);
    process.exit(1);
});

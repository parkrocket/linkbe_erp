// 거래처 접속정보 검사·모델 점검: node scripts/checkClientModel.js  (pool·연결 가짜 — SQL·파라미터만 확인, DB 접속 없음)
const assert = require('assert');
const pool = require('../src/config/dbPromise');
const { validateClient, validateCredential, validateReveal } = require('../src/utils/clientValidation');

const calls = [];
const events = [];
let handlers = [];
const answer = (sql, params, tx) => {
    calls.push({ sql, params, tx });
    const h = handlers.find(([re]) => re.test(sql));
    if (h) return typeof h[1] === 'function' ? h[1](params) : h[1];
    return [[]];
};
pool.query = async (sql, params) => answer(sql, params, false);
pool.getConnection = async () => ({
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql, params) => answer(sql, params, true),
});
const reset = (h = []) => ((calls.length = 0), (events.length = 0), (handlers = h));
const { Client, Credential, ClientFile, CredentialLog } = require('../src/models/clientModel');

const actor = { no: 7, name: '홍길동' };
const LOCK = /^SELECT id FROM wk_client WHERE cp_id = \? AND id = \? FOR UPDATE$/;
const found = [LOCK, [[{ id: 5 }]]];
const ok = [/^(UPDATE|DELETE|INSERT)/, [{ affectedRows: 1, insertId: 9 }]];
const err = (fn, input, msg) => assert.deepStrictEqual(fn(input), { ok: false, error: msg }, msg);
// 쓰기 공통: 첫 SQL = cp_id로 업체 잠금, 모두 트랜잭션 안, 마지막 = 기록
const lockedThenLogged = (cp, id, log) => {
    assert.ok(LOCK.test(calls[0].sql), '업체 확인 없이 씀');
    assert.deepStrictEqual(calls[0].params, [cp, id]);
    assert.ok(calls.every(c => c.tx), '트랜잭션 밖 SQL');
    const last = calls[calls.length - 1];
    assert.ok(/^INSERT INTO wk_credential_log/.test(last.sql), '기록 없음');
    assert.deepStrictEqual(last.params, [cp, id, log.credentialId ?? null, log.fileId ?? null, log.target, log.action, 7, '홍길동']);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);
};

(async () => {
    // ---- 입력 검사 ----
    assert.deepStrictEqual(validateClient({ kind: 'own', name: ' 테스트업체 ' }), { ok: true, value: { kind: 'own', name: '테스트업체' } });
    err(validateClient, { kind: 'x', name: 'a' }, 'Invalid kind');
    err(validateClient, { kind: 'client', name: ' ' }, 'Invalid name');
    err(validateClient, { kind: 'client', name: 'a'.repeat(101) }, 'Invalid name');

    const NO_SITE = { port: null, adminUrl: '', adminId: '', adminSecret: null, dbHost: '', dbName: '', dbId: '', dbSecret: null };
    const C = (patch = {}) => ({ kind: 'ftp', label: ' 메인 ', url: 'sftp://example.com', loginId: 'user', ...patch });
    assert.deepStrictEqual(validateCredential(C({ secret: ' p@ss ', memo: '' })), {
        ok: true, value: { kind: 'ftp', label: '메인', url: 'sftp://example.com', loginId: 'user', secret: ' p@ss ', memo: null, ...NO_SITE },
    });
    assert.strictEqual(validateCredential(C()).value.secret, undefined); // 없으면 그대로(수정 시)
    // 세트가 아닌 항목은 세트 칸을 보내도 비움(세트 → 다른 종류로 바꾸면 지워짐)
    assert.deepStrictEqual(validateCredential(C({ port: 22, adminId: 'x', dbSecret: 'y' })).value, validateCredential(C()).value);

    // ---- 호스팅 세트(site) ----
    const S = (patch = {}) => ({ kind: 'site', label: '호스팅', url: 'sftp://host.kr', loginId: 'ftpid', port: 22, adminUrl: ' https://a.kr/adm ', adminId: 'adm', adminSecret: 'apw', dbHost: 'localhost', dbName: 'db1', dbId: 'dbu', dbSecret: 'dpw', ...patch });
    assert.deepStrictEqual(validateCredential(S()).value, {
        kind: 'site', label: '호스팅', url: 'sftp://host.kr', loginId: 'ftpid', secret: undefined, memo: undefined,
        port: 22, adminUrl: 'https://a.kr/adm', adminId: 'adm', adminSecret: 'apw', dbHost: 'localhost', dbName: 'db1', dbId: 'dbu', dbSecret: 'dpw',
    });
    assert.deepStrictEqual(validateCredential(S({ port: '', adminSecret: undefined, dbSecret: '' })).value.port, null);
    assert.deepStrictEqual([validateCredential(S({ adminSecret: undefined })).value.adminSecret, validateCredential(S({ dbSecret: '' })).value.dbSecret], [undefined, null]);
    for (const url of ['', 'ftp://a', 'SFTP://a']) assert.ok(validateCredential(S({ url })).ok, url);
    for (const url of ['https://a', 'ftps://a', 'sftp://u:p@a']) err(validateCredential, S({ url }), 'Invalid url');
    for (const port of [0, 65536, 1.5, '22', 'a']) err(validateCredential, S({ port }), 'Invalid port');
    for (const adminUrl of ['javascript:x', 'https://u:p@a']) err(validateCredential, S({ adminUrl }), 'Invalid adminUrl');
    err(validateCredential, S({ dbName: 'a'.repeat(101) }), 'Invalid dbName');
    err(validateCredential, S({ dbId: 1 }), 'Invalid dbId');
    err(validateCredential, S({ adminSecret: 'a'.repeat(501) }), 'Invalid adminSecret');
    for (const field of ['adminSecret', 'dbSecret']) assert.ok(validateReveal({ field, action: 'view' }, true).ok, field);
    err(b => validateReveal(b, true), { field: 'toString', action: 'view' }, 'Invalid field');
    for (const url of ['', 'http://a', 'HTTPS://a', 'ftp://a', 'ftps://a', 'sftp://a']) assert.ok(validateCredential(C({ url })).ok, url);
    for (const url of ['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'example.com', 'a'.repeat(501)]) err(validateCredential, C({ url }), 'Invalid url');
    err(validateCredential, C({ kind: 'x' }), 'Invalid kind');
    err(validateCredential, C({ label: 'a'.repeat(101) }), 'Invalid label');
    err(validateCredential, C({ loginId: 'a'.repeat(201) }), 'Invalid loginId');
    err(validateCredential, C({ secret: 'a'.repeat(501) }), 'Invalid secret');
    err(validateCredential, C({ secret: 1 }), 'Invalid secret');
    err(validateCredential, C({ memo: 'a'.repeat(5001) }), 'Invalid memo');
    assert.deepStrictEqual(validateReveal({ field: 'memo', action: 'copy' }, true), { ok: true, value: { field: 'memo', action: 'copy' } });
    assert.deepStrictEqual(validateReveal({ action: 'view' }, false), { ok: true, value: { field: null, action: 'view' } });
    err(b => validateReveal(b, true), { field: 'loginId', action: 'view' }, 'Invalid field');
    err(b => validateReveal(b, false), { action: 'delete' }, 'Invalid action');

    // ---- 목록: cp_id 범위, 암호 칸은 여부·개수만 ----
    reset([[/FROM wk_client c/, [[{ id: 1 }]]]]);
    assert.deepStrictEqual(await Client.list(1, { q: '테스_트%', kind: 'own' }), [{ id: 1 }]);
    let { sql, params } = calls[0];
    assert.ok(sql.includes('c.cp_id = ?') && sql.includes('c.kind = ?') && sql.includes('c.name LIKE ?') && sql.includes('cr.login_id LIKE ?') && sql.includes('f.original_name LIKE ?'));
    assert.ok(!sql.includes('c.id IN'), '메모 맞은 업체 없으면 IN 없음');
    const like = '%테스\\_트\\%%';
    assert.deepStrictEqual(params, [1, 'own', ...Array(10).fill(like)]);
    assert.ok(!/(secret_enc|memo_enc|legacy_memo_enc)(?! IS NOT NULL)/.test(sql), '목록에 암호 칸 SELECT');
    assert.ok(/f\.cp_id = c\.cp_id/.test(sql), '첨부 개수가 회사 범위 밖');
    reset([[/FROM wk_client c/, [[]]]]);
    await Client.list(1, { q: 'x', memoIds: [5, 7] });
    assert.ok(calls[0].sql.includes('OR c.id IN (?)'));
    assert.deepStrictEqual(calls[0].params.at(-1), [5, 7]);
    reset();
    await Credential.memosOf(3);
    assert.ok(calls[0].sql.includes('c.cp_id = ?') && calls[0].sql.includes('memo_enc IS NOT NULL'));
    assert.deepStrictEqual(calls[0].params, [3]);
    reset();
    await Client.list(2, {});
    assert.deepStrictEqual(calls[0].params, [2]);

    // ---- 상세 읽기: 업체 cp_id, 항목·기록은 업체 cp_id로 확인 ----
    reset();
    await Client.find(1, 5);
    assert.ok(calls[0].sql.includes('WHERE cp_id = ? AND id = ?'));
    assert.deepStrictEqual(calls[0].params, [1, 5]);
    reset();
    await Credential.list(1, 5);
    assert.ok(/JOIN wk_client c ON c\.id = cr\.client_id AND c\.cp_id = \?/.test(calls[0].sql));
    assert.ok(!/secret_enc(?! IS NOT NULL)/.test(calls[0].sql), '항목 목록에 비밀번호 암호 칸 SELECT'); // 항목 메모는 화면에 보이는 칸(11-04)
    assert.deepStrictEqual(calls[0].params, [1, 5]);
    reset();
    await Credential.findEnc(1, 5, 3);
    assert.ok(/JOIN wk_client c ON c\.id = cr\.client_id AND c\.cp_id = \?/.test(calls[0].sql) && calls[0].sql.includes('cr.id = ?'));
    assert.deepStrictEqual(calls[0].params, [1, 5, 3]);
    reset();
    await ClientFile.list(1, 5);
    assert.ok(calls[0].sql.includes("cp_id = ? AND owner_type = 'client' AND owner_id = ?") && !calls[0].sql.includes('stored_name'));
    assert.deepStrictEqual(calls[0].params, [1, 5]);
    reset();
    await ClientFile.find(1, 5, 8);
    assert.ok(calls[0].sql.includes("cp_id = ? AND owner_type = 'client' AND owner_id = ? AND id = ?"));
    assert.deepStrictEqual(calls[0].params, [1, 5, 8]);
    reset();
    await CredentialLog.recent(1, 5);
    assert.ok(calls[0].sql.includes('l.cp_id = ? AND l.client_id = ?') && calls[0].sql.includes('ORDER BY l.id DESC LIMIT 30'));
    assert.deepStrictEqual(calls[0].params, [1, 5]);

    // ---- 업체 쓰기 ----
    reset([ok]);
    assert.strictEqual(await Client.create(1, { kind: 'client', name: '테스트업체' }, actor), 9);
    assert.ok(/^INSERT INTO wk_client \(cp_id, kind, name\)/.test(calls[0].sql));
    assert.deepStrictEqual(calls[0].params, [1, 'client', '테스트업체']);
    assert.deepStrictEqual(calls[1].params, [1, 9, null, null, 'client', 'create', 7, '홍길동']);
    assert.deepStrictEqual(events, ['begin', 'commit', 'release']);

    reset([found, ok]);
    assert.strictEqual(await Client.update(1, 5, { kind: 'own', name: '새이름' }, actor), true);
    assert.ok(calls[1].sql.includes('WHERE cp_id = ? AND id = ?'));
    lockedThenLogged(1, 5, { target: 'client', action: 'update' });

    // 없는(다른 회사) 업체 → null, 아무것도 안 씀
    for (const fn of [
        () => Client.update(2, 5, { kind: 'own', name: 'a' }, actor),
        () => Client.remove(2, 5, actor),
        () => Credential.create(2, 5, { kind: 'etc', label: '', url: '', loginId: '', secretEnc: null, memoEnc: null }, actor),
        () => Credential.update(2, 5, 3, { kind: 'etc', label: '', url: '', loginId: '' }, actor),
        () => Credential.remove(2, 5, 3, actor),
        () => ClientFile.remove(2, 5, 8, actor),
    ]) {
        reset();
        assert.strictEqual(await fn(), null);
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);
    }
    reset();
    assert.strictEqual(await ClientFile.create(2, 5, { storedName: 'u', originalName: 'a.pdf', mime: 'application/pdf', size: 1 }, actor), 'missing');

    // 업체 삭제: 항목·첨부 행 삭제, 기록은 남김, 지울 파일 이름 반환
    reset([found, [/SELECT stored_name FROM wk_file/, [[{ stored_name: 'aaa' }, { stored_name: 'bbb' }]]], ok]);
    assert.deepStrictEqual(await Client.remove(1, 5, actor), ['aaa', 'bbb']);
    lockedThenLogged(1, 5, { target: 'client', action: 'delete' });
    const sqls = calls.map(c => c.sql).join('\n');
    assert.ok(sqls.includes('DELETE FROM wk_client_credential WHERE client_id = ?'));
    assert.ok(sqls.includes("DELETE FROM wk_file WHERE cp_id = ? AND owner_type = 'client' AND owner_id = ?"));
    assert.ok(sqls.includes('DELETE FROM wk_client WHERE cp_id = ? AND id = ?'));
    assert.ok(!/DELETE FROM wk_credential_log/.test(sqls), '기록을 지움');

    // ---- 항목 쓰기 ----
    reset([found, [/COALESCE\(MAX\(sort\)/, [[{ next: 3 }]]], ok]);
    const cv = { kind: 'ftp', label: '메인', url: '', loginId: 'u', secretEnc: 'v1:AAA', memoEnc: null };
    assert.strictEqual(await Credential.create(1, 5, cv, actor), 9);
    const ins = calls.find(c => /^INSERT INTO wk_client_credential/.test(c.sql));
    assert.deepStrictEqual(ins.params, [5, 'ftp', '메인', '', 'u', 'v1:AAA', null, 3, null, '', '', null, '', '', '', null]);
    lockedThenLogged(1, 5, { credentialId: 9, target: 'credential', action: 'create' });
    // 세트: 세트 칸도 저장(비밀번호는 암호문)
    reset([found, [/COALESCE\(MAX\(sort\)/, [[{ next: 0 }]]], ok]);
    const sv = { ...cv, kind: 'site', port: 22, adminUrl: 'https://a', adminId: 'adm', adminSecretEnc: 'v1:A', dbHost: 'h', dbName: 'n', dbId: 'd', dbSecretEnc: 'v1:D' };
    await Credential.create(1, 5, sv, actor);
    const insSite = calls.find(c => /^INSERT INTO wk_client_credential/.test(c.sql));
    assert.ok(insSite.sql.includes('port, admin_url, admin_id, admin_secret_enc, db_host, db_name, db_id, db_secret_enc'));
    assert.deepStrictEqual(insSite.params, [5, 'site', '메인', '', 'u', 'v1:AAA', null, 0, 22, 'https://a', 'adm', 'v1:A', 'h', 'n', 'd', 'v1:D']);
    // 수정: 세트 비밀번호도 undefined = 그대로
    reset([found, ok]);
    await Credential.update(1, 5, 3, { ...sv, secretEnc: undefined, memoEnc: undefined, dbSecretEnc: undefined }, actor);
    assert.ok(calls[1].sql.includes('admin_secret_enc = ?') && !calls[1].sql.includes('db_secret_enc') && !calls[1].sql.includes(' secret_enc'));
    reset();
    await Credential.findEnc(1, 5, 3);
    assert.ok(calls[0].sql.includes('cr.admin_secret_enc') && calls[0].sql.includes('cr.db_secret_enc'));

    // 수정: secretEnc undefined = 그대로(칸 자체를 안 건드림), null = 지움
    reset([found, ok]);
    assert.strictEqual(await Credential.update(1, 5, 3, { kind: 'db', label: 'a', url: '', loginId: 'b', memoEnc: null }, actor), true);
    assert.ok(!calls[1].sql.includes('secret_enc') && calls[1].sql.includes('memo_enc = ?') && calls[1].sql.includes('WHERE client_id = ? AND id = ?'));
    assert.deepStrictEqual(calls[1].params, ['db', 'a', '', 'b', null, '', '', '', '', '', null, 5, 3]);
    lockedThenLogged(1, 5, { credentialId: 3, target: 'credential', action: 'update' });
    // 다른 업체의 항목 → 0행 → null·롤백
    reset([found, [/^UPDATE/, [{ affectedRows: 0 }]]]);
    assert.strictEqual(await Credential.update(1, 5, 99, { kind: 'db', label: '', url: '', loginId: '' }, actor), null);
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    reset([found, ok]);
    assert.strictEqual(await Credential.remove(1, 5, 3, actor), true);
    assert.ok(calls[1].sql === 'DELETE FROM wk_client_credential WHERE client_id = ? AND id = ?');
    lockedThenLogged(1, 5, { credentialId: 3, target: 'credential', action: 'delete' });

    // ---- 첨부 ----
    const stored = { storedName: '0f0e0d0c-1111-2222-3333-444455556666', originalName: '견적.pdf', mime: 'application/pdf', size: 10 };
    reset([found, [/COUNT\(\*\) AS n FROM wk_file/, [[{ n: 19 }]]], ok]);
    assert.strictEqual(await ClientFile.create(1, 5, stored, actor), 9);
    assert.deepStrictEqual(calls[1].params, [1, 5]);
    const fins = calls.find(c => /^INSERT INTO wk_file/.test(c.sql));
    assert.deepStrictEqual(fins.params, [1, 5, '견적.pdf', stored.storedName, 'application/pdf', 10, 7]);
    lockedThenLogged(1, 5, { fileId: 9, target: 'file', action: 'create' });
    reset([found, [/COUNT\(\*\) AS n FROM wk_file/, [[{ n: 20 }]]]]);
    assert.strictEqual(await ClientFile.create(1, 5, stored, actor), 'too_many');
    assert.ok(!calls.some(c => /^INSERT/.test(c.sql)));

    reset([found, [/SELECT stored_name FROM wk_file/, [[{ stored_name: 'aaa' }]]], ok]);
    assert.strictEqual(await ClientFile.remove(1, 5, 8, actor), 'aaa');
    assert.ok(calls.some(c => c.sql === "DELETE FROM wk_file WHERE cp_id = ? AND owner_type = 'client' AND owner_id = ? AND id = ?"));
    lockedThenLogged(1, 5, { fileId: 8, target: 'file', action: 'delete' });
    reset([found]);
    assert.strictEqual(await ClientFile.remove(1, 5, 99, actor), null); // 다른 업체 파일
    assert.deepStrictEqual(events, ['begin', 'rollback', 'release']);

    // ---- 기록(보기·복사·내려받기): pool에 바로 ----
    reset([ok]);
    await CredentialLog.insert(null, { cpId: 1, clientId: 5, credentialId: 3, target: 'secret', action: 'copy', actor });
    assert.deepStrictEqual(calls[0].params, [1, 5, 3, null, 'secret', 'copy', 7, '홍길동']);
    assert.strictEqual(calls[0].tx, false);

    console.log('checkClientModel ✅');
    process.exit(0);
})().catch(e => {
    console.error('checkClientModel 실패 ❌', e);
    process.exit(1);
});

// 거래처 접속정보 API 점검: node scripts/checkClient.js  (모델·암호화 가짜, 첨부는 임시 폴더 — 운영 DB 호출 없음)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'check-client-'));
process.env.WORK_UPLOAD_ROOT = ROOT;

const PLAIN = 'p@ss-테스트';
const MEMO = '메모-비밀-테스트';
const LEGACY = '예전-메모-테스트';

// ── 콘솔 가로채기: 평문이 어디에도 찍히지 않아야 함 ──
const printed = [];
for (const k of ['log', 'error', 'warn', 'info']) {
    const orig = console[k];
    console[k] = (...a) => (printed.push(a.map(x => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')), k === 'log' && orig(...a));
}

// ── 가짜 암호화: 암호문 안에 평문이 그대로 들어감 → 암호 칸이 응답에 새면 평문 검사에 걸림 ──
const box = require('../src/utils/secretBox');
let keyReady = true;
let unreadable = new Set();
box.isKeyReady = () => keyReady;
box.encrypt = v => {
    if (!keyReady) throw Object.assign(new Error('Secret key missing'), { code: 'SECRET_KEY_MISSING' });
    return v === null || v === undefined ? null : `v1:${v}`;
};
box.decrypt = v => {
    if (v === null) return null;
    if (!keyReady) throw Object.assign(new Error('Secret key missing'), { code: 'SECRET_KEY_MISSING' });
    if (unreadable.has(v)) throw new Error('Unsupported state or unable to authenticate data');
    return v.slice(3);
};

// ── 가짜 모델 ──
const Admin = require('../src/models/adminModel');
const { Client, Credential, ClientFile, CredentialLog } = require('../src/models/clientModel');
Admin.findByUserId = async () => ({ mb_no: 7, user_name: '홍길동' });
const calls = {};
const rec = (name, ret) => async (...a) => ((calls[name] = a), typeof ret === 'function' ? ret(...a) : ret);
const logs = [];
let logFail = false;
CredentialLog.insert = async (db, entry) => {
    if (logFail) throw Object.assign(new Error('log failed'), { code: 'ER_LOCK_WAIT_TIMEOUT' });
    logs.push(entry);
};
CredentialLog.recent = rec('recent', [{ action: 'view', target: 'secret', credential_label: '메인', actor_name: '홍길동', created_at: '2026-11-04 10:00:00' }]);
Client.list = rec('list', [{ id: 5, kind: 'client', name: '테스트업체', credential_count: 2, file_count: 1, starred: 1, has_legacy_memo: 1, updated_at: '2026-11-04 10:00:00', legacy_memo_enc: `v1:${LEGACY}` }]);
Credential.memosOf = rec('memosOf', [{ client_id: 5, memo_enc: 'v1:FTP 포트 2121' }, { client_id: 6, memo_enc: 'v1:깨짐' }, { client_id: 7, memo_enc: 'v1:ftp 백업' }]);
const clientRow = { id: 5, kind: 'client', name: '테스트업체', legacy_memo_enc: `v1:${LEGACY}`, memo_enc: 'v1:업체 메모' };
Client.memosOf = rec('clientMemosOf', [{ client_id: 9, memo_enc: 'v1:FTP는 월말 점검' }]);
Client.setMemo = rec('setMemo', (cp, id) => (id === 5 ? true : null));
Client.setStar = rec('setStar', (cp, id) => (id === 5 ? true : null));
let clientFind = clientRow;
Client.find = rec('find', (cp, id) => (cp === 1 && id === 5 ? clientFind : undefined));
let clientCreate = 11;
Client.create = rec('create', () => clientCreate);
let clientUpdate = true;
Client.update = rec('update', () => clientUpdate);
let clientRemove = [];
Client.remove = rec('remove', () => clientRemove);
const credRow = { id: 3, kind: 'ftp', label: '메인', url: 'ftp://example.com', login_id: 'user', has_secret: 1, has_memo: 1, port: null, admin_url: '', admin_id: '', has_admin_secret: 0, db_host: '', db_name: '', db_id: '', has_db_secret: 0, sort: 0, updated_at: '2026-11-04 10:00:00', secret_enc: `v1:${PLAIN}`, memo_enc: `v1:${MEMO}` };
Credential.list = rec('credList', [credRow]);
let credEnc = { id: 3, label: '메인', secret_enc: `v1:${PLAIN}`, memo_enc: `v1:${MEMO}`, admin_secret_enc: 'v1:ADMINPW', db_secret_enc: 'v1:DBPW' };
Credential.findEnc = rec('findEnc', (cp, cid, id) => (cp === 1 && cid === 5 && id === 3 ? credEnc : undefined));
let credCreate = 21;
Credential.create = rec('credCreate', () => credCreate);
let credUpdate = true;
Credential.update = rec('credUpdate', () => credUpdate);
let credRemove = true;
Credential.remove = rec('credRemove', () => credRemove);
let fileRows = [{ id: 8, original_name: '견적.pdf', size: 10, created_at: '2026-11-04 10:00:00', stored_name: 'x' }];
ClientFile.list = rec('fileList', () => fileRows);
let fileFind = null;
ClientFile.find = rec('fileFind', (cp, cid, id) => (cp === 1 && cid === 5 && id === 8 ? fileFind : undefined));
let fileCreate = 31;
ClientFile.create = rec('fileCreate', () => (typeof fileCreate === 'function' ? fileCreate() : fileCreate));
let fileRemove = null;
ClientFile.remove = rec('fileRemove', () => fileRemove);

const ctrl = require('../src/controllers/workClientController');
const call = async (fn, req) => {
    const res = { code: 200, headers: {}, headersSent: false };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.set = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
    await fn({ params: {}, query: {}, body: {}, userCpId: 1, userId: 'a@x.kr', ...req }, res);
    return res;
};
const expect = (res, code, error) => assert.deepStrictEqual([res.code, res.body && res.body.error], [code, error]);
const noPlain = (obj, what, allowMemo = false) => {
    const s = JSON.stringify(obj);
    for (const p of allowMemo ? [PLAIN, LEGACY] : [PLAIN, MEMO, LEGACY]) assert.ok(!s.includes(p), `${what}에 평문`);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

(async () => {
    // ---- 목록 ----
    let res = await call(ctrl.list, { query: { q: ' 테스 ', kind: 'client' } });
    assert.deepStrictEqual(res.body, { clients: [{ id: 5, kind: 'client', name: '테스트업체', starred: true, credentialCount: 2, fileCount: 1, hasLegacyMemo: true, updatedAt: '2026-11-04 10:00:00' }] });
    assert.deepStrictEqual(calls.list, [1, { q: '테스', kind: 'client', memoIds: [] }]);
    // 항목 메모 검색: 풀어서 대소문자 무시, 못 읽는 메모는 건너뜀
    unreadable = new Set(['v1:깨짐']);
    await call(ctrl.list, { query: { q: 'Ftp' } });
    assert.deepStrictEqual(calls.list, [1, { q: 'Ftp', kind: null, memoIds: [5, 7, 9] }]); // 9 = 업체 메모가 맞은 업체
    unreadable = new Set();
    calls.memosOf = undefined;
    noPlain(res.body, '목록');
    await call(ctrl.list, {});
    assert.deepStrictEqual(calls.list, [1, { q: '', kind: null, memoIds: [] }]);
    assert.strictEqual(calls.memosOf, undefined, '검색어 없을 때 메모를 풀면 안 됨');
    expect(await call(ctrl.list, { query: { kind: 'x' } }), 400, 'Invalid kind');

    // ---- 상세: 칸 이름 정확히, 평문 없음 ----
    res = await call(ctrl.detail, { params: { id: '5' } });
    assert.deepStrictEqual(Object.keys(res.body), ['client', 'credentials', 'files', 'logs']);
    assert.deepStrictEqual(res.body.client, { id: 5, kind: 'client', name: '테스트업체', hasLegacyMemo: true, legacyMemoUnreadable: false, memo: '업체 메모', memoUnreadable: false });
    assert.deepStrictEqual(res.body.credentials, [{ id: 3, kind: 'ftp', label: '메인', url: 'ftp://example.com', loginId: 'user', hasSecret: true, port: null, adminUrl: '', adminId: '', hasAdminSecret: false, dbHost: '', dbName: '', dbId: '', hasDbSecret: false, hasMemo: true, memo: MEMO, memoUnreadable: false, sort: 0, updatedAt: '2026-11-04 10:00:00' }]);
    assert.deepStrictEqual(res.body.files, [{ id: 8, originalName: '견적.pdf', size: 10, createdAt: '2026-11-04 10:00:00' }]);
    assert.deepStrictEqual(res.body.logs, [{ action: 'view', target: 'secret', credentialLabel: '메인', actorName: '홍길동', createdAt: '2026-11-04 10:00:00' }]);
    noPlain(res.body, '상세', true); // 항목 메모는 보이는 칸, 비밀번호·예전 메모는 없어야 함
    // 예전 메모를 못 읽으면(키 틀림·변조) 그 칸만 unreadable — 상세는 동작
    unreadable = new Set([`v1:${LEGACY}`]);
    res = await call(ctrl.detail, { params: { id: '5' } });
    assert.deepStrictEqual([res.code, res.body.client.legacyMemoUnreadable], [200, true]);
    unreadable = new Set();
    keyReady = false;
    res = await call(ctrl.detail, { params: { id: '5' } });
    assert.deepStrictEqual([res.code, res.body.client.legacyMemoUnreadable, res.body.credentials.length], [200, true, 1]);
    assert.strictEqual((await call(ctrl.list, {})).code, 200); // 키 없어도 목록 동작
    keyReady = true;
    clientFind = { ...clientRow, legacy_memo_enc: null };
    res = await call(ctrl.detail, { params: { id: '5' } });
    assert.deepStrictEqual([res.body.client.hasLegacyMemo, res.body.client.legacyMemoUnreadable], [false, false]);
    clientFind = clientRow;
    for (const id of ['abc', '0', '99', '5.0']) expect(await call(ctrl.detail, { params: { id } }), 404, 'Not found');
    expect(await call(ctrl.detail, { params: { id: '5' }, userCpId: 2 }), 404, 'Not found'); // 다른 회사

    // ---- 업체 쓰기 ----
    res = await call(ctrl.create, { body: { kind: 'own', name: ' 테스트업체 ' } });
    assert.deepStrictEqual(res.body, { id: 11 });
    assert.deepStrictEqual(calls.create, [1, { kind: 'own', name: '테스트업체' }, { no: 7, name: '홍길동' }]);
    expect(await call(ctrl.create, { body: { kind: 'own', name: '' } }), 400, 'Invalid name');
    assert.deepStrictEqual((await call(ctrl.update, { params: { id: '5' }, body: { kind: 'client', name: 'a' } })).body, { ok: true });
    assert.deepStrictEqual(calls.update.slice(0, 2), [1, 5]);
    clientUpdate = null;
    expect(await call(ctrl.update, { params: { id: '5' }, body: { kind: 'client', name: 'a' } }), 404, 'Not found');
    expect(await call(ctrl.update, { params: { id: 'x' }, body: { kind: 'client', name: 'a' } }), 404, 'Not found');

    // ---- 항목: 저장 전에 암호화, undefined = 그대로, '' = 지움 ----
    res = await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'ftp', label: '메인', url: 'ftp://example.com', loginId: 'user', secret: PLAIN, memo: '' } });
    assert.deepStrictEqual(res.body, { id: 21 });
    assert.deepStrictEqual(calls.credCreate.slice(0, 3), [1, 5, { kind: 'ftp', label: '메인', url: 'ftp://example.com', loginId: 'user', secretEnc: `v1:${PLAIN}`, memoEnc: null, port: null, adminUrl: '', adminId: '', dbHost: '', dbName: '', dbId: '', adminSecretEnc: null, dbSecretEnc: null }]);
    noPlain(res.body, '항목 저장 응답');
    await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'etc' } });
    assert.deepStrictEqual([calls.credCreate[2].secretEnc, calls.credCreate[2].memoEnc], [null, null]);
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'admin', url: 'javascript:alert(1)' } }), 400, 'Invalid url');
    // 주소 안에 아이디·비밀번호(user:pass@) — 평문으로 남으므로 거절, 경로·쿼리의 @는 허용
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'ftp', url: 'ftp://user:pw@example.com' } }), 400, 'Invalid url');
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'admin', url: 'https://user@example.com/admin' } }), 400, 'Invalid url');
    res = await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'admin', url: 'https://example.com/a?mail=a@b.kr' } });
    assert.deepStrictEqual(res.body, { id: 21 });
    // 세트: 비밀번호 셋 모두 암호화, 평문은 응답에 없음
    res = await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'site', url: 'sftp://h', port: 22, loginId: 'f', secret: PLAIN, adminUrl: 'https://a', adminId: 'adm', adminSecret: 'APW', dbHost: 'localhost', dbName: 'n', dbId: 'd', dbSecret: 'DPW' } });
    assert.deepStrictEqual(res.body, { id: 21 });
    assert.deepStrictEqual(calls.credCreate[2], { kind: 'site', label: '', url: 'sftp://h', loginId: 'f', port: 22, adminUrl: 'https://a', adminId: 'adm', dbHost: 'localhost', dbName: 'n', dbId: 'd', secretEnc: `v1:${PLAIN}`, memoEnc: null, adminSecretEnc: 'v1:APW', dbSecretEnc: 'v1:DPW' });
    await call(ctrl.updateCredential, { params: { id: '5', cid: '3' }, body: { kind: 'site', dbSecret: '' } });
    assert.deepStrictEqual([calls.credUpdate[3].adminSecretEnc, calls.credUpdate[3].dbSecretEnc], [undefined, null]);
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'site', url: 'https://h' } }), 400, 'Invalid url');
    credCreate = null;
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'etc' } }), 404, 'Not found');
    keyReady = false;
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'etc', secret: PLAIN } }), 503, 'Secret key missing');
    expect(await call(ctrl.updateCredential, { params: { id: '5', cid: '3' }, body: { kind: 'etc', memo: MEMO } }), 503, 'Secret key missing');
    keyReady = true;

    res = await call(ctrl.updateCredential, { params: { id: '5', cid: '3' }, body: { kind: 'db', label: 'a', url: '', loginId: 'b', secret: '' } });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.deepStrictEqual(calls.credUpdate.slice(0, 4), [1, 5, 3, { kind: 'db', label: 'a', url: '', loginId: 'b', secretEnc: null, memoEnc: undefined, port: null, adminUrl: '', adminId: '', dbHost: '', dbName: '', dbId: '', adminSecretEnc: null, dbSecretEnc: null }]);
    credUpdate = null;
    expect(await call(ctrl.updateCredential, { params: { id: '5', cid: '3' }, body: { kind: 'db' } }), 404, 'Not found');
    expect(await call(ctrl.updateCredential, { params: { id: '5', cid: 'x' }, body: { kind: 'db' } }), 404, 'Not found');
    assert.deepStrictEqual((await call(ctrl.removeCredential, { params: { id: '5', cid: '3' } })).body, { ok: true });
    credRemove = null;
    expect(await call(ctrl.removeCredential, { params: { id: '5', cid: '3' } }), 404, 'Not found');

    // ---- 보기·복사: 기록 먼저, 성공해야 값 ----
    logs.length = 0;
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'secret', action: 'view' } });
    assert.deepStrictEqual(res.body, { value: PLAIN });
    assert.strictEqual(res.headers['cache-control'], 'no-store');
    assert.deepStrictEqual(logs, [{ cpId: 1, clientId: 5, credentialId: 3, target: 'secret', action: 'view', actor: { no: 7, name: '홍길동' } }]);
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'memo', action: 'copy' } });
    assert.deepStrictEqual(res.body, { value: MEMO });
    assert.deepStrictEqual([logs[1].target, logs[1].action], ['memo', 'copy']);
    // 세트 비밀번호: 칸별 기록 target
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'adminSecret', action: 'view' } });
    assert.deepStrictEqual([res.body, logs[2].target], [{ value: 'ADMINPW' }, 'admin_pw']);
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'dbSecret', action: 'copy' } });
    assert.deepStrictEqual([res.body, logs[3].target], [{ value: 'DBPW' }, 'db_pw']);
    credEnc = { ...credEnc, db_secret_enc: null };
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'dbSecret', action: 'view' } }), 404, 'Not found');
    credEnc = { ...credEnc, db_secret_enc: 'v1:DBPW' };
    logs.splice(2);
    // 기록 실패 → 500, 값 없음
    logFail = true;
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'secret', action: 'view' } });
    expect(res, 500, 'Database query error');
    noPlain(res.body, '기록 실패 응답');
    res = await call(ctrl.revealLegacy, { params: { id: '5' }, body: { action: 'view' } });
    expect(res, 500, 'Database query error');
    logFail = false;
    // 키 없음 → 503, 기록도 안 남김
    logs.length = 0;
    keyReady = false;
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'secret', action: 'view' } }), 503, 'Secret key missing');
    expect(await call(ctrl.revealLegacy, { params: { id: '5' }, body: { action: 'view' } }), 503, 'Secret key missing');
    assert.strictEqual(logs.length, 0);
    keyReady = true;
    // 못 읽는 값 → value null + unreadable
    unreadable = new Set([`v1:${PLAIN}`]);
    res = await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'secret', action: 'view' } });
    assert.deepStrictEqual(res.body, { value: null, unreadable: true });
    unreadable = new Set();
    // 입력 오류·없는 값·다른 업체 항목
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'loginId', action: 'view' } }), 400, 'Invalid field');
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'secret', action: 'x' } }), 400, 'Invalid action');
    expect(await call(ctrl.revealCredential, { params: { id: '6', cid: '3' }, body: { field: 'secret', action: 'view' } }), 404, 'Not found');
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, userCpId: 2, body: { field: 'secret', action: 'view' } }), 404, 'Not found');
    credEnc = { ...credEnc, memo_enc: null };
    logs.length = 0;
    expect(await call(ctrl.revealCredential, { params: { id: '5', cid: '3' }, body: { field: 'memo', action: 'view' } }), 404, 'Not found');
    assert.strictEqual(logs.length, 0);
    // 예전 메모
    res = await call(ctrl.revealLegacy, { params: { id: '5' }, body: { action: 'copy' } });
    assert.deepStrictEqual(res.body, { value: LEGACY });
    assert.deepStrictEqual(logs, [{ cpId: 1, clientId: 5, credentialId: null, target: 'legacy', action: 'copy', actor: { no: 7, name: '홍길동' } }]);
    expect(await call(ctrl.revealLegacy, { params: { id: '99' }, body: { action: 'copy' } }), 404, 'Not found');

    // 오류 메시지에 평문이 들어 있어도 로그에는 코드만
    Credential.create = async () => {
        throw Object.assign(new Error(`Duplicate entry '${PLAIN}'`), { code: 'ER_DUP_ENTRY' });
    };
    expect(await call(ctrl.createCredential, { params: { id: '5' }, body: { kind: 'etc', secret: PLAIN } }), 500, 'Database query error');

    // ---- 첨부: 실제 라우터(multer) + 임시 폴더 ----
    const app = express();
    app.use(express.json());
    app.use((r, _res, next) => Object.assign(r, { userId: 'a@x.kr', userCpId: 1, clientSecret: true, workDoc: false }) && next());
    const workRoutes = require('../src/routes/work');
    app.use('/api/work', workRoutes, workRoutes.jsonError); // index.js와 같은 연결
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/work/clients`;
    const upload = async (name, buf, p = '/5/files') => {
        const form = new FormData();
        form.append('file', new Blob([buf]), name);
        const r = await fetch(base + p, { method: 'POST', body: form });
        return { code: r.status, body: await r.json() };
    };
    const disk = () => fs.readdirSync(ROOT);
    const PDF = Buffer.from('%PDF-1.4 테스트');
    const NAME = '견적서 (최종)\'s "a";.pdf';

    let up = await upload(NAME, PDF);
    assert.deepStrictEqual(up, { code: 200, body: { id: 31 } });
    const stored = calls.fileCreate[2];
    assert.ok(UUID.test(stored.storedName), '저장 이름이 UUID가 아님');
    assert.deepStrictEqual([stored.originalName, stored.mime, stored.size], [NAME, 'application/pdf', PDF.length]);
    assert.deepStrictEqual(calls.fileCreate.slice(0, 2), [1, 5]);
    assert.deepStrictEqual(disk(), [stored.storedName]);
    assert.ok(fs.readFileSync(path.join(ROOT, stored.storedName)).equals(PDF));
    // 첨부 권한: 폴더 700, 파일 600 (Windows는 권한 개념이 달라 건너뜀)
    if (process.platform !== 'win32') {
        assert.strictEqual(fs.statSync(path.join(ROOT, stored.storedName)).mode & 0o777, 0o600, '첨부 파일 권한');
    }

    // 깨진 JSON → 400 Invalid JSON, 본문·오류 내용을 응답하지 않음
    const badJson = await fetch(base + '/5/credentials', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"secret":"PLAIN_IN_BODY' });
    assert.strictEqual(badJson.status, 400);
    assert.deepStrictEqual(await badJson.json(), { error: 'Invalid JSON' });

    // 확장자·내용 불일치, 허용 밖 확장자, 파일 없음 → 400, 디스크에 안 남김
    for (const [name, buf] of [['a.pdf', Buffer.from('89504e470d0a1a0a', 'hex')], ['a.exe', Buffer.from('MZ\x90\x00')], ['a.png', PDF], ['noext', PDF]]) {
        assert.deepStrictEqual(await upload(name, buf), { code: 400, body: { error: 'Invalid file' } }, name);
    }
    assert.deepStrictEqual((await (await fetch(base + '/5/files', { method: 'POST' })).json()).error, 'Invalid file');
    assert.strictEqual(disk().length, 1);
    // 21번째 → 409, 없는 업체 → 404, DB 오류 → 500 — 모두 저장한 파일 지움
    fileCreate = 'too_many';
    assert.deepStrictEqual(await upload('b.pdf', PDF), { code: 409, body: { error: 'Too many files' } });
    fileCreate = 'missing';
    assert.deepStrictEqual(await upload('b.pdf', PDF), { code: 404, body: { error: 'Not found' } });
    fileCreate = () => {
        throw Object.assign(new Error('db down'), { code: 'ECONNRESET' });
    };
    assert.strictEqual((await upload('b.pdf', PDF)).code, 500);
    assert.strictEqual(disk().length, 1, 'DB 실패 뒤 파일이 남음');
    assert.strictEqual((await upload('b.pdf', PDF, '/abc/files')).code, 404);
    // 50MB 초과 → 413
    const big = Buffer.alloc(50 * 1024 * 1024 + 1);
    PDF.copy(big);
    assert.deepStrictEqual(await upload('big.pdf', big), { code: 413, body: { error: 'File too large' } });
    assert.strictEqual(disk().length, 1);

    // 내려받기: 그 업체의 파일 id로만, filename* 인코딩, 기록
    fileFind = { id: 8, original_name: NAME, stored_name: stored.storedName, mime: 'application/pdf', size: PDF.length };
    logs.length = 0;
    let dl = await fetch(`${base}/5/files/8`);
    assert.strictEqual(dl.status, 200);
    assert.strictEqual(dl.headers.get('content-disposition'), `attachment; filename*=UTF-8''%EA%B2%AC%EC%A0%81%EC%84%9C%20%28%EC%B5%9C%EC%A2%85%29%27s%20%22a%22%3B.pdf`);
    assert.strictEqual(dl.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(Buffer.from(await dl.arrayBuffer()).equals(PDF));
    assert.deepStrictEqual(logs, [{ cpId: 1, clientId: 5, fileId: 8, target: 'file', action: 'download', actor: { no: 7, name: '홍길동' } }]);
    logs.length = 0;
    for (const p of ['/6/files/8', '/5/files/9', '/5/files/abc', '/5/files/..%2F..%2Fx']) assert.strictEqual((await fetch(base + p)).status, 404, p);
    fileFind = { ...fileFind, stored_name: '../../etc/passwd' };
    assert.strictEqual((await fetch(`${base}/5/files/8`)).status, 404);
    assert.strictEqual(logs.length, 0, '못 내려받은 파일에 기록');
    // 기록 실패 → 내려받기도 500
    fileFind = { ...fileFind, stored_name: stored.storedName };
    logFail = true;
    assert.strictEqual((await fetch(`${base}/5/files/8`)).status, 500);
    logFail = false;

    // 첨부 삭제 → 디스크에서도
    fileRemove = null;
    assert.strictEqual((await fetch(`${base}/5/files/9`, { method: 'DELETE' })).status, 404);
    assert.strictEqual(disk().length, 1);
    fileRemove = stored.storedName;
    assert.strictEqual((await fetch(`${base}/5/files/8`, { method: 'DELETE' })).status, 200);
    assert.deepStrictEqual(disk(), []);

    // 업체 삭제 → 그 업체 파일 모두 디스크에서
    fileCreate = 32;
    await upload('c.pdf', PDF);
    clientRemove = [calls.fileCreate[2].storedName];
    assert.deepStrictEqual((await call(ctrl.remove, { params: { id: '5' } })).body, { ok: true });
    assert.deepStrictEqual(disk(), []);
    clientRemove = null;
    expect(await call(ctrl.remove, { params: { id: '5' } }), 404, 'Not found');
    server.close();

    // ---- 업체 메모: 암호화해 저장, '' = 지움, 기록은 모델이 남김(요청자 전달) ----
    assert.deepStrictEqual((await call(ctrl.updateMemo, { params: { id: '5' }, body: { memo: '새 메모' } })).body, { ok: true });
    assert.deepStrictEqual(calls.setMemo, [1, 5, 'v1:새 메모', { no: 7, name: '홍길동' }]);
    await call(ctrl.updateMemo, { params: { id: '5' }, body: { memo: '' } });
    assert.strictEqual(calls.setMemo[2], null);
    expect(await call(ctrl.updateMemo, { params: { id: '5' }, body: {} }), 400, 'Invalid memo');
    expect(await call(ctrl.updateMemo, { params: { id: '5' }, body: { memo: 'a'.repeat(10001) } }), 400, 'Invalid memo');
    expect(await call(ctrl.updateMemo, { params: { id: '6' }, body: { memo: 'x' } }), 404, 'Not found');
    keyReady = false;
    expect(await call(ctrl.updateMemo, { params: { id: '5' }, body: { memo: 'x' } }), 503, 'Secret key missing');
    keyReady = true;
    // ---- 별표: boolean만, 회사 범위(모델) ----
    assert.deepStrictEqual((await call(ctrl.setStar, { params: { id: '5' }, body: { starred: true } })).body, { ok: true });
    assert.deepStrictEqual(calls.setStar, [1, 5, true]);
    expect(await call(ctrl.setStar, { params: { id: '5' }, body: { starred: 1 } }), 400, 'Invalid starred');
    expect(await call(ctrl.setStar, { params: { id: '6' }, body: { starred: false } }), 404, 'Not found');
    expect(await call(ctrl.setStar, { params: { id: 'x' }, body: { starred: false } }), 404, 'Not found');

    // ---- 콘솔에 평문 없음 ----
    for (const line of printed) for (const p of [PLAIN, MEMO, LEGACY]) assert.ok(!line.includes(p), `콘솔에 평문: ${line.slice(0, 80)}`);
    assert.ok(printed.some(l => l.includes('ER_DUP_ENTRY')), '오류 코드도 안 찍힘');

    fs.rmSync(ROOT, { recursive: true, force: true });
    console.log('checkClient ✅');
    process.exit(0);
})().catch(e => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    process.stderr.write(`checkClient 실패 ❌ ${e.stack}\n`); // console은 가로채져 있어 stderr로
    process.exit(1);
});

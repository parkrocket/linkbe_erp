// 예전 거래처 작업정보 이전 스크립트 점검: node scripts/checkImportClients.js  (pool 가짜·임시 폴더 — DB 접속 없음, 값은 모두 가짜)
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-import-clients-'));
const filesDir = path.join(tmp, 'src');
process.env.WORK_UPLOAD_ROOT = path.join(tmp, 'work');
fs.mkdirSync(filesDir);
fs.writeFileSync(path.join(filesDir, 'a_1.pdf'), Buffer.from('%PDF-1.4 테스트'));
const FAKE_JPG = Buffer.from('MZ 실행 파일인 척');
fs.writeFileSync(path.join(filesDir, 'b_2.jpg'), FAKE_JPG); // 내용이 jpg 아님 → 건너뜀
fs.writeFileSync(path.join(filesDir, 'c_3.pdf'), Buffer.from('%PDF-1.4 덜 복사됨')); // JSON size와 실제 크기가 다름 → 건너뜀
const keyA = crypto.randomBytes(32).toString('base64');
process.env.CLIENT_SECRET_KEY = keyA;

const { run } = require('./importClients');
const { decrypt } = require('../src/utils/secretBox');

const MEMO = '가짜메모 FTP 비밀번호 test1234';
const data = {
    clients: [
        {
            legacyWrId: 1,
            kind: 'client',
            name: '테스트업체',
            createdAt: '2020-01-01 10:00:00',
            memo: MEMO,
            files: [
                { legacyKey: 'g_info:1:0', originalName: '가짜자료.pdf', storedFile: 'a_1.pdf', size: 18 },
                { legacyKey: 'g_info:1:1', originalName: '가짜사진.jpg', storedFile: 'b_2.jpg', size: FAKE_JPG.length },
                { legacyKey: 'g_info:1:2', originalName: '없는파일.pdf', storedFile: 'none.pdf', size: 1 },
                { legacyKey: 'g_info:1:3', originalName: '덜복사.pdf', storedFile: 'c_3.pdf', size: 999 },
            ],
        },
        { legacyWrId: 2, kind: 'own', name: '홍길동상사', createdAt: '2020-01-02 10:00:00', memo: '', files: [] },
    ],
};
const PLAIN = [MEMO, '테스트업체', '홍길동상사', '가짜자료', '가짜사진', '덜복사', 'a_1.pdf', 'b_2.jpg', 'none.pdf', 'c_3.pdf'];

// ---- 가짜 DB (wk_client·wk_file 메모리) ----
let db;
let calls;
let failFileInsert = false;
const reset = () => ((db = { clients: [], files: [] }), (calls = []));
const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM lk_company/.test(sql)) return [params[0] === 1 ? [{ 1: 1 }] : []];
    if (/^SELECT legacy_memo_enc FROM wk_client/.test(sql)) return [db.clients.filter(c => c.cp_id === params[0] && c.legacy_memo_enc).slice(0, 1)];
    if (/^SELECT id FROM wk_client WHERE cp_id = \? AND legacy_wr_id = \?/.test(sql)) return [db.clients.filter(c => c.cp_id === params[0] && c.legacy_wr_id === params[1])];
    if (/^INSERT INTO wk_client/.test(sql)) {
        const [cp_id, kind, name, legacy_memo_enc, , , legacy_wr_id] = params;
        const id = db.clients.length + 10;
        db.clients.push({ id, cp_id, kind, name, legacy_memo_enc, legacy_wr_id });
        return [{ insertId: id, affectedRows: 1 }];
    }
    if (/^SELECT id FROM wk_file WHERE cp_id = \? AND legacy_key = \?/.test(sql)) return [db.files.filter(f => f.cp_id === params[0] && f.legacy_key === params[1])];
    if (/^INSERT INTO wk_file/.test(sql)) {
        if (failFileInsert) throw Object.assign(new Error('가짜 DB 오류 ' + MEMO), { code: 'ER_FAKE' });
        const [cp_id, owner_id, original_name, stored_name, mime, size, , legacy_key] = params;
        db.files.push({ id: db.files.length + 1, cp_id, owner_id, original_name, stored_name, mime, size, legacy_key });
        return [{ insertId: db.files.length, affectedRows: 1 }];
    }
    throw new Error('모르는 SQL: ' + sql);
};
const events = [];
const pool = {
    query,
    getConnection: async () => ({
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release'),
        query,
    }),
};

// 출력 가로채기 — 평문이 화면에 나오면 실패
const out = [];
const log = (...a) => out.push(a.join(' '));
const stored = () => (fs.existsSync(process.env.WORK_UPLOAD_ROOT) ? fs.readdirSync(process.env.WORK_UPLOAD_ROOT) : []);
const writes = () => calls.filter(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql));
const go = (patch = {}) => run({ pool, data, filesDir, cpId: 1, dryRun: false, log, ...patch });
const rejects = async (p, code) => {
    await assert.rejects(p, e => e.code === code, code);
};

(async () => {
    reset();
    // 1번째 실행: 업체 2, 첨부 1(검사 실패·없는 파일 2, 크기 불일치 1은 건너뜀)
    const first = await go();
    assert.deepStrictEqual(first, { clients: 2, clientsSkipped: 0, files: 1, filesSkipped: 0, filesRejected: 2, filesSizeMismatch: 1 });
    assert.ok(out.at(-1).includes('크기 불일치(건너뜀) 1'));
    assert.strictEqual(db.clients.length, 2);
    assert.strictEqual(db.files.length, 1);
    // 메모는 암호문으로만 — SQL 파라미터에 평문 메모 없음, 같은 키로 풀림. 빈 메모는 NULL
    assert.ok(calls.every(c => !c.params.some(p => typeof p === 'string' && p.includes(MEMO))), '평문 메모가 SQL로 감');
    assert.ok(db.clients[0].legacy_memo_enc.startsWith('v1:'));
    assert.strictEqual(decrypt(db.clients[0].legacy_memo_enc), MEMO);
    assert.strictEqual(db.clients[1].legacy_memo_enc, null);
    // 첨부: UUID 이름으로 복사, 업체 번호에 연결, 내용 검사 MIME
    assert.deepStrictEqual(stored(), [db.files[0].stored_name]);
    assert.match(db.files[0].stored_name, /^[0-9a-f-]{36}$/);
    assert.deepStrictEqual([db.files[0].owner_id, db.files[0].mime, db.files[0].legacy_key, db.files[0].size], [10, 'application/pdf', 'g_info:1:0', 18]);
    const insertClient = calls.find(c => /^INSERT INTO wk_client/.test(c.sql));
    assert.match(insertClient.sql, /CONVERT_TZ\(\?, '\+09:00', @@session\.time_zone\)/);

    // 2번째 실행: 중복 없음
    const second = await go();
    assert.deepStrictEqual(second, { clients: 0, clientsSkipped: 2, files: 0, filesSkipped: 1, filesRejected: 2, filesSizeMismatch: 1 });
    assert.strictEqual(db.clients.length, 2);
    assert.strictEqual(db.files.length, 1);
    assert.strictEqual(stored().length, 1);

    // dry-run: 쓰기 없음
    calls = [];
    const dry = await go({ dryRun: true });
    assert.deepStrictEqual(dry, { clients: 2, clientsSkipped: 0, files: 1, filesSkipped: 0, filesRejected: 2, filesSizeMismatch: 1 });
    assert.ok(out.at(-1).includes('크기 불일치 1'));
    assert.deepStrictEqual(writes(), []);
    assert.strictEqual(stored().length, 1);

    // 키 없음·형식 틀림 → DB도 안 봄
    for (const key of ['', Buffer.alloc(16).toString('base64')]) {
        process.env.CLIENT_SECRET_KEY = key;
        calls = [];
        await rejects(go(), 'KEY_NOT_READY');
        assert.deepStrictEqual(calls, []);
    }
    // 다른 키(이미 넣은 메모를 못 읽음) → 아무것도 안 씀
    process.env.CLIENT_SECRET_KEY = crypto.randomBytes(32).toString('base64');
    calls = [];
    await rejects(go({ data: { clients: [{ ...data.clients[0], legacyWrId: 3, files: [] }] } }), 'KEY_MISMATCH');
    assert.deepStrictEqual(writes(), []);
    process.env.CLIENT_SECRET_KEY = keyA;

    // 없는 회사 → 아무것도 안 씀
    reset();
    await rejects(go({ cpId: 2 }), 'NO_COMPANY');
    assert.deepStrictEqual(writes(), []);

    // JSON 모양 오류 → DB 안 봄
    for (const bad of [{}, { clients: [{ ...data.clients[0], kind: 'x' }] }, { clients: [{ ...data.clients[0], name: '' }] },
        { clients: [{ ...data.clients[0], files: [{ ...data.clients[0].files[0], storedFile: '../a_1.pdf' }] }] },
        { clients: [{ ...data.clients[0], files: [{ ...data.clients[0].files[0], legacyKey: 'g_info:2:0' }] }] },
        { clients: [{ ...data.clients[0], files: [{ ...data.clients[0].files[0], size: undefined }] }] },
        { clients: [{ ...data.clients[0], files: [{ ...data.clients[0].files[0], size: '18' }] }] },
        { clients: [data.clients[0], data.clients[0]] }]) {
        calls = [];
        await rejects(go({ data: bad }), 'BAD_JSON');
        assert.deepStrictEqual(calls, []);
    }

    // 첨부 저장 중 DB 오류 → 롤백, 복사한 파일 지움, 오류는 위로
    reset();
    fs.rmSync(process.env.WORK_UPLOAD_ROOT, { recursive: true, force: true });
    failFileInsert = true;
    events.length = 0;
    await rejects(go(), 'ER_FAKE');
    assert.ok(events.includes('rollback') && !events.includes('commit'));
    assert.deepStrictEqual(stored(), []);
    failFileInsert = false;

    // 출력: 건수만
    assert.ok(out.length > 0);
    for (const line of out) for (const p of PLAIN) assert.ok(!line.includes(p), '출력에 평문');

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('checkImportClients 통과');
})().catch(e => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.error(e);
    process.exit(1);
});

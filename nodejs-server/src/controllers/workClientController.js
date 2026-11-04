const { Client, Credential, ClientFile, CredentialLog } = require('../models/clientModel');
const Admin = require('../models/adminModel');
const box = require('../utils/secretBox'); // box.encrypt 형태로 호출 — 점검에서 가짜로 바꿀 수 있게
const { validateClient, validateCredential, validateReveal, CLIENT_KINDS, REVEAL_FIELDS } = require('../utils/clientValidation');
const { WORK_UPLOAD_ROOT, isAllowedFile, saveWorkFile, removeWorkFile, attachmentHeader, isStoredName } = require('../utils/workUploads');

// 거래처 접속정보 API — requireAuth·requireClientSecret 뒤. 모든 조회·변경은 req.userCpId 범위(모델이 업체 cp_id로 확인)
// 비밀번호·메모·예전 메모 평문은 reveal 응답에만. 목록·상세·오류·서버 로그에 넣지 않음

const fail = (res, code, error) => res.status(code).json({ error });
const notFound = res => fail(res, 404, 'Not found');

// 로그에는 오류 코드(또는 종류)만 — 메시지·SQL에 값이 섞일 수 있어 그대로 찍지 않음
const logError = error => console.error('work client api error:', error.code || error.name);

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.code === 'SECRET_KEY_MISSING') return res.headersSent || fail(res, 503, 'Secret key missing');
        logError(error);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

const parseId = value => (/^[1-9]\d{0,14}$/.test(String(value)) ? Number(value) : null);

// 기록에 남길 요청자 — 없으면(그 사이 계정 삭제 등) null
const actorOf = async req => {
    const me = await Admin.findByUserId(req.userCpId, req.userId);
    return me ? { no: me.mb_no, name: String(me.user_name || '').slice(0, 50) } : null;
};
const noActor = res => fail(res, 401, 'Unauthorized');

// 못 읽는 값(키 없음·틀림·변조)이면 true — 평문은 버림
const isUnreadable = enc => {
    if (enc === null || enc === undefined) return false;
    try {
        box.decrypt(enc);
        return false;
    } catch {
        return true;
    }
};

// 항목 메모 — 화면에 바로 보이는 칸(11-04 사용자 결정: 비밀번호만 가림). 저장은 그대로 암호화, 못 읽으면 null
const memoOf = enc => {
    if (enc === null || enc === undefined) return { memo: null, memoUnreadable: false };
    try {
        return { memo: box.decrypt(enc), memoUnreadable: false };
    } catch {
        return { memo: null, memoUnreadable: true };
    }
};

// 비밀 칸 암호화: undefined = 그대로, null = 지움 (키 없으면 SECRET_KEY_MISSING → 503)
const encOrKeep = v => (v === undefined ? undefined : v === null ? null : box.encrypt(v));
// 검사한 항목 값 → 모델 값(비밀 칸 넷은 암호문으로). isNew: 새 항목은 '그대로'(undefined)가 없으므로 null
const credentialValue = ({ secret, memo, adminSecret, dbSecret, ...rest }, isNew) => {
    const enc = v => (isNew ? (encOrKeep(v) ?? null) : encOrKeep(v));
    return { ...rest, secretEnc: enc(secret), memoEnc: enc(memo), adminSecretEnc: enc(adminSecret), dbSecretEnc: enc(dbSecret) };
};

// 저장 파일 지우기 — 정리 단계라 실패해도 응답은 그대로(코드만 기록)
const discard = storedName => {
    try {
        removeWorkFile(storedName);
    } catch (error) {
        logError(error);
    }
};

// ---- 업체 ----

// 항목 메모는 상세에 바로 보이는 값(11-04 결정)이라 검색 대상. 예전 메모·비밀번호는 열람 기록이 필요해 검색하지 않음
// ponytail: 검색마다 회사 전체 메모를 풀어 봄(수백 개 기준) — 수만 개가 되면 검색용 색인을 따로 고민
const memoMatches = async (cpId, q) => {
    const needle = q.toLowerCase();
    const ids = new Set();
    for (const r of await Credential.memosOf(cpId)) {
        const { memo } = memoOf(r.memo_enc);
        if (memo && memo.toLowerCase().includes(needle)) ids.add(r.client_id);
    }
    return [...ids];
};

exports.list = handle(async (req, res) => {
    const kind = req.query.kind === undefined || req.query.kind === '' ? null : req.query.kind;
    if (kind && !CLIENT_KINDS.includes(kind)) return fail(res, 400, 'Invalid kind');
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const rows = await Client.list(req.userCpId, { q, kind, memoIds: q ? await memoMatches(req.userCpId, q) : [] });
    res.json({
        clients: rows.map(r => ({
            id: r.id,
            kind: r.kind,
            name: r.name,
            credentialCount: Number(r.credential_count),
            fileCount: Number(r.file_count),
            hasLegacyMemo: Boolean(r.has_legacy_memo),
            updatedAt: r.updated_at,
        })),
    });
});

exports.detail = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const client = id && (await Client.find(req.userCpId, id));
    if (!client) return notFound(res);
    const [credentials, files, logs] = await Promise.all([
        Credential.list(req.userCpId, id),
        ClientFile.list(req.userCpId, id),
        CredentialLog.recent(req.userCpId, id),
    ]);
    res.json({
        client: {
            id: client.id,
            kind: client.kind,
            name: client.name,
            hasLegacyMemo: client.legacy_memo_enc !== null && client.legacy_memo_enc !== undefined,
            legacyMemoUnreadable: isUnreadable(client.legacy_memo_enc),
        },
        credentials: credentials.map(c => ({
            id: c.id,
            kind: c.kind,
            label: c.label,
            url: c.url,
            loginId: c.login_id,
            hasSecret: Boolean(c.has_secret),
            port: c.port,
            adminUrl: c.admin_url,
            adminId: c.admin_id,
            hasAdminSecret: Boolean(c.has_admin_secret),
            dbHost: c.db_host,
            dbName: c.db_name,
            dbId: c.db_id,
            hasDbSecret: Boolean(c.has_db_secret),
            hasMemo: Boolean(c.has_memo),
            ...memoOf(c.memo_enc),
            sort: c.sort,
            updatedAt: c.updated_at,
        })),
        files: files.map(f => ({ id: f.id, originalName: f.original_name, size: f.size, createdAt: f.created_at })),
        logs: logs.map(l => ({ action: l.action, target: l.target, credentialLabel: l.credential_label, actorName: l.actor_name, createdAt: l.created_at })),
    });
});

exports.create = handle(async (req, res) => {
    const checked = validateClient(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    res.json({ id: await Client.create(req.userCpId, checked.value, actor) });
});

exports.update = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateClient(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    if (!(await Client.update(req.userCpId, id, checked.value, actor))) return notFound(res);
    res.json({ ok: true });
});

// 항목·첨부까지 삭제(기록은 남김). 파일은 DB 커밋 뒤 지움 — 지우다 실패해도 DB는 이미 정리됨(고아 파일은 이름이 UUID라 노출 없음)
exports.remove = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    const storedNames = await Client.remove(req.userCpId, id, actor);
    if (!storedNames) return notFound(res);
    storedNames.forEach(discard);
    res.json({ ok: true });
});

// ---- 접속정보 항목 ----

exports.createCredential = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateCredential(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const value = credentialValue(checked.value, true);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    const newId = await Credential.create(req.userCpId, id, value, actor);
    if (!newId) return notFound(res);
    res.json({ id: newId });
});

exports.updateCredential = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const cid = parseId(req.params.cid);
    if (!id || !cid) return notFound(res);
    const checked = validateCredential(req.body);
    if (!checked.ok) return fail(res, 400, checked.error);
    const value = credentialValue(checked.value, false);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    if (!(await Credential.update(req.userCpId, id, cid, value, actor))) return notFound(res);
    res.json({ ok: true });
});

exports.removeCredential = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const cid = parseId(req.params.cid);
    if (!id || !cid) return notFound(res);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    if (!(await Credential.remove(req.userCpId, id, cid, actor))) return notFound(res);
    res.json({ ok: true });
});

// 보기·복사 공통: 키 확인 → 기록(실패하면 500, 값 안 줌) → 복호화. 못 읽으면 value null + unreadable
const reveal = async (req, res, enc, log) => {
    if (enc === null || enc === undefined) return notFound(res);
    if (!box.isKeyReady()) return fail(res, 503, 'Secret key missing');
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    await CredentialLog.insert(null, { ...log, actor });
    let value;
    try {
        value = box.decrypt(enc);
    } catch (error) {
        if (error.code === 'SECRET_KEY_MISSING') throw error;
        return res.set('Cache-Control', 'no-store').json({ value: null, unreadable: true });
    }
    res.set('Cache-Control', 'no-store').json({ value });
};

exports.revealCredential = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const cid = parseId(req.params.cid);
    if (!id || !cid) return notFound(res);
    const checked = validateReveal(req.body, true);
    if (!checked.ok) return fail(res, 400, checked.error);
    const { field, action } = checked.value;
    const row = await Credential.findEnc(req.userCpId, id, cid);
    if (!row) return notFound(res);
    const [column, target] = REVEAL_FIELDS[field];
    await reveal(req, res, row[column], { cpId: req.userCpId, clientId: id, credentialId: cid, target, action });
});

exports.revealLegacy = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const checked = validateReveal(req.body, false);
    if (!checked.ok) return fail(res, 400, checked.error);
    const client = await Client.find(req.userCpId, id);
    if (!client) return notFound(res);
    await reveal(req, res, client.legacy_memo_enc, { cpId: req.userCpId, clientId: id, credentialId: null, target: 'legacy', action: checked.value.action });
});

// ---- 첨부 (라우터의 multer가 req.file을 메모리에 받음, 50MB·1개) ----

exports.uploadFile = handle(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    if (!isAllowedFile(req.file)) return fail(res, 400, 'Invalid file');
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    const stored = saveWorkFile(req.file);
    let result;
    try {
        result = await ClientFile.create(req.userCpId, id, stored, actor);
    } catch (error) {
        discard(stored.storedName); // DB에 없는 파일을 남기지 않음
        throw error;
    }
    if (result === 'missing' || result === 'too_many') discard(stored.storedName);
    if (result === 'missing') return notFound(res);
    if (result === 'too_many') return fail(res, 409, 'Too many files');
    res.json({ id: result });
});

// 내려받기 — 그 업체의 파일 id로만, 기록이 남아야 내보냄
exports.downloadFile = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const fid = parseId(req.params.fid);
    const file = id && fid && (await ClientFile.find(req.userCpId, id, fid));
    if (!file || !isStoredName(file.stored_name)) return notFound(res);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    await CredentialLog.insert(null, { cpId: req.userCpId, clientId: id, fileId: fid, target: 'file', action: 'download', actor });
    res.set({
        'Content-Type': file.mime || 'application/octet-stream',
        'Content-Disposition': attachmentHeader(file.original_name),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
    });
    res.sendFile(file.stored_name, { root: WORK_UPLOAD_ROOT() }, error => {
        if (!error) return;
        logError(error);
        if (!res.headersSent) notFound(res);
    });
});

exports.removeFile = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const fid = parseId(req.params.fid);
    if (!id || !fid) return notFound(res);
    const actor = await actorOf(req);
    if (!actor) return noActor(res);
    const storedName = await ClientFile.remove(req.userCpId, id, fid, actor);
    if (!storedName) return notFound(res);
    discard(storedName);
    res.json({ ok: true });
});

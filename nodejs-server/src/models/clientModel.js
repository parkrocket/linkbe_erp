const pool = require('../config/dbPromise');

// 거래처 접속정보(wk_client·wk_client_credential·wk_file·wk_credential_log) — 값은 바인딩.
// wk_client_credential에는 cp_id가 없으므로 항목·첨부·기록은 언제나 cp_id로 확인한 업체(client_id) 범위에서만 다룸:
// 읽기는 wk_client와 cp_id로 JOIN, 쓰기는 트랜잭션 첫 SQL로 업체를 cp_id로 잠근 뒤(withClient) 진행.
// 비밀번호·메모·예전 메모는 암호문(secret_enc·memo_enc·legacy_memo_enc)만 다루고, 목록에는 여부만 내보냄
const Client = {};
const Credential = {};
const ClientFile = {};
const CredentialLog = {};

const escapeLike = q => q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
const KST = col => `DATE_FORMAT(CONVERT_TZ(${col}, @@session.time_zone, '+09:00'), '%Y-%m-%d %H:%i:%s')`;
const OWNER = "cp_id = ? AND owner_type = 'client' AND owner_id = ?";
const MAX_FILES = 20;

// 기록 한 줄 — db는 트랜잭션 연결(쓰기와 함께) 또는 null(pool: 보기·복사·내려받기)
CredentialLog.insert = (db, { cpId, clientId, credentialId = null, fileId = null, target, action, actor }) =>
    (db || pool).query(
        'INSERT INTO wk_credential_log (cp_id, client_id, credential_id, file_id, target, action, actor_no, actor_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [cpId, clientId, credentialId, fileId, target, action, actor.no, actor.name],
    );

// 최근 30건 — 지운 항목은 이름 없음(NULL)
CredentialLog.recent = async (cpId, clientId) => {
    const [rows] = await pool.query(
        `SELECT l.action, l.target, cr.label AS credential_label, l.actor_name, ${KST('l.created_at')} AS created_at
         FROM wk_credential_log l LEFT JOIN wk_client_credential cr ON cr.id = l.credential_id AND cr.client_id = l.client_id
         WHERE l.cp_id = ? AND l.client_id = ? ORDER BY l.id DESC LIMIT 30`,
        [cpId, clientId],
    );
    return rows;
};

// 트랜잭션: 업체를 cp_id로 잠근 뒤 fn(conn). 업체가 없거나(다른 회사 포함) fn이 null이면 롤백하고 null
const withClient = async (cpId, clientId, fn) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id FROM wk_client WHERE cp_id = ? AND id = ? FOR UPDATE', [cpId, clientId]);
        const out = rows.length ? await fn(conn) : null;
        await (out === null ? conn.rollback() : conn.commit());
        return out;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// ---- 업체 ----

Client.list = async (cpId, { q, kind } = {}) => {
    const conds = ['c.cp_id = ?'];
    const params = [cpId];
    if (kind) (conds.push('c.kind = ?'), params.push(kind));
    if (q) (conds.push('c.name LIKE ?'), params.push(`%${escapeLike(q)}%`));
    const [rows] = await pool.query(
        `SELECT c.id, c.kind, c.name, c.legacy_memo_enc IS NOT NULL AS has_legacy_memo, ${KST('c.updated_at')} AS updated_at,
         (SELECT COUNT(*) FROM wk_client_credential cr WHERE cr.client_id = c.id) AS credential_count,
         (SELECT COUNT(*) FROM wk_file f WHERE f.cp_id = c.cp_id AND f.owner_type = 'client' AND f.owner_id = c.id) AS file_count
         FROM wk_client c WHERE ${conds.join(' AND ')} ORDER BY c.name, c.id`,
        params,
    );
    return rows;
};

// 상세용 — legacy_memo_enc(암호문)는 읽을 수 있는지 확인용으로만 컨트롤러에 넘김
Client.find = async (cpId, id) => {
    const [rows] = await pool.query('SELECT id, kind, name, legacy_memo_enc FROM wk_client WHERE cp_id = ? AND id = ?', [cpId, id]);
    return rows[0];
};

Client.create = async (cpId, value, actor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query('INSERT INTO wk_client (cp_id, kind, name) VALUES (?, ?, ?)', [cpId, value.kind, value.name]);
        await CredentialLog.insert(conn, { cpId, clientId: result.insertId, target: 'client', action: 'create', actor });
        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

Client.update = (cpId, id, value, actor) =>
    withClient(cpId, id, async conn => {
        await conn.query('UPDATE wk_client SET kind = ?, name = ? WHERE cp_id = ? AND id = ?', [value.kind, value.name, cpId, id]);
        await CredentialLog.insert(conn, { cpId, clientId: id, target: 'client', action: 'update', actor });
        return true;
    });

// 항목·첨부 행까지 삭제(기록은 남김). 반환: 지울 저장 파일 이름 목록(커밋 뒤 컨트롤러가 디스크에서 지움) | null
Client.remove = (cpId, id, actor) =>
    withClient(cpId, id, async conn => {
        const [files] = await conn.query(`SELECT stored_name FROM wk_file WHERE ${OWNER}`, [cpId, id]);
        await conn.query('DELETE FROM wk_client_credential WHERE client_id = ?', [id]);
        await conn.query(`DELETE FROM wk_file WHERE ${OWNER}`, [cpId, id]);
        await conn.query('DELETE FROM wk_client WHERE cp_id = ? AND id = ?', [cpId, id]);
        await CredentialLog.insert(conn, { cpId, clientId: id, target: 'client', action: 'delete', actor });
        return files.map(f => f.stored_name);
    });

// ---- 접속정보 항목 ----

const CRED_JOIN = 'FROM wk_client_credential cr JOIN wk_client c ON c.id = cr.client_id AND c.cp_id = ?';

Credential.list = async (cpId, clientId) => {
    const [rows] = await pool.query(
        `SELECT cr.id, cr.kind, cr.label, cr.url, cr.login_id, cr.secret_enc IS NOT NULL AS has_secret, cr.memo_enc IS NOT NULL AS has_memo, cr.memo_enc, cr.sort,
         ${KST('cr.updated_at')} AS updated_at ${CRED_JOIN} WHERE cr.client_id = ? ORDER BY cr.sort, cr.id`,
        [cpId, clientId],
    );
    return rows;
};

// 보기·복사용 암호문
Credential.findEnc = async (cpId, clientId, id) => {
    const [rows] = await pool.query(`SELECT cr.id, cr.label, cr.secret_enc, cr.memo_enc ${CRED_JOIN} WHERE cr.client_id = ? AND cr.id = ?`, [cpId, clientId, id]);
    return rows[0];
};

// value.secretEnc·memoEnc는 컨트롤러가 암호화한 값(null = 없음). 반환: 새 id | null(업체 없음)
Credential.create = (cpId, clientId, value, actor) =>
    withClient(cpId, clientId, async conn => {
        const [[row]] = await conn.query('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM wk_client_credential WHERE client_id = ?', [clientId]);
        const [result] = await conn.query(
            'INSERT INTO wk_client_credential (client_id, kind, label, url, login_id, secret_enc, memo_enc, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [clientId, value.kind, value.label, value.url, value.loginId, value.secretEnc, value.memoEnc, row ? row.next : 0],
        );
        await CredentialLog.insert(conn, { cpId, clientId, credentialId: result.insertId, target: 'credential', action: 'create', actor });
        return result.insertId;
    });

// secretEnc·memoEnc가 undefined면 그 칸은 그대로. 반환: true | null(업체 없음 또는 다른 업체의 항목)
Credential.update = (cpId, clientId, id, value, actor) =>
    withClient(cpId, clientId, async conn => {
        const sets = ['kind = ?', 'label = ?', 'url = ?', 'login_id = ?'];
        const params = [value.kind, value.label, value.url, value.loginId];
        if (value.secretEnc !== undefined) (sets.push('secret_enc = ?'), params.push(value.secretEnc));
        if (value.memoEnc !== undefined) (sets.push('memo_enc = ?'), params.push(value.memoEnc));
        const [result] = await conn.query(`UPDATE wk_client_credential SET ${sets.join(', ')} WHERE client_id = ? AND id = ?`, [...params, clientId, id]);
        if (result.affectedRows === 0) return null;
        await CredentialLog.insert(conn, { cpId, clientId, credentialId: id, target: 'credential', action: 'update', actor });
        return true;
    });

Credential.remove = (cpId, clientId, id, actor) =>
    withClient(cpId, clientId, async conn => {
        const [result] = await conn.query('DELETE FROM wk_client_credential WHERE client_id = ? AND id = ?', [clientId, id]);
        if (result.affectedRows === 0) return null;
        await CredentialLog.insert(conn, { cpId, clientId, credentialId: id, target: 'credential', action: 'delete', actor });
        return true;
    });

// ---- 첨부 (wk_file owner_type 'client') ----

ClientFile.list = async (cpId, clientId) => {
    const [rows] = await pool.query(`SELECT id, original_name, size, ${KST('created_at')} AS created_at FROM wk_file WHERE ${OWNER} ORDER BY id`, [cpId, clientId]);
    return rows;
};

ClientFile.find = async (cpId, clientId, id) => {
    const [rows] = await pool.query(`SELECT id, original_name, stored_name, mime, size FROM wk_file WHERE ${OWNER} AND id = ?`, [cpId, clientId, id]);
    return rows[0];
};

// 반환: 새 id | 'missing'(업체 없음) | 'too_many'(업체당 20개)
ClientFile.create = async (cpId, clientId, stored, actor) => {
    const out = await withClient(cpId, clientId, async conn => {
        const [[count]] = await conn.query(`SELECT COUNT(*) AS n FROM wk_file WHERE ${OWNER}`, [cpId, clientId]);
        if (Number(count.n) >= MAX_FILES) return 'too_many';
        const [result] = await conn.query(
            "INSERT INTO wk_file (cp_id, owner_type, owner_id, original_name, stored_name, mime, size, created_by) VALUES (?, 'client', ?, ?, ?, ?, ?, ?)",
            [cpId, clientId, stored.originalName, stored.storedName, stored.mime, stored.size, actor.no],
        );
        await CredentialLog.insert(conn, { cpId, clientId, fileId: result.insertId, target: 'file', action: 'create', actor });
        return result.insertId;
    });
    return out === null ? 'missing' : out;
};

// 반환: 지울 저장 파일 이름 | null(업체 없음 또는 다른 업체의 파일)
ClientFile.remove = (cpId, clientId, id, actor) =>
    withClient(cpId, clientId, async conn => {
        const [rows] = await conn.query(`SELECT stored_name FROM wk_file WHERE ${OWNER} AND id = ?`, [cpId, clientId, id]);
        if (!rows.length) return null;
        await conn.query(`DELETE FROM wk_file WHERE ${OWNER} AND id = ?`, [cpId, clientId, id]);
        await CredentialLog.insert(conn, { cpId, clientId, fileId: id, target: 'file', action: 'delete', actor });
        return rows[0].stored_name;
    });

module.exports = { Client, Credential, ClientFile, CredentialLog };

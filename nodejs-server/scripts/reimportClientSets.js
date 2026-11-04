// 예전 메모 자동 정리 항목 → 호스팅 세트 형식으로 다시 넣기 (서버에서 1회 실행 — 다시 실행해도 결과 같음)
// 실행: cd nodejs-server && NODE_ENV=production node scripts/reimportClientSets.js <client-sets.json> <회사 번호> [--dry-run]
// - 업체(예전 글 번호)마다 트랜잭션: 메모 첫 줄이 MARK인 항목(자동 정리분)만 지우고 JSON 항목을 넣음. 직접 넣은 항목·못 읽는 메모는 그대로 둠
// - 항목은 API와 같은 validateCredential로 검사, 비밀번호·메모는 CLIENT_SECRET_KEY로 암호화. 기록(wk_credential_log)도 남김
// - 출력은 건수만 (JSON은 다른 회사 접속정보 평문 — 실행 뒤 바로 삭제)
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, isKeyReady } = require('../src/utils/secretBox');
const { validateCredential } = require('../src/utils/clientValidation');

const MARK = '예전 메모에서 자동 정리 — 확인 필요';
const ACTOR = { no: null, name: '예전 메모 정리' };
const fail = (code, hint) => Object.assign(new Error(hint), { code, hint });

const keyWorks = () => {
    if (!isKeyReady()) return false;
    try {
        return decrypt(encrypt('키 확인')) === '키 확인';
    } catch {
        return false;
    }
};

// JSON 검사 — 몇 번째인지만 알림. 반환: [{ legacyWrId, items: 검사된 값 }]
function validate(data) {
    if (!data || !Array.isArray(data.clients)) throw fail('BAD_JSON', 'clients 배열 없음');
    const seen = new Set();
    return data.clients.map((c, i) => {
        if (!Number.isInteger(c?.legacyWrId) || c.legacyWrId < 1 || seen.has(c.legacyWrId) || !Array.isArray(c.items)) throw fail('BAD_JSON', `${i + 1}번째 업체 모양 오류`);
        seen.add(c.legacyWrId);
        return {
            legacyWrId: c.legacyWrId,
            items: c.items.map((item, j) => {
                const checked = validateCredential(item);
                if (!checked.ok || typeof item.memo !== 'string' || !item.memo.startsWith(MARK)) throw fail('BAD_ITEM', `${i + 1}번째 업체 ${j + 1}번째 항목: ${checked.error || 'memo 표시 없음'}`);
                return checked.value;
            }),
        };
    });
}

const enc = v => (v === null || v === undefined || v === '' ? null : encrypt(v));
// 자동 정리분인지 — 못 읽으면 false(지우지 않음)
const isAuto = memoEnc => {
    if (!memoEnc) return false;
    try {
        return decrypt(memoEnc).startsWith(MARK);
    } catch {
        return false;
    }
};

const log = (conn, cpId, clientId, credentialId, action) =>
    conn.query(
        "INSERT INTO wk_credential_log (cp_id, client_id, credential_id, file_id, target, action, actor_no, actor_name) VALUES (?, ?, ?, NULL, 'credential', ?, ?, ?)",
        [cpId, clientId, credentialId, action, ACTOR.no, ACTOR.name],
    );

async function run({ pool, data, cpId, dryRun = false, out = console.log }) {
    if (!keyWorks()) throw fail('KEY_NOT_READY', 'CLIENT_SECRET_KEY 없음 또는 형식 오류');
    const clients = validate(data);
    const [company] = await pool.query('SELECT 1 FROM lk_company WHERE cp_id = ? LIMIT 1', [cpId]);
    if (!company.length) throw fail('NO_COMPANY', '없는 회사 번호');

    const counts = { clients: 0, missing: 0, deleted: 0, kept: 0, inserted: 0 };
    for (const c of clients) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [found] = await conn.query('SELECT id FROM wk_client WHERE cp_id = ? AND legacy_wr_id = ? FOR UPDATE', [cpId, c.legacyWrId]);
            if (!found.length) {
                counts.missing++;
                await conn.rollback();
                continue;
            }
            const clientId = found[0].id;
            const [rows] = await conn.query('SELECT id, memo_enc FROM wk_client_credential WHERE client_id = ?', [clientId]);
            const auto = rows.filter(r => isAuto(r.memo_enc));
            counts.clients++;
            counts.deleted += auto.length;
            counts.kept += rows.length - auto.length;
            counts.inserted += c.items.length;
            if (dryRun) {
                await conn.rollback();
                continue;
            }
            for (const r of auto) {
                await conn.query('DELETE FROM wk_client_credential WHERE client_id = ? AND id = ?', [clientId, r.id]);
                await log(conn, cpId, clientId, r.id, 'delete');
            }
            // 직접 넣은 항목 뒤에 이어 붙임
            const [[{ next }]] = await conn.query('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM wk_client_credential WHERE client_id = ?', [clientId]);
            for (const [i, v] of c.items.entries()) {
                const [result] = await conn.query(
                    `INSERT INTO wk_client_credential (client_id, kind, label, url, login_id, secret_enc, memo_enc, sort, port, admin_url, admin_id, admin_secret_enc, db_host, db_name, db_id, db_secret_enc)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [clientId, v.kind, v.label, v.url, v.loginId, enc(v.secret), enc(v.memo), next + i, v.port, v.adminUrl, v.adminId, enc(v.adminSecret), v.dbHost, v.dbName, v.dbId, enc(v.dbSecret)],
                );
                await log(conn, cpId, clientId, result.insertId, 'create');
            }
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
    out(`${dryRun ? '[dry-run] ' : ''}업체 ${counts.clients} (없는 업체 ${counts.missing}) · 자동 정리 항목 삭제 ${counts.deleted} · 직접 넣은 항목 유지 ${counts.kept} · 새 항목 ${counts.inserted}${dryRun ? ' (쓰기 없음)' : ''}`);
    return counts;
}

module.exports = { run, MARK };

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const [jsonPath, cp] = args.filter(a => a !== '--dry-run');
    if (!jsonPath || !/^[1-9]\d*$/.test(cp ?? '')) {
        console.error('사용법: node scripts/reimportClientSets.js <client-sets.json> <회사 번호> [--dry-run]');
        process.exit(1);
    }
    require('dotenv').config({ path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });
    const pool = require('../src/config/dbPromise');
    let data;
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {
        console.error('실패: BAD_JSON — 파일을 읽거나 해석할 수 없음');
        process.exit(1);
    }
    run({ pool, data, cpId: Number(cp), dryRun })
        .then(() => process.exit(0))
        .catch(error => {
            console.error(`실패: ${error.code ?? 'UNKNOWN'}${error.hint ? ` — ${error.hint}` : ''} (값은 출력하지 않음, 다시 실행해도 결과 같음)`);
            process.exit(1);
        });
}

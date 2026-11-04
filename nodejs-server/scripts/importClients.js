// 예전 거래처 작업정보 → wk_client·wk_file 이전 (서버에서 1회 실행 — 여러 번 실행해도 중복 없음)
// 실행: cd nodejs-server && NODE_ENV=production node scripts/importClients.js <clients-import.json> <첨부 폴더> <회사 번호> [--dry-run]
// - 예전 메모는 여기서 CLIENT_SECRET_KEY로 암호화해 넣음(평문은 DB·SQL로 가지 않음). 키가 없거나 이미 넣은 메모를 못 읽는 키면 아무것도 안 씀
// - 업체마다 트랜잭션. 같은 (회사, 예전 글 번호)·(회사, legacy_key)는 건너뜀. 첨부는 확장자·내용 검사 통과한 것만 UUID 이름으로 복사
// - 출력은 건수만, 오류도 코드만 (JSON·첨부는 다른 회사 접속정보 평문 — 실행 뒤 바로 삭제)
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, isKeyReady } = require('../src/utils/secretBox');
const { isAllowedFile, saveWorkFile, removeWorkFile } = require('../src/utils/workUploads');

const MAX_FILE = 50 * 1024 * 1024;
const KST = "CONVERT_TZ(?, '+09:00', @@session.time_zone)";

// 값이 들어가지 않는 오류 (code로만 알림)
const fail = (code, hint) => Object.assign(new Error(hint), { code, hint });

// 시험 암호화·복호까지 되는 키인지
const keyWorks = () => {
    if (!isKeyReady()) return false;
    try {
        return decrypt(encrypt('키 확인')) === '키 확인';
    } catch {
        return false;
    }
};

const str = (v, min, max) => typeof v === 'string' && [...v].length >= min && [...v].length <= max;
const isSafeFile = v => typeof v === 'string' && /^[A-Za-z0-9_.-]+$/.test(v) && !v.includes('..');

// JSON 모양 검사 — 몇 번째인지만 알림
function validate(data) {
    if (!data || !Array.isArray(data.clients)) throw fail('BAD_JSON', 'clients 배열 없음');
    const ids = new Set();
    const keys = new Set();
    data.clients.forEach((c, i) => {
        const ok =
            Number.isInteger(c?.legacyWrId) &&
            c.legacyWrId > 0 &&
            !ids.has(c.legacyWrId) &&
            ['client', 'own'].includes(c.kind) &&
            str(c.name, 1, 100) &&
            c.name.trim() === c.name &&
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(c.createdAt) &&
            str(c.memo, 0, 200000) &&
            Array.isArray(c.files) &&
            c.files.every(
                f =>
                    typeof f?.legacyKey === 'string' &&
                    f.legacyKey.startsWith(`g_info:${c.legacyWrId}:`) &&
                    /^g_info:\d+:\d+$/.test(f.legacyKey) &&
                    !keys.has(f.legacyKey) &&
                    keys.add(f.legacyKey) &&
                    str(f.originalName, 1, 255) &&
                    isSafeFile(f.storedFile),
            );
        if (!ok) throw fail('BAD_JSON', `${i + 1}번째 업체 모양 오류`);
        ids.add(c.legacyWrId);
    });
}

// 첨부 원본 읽기 — 없거나 50MB 넘거나 확장자·내용 검사 실패면 null
const readChecked = (filesDir, f) => {
    const file = path.join(filesDir, f.storedFile);
    if (!fs.existsSync(file) || fs.statSync(file).size > MAX_FILE) return null;
    const buffer = fs.readFileSync(file);
    return isAllowedFile({ buffer, originalname: f.originalName }) ? buffer : null;
};

async function run({ pool, data, filesDir, cpId, dryRun = false, log = console.log }) {
    if (!keyWorks()) throw fail('KEY_NOT_READY', 'CLIENT_SECRET_KEY 없음 또는 형식 오류');
    validate(data);
    const [company] = await pool.query('SELECT 1 FROM lk_company WHERE cp_id = ? LIMIT 1', [cpId]);
    if (!company.length) throw fail('NO_COMPANY', '없는 회사 번호');
    // 이미 넣은 메모가 지금 키로 읽히는지 — 키가 다르면 섞여서 일부만 읽히게 되므로 멈춤
    const [old] = await pool.query('SELECT legacy_memo_enc FROM wk_client WHERE cp_id = ? AND legacy_memo_enc IS NOT NULL LIMIT 1', [cpId]);
    if (old.length) {
        try {
            decrypt(old[0].legacy_memo_enc);
        } catch {
            throw fail('KEY_MISMATCH', '이미 넣은 예전 메모를 지금 키로 읽을 수 없음 — 이전 때 쓴 키인지 확인');
        }
    }

    const counts = { clients: 0, clientsSkipped: 0, files: 0, filesSkipped: 0, filesRejected: 0 };
    if (dryRun) {
        for (const c of data.clients) {
            counts.clients++;
            for (const f of c.files) readChecked(filesDir, f) ? counts.files++ : counts.filesRejected++;
        }
        log(`[dry-run] 업체 ${counts.clients} · 첨부 ${counts.files} · 첨부 검사 실패 ${counts.filesRejected} (쓰기 없음)`);
        return counts;
    }

    for (const c of data.clients) {
        const one = { clients: 0, clientsSkipped: 0, files: 0, filesSkipped: 0, filesRejected: 0 };
        const copied = [];
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [found] = await conn.query('SELECT id FROM wk_client WHERE cp_id = ? AND legacy_wr_id = ? FOR UPDATE', [cpId, c.legacyWrId]);
            let clientId;
            if (found.length) {
                clientId = found[0].id;
                one.clientsSkipped++;
            } else {
                const [result] = await conn.query(
                    `INSERT INTO wk_client (cp_id, kind, name, legacy_memo_enc, created_at, updated_at, legacy_wr_id) VALUES (?, ?, ?, ?, ${KST}, ${KST}, ?)`,
                    [cpId, c.kind, c.name, c.memo ? encrypt(c.memo) : null, c.createdAt, c.createdAt, c.legacyWrId],
                );
                clientId = result.insertId;
                one.clients++;
            }
            // 업체가 이미 있어도 빠진 첨부는 넣음 (앞선 실행이 중간에 멈춘 경우)
            for (const f of c.files) {
                const [exists] = await conn.query('SELECT id FROM wk_file WHERE cp_id = ? AND legacy_key = ?', [cpId, f.legacyKey]);
                if (exists.length) {
                    one.filesSkipped++;
                    continue;
                }
                const buffer = readChecked(filesDir, f);
                if (!buffer) {
                    one.filesRejected++;
                    continue;
                }
                const saved = saveWorkFile({ buffer, originalname: f.originalName });
                copied.push(saved.storedName);
                await conn.query(
                    `INSERT INTO wk_file (cp_id, owner_type, owner_id, original_name, stored_name, mime, size, created_by, created_at, legacy_key) VALUES (?, 'client', ?, ?, ?, ?, ?, NULL, ${KST}, ?)`,
                    [cpId, clientId, saved.originalName, saved.storedName, saved.mime, saved.size, c.createdAt, f.legacyKey],
                );
                one.files++;
            }
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            copied.forEach(removeWorkFile);
            throw error;
        } finally {
            conn.release();
        }
        for (const k of Object.keys(counts)) counts[k] += one[k];
    }
    log(`업체 추가 ${counts.clients} · 이미 있음 ${counts.clientsSkipped} / 첨부 추가 ${counts.files} · 이미 있음 ${counts.filesSkipped} · 검사 실패(건너뜀) ${counts.filesRejected}`);
    return counts;
}

module.exports = { run };

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const [jsonPath, filesDir, cp] = args.filter(a => a !== '--dry-run');
    if (!jsonPath || !filesDir || !/^[1-9]\d*$/.test(cp ?? '')) {
        console.error('사용법: node scripts/importClients.js <clients-import.json> <첨부 폴더> <회사 번호> [--dry-run]');
        process.exit(1);
    }
    // 서버와 같은 env (운영은 .env.production)
    require('dotenv').config({ path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });
    const pool = require('../src/config/dbPromise');
    let data;
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {
        // JSON 오류 메시지에는 내용 일부가 들어갈 수 있어 출력하지 않음
        console.error('실패: BAD_JSON — 파일을 읽거나 해석할 수 없음');
        process.exit(1);
    }
    run({ pool, data, filesDir, cpId: Number(cp), dryRun })
        .then(() => process.exit(0))
        .catch(error => {
            console.error(`실패: ${error.code ?? 'UNKNOWN'}${error.hint ? ` — ${error.hint}` : ''} (값은 출력하지 않음, 다시 실행해도 중복 없음)`);
            process.exit(1);
        });
}

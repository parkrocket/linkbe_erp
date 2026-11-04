const pool = require('../config/dbPromise');

// 매출/매입 장부(wk_ledger)·계정과목(wk_account) — 모든 조회·변경은 cp_id 범위, 값은 바인딩.
// 계정과목 계층은 코드 앞부분으로 판단: 다른 계정 코드의 앞부분이 되는 계정 = 묶음(장부에 고를 수 없음), 나머지 = 항목
const Ledger = {};
const Account = {};

// LIKE 와일드카드 이스케이프 (contractModel과 같은 방식)
const escapeLike = q => q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const DATE_F = "'%Y-%m-%d'";
const DATETIME_F = "'%Y-%m-%d %H:%i:%s'";
// 표시용 KST 문자열(세션 시간대 → +09:00). 동시 수정 검사용 updated_at과는 별개
const KST = col => `DATE_FORMAT(CONVERT_TZ(${col}, @@session.time_zone, '+09:00'), ${DATETIME_F})`;

const pad = n => String(n).padStart(2, '0');
// 기간: 연 + 선택 월 → [시작, 다음 시작) 날짜 문자열 (연도·12월 경계는 문자열로 계산해 시간대 영향 없음)
const range = (year, month) => {
    const y = year || new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear(); // 기본: KST 올해
    if (!month) return [`${y}-01-01`, `${y + 1}-01-01`];
    return month === 12 ? [`${y}-12-01`, `${y + 1}-01-01`] : [`${y}-${pad(month)}-01`, `${y}-${pad(month + 1)}-01`];
};

// 공통 조건: 회사·기간·구분·계정 (list·summary 공통)
const baseConds = (cpId, { year, month, side, accountId }) => {
    const [from, to] = range(year, month);
    const conds = ['cp_id = ?', 'entry_date >= ? AND entry_date < ?'];
    const params = [cpId, from, to];
    if (side) (conds.push('side = ?'), params.push(side));
    if (accountId) (conds.push('account_id = ?'), params.push(accountId));
    return { conds, params };
};

const LIST_COLUMNS = `id, side, DATE_FORMAT(entry_date, ${DATE_F}) AS entry_date, account_id, title, memo, supply, tax, total, ${KST('created_at')} AS created_at`;

Ledger.list = async (cpId, { page = 1, size = 50, q, ...filter } = {}) => {
    const { conds, params } = baseConds(cpId, filter);
    if (q) {
        conds.push('(title LIKE ? OR memo LIKE ?)');
        params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
    }
    const where = ` WHERE ${conds.join(' AND ')}`;
    const [rows] = await pool.query(
        `SELECT ${LIST_COLUMNS} FROM wk_ledger${where} ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[count]] = await pool.query(`SELECT COUNT(*) AS n FROM wk_ledger${where}`, params);
    return { rows, total: Number(count.n) };
};

// 요약: 같은 기간·구분·계정 필터(검색어·페이지 무관), 합계는 부가세 포함 total 기준
Ledger.summary = async (cpId, filter = {}) => {
    const { conds, params } = baseConds(cpId, filter);
    const [rows] = await pool.query(
        `SELECT side, account_id, SUM(total) AS total, COUNT(*) AS n FROM wk_ledger WHERE ${conds.join(' AND ')} GROUP BY side, account_id ORDER BY side, account_id`,
        params,
    );
    let sales = 0;
    let purchase = 0;
    const byAccount = rows.map(r => {
        const total = Number(r.total);
        if (r.side === 'sales') sales += total;
        else purchase += total;
        return { accountId: r.account_id, total, count: Number(r.n) };
    });
    return { sales, purchase, diff: sales - purchase, byAccount };
};

Ledger.findById = async (cpId, id) => {
    const [rows] = await pool.query(
        `SELECT id, side, DATE_FORMAT(entry_date, ${DATE_F}) AS entry_date, account_id, title, memo, supply, tax, total, created_by, ${KST('created_at')} AS created_at, DATE_FORMAT(updated_at, ${DATETIME_F}) AS updated_at, ${KST('updated_at')} AS updated_at_kst FROM wk_ledger WHERE cp_id = ? AND id = ?`,
        [cpId, id],
    );
    return rows[0];
};

// ponytail: 계정 검사와 저장 사이 동시 계정 변경은 막지 않음, 필요하면 FOR UPDATE 또는 회사별 잠금
// 장부에 연결 가능한 계정인지: 같은 회사·같은 구분의 항목(다른 계정 코드의 앞부분이 아님)
const accountOk = async (conn, cpId, accountId, side) => {
    const [rows] = await conn.query(
        `SELECT a.id FROM wk_account a WHERE a.cp_id = ? AND a.id = ? AND a.side = ?
         AND NOT EXISTS (SELECT 1 FROM wk_account c WHERE c.cp_id = a.cp_id AND c.side = a.side AND c.id <> a.id AND c.code LIKE CONCAT(a.code, '%'))`,
        [cpId, accountId, side],
    );
    return rows.length > 0;
};

// 반환: 새 id, 계정이 항목이 아니거나 다른 회사·구분이면 null
Ledger.create = async (cpId, value, createdBy) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await accountOk(conn, cpId, value.accountId, value.side))) {
            await conn.rollback();
            return null;
        }
        const [result] = await conn.query(
            'INSERT INTO wk_ledger (cp_id, side, entry_date, account_id, title, memo, supply, tax, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cpId, value.side, value.entryDate, value.accountId, value.title, value.memo, value.supply, value.tax, value.total, createdBy],
        );
        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'ok' | 'changed'(그 사이 다른 사람이 저장) | 'missing' | 'invalid'(계정이 항목이 아니거나 다른 회사·구분)
Ledger.update = async (cpId, id, value) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await accountOk(conn, cpId, value.accountId, value.side))) {
            await conn.rollback();
            return 'invalid';
        }
        const [result] = await conn.query(
            `UPDATE wk_ledger SET side = ?, entry_date = ?, account_id = ?, title = ?, memo = ?, supply = ?, tax = ?, total = ?, updated_at = NOW() WHERE cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, ${DATETIME_F}) = ?`,
            [value.side, value.entryDate, value.accountId, value.title, value.memo, value.supply, value.tax, value.total, cpId, id, value.updatedAt || ''],
        );
        if (result.affectedRows === 0) {
            const [rows] = await conn.query('SELECT id FROM wk_ledger WHERE cp_id = ? AND id = ?', [cpId, id]);
            await conn.rollback();
            return rows.length ? 'changed' : 'missing';
        }
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

Ledger.remove = async (cpId, id) => {
    const [result] = await pool.query('DELETE FROM wk_ledger WHERE cp_id = ? AND id = ?', [cpId, id]);
    return result.affectedRows > 0;
};

// ---- 계정과목 ----

Account.list = async cpId => {
    const [rows] = await pool.query(
        `SELECT a.id, a.side, a.code, a.label, a.name, a.sort,
         (SELECT COUNT(*) FROM wk_ledger l WHERE l.cp_id = a.cp_id AND l.account_id = a.id) AS used,
         EXISTS (SELECT 1 FROM wk_account c WHERE c.cp_id = a.cp_id AND c.side = a.side AND c.id <> a.id AND c.code LIKE CONCAT(a.code, '%')) AS is_group
         FROM wk_account a WHERE a.cp_id = ? ORDER BY a.side, a.code`,
        [cpId],
    );
    return rows.map(({ is_group: isGroup, used, ...r }) => ({ ...r, used: Number(used), isGroup: Boolean(isGroup) }));
};

// 같은 회사·구분에서 이 코드가 이미 쓰이는지 (자기 자신 제외 — create는 id 0)
const codeTaken = async (conn, cpId, side, code, id) => {
    const [rows] = await conn.query('SELECT id FROM wk_account WHERE cp_id = ? AND side = ? AND code = ? AND id <> ?', [cpId, side, code, id]);
    return rows.length > 0;
};

// 묶음 무결성: 장부가 붙은 계정은 항상 항목(다른 계정 코드의 앞부분이 아님)이어야 함. 막을 것은 두 가지뿐 —
// (가) 장부 붙은 다른 계정의 코드가 새 코드의 앞부분(그 계정이 새 계정의 묶음이 되어 버림)
// (나) 이 계정에 장부가 있는데 다른 계정 코드가 새 코드로 시작(이 계정이 묶음이 됨)
// 새 코드가 장부 붙은 계정 코드의 앞부분이면 새 코드가 묶음이 될 뿐이라 허용. 코드는 영문·숫자만이라 LIKE 와일드카드 걱정 없음
// ponytail: 검사와 저장 사이 동시 장부·계정 변경은 막지 않음(내부 도구라 드묾), 필요하면 FOR UPDATE 또는 회사별 잠금
const breaksGroup = async (conn, cpId, side, id, code, selfHasLedger) => {
    const [rows] = await conn.query(
        `SELECT a.id FROM wk_account a WHERE a.cp_id = ? AND a.side = ? AND a.id <> ?
         AND ((EXISTS (SELECT 1 FROM wk_ledger l WHERE l.cp_id = a.cp_id AND l.account_id = a.id) AND ? LIKE CONCAT(a.code, '%'))
              OR (? = 1 AND a.code LIKE ?)) LIMIT 1`,
        [cpId, side, id, code, selfHasLedger ? 1 : 0, `${code}%`],
    );
    return rows.length > 0;
};

// 반환: 새 id | 'duplicate'(같은 구분에 같은 코드) | 'invalid'(장부 붙은 계정과 앞부분 관계)
Account.create = async (cpId, value) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (await codeTaken(conn, cpId, value.side, value.code, 0)) {
            await conn.rollback();
            return 'duplicate';
        }
        if (await breaksGroup(conn, cpId, value.side, 0, value.code, false)) {
            await conn.rollback();
            return 'invalid';
        }
        const [[row]] = await conn.query('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM wk_account WHERE cp_id = ? AND side = ?', [cpId, value.side]);
        const [result] = await conn.query('INSERT INTO wk_account (cp_id, side, code, label, name, sort) VALUES (?, ?, ?, ?, ?, ?)', [
            cpId, value.side, value.code, value.label, value.name, row ? row.next : 0,
        ]);
        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY') return 'duplicate'; // 동시 등록으로 유일키에 걸린 경우
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'ok' | 'missing' | 'duplicate' | 'invalid'(장부 붙은 계정의 구분이 바뀌거나, 코드 변경으로 묶음 관계가 깨짐)
Account.update = async (cpId, id, value) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [cur] = await conn.query('SELECT side, code FROM wk_account WHERE cp_id = ? AND id = ?', [cpId, id]);
        if (!cur.length) {
            await conn.rollback();
            return 'missing';
        }
        const sideChanged = cur[0].side !== value.side;
        const codeChanged = cur[0].code !== value.code;
        if (sideChanged || codeChanged) {
            if (await codeTaken(conn, cpId, value.side, value.code, id)) {
                await conn.rollback();
                return 'duplicate';
            }
            const [countRows] = await conn.query('SELECT COUNT(*) AS n FROM wk_ledger WHERE cp_id = ? AND account_id = ?', [cpId, id]);
            const selfHasLedger = Number(countRows[0] ? countRows[0].n : 0) > 0;
            // 장부가 붙은 계정의 구분을 바꾸면 장부의 side와 어긋남
            if ((sideChanged && selfHasLedger) || (await breaksGroup(conn, cpId, value.side, id, value.code, selfHasLedger))) {
                await conn.rollback();
                return 'invalid';
            }
        }
        await conn.query('UPDATE wk_account SET side = ?, code = ?, label = ?, name = ? WHERE cp_id = ? AND id = ?', [
            value.side, value.code, value.label, value.name, cpId, id,
        ]);
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY') return 'duplicate';
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'ok' | 'used'(장부 또는 하위 계정이 있음) | 'missing'
// ponytail: 확인과 삭제 사이 동시 장부 등록은 막지 않음(내부 도구·동시 작업 드묾), 필요하면 트랜잭션 + FOR UPDATE
Account.remove = async (cpId, id) => {
    const [rows] = await pool.query('SELECT id FROM wk_account WHERE cp_id = ? AND id = ?', [cpId, id]);
    if (!rows.length) return 'missing';
    const [[r]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM wk_ledger WHERE cp_id = ? AND account_id = ?)
         + (SELECT COUNT(*) FROM wk_account c JOIN wk_account a ON a.id = ? AND a.cp_id = ? WHERE c.cp_id = a.cp_id AND c.side = a.side AND c.id <> a.id AND c.code LIKE CONCAT(a.code, '%')) AS n`,
        [cpId, id, id, cpId],
    );
    if (Number(r.n) > 0) return 'used';
    await pool.query('DELETE FROM wk_account WHERE cp_id = ? AND id = ?', [cpId, id]);
    return 'ok';
};

module.exports = { Ledger, Account };

const pool = require('../config/dbPromise');
const { RECEIVABLE_SQL } = require('../utils/contractCalc');

// 견적·계약서(wk_contract) — 모든 조회·변경은 cp_id 범위, 값은 바인딩.
// 품목·담당자(wk_contract_item·wk_contract_manager)는 cp_id가 없으므로 반드시 cp_id로 확인된 contract_id로만 접근
const Contract = {};

// LIKE 와일드카드 이스케이프 (orderModel과 같은 방식)
const escapeLike = q => q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const DATE_F = "'%Y-%m-%d'";
const DATETIME_F = "'%Y-%m-%d %H:%i:%s'";
// KST 현재 시각 기준 문서번호 앞부분 (서버·DB 시간대가 달라 SQL 안에서 계산)
const DOC_NO_BASE_SQL = "DATE_FORMAT(CONVERT_TZ(NOW(), @@session.time_zone, '+09:00'), '%Y%m%d-%H%i')";

// 상태별 WHERE 조각 — 우선순위: 취소 → 보류 → 완납 → 미수 → 진행
const STATUS_SQL = {
    cancelled: 'is_cancelled = 1',
    hold: 'is_cancelled = 0 AND is_hold = 1',
    paid: 'is_cancelled = 0 AND is_hold = 0 AND is_paid_full = 1',
    unpaid: `is_cancelled = 0 AND is_hold = 0 AND is_paid_full = 0 AND (${RECEIVABLE_SQL}) > 0`,
    active: `is_cancelled = 0 AND is_hold = 0 AND is_paid_full = 0 AND (${RECEIVABLE_SQL}) <= 0`,
};

// [DB 칸, 입력 키] — 계약 본문 칸(문서번호·작성자 제외)
const FIELDS = [
    ['category_id', 'categoryId'], ['company_name', 'companyName'], ['biz_no', 'bizNo'], ['ceo_name', 'ceoName'],
    ['company_email', 'companyEmail'], ['project_name', 'projectName'], ['contract_date', 'contractDate'],
    ['delivery_date', 'deliveryDate'], ['work_period', 'workPeriod'], ['memo', 'memo'], ['link1', 'link1'], ['link2', 'link2'],
    ['total', 'total'], ['deposit', 'deposit'], ['balance', 'balance'], ['paid_amount', 'paidAmount'],
    ['is_hold', 'isHold'], ['is_cancelled', 'isCancelled'], ['is_paid_full', 'isPaidFull'], ['invoice_issued', 'invoiceIssued'],
    ['ops_server1', 'opsServer1'], ['ops_server2', 'opsServer2'], ['ops_spend', 'opsSpend'], ['ops_site', 'opsSite'],
];
const fieldValues = value => FIELDS.map(([, key]) => (typeof value[key] === 'boolean' ? Number(value[key]) : value[key]));

const LIST_COLUMNS = `id, doc_no, category_id, (SELECT name FROM wk_doc_category WHERE id = wk_contract.category_id AND cp_id = wk_contract.cp_id) AS category_name, company_name, project_name, DATE_FORMAT(contract_date, ${DATE_F}) AS contract_date, DATE_FORMAT(delivery_date, ${DATE_F}) AS delivery_date, total, paid_amount, ${RECEIVABLE_SQL} AS receivable, is_hold, is_cancelled, is_paid_full, invoice_issued, created_at`;

// 업체명 LIKE 조건 (list·companyTotals 공통)
const companyLike = (conds, params, q) => {
    if (!q) return;
    conds.push('company_name LIKE ?');
    params.push(`%${escapeLike(q)}%`);
};

Contract.list = async (cpId, { categoryId, status, from, to, q, page = 1, size = 50 } = {}) => {
    const conds = ['cp_id = ?'];
    const params = [cpId];
    if (categoryId) (conds.push('category_id = ?'), params.push(categoryId));
    if (STATUS_SQL[status]) conds.push(`(${STATUS_SQL[status]})`);
    if (from) (conds.push('contract_date >= ?'), params.push(from));
    if (to) (conds.push('contract_date <= ?'), params.push(to));
    companyLike(conds, params, q);
    const where = ` WHERE ${conds.join(' AND ')}`;
    const [rows] = await pool.query(
        `SELECT ${LIST_COLUMNS} FROM wk_contract${where} ORDER BY contract_date DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[count]] = await pool.query(`SELECT COUNT(*) AS n FROM wk_contract${where}`, params);
    return { rows, total: Number(count.n) };
};

Contract.companyTotals = async (cpId, q) => {
    const conds = ['cp_id = ?'];
    const params = [cpId];
    companyLike(conds, params, q);
    const [[r]] = await pool.query(
        `SELECT COALESCE(SUM(paid_amount), 0) AS paid, COALESCE(SUM(${RECEIVABLE_SQL}), 0) AS receivable FROM wk_contract WHERE ${conds.join(' AND ')}`,
        params,
    );
    return { paid: Number(r.paid), receivable: Number(r.receivable) };
};

Contract.findById = async (cpId, id) => {
    const [rows] = await pool.query(
        `SELECT id, cp_id, doc_no, category_id, company_name, biz_no, ceo_name, company_email, project_name, DATE_FORMAT(contract_date, ${DATE_F}) AS contract_date, DATE_FORMAT(delivery_date, ${DATE_F}) AS delivery_date, work_period, memo, link1, link2, total, deposit, balance, paid_amount, is_hold, is_cancelled, is_paid_full, invoice_issued, ops_server1, ops_server2, ops_spend, ops_site, created_by, created_at, DATE_FORMAT(updated_at, ${DATETIME_F}) AS updated_at FROM wk_contract WHERE cp_id = ? AND id = ?`,
        [cpId, id],
    );
    const contract = rows[0];
    if (!contract) return undefined; // 다른 회사·없는 계약이면 품목은 조회하지 않음
    const [items] = await pool.query(
        'SELECT id, sort, group_name, content, unit_price, qty, period, note, kind FROM wk_contract_item WHERE contract_id = ? ORDER BY sort, id',
        [contract.id],
    );
    const [managers] = await pool.query(
        'SELECT id, sort, name, phone, email, memo FROM wk_contract_manager WHERE contract_id = ? ORDER BY sort, id',
        [contract.id],
    );
    return { ...contract, items, managers };
};

// 품목·담당자 일괄 삽입 (sort = 배열 순서). contractId는 호출부가 cp_id로 확인한 값
const insertChildren = async (conn, contractId, { items, managers }) => {
    if (items.length) {
        await conn.query('INSERT INTO wk_contract_item (contract_id, sort, group_name, content, unit_price, qty, period, note, kind) VALUES ?', [
            items.map((it, i) => [contractId, i, it.groupName, it.content, it.unitPrice, it.qty, it.period, it.note, it.kind]),
        ]);
    }
    if (managers.length) {
        await conn.query('INSERT INTO wk_contract_manager (contract_id, sort, name, phone, email, memo) VALUES ?', [
            managers.map((m, i) => [contractId, i, m.name, m.phone, m.email, m.memo]),
        ]);
    }
};

// 분류가 같은 회사 것인지 (없으면 true)
const categoryOk = async (conn, cpId, categoryId) => {
    if (!categoryId) return true;
    const [rows] = await conn.query('SELECT id FROM wk_doc_category WHERE cp_id = ? AND id = ?', [cpId, categoryId]);
    return rows.length > 0;
};

// 문서번호: KST YYYYMMDD-HHmm, 같은 회사에 있으면 -2, -3… 비는 번호
Contract.nextDocNo = async (conn, cpId) => {
    const [[{ base }]] = await conn.query(`SELECT ${DOC_NO_BASE_SQL} AS base`);
    const [rows] = await conn.query('SELECT doc_no FROM wk_contract WHERE cp_id = ? AND (doc_no = ? OR doc_no LIKE ?)', [cpId, base, `${base}-%`]);
    const used = new Set(rows.map(r => r.doc_no));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
};

// 반환: 새 id, 분류가 다른 회사 것이면 null
Contract.create = async (cpId, value, createdBy) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await categoryOk(conn, cpId, value.categoryId))) {
            await conn.rollback();
            return null;
        }
        const docNo = value.docNo || (await Contract.nextDocNo(conn, cpId));
        const [result] = await conn.query(
            `INSERT INTO wk_contract (cp_id, doc_no, created_by, ${FIELDS.map(f => f[0]).join(', ')}) VALUES (?, ?, ?, ${FIELDS.map(() => '?').join(', ')})`,
            [cpId, docNo, createdBy, ...fieldValues(value)],
        );
        await insertChildren(conn, result.insertId, value);
        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'ok' | 'changed'(그 사이 다른 사람이 저장) | 'missing' | 'invalid'(분류가 다른 회사 것)
// affectedRows는 mysql2 기본(FOUND_ROWS)이라 값이 같아도 조건에 맞으면 1
Contract.update = async (cpId, id, value) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (!(await categoryOk(conn, cpId, value.categoryId))) {
            await conn.rollback();
            return 'invalid';
        }
        const [result] = await conn.query(
            `UPDATE wk_contract SET doc_no = IF(? = '', doc_no, ?), ${FIELDS.map(f => `${f[0]} = ?`).join(', ')}, updated_at = NOW() WHERE cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, ${DATETIME_F}) = ?`,
            [value.docNo || '', value.docNo || '', ...fieldValues(value), cpId, id, value.updatedAt || ''],
        );
        if (result.affectedRows === 0) {
            const [rows] = await conn.query('SELECT id FROM wk_contract WHERE cp_id = ? AND id = ?', [cpId, id]);
            await conn.rollback();
            return rows.length ? 'changed' : 'missing';
        }
        await conn.query('DELETE FROM wk_contract_item WHERE contract_id = ?', [id]);
        await conn.query('DELETE FROM wk_contract_manager WHERE contract_id = ?', [id]);
        await insertChildren(conn, id, value);
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

Contract.remove = async (cpId, id) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query('DELETE FROM wk_contract WHERE cp_id = ? AND id = ?', [cpId, id]);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return false;
        }
        await conn.query('DELETE FROM wk_contract_item WHERE contract_id = ?', [id]);
        await conn.query('DELETE FROM wk_contract_manager WHERE contract_id = ?', [id]);
        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 업체 자동 완성: 업체명 앞부분 일치, 업체마다 가장 최근 계약 1건 + 첫 담당자
Contract.companies = async (cpId, q) => {
    const [rows] = await pool.query(
        `SELECT c.company_name, c.biz_no, c.ceo_name, c.company_email, COALESCE(m.name, '') AS manager_name, COALESCE(m.phone, '') AS manager_phone, COALESCE(m.email, '') AS manager_email
         FROM wk_contract c
         LEFT JOIN wk_contract_manager m ON m.contract_id = c.id AND m.id = (SELECT id FROM wk_contract_manager WHERE contract_id = c.id ORDER BY sort, id LIMIT 1)
         WHERE c.cp_id = ? AND c.company_name LIKE ? AND c.id = (SELECT MAX(c2.id) FROM wk_contract c2 WHERE c2.cp_id = c.cp_id AND c2.company_name = c.company_name)
         ORDER BY c.company_name LIMIT 10`,
        [cpId, `${escapeLike(q || '')}%`],
    );
    return rows;
};

module.exports = Contract;

const pool = require('../config/dbPromise');

// 계약 관리(wk_site_contract) — 업체별 홈페이지 계약 기간. 모든 조회·변경은 cp_id 범위, 값은 바인딩
const SiteContract = {};

const DATE_F = "'%Y-%m-%d'";
const DATETIME_F = "'%Y-%m-%d %H:%i:%s'";

// ponytail: 페이지 없이 한 번에(예전 16건, 화면에서 걸러 봄) — 1000건 넘게 쌓이면 페이지·서버 검색 추가
// 진행 중 먼저, 그 안에서는 종료일이 가까운 순(종료일 없는 건 뒤)
SiteContract.list = async cpId => {
    const [rows] = await pool.query(
        `SELECT id, code, company_name, site_url, DATE_FORMAT(start_date, ${DATE_F}) AS start_date, DATE_FORMAT(end_date, ${DATE_F}) AS end_date,
         status, email, memo, DATE_FORMAT(updated_at, ${DATETIME_F}) AS updated_at
         FROM wk_site_contract WHERE cp_id = ? ORDER BY status = 'run' DESC, end_date IS NULL, end_date, id LIMIT 1000`,
        [cpId],
    );
    return rows;
};

const values = v => [v.code, v.companyName, v.siteUrl, v.startDate, v.endDate, v.status, v.email, v.memo];

SiteContract.create = async (cpId, v) => {
    const [result] = await pool.query(
        'INSERT INTO wk_site_contract (cp_id, code, company_name, site_url, start_date, end_date, status, email, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [cpId, ...values(v)],
    );
    return result.insertId;
};

// 반환: 'ok' | 'changed'(그 사이 다른 사람이 저장) | 'missing'
SiteContract.update = async (cpId, id, v) => {
    const [result] = await pool.query(
        `UPDATE wk_site_contract SET code = ?, company_name = ?, site_url = ?, start_date = ?, end_date = ?, status = ?, email = ?, memo = ?, updated_at = NOW()
         WHERE cp_id = ? AND id = ? AND DATE_FORMAT(updated_at, ${DATETIME_F}) = ?`,
        [...values(v), cpId, id, v.updatedAt || ''],
    );
    if (result.affectedRows > 0) return 'ok';
    const [rows] = await pool.query('SELECT id FROM wk_site_contract WHERE cp_id = ? AND id = ?', [cpId, id]);
    return rows.length ? 'changed' : 'missing';
};

SiteContract.remove = async (cpId, id) => {
    const [result] = await pool.query('DELETE FROM wk_site_contract WHERE cp_id = ? AND id = ?', [cpId, id]);
    return result.affectedRows > 0;
};

module.exports = SiteContract;

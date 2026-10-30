const pool = require('../config/dbPromise');

// 회사별 부서·직급 목록 (lk_department / lk_position) — 항상 같은 회사(cp_id) 범위
const Org = {};

// URL의 kind → 테이블·직원 칸. 테이블명은 이 고정 표에서만 오므로 SQL에 넣어도 안전
const KINDS = {
    departments: { table: 'lk_department', column: 'dept_id' },
    positions: { table: 'lk_position', column: 'position_id' },
};
Org.KINDS = KINDS;

Org.exists = async (cpId, kind, id) => {
    const [rows] = await pool.query(`SELECT id FROM ${KINDS[kind].table} WHERE cp_id = ? AND id = ? LIMIT 1`, [cpId, id]);
    return rows.length > 0;
};

module.exports = Org;

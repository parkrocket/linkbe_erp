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

// 목록 + 소속 인원(같은 회사 직원, 상태 무관) — 정렬 순서, 같으면 만든 순
Org.list = async (cpId, kind) => {
    const { table, column } = KINDS[kind];
    const [rows] = await pool.query(
        `SELECT o.id, o.name, o.sort_order, (SELECT COUNT(*) FROM lk_user u WHERE u.cp_id = o.cp_id AND u.${column} = o.id) AS member_count FROM ${table} o WHERE o.cp_id = ? ORDER BY o.sort_order, o.id`,
        [cpId],
    );
    return rows.map(r => ({ ...r, member_count: Number(r.member_count) }));
};

// 맨 뒤 순서로 추가 — 이름 중복은 UNIQUE(cp_id, name)가 막음(ER_DUP_ENTRY)
Org.create = async (cpId, kind, name) => {
    const { table } = KINDS[kind];
    const [result] = await pool.query(
        `INSERT INTO ${table} (cp_id, name, sort_order) SELECT ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM ${table} WHERE cp_id = ?`,
        [cpId, name, cpId],
    );
    return result.insertId;
};

// 반환: 대상이 있었는지
Org.rename = async (cpId, kind, id, name) => {
    const [result] = await pool.query(`UPDATE ${KINDS[kind].table} SET name = ? WHERE id = ? AND cp_id = ?`, [name, id, cpId]);
    return result.affectedRows > 0;
};

// 이웃과 자리 바꾸기 — 전체를 1부터 다시 매겨 같은 순서값(예전 데이터)도 정상 처리. 반환: 대상이 있었는지
Org.move = async (cpId, kind, id, direction) => {
    const { table } = KINDS[kind];
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT id, sort_order FROM ${table} WHERE cp_id = ? ORDER BY sort_order, id FOR UPDATE`, [cpId]);
        const index = rows.findIndex(r => r.id === id);
        if (index < 0) {
            await conn.rollback();
            return false;
        }
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target >= 0 && target < rows.length) [rows[index], rows[target]] = [rows[target], rows[index]];
        for (const [i, row] of rows.entries()) {
            if (row.sort_order !== i + 1) {
                await conn.query(`UPDATE ${table} SET sort_order = ? WHERE id = ? AND cp_id = ?`, [i + 1, row.id, cpId]);
            }
        }
        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 반환: 'in use' | 'not found' | 'ok' — 소속 직원이 있으면 삭제하지 않음 (이름 변경만 가능)
Org.remove = async (cpId, kind, id) => {
    const { table, column } = KINDS[kind];
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM lk_user WHERE cp_id = ? AND ${column} = ?`, [cpId, id]);
    if (Number(n) > 0) return 'in use';
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ? AND cp_id = ?`, [id, cpId]);
    return result.affectedRows > 0 ? 'ok' : 'not found';
};

module.exports = Org;

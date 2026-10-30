const pool = require('../config/dbPromise');

// 관리자 화면용 직원 조회·변경 — 항상 같은 회사(cp_id) 범위, 비밀번호 등 민감 컬럼은 조회하지 않음
const Admin = {};

const SAFE_COLUMNS = 'mb_no, user_id, user_name, user_phone, user_role, user_status, user_datetime';

Admin.listUsers = async (cpId, status) => {
    const [rows] = status
        ? await pool.query(`SELECT ${SAFE_COLUMNS} FROM lk_user WHERE cp_id = ? AND user_status = ? ORDER BY mb_no DESC`, [cpId, status])
        : await pool.query(`SELECT ${SAFE_COLUMNS} FROM lk_user WHERE cp_id = ? ORDER BY mb_no DESC`, [cpId]);
    return rows;
};

Admin.pendingCount = async cpId => {
    const [[row]] = await pool.query("SELECT COUNT(*) AS n FROM lk_user WHERE cp_id = ? AND user_status = 'pending'", [cpId]);
    return Number(row.n);
};

Admin.findByMbNo = async (cpId, mbNo) => {
    const [rows] = await pool.query(`SELECT ${SAFE_COLUMNS} FROM lk_user WHERE cp_id = ? AND mb_no = ?`, [cpId, mbNo]);
    return rows[0];
};

Admin.findByUserId = async (cpId, userId) => {
    const [rows] = await pool.query(`SELECT ${SAFE_COLUMNS} FROM lk_user WHERE cp_id = ? AND user_id = ?`, [cpId, userId]);
    return rows[0];
};

Admin.countApprovedAdmins = async cpId => {
    const [[row]] = await pool.query(
        "SELECT COUNT(*) AS n FROM lk_user WHERE cp_id = ? AND user_role = 'admin' AND user_status = 'approved'",
        [cpId],
    );
    return Number(row.n);
};

Admin.updateStatus = (mbNo, status) => pool.query('UPDATE lk_user SET user_status = ? WHERE mb_no = ?', [status, mbNo]);
Admin.updateRole = (mbNo, role) => pool.query('UPDATE lk_user SET user_role = ? WHERE mb_no = ?', [role, mbNo]);

module.exports = Admin;

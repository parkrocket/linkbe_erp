const pool = require('../config/dbPromise');

// 관리자 화면용 직원 조회·변경 — 항상 같은 회사(cp_id) 범위, 비밀번호 등 민감 컬럼은 조회하지 않음
const Admin = {};

// dept_id·position_id: 조직 탭 소속 명단용 (개인정보 아님)
const SAFE_COLUMNS = 'mb_no, user_id, user_name, user_phone, user_role, user_status, user_datetime, dept_id, position_id';

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

// 직원 상세(관리자 팝업) — 인사 정보 포함, 날짜는 'YYYY-MM-DD' 문자열로 (시간대 변환 방지)
Admin.findDetail = async (cpId, mbNo) => {
    const [rows] = await pool.query(
        `SELECT ${SAFE_COLUMNS}, user_email, DATE_FORMAT(user_doe, '%Y-%m-%d') AS user_doe, user_gender,
            DATE_FORMAT(user_birth, '%Y-%m-%d') AS user_birth, employment_type, user_stip, user_vaca
         FROM lk_user WHERE cp_id = ? AND mb_no = ?`,
        [cpId, mbNo],
    );
    return rows[0];
};

// 인사 정보 전체 덮어쓰기 (값은 profileValidation으로 검증된 것)
Admin.updateProfile = (cpId, mbNo, v) =>
    pool.query(
        'UPDATE lk_user SET user_name = ?, user_phone = ?, user_doe = ?, user_gender = ?, user_birth = ?, dept_id = ?, position_id = ?, employment_type = ? WHERE mb_no = ? AND cp_id = ?',
        [v.name, v.phone, v.doe, v.gender, v.birth, v.deptId, v.positionId, v.employmentType, mbNo, cpId],
    );

// 근태 현황 — 같은 회사 직원의 기간 내 근태 (개인정보 칸 제외), 날짜·이름순
Admin.listLeaves = async (cpId, from, to) => {
    const [rows] = await pool.query(
        `SELECT v.id, DATE_FORMAT(v.date, '%Y-%m-%d') AS date, v.type, v.va_datetime, u.mb_no, u.user_name, u.dept_id, u.position_id, u.user_status
         FROM lk_vacation v JOIN lk_user u ON u.user_id = v.user_id
         WHERE u.cp_id = ? AND v.date BETWEEN ? AND ? ORDER BY v.date, u.user_name`,
        [cpId, from, to],
    );
    return rows;
};

Admin.updateStatus = (mbNo, status) => pool.query('UPDATE lk_user SET user_status = ? WHERE mb_no = ?', [status, mbNo]);
Admin.updateRole = (mbNo, role) => pool.query('UPDATE lk_user SET user_role = ? WHERE mb_no = ?', [role, mbNo]);

module.exports = Admin;

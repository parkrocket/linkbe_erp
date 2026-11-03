const pool = require('../config/dbPromise');
const { STATUS_NAME } = require('../utils/expenseValidation');

// 경비(wk_expense) — 모든 조회·변경은 cp_id 범위, 값은 바인딩
const Expense = {};

// KST 현재 시각 문자열(SQL 안에서 계산 — 서버·DB 시간대가 다름)
const NOW_KST = "DATE_FORMAT(CONVERT_TZ(NOW(), @@session.time_zone, '+09:00'), '%Y-%m-%d %H:%i')";
// 본문·history 제외 목록 칸. spent_on은 문자열로
const LIST_COLUMNS = "id, writer_no, writer_name, DATE_FORMAT(spent_on, '%Y-%m-%d') AS spent_on, category, amount, title, status, created_at";

Expense.list = async (cpId, { month, status = null, writerNo = null }) => {
    const start = `${month}-01`;
    let sql = `SELECT ${LIST_COLUMNS} FROM wk_expense WHERE cp_id = ? AND spent_on >= ? AND spent_on < DATE_ADD(?, INTERVAL 1 MONTH)`;
    const params = [cpId, start, start];
    if (status) (sql += ' AND status = ?'), params.push(status);
    if (writerNo !== null && writerNo !== undefined) (sql += ' AND writer_no = ?'), params.push(writerNo);
    const [rows] = await pool.query(`${sql} ORDER BY spent_on DESC, id DESC`, params);
    return rows;
};

Expense.summary = async (cpId, { month, writerNo = null }) => {
    const start = `${month}-01`;
    let sql = 'SELECT category, COUNT(*) AS n, SUM(amount) AS total FROM wk_expense WHERE cp_id = ? AND spent_on >= ? AND spent_on < DATE_ADD(?, INTERVAL 1 MONTH)';
    const params = [cpId, start, start];
    if (writerNo !== null && writerNo !== undefined) (sql += ' AND writer_no = ?'), params.push(writerNo);
    const [rows] = await pool.query(`${sql} GROUP BY category`, params);
    const out = { count: 0, total: 0, byCategory: {} };
    for (const r of rows) {
        out.count += Number(r.n);
        out.total += Number(r.total);
        out.byCategory[r.category] = Number(r.total);
    }
    return out;
};

// 전체 칸 + 기안자 이메일(lk_user.user_id) — writer_email은 응답에 내보내지 않음(Slack DM용)
Expense.findById = async (cpId, id) => {
    const [rows] = await pool.query(
        "SELECT e.id, e.cp_id, e.writer_no, e.writer_name, DATE_FORMAT(e.spent_on, '%Y-%m-%d') AS spent_on, e.category, e.amount, e.title, e.body, e.status, e.history, e.created_at, e.updated_at, u.user_id AS writer_email FROM wk_expense e LEFT JOIN lk_user u ON u.mb_no = e.writer_no WHERE e.cp_id = ? AND e.id = ?",
        [cpId, id],
    );
    return rows[0];
};

Expense.create = async (cpId, { writerNo, writerName, spentOn, category, amount, title, body }) => {
    const [result] = await pool.query(
        `INSERT INTO wk_expense (cp_id, writer_no, writer_name, spent_on, category, amount, title, body, status, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CONCAT(${NOW_KST}, ?))`,
        [cpId, writerNo, writerName, spentOn, category, amount, title, body, ` ${writerName} 기안`],
    );
    return result.insertId;
};

// 본인 + 대기 상태일 때만 수정·삭제
Expense.updateOwnPending = async (cpId, id, writerNo, { spentOn, category, amount, title, body }) => {
    const [result] = await pool.query(
        "UPDATE wk_expense SET spent_on = ?, category = ?, amount = ?, title = ?, body = ? WHERE cp_id = ? AND id = ? AND writer_no = ? AND status = 'pending'",
        [spentOn, category, amount, title, body, cpId, id, writerNo],
    );
    return result.affectedRows === 1;
};

Expense.removeOwnPending = async (cpId, id, writerNo) => {
    const [result] = await pool.query("DELETE FROM wk_expense WHERE cp_id = ? AND id = ? AND writer_no = ? AND status = 'pending'", [cpId, id, writerNo]);
    return result.affectedRows === 1;
};

// 상태 전이: 현재 상태가 from일 때만(동시 처리 방지). history에 한 줄 추가
Expense.transition = async (cpId, id, from, to, actorName) => {
    const [result] = await pool.query(
        `UPDATE wk_expense SET status = ?, history = CONCAT(history, '\n', ${NOW_KST}, ?) WHERE cp_id = ? AND id = ? AND status = ?`,
        [to, ` ${actorName} ${STATUS_NAME[to]}`, cpId, id, from],
    );
    return result.affectedRows === 1;
};

Expense.pendingCount = async cpId => {
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM wk_expense WHERE cp_id = ? AND status = 'pending'", [cpId]);
    return Number(rows[0].n);
};

Expense.approverEmails = async cpId => {
    const [rows] = await pool.query("SELECT user_id FROM lk_user WHERE cp_id = ? AND user_status = 'approved' AND (user_role = 'admin' OR expense_approver = 1)", [cpId]);
    return rows.map(r => r.user_id);
};

module.exports = Expense;

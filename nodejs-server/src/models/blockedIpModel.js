const pool = require('../config/dbPromise');

// 차단 IP 목록(lk_blocked_ip) — 관리 화면은 같은 회사(cp_id)가 넣은 것만 보고 고침, 차단 자체는 사이트 전체에 적용
const BlockedIp = {};

BlockedIp.list = async cpId => {
    const [rows] = await pool.query(
        `SELECT b.id, b.ip, b.reason, b.mb_no, u.user_name AS target_name, b.created_by, c.user_name AS creator_name,
                DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS created_at
         FROM lk_blocked_ip b
         LEFT JOIN lk_user u ON u.mb_no = b.mb_no AND u.cp_id = b.cp_id
         LEFT JOIN lk_user c ON c.user_id = b.created_by
         WHERE b.cp_id = ? ORDER BY b.id DESC`,
        [cpId],
    );
    return rows;
};

// 이미 있으면 ER_DUP_ENTRY (컨트롤러가 409)
BlockedIp.add = async (cpId, { ip, reason, mbNo, createdBy }) => {
    const [r] = await pool.query('INSERT INTO lk_blocked_ip (cp_id, ip, reason, mb_no, created_by) VALUES (?, ?, ?, ?, ?)', [cpId, ip, reason, mbNo, createdBy]);
    return r.insertId;
};

BlockedIp.find = async (cpId, id) => {
    const [rows] = await pool.query('SELECT id, ip FROM lk_blocked_ip WHERE cp_id = ? AND id = ?', [cpId, id]);
    return rows[0] || null;
};

BlockedIp.remove = async (cpId, id) => {
    const [r] = await pool.query('DELETE FROM lk_blocked_ip WHERE cp_id = ? AND id = ?', [cpId, id]);
    return r.affectedRows > 0;
};

module.exports = BlockedIp;

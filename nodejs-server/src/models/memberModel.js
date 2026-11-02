const pool = require('../config/dbPromise');

// 고객 회원(hp_member) — 직원 lk_user와 별개. 모든 값은 바인딩, 명시 컬럼만(비밀번호 해시는 필요한 함수만)
const Member = {};

// 중복(login_id·email)은 ER_DUP_ENTRY 그대로 던짐 — 호출부가 409로 변환
Member.create = async ({ loginId, passwordHash, name, email, phone }) => {
    const [result] = await pool.query(
        'INSERT INTO hp_member (login_id, password_hash, name, email, phone, agreed_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [loginId, passwordHash, name, email, phone],
    );
    return result.insertId;
};

Member.findByLoginId = async loginId => {
    const [rows] = await pool.query(
        "SELECT id, login_id, password_hash, name, password_changed_at FROM hp_member WHERE login_id = ? AND status = 'active'",
        [loginId],
    );
    return rows[0];
};

Member.findById = async id => {
    const [rows] = await pool.query(
        'SELECT id, login_id, name, email, phone, status, password_changed_at, created_at FROM hp_member WHERE id = ?',
        [id],
    );
    return rows[0];
};

// 로그인 쿠키 확인용 — active만. 비밀번호 변경 뒤 발급된 토큰인지는 DB 시계로 비교(JS Date는 시간대가 어긋난 이력)
Member.findForSession = async (id, iatSeconds) => {
    const [rows] = await pool.query(
        "SELECT id, login_id, name, email, phone, created_at, (password_changed_at IS NOT NULL AND password_changed_at > FROM_UNIXTIME(?)) AS token_stale FROM hp_member WHERE id = ? AND status = 'active'",
        [iatSeconds, id],
    );
    return rows[0];
};

Member.findPasswordHash = async id => {
    const [rows] = await pool.query("SELECT password_hash FROM hp_member WHERE id = ? AND status = 'active'", [id]);
    return rows[0] ? rows[0].password_hash : null;
};

// newHash(예전 형식 → bcrypt 재해시)가 있어도 password_changed_at은 그대로 — 기존 로그인 쿠키 유지
Member.markLogin = async (id, newHash) => {
    if (newHash) {
        await pool.query('UPDATE hp_member SET last_login_at = NOW(), password_hash = ? WHERE id = ?', [newHash, id]);
        return;
    }
    await pool.query('UPDATE hp_member SET last_login_at = NOW() WHERE id = ?', [id]);
};

Member.updateProfile = async (id, { name, email, phone }) => {
    await pool.query("UPDATE hp_member SET name = ?, email = ?, phone = ? WHERE id = ? AND status = 'active'", [name, email, phone, id]);
};

Member.updatePassword = async (id, hash) => {
    await pool.query(
        "UPDATE hp_member SET password_hash = ?, password_changed_at = NOW(), reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ? AND status = 'active'",
        [hash, id],
    );
};

// email은 호출부가 소문자·trim. active이고 일치할 때만 토큰 저장 후 { id, name } 반환
Member.setResetToken = async (email, tokenHash, expiresAt) => {
    const [result] = await pool.query(
        "UPDATE hp_member SET reset_token_hash = ?, reset_expires_at = ? WHERE email = ? AND status = 'active'",
        [tokenHash, expiresAt, email],
    );
    if (result.affectedRows !== 1) return undefined;
    const [rows] = await pool.query("SELECT id, name FROM hp_member WHERE email = ? AND status = 'active'", [email]);
    return rows[0];
};

Member.resetPasswordByToken = async (tokenHash, hash) => {
    const [result] = await pool.query(
        "UPDATE hp_member SET password_hash = ?, password_changed_at = NOW(), reset_token_hash = NULL, reset_expires_at = NULL WHERE reset_token_hash = ? AND reset_expires_at > NOW() AND status = 'active'",
        [hash, tokenHash],
    );
    return result.affectedRows === 1;
};

// 탈퇴: 개인정보 비움(주문은 hp_order 복사본으로 남음)
Member.leave = async id => {
    const [result] = await pool.query(
        "UPDATE hp_member SET status = 'left', login_id = NULL, password_hash = NULL, email = NULL, phone = NULL, reset_token_hash = NULL, reset_expires_at = NULL, name = '탈퇴 회원', left_at = NOW() WHERE id = ? AND status = 'active'",
        [id],
    );
    return result.affectedRows === 1;
};

// q의 \ % _ 이스케이프(백슬래시 먼저)
Member.listForAdmin = async ({ q, page = 1, size = 20 } = {}) => {
    const params = [];
    let where = '';
    if (q) {
        const like = `%${q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
        where = ' WHERE (m.login_id LIKE ? OR m.name LIKE ? OR m.email LIKE ?)';
        params.push(like, like, like);
    }
    const [rows] = await pool.query(
        `SELECT m.id, m.login_id, m.name, m.email, m.phone, m.status, m.created_at, m.last_login_at, (SELECT COUNT(*) FROM hp_order o WHERE o.member_id = m.id) AS order_count FROM hp_member m${where} ORDER BY m.id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM hp_member m${where}`, params);
    return { rows, total: Number(n) };
};

module.exports = Member;

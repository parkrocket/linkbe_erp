const db = require('../config/db');
const pool = require('../config/dbPromise'); // async 쿼리용 (promise pool)
const bcrypt = require('bcrypt');

const User = {};

// 회원가입 저장 — 관리자 승인 전까지 pending (입력값은 registerValidation으로 검증·정규화된 값)
User.create = async ({ email, password, name, phone, cpId, doe, gender, birth }) => {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        'INSERT INTO lk_user (user_id, user_email, user_password, user_name, user_phone, cp_id, user_doe, user_gender, user_birth, user_role, user_status, user_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [email, email, hash, name, phone, cpId, doe, gender, birth, 'member', 'pending'],
    );
    return result.insertId;
};

// 회사는 이름만 — 사무실 IP·사업자번호 등 lk_company 칸이 로그인·auth 응답에 실려 나가던 것 차단
User.findByEmail = (userId, callback) => {
    db.query('SELECT lk_user.*, UNIX_TIMESTAMP(lk_user.pw_changed_at) AS pw_changed_sec, lk_company.cp_name FROM lk_user left join lk_company on lk_user.cp_id = lk_company.cp_id WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results[0]);
    });
};



// 요청마다 계정 상태 확인용 (requireAuth) — 필요한 컬럼만
User.findStatusById = async userId => {
    const [rows] = await pool.query('SELECT user_status, user_role, cp_id, homepage_access, work_doc_access, expense_approver, client_secret_access, UNIX_TIMESTAMP(pw_changed_at) AS pw_changed_sec FROM lk_user WHERE user_id = ?', [userId]);
    return rows[0];
};

User.findByEmailAsync = (email) => {
    return new Promise((resolve, reject) => {
        User.findByEmail(email, (err, user) => {
            if (err) {
                return reject(err);
            }
            resolve(user);
        });
    });
};

User.comparePassword = (candidatePassword, hash, callback) => {
    bcrypt.compare(candidatePassword, hash, (err, isMatch) => {
        if (err) {
            return callback(err);
        }
        return callback(null, isMatch);
    });
};

// ── 마이페이지(본인) — 개인정보 포함이라 명시 칸만, 언제나 토큰 주인(user_id) 기준 ──
User.findMe = async userId => {
    const [rows] = await pool.query(
        `SELECT u.user_id, u.user_email, u.user_name, u.user_phone, DATE_FORMAT(u.user_doe, '%Y-%m-%d') AS user_doe, u.user_gender,
                DATE_FORMAT(u.user_birth, '%Y-%m-%d') AS user_birth, u.employment_type, u.user_stip, u.user_vaca, u.user_role,
                d.name AS dept_name, p.name AS position_name
         FROM lk_user u
         LEFT JOIN lk_department d ON d.id = u.dept_id AND d.cp_id = u.cp_id
         LEFT JOIN lk_position p ON p.id = u.position_id AND p.cp_id = u.cp_id
         WHERE u.user_id = ?`,
        [userId],
    );
    return rows[0];
};

User.updateSelfProfile = (userId, v) =>
    pool.query('UPDATE lk_user SET user_name = ?, user_phone = ?, user_gender = ?, user_birth = ? WHERE user_id = ?', [v.name, v.phone, v.gender, v.birth, userId]);

User.findPasswordHash = async userId => {
    const [rows] = await pool.query('SELECT user_password FROM lk_user WHERE user_id = ?', [userId]);
    return rows[0]?.user_password ?? null;
};

// 변경 시각은 화면 기기에 새로 발급할 로그인의 iat와 같은 초 — 그보다 먼저 발급된 로그인은 requireAuth가 거절
User.updatePassword = async (userId, password, changedSec) => {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE lk_user SET user_password = ?, pw_changed_at = FROM_UNIXTIME(?) WHERE user_id = ?', [hash, changedSec, userId]);
};

module.exports = User;

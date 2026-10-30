const pool = require('../config/dbPromise');

// 잔여 장부(lk_balance_log) — 연차·휴가가 바뀌는 모든 경우(관리자 조정·신청·취소)를 1행씩 기록
const BalanceLog = {};

const MEMO_MAX = 200; // 컬럼 VARCHAR(200)

// 호출자의 트랜잭션 연결(conn)로 기록 — 기록 실패 시 잔여 변경도 함께 롤백되도록
BalanceLog.insert = (conn, { cpId, mbNo, actorMbNo, kind, before, after, memo }) => {
    const text = memo.length > MEMO_MAX ? `${memo.slice(0, MEMO_MAX - 1)}…` : memo;
    return conn.query(
        'INSERT INTO lk_balance_log (cp_id, mb_no, actor_mb_no, kind, stip_before, stip_after, vaca_before, vaca_after, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [cpId, mbNo, actorMbNo, kind, before.stip, after.stip, before.vaca, after.vaca, text],
    );
};

// 관리자 이력 화면용 — 같은 회사 직원만, 최근순, 변경한 사람 이름 포함
BalanceLog.listByMember = async (cpId, mbNo, limit = 100) => {
    const [rows] = await pool.query(
        `SELECT l.id, l.kind, l.stip_before, l.stip_after, l.vaca_before, l.vaca_after, l.memo, l.created_at, a.user_name AS actor_name
         FROM lk_balance_log l LEFT JOIN lk_user a ON a.mb_no = l.actor_mb_no
         WHERE l.cp_id = ? AND l.mb_no = ? ORDER BY l.id DESC LIMIT ?`,
        [cpId, mbNo, limit],
    );
    return rows;
};

module.exports = BalanceLog;

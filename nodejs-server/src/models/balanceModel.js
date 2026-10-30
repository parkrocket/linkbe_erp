const pool = require('../config/dbPromise');
const BalanceLog = require('./balanceLog');

// 관리자 연차·휴가 조정 — 항상 같은 회사(cp_id) 범위, 바뀐 만큼 장부(kind 'admin') 기록
const Balance = {};

// 상태 코드를 가진 오류 — 컨트롤러가 그대로 HTTP 응답 코드로 사용
class BalanceError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
Balance.BalanceError = BalanceError;

const num = v => (v === null || v === undefined ? null : Number(v));

Balance.listApproved = async cpId => {
    const [rows] = await pool.query(
        "SELECT mb_no, user_name, user_id, user_stip, user_vaca FROM lk_user WHERE cp_id = ? AND user_status = 'approved' ORDER BY user_name",
        [cpId],
    );
    return rows;
};

Balance.exists = async (cpId, mbNo) => {
    const [rows] = await pool.query('SELECT mb_no FROM lk_user WHERE cp_id = ? AND mb_no = ? LIMIT 1', [cpId, mbNo]);
    return rows.length > 0;
};

// 덮어쓰기 일괄 조정 — 하나라도 안 되면 전체 거절(트랜잭션)
// expected: 관리자가 화면을 열 때 본 값. 그 사이 신청·취소로 바뀌었으면 덮어쓰지 않고 409
Balance.adjust = async ({ cpId, actorMbNo, reason, changes }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            'SELECT mb_no, user_stip, user_vaca FROM lk_user WHERE cp_id = ? AND mb_no IN (?) FOR UPDATE',
            [cpId, changes.map(c => c.mbNo)],
        );
        const byNo = new Map(rows.map(r => [r.mb_no, r]));
        if (!changes.every(c => byNo.has(c.mbNo))) throw new BalanceError(404, 'User not found');

        const stale = changes.some(c => {
            const row = byNo.get(c.mbNo);
            return num(row.user_stip) !== c.expectedStip || num(row.user_vaca) !== c.expectedVaca;
        });
        if (stale) throw new BalanceError(409, 'Balance changed');

        let changed = 0;
        for (const c of changes) {
            const row = byNo.get(c.mbNo);
            const before = { stip: num(row.user_stip), vaca: num(row.user_vaca) };
            if (before.stip === c.stip && before.vaca === c.vaca) continue; // 그대로인 항목은 기록하지 않음

            await conn.query('UPDATE lk_user SET user_stip = ?, user_vaca = ? WHERE mb_no = ? AND cp_id = ?', [
                c.stip,
                c.vaca,
                c.mbNo,
                cpId,
            ]);
            await BalanceLog.insert(conn, {
                cpId,
                mbNo: c.mbNo,
                actorMbNo,
                kind: 'admin',
                before,
                after: { stip: c.stip, vaca: c.vaca },
                memo: reason,
            });
            changed += 1;
        }
        if (!changed) throw new BalanceError(400, 'No changes');

        await conn.commit();
        return { changed };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = Balance;

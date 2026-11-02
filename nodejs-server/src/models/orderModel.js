const pool = require('../config/dbPromise');

// 개인결제 주문(hp_order) — 모든 값은 바인딩, 명시 컬럼만
const Order = {};

const COLUMNS = 'id, order_no, member_id, product_id, product_title, amount, buyer_name, buyer_email, buyer_phone, pay_method, status, kcp_tno, kcp_app_no, vbank_bank, vbank_account, vbank_holder, vbank_due, deposit_name, buyer_memo, admin_memo, history, paid_at, cancelled_at, created_at, updated_at';

// 고객에게 내보내는 칸 — 관리자 메모·변경 기록·KCP 거래 정보는 제외
const MEMBER_COLUMNS = 'order_no, product_id, product_title, amount, pay_method, status, buyer_name, buyer_email, buyer_phone, buyer_memo, deposit_name, paid_at, cancelled_at, created_at';

// transition이 바꿀 수 있는 칸(그 밖은 throw). paid_at·cancelled_at은 값 'NOW'면 SQL NOW()
const TRANSITION_FIELDS = ['kcp_tno', 'kcp_app_no', 'vbank_bank', 'vbank_account', 'vbank_holder', 'vbank_due', 'paid_at', 'cancelled_at'];
const NOW_FIELDS = ['paid_at', 'cancelled_at'];

// q의 \ % _ 이스케이프(백슬래시 먼저)
const escapeLike = q => q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// history는 NOT NULL이라 호출부가 첫 줄을 넣음
Order.create = async o => {
    const [result] = await pool.query(
        'INSERT INTO hp_order (order_no, member_id, product_id, product_title, amount, pay_method, status, buyer_name, buyer_email, buyer_phone, buyer_memo, deposit_name, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [o.order_no, o.member_id, o.product_id, o.product_title, o.amount, o.pay_method, o.status, o.buyer_name, o.buyer_email, o.buyer_phone, o.buyer_memo, o.deposit_name, o.history],
    );
    return result.insertId;
};

Order.findByOrderNo = async orderNo => {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM hp_order WHERE order_no = ?`, [orderNo]);
    return rows[0];
};

Order.findByTno = async tno => {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM hp_order WHERE kcp_tno = ?`, [tno]);
    return rows[0];
};

Order.findById = async id => {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM hp_order WHERE id = ?`, [id]);
    return rows[0];
};

// 상태 전이: 현재 상태가 fromStatuses 중 하나일 때만 바꿈(중복 처리·경합 방지). historyLine은 앞에 줄바꿈을 붙여 이어 씀
Order.transition = async (orderNo, fromStatuses, toStatus, fields, historyLine) => {
    if (!Array.isArray(fromStatuses) || fromStatuses.length === 0) throw new Error('transition fromStatuses는 비어 있지 않은 배열');
    const sets = ['status = ?'];
    const params = [toStatus];
    for (const [key, value] of Object.entries(fields || {})) {
        if (!TRANSITION_FIELDS.includes(key)) throw new Error(`transition 허용되지 않은 칸: ${key}`);
        if (NOW_FIELDS.includes(key) && value === 'NOW') {
            sets.push(`${key} = NOW()`);
        } else {
            sets.push(`${key} = ?`);
            params.push(value);
        }
    }
    sets.push('history = CONCAT(history, ?)');
    params.push(`\n${historyLine}`, orderNo, fromStatuses);
    const [result] = await pool.query(`UPDATE hp_order SET ${sets.join(', ')} WHERE order_no = ? AND status IN (?)`, params);
    return result.affectedRows === 1;
};

// 결제 시도 전(pending)은 회원에게 보이지 않음
Order.listForMember = async memberId => {
    const [rows] = await pool.query(
        `SELECT ${MEMBER_COLUMNS} FROM hp_order WHERE member_id = ? AND status <> 'pending' ORDER BY created_at DESC, id DESC`,
        [memberId],
    );
    return rows;
};

// 본인 주문만(member_id 조건)
Order.findForMember = async (memberId, orderNo) => {
    const [rows] = await pool.query(`SELECT ${MEMBER_COLUMNS} FROM hp_order WHERE member_id = ? AND order_no = ?`, [memberId, orderNo]);
    return rows[0];
};

// 기본은 pending 제외, status='pending'을 명시하면 그것만. from·to는 'YYYY-MM-DD'
Order.listForAdmin = async ({ status, payMethod, from, to, q, page = 1, size = 20 } = {}) => {
    page = Number(page);
    size = Number(size);
    const conds = [];
    const params = [];
    if (status) {
        conds.push('status = ?');
        params.push(status);
    } else {
        conds.push("status <> 'pending'");
    }
    if (payMethod) {
        conds.push('pay_method = ?');
        params.push(payMethod);
    }
    if (from) {
        conds.push('created_at >= ?');
        params.push(from);
    }
    if (to) {
        conds.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(to);
    }
    if (q) {
        const like = `%${escapeLike(q)}%`;
        conds.push('(order_no LIKE ? OR buyer_name LIKE ? OR product_title LIKE ?)');
        params.push(like, like, like);
    }
    const where = ` WHERE ${conds.join(' AND ')}`;
    const [rows] = await pool.query(
        `SELECT ${COLUMNS} FROM hp_order${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, size, (page - 1) * size],
    );
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM hp_order${where}`, params);
    return { rows, total: Number(n) };
};

// 관리 배지용 입금 대기 건수
Order.awaitingCount = async () => {
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM hp_order WHERE status = 'awaiting_deposit'");
    return Number(n);
};

Order.setAdminMemo = async (id, memo) => {
    const [result] = await pool.query('UPDATE hp_order SET admin_memo = ? WHERE id = ?', [memo, id]);
    return result.affectedRows === 1;
};

Order.hasOrders = async productId => {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM hp_order WHERE product_id = ?', [productId]);
    return Number(n) > 0;
};

// 상태는 그대로 두고 변경 기록만 추가
Order.appendHistory = async (orderNo, line) => {
    const [result] = await pool.query('UPDATE hp_order SET history = CONCAT(history, ?) WHERE order_no = ?', [`\n${line}`, orderNo]);
    return result.affectedRows === 1;
};

module.exports = Order;

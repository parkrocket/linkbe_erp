const Member = require('../models/memberModel');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)
const kcp = require('../utils/kcp'); // 호출 시점 참조 (점검에서 가짜 교체)
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const { intIn, flag, html, text, publicFileOrNull, actorNo } = require('./adminHomepageController').helpers;
const { notify, kstStamp } = require('./shopController');

// 쇼핑(고객 회원) 관리자 API — requireAuth + requireHomepage 뒤에서만
const positiveInt = v => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('admin shop api error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

exports.listMembers = handle(async (req, res) => {
    const page = positiveInt(req.query.page) || 1;
    const size = Math.min(positiveInt(req.query.size) || 20, 50);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { rows, total } = await Member.listForAdmin({ q, page, size });
    res.json({
        members: rows.map(r => ({
            id: r.id,
            loginId: r.login_id,
            name: r.name,
            email: r.email,
            status: r.status,
            createdAt: r.created_at,
            lastLoginAt: r.last_login_at,
            orderCount: Number(r.order_count),
        })),
        total,
        page,
        size,
    });
});

exports.leaveMember = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const member = id && (await Member.findById(id));
    if (!member || member.status !== 'active' || !(await Member.leave(id))) return res.status(404).json({ error: 'Member not found' });
    res.json({ ok: true });
    try {
        await slack.sendSlackMessage(process.env.SLACK_SHOP_CHANNEL || '#결제', `[회원탈퇴] 관리자 처리: ${escapeSlack(member.name)}님 (처리: 직원 #${req.userId})`);
    } catch (error) {
        console.error('admin shop slack notice failed:', error.message);
    }
});

const fail = (res, code, error, extra) => res.status(code).json({ error, ...extra });
const won = n => Number(n).toLocaleString('en-US');
const notice = (req, msg) => notify(`${msg} (처리: 직원 #${req.userId})`);

// ── 개인결제 상품 ──
const toProductRow = r => ({
    id: r.id,
    title: r.title,
    price: Number(r.price),
    imageFileId: r.image_file_id,
    isVisible: !!r.is_visible,
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
    ...(r.order_count !== undefined && { orderCount: Number(r.order_count) }),
    ...(r.body_html !== undefined && { bodyHtml: r.body_html }),
});

exports.listProducts = handle(async (req, res) => {
    const page = positiveInt(req.query.page) || 1;
    const { rows, total } = await Product.listForAdmin({ page, size: 30 });
    res.json({ products: rows.map(toProductRow), total, page, size: 30 });
});

exports.getProduct = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const row = id && (await Product.findById(id));
    if (!row) return fail(res, 404, 'Not found');
    res.json({ product: toProductRow(row) });
});

exports.saveProduct = handle(async (req, res) => {
    const id = req.params.id ? positiveInt(req.params.id) : null;
    if (req.params.id && (!id || !(await Product.findById(id)))) return fail(res, 404, 'Not found');
    const b = req.body || {};
    const title = text(b.title, 200);
    if (!title) return fail(res, 400, 'Invalid title');
    const price = intIn(b.price, 1, 100000000, NaN);
    if (!Number.isInteger(price)) return fail(res, 400, 'Invalid price');
    const bodyHtml = html(b.bodyHtml ?? '');
    if (bodyHtml === null) return fail(res, 400, 'Invalid body');
    const imageFileId = await publicFileOrNull(b.imageFileId);
    if (imageFileId === undefined) return fail(res, 400, 'Invalid file');
    const sortOrder = intIn(b.sortOrder, 0, 100000, 0);
    if (Number.isNaN(sortOrder)) return fail(res, 400, 'Invalid sortOrder');
    let expected = null;
    if (id) {
        // 수정은 화면을 열 때의 updatedAt 필수(없으면 남의 수정을 덮어쓸 수 있음)
        if (!b.expectedUpdatedAt) return fail(res, 400, 'Missing expectedUpdatedAt');
        expected = new Date(b.expectedUpdatedAt);
        if (Number.isNaN(expected.getTime())) return fail(res, 400, 'Invalid expectedUpdatedAt');
    }
    const saved = await Product.save(id, { title, price, bodyHtml, imageFileId, isVisible: flag(b.isVisible, 1), sortOrder }, await actorNo(req), expected);
    if (saved === 'conflict') return fail(res, 409, 'Product changed');
    res.json({ ok: true, id: saved });
});

exports.deleteProduct = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const result = id && (await Product.remove(id));
    if (result === 'has_orders') return fail(res, 409, 'Has orders');
    if (!result) return fail(res, 404, 'Not found');
    res.json({ ok: true });
});

// ── 개인결제 주문 ──
const ORDER_STATUSES = ['pending', 'awaiting_deposit', 'paid', 'completed', 'cancelled'];
const PAY_METHODS = ['card', 'bank', 'deposit'];
const dateOnly = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

const toOrderRow = (r, detail) => ({
    id: r.id,
    orderNo: r.order_no,
    memberId: r.member_id,
    productId: r.product_id,
    productTitle: r.product_title,
    amount: Number(r.amount),
    buyerName: r.buyer_name,
    payMethod: r.pay_method,
    status: r.status,
    depositName: r.deposit_name,
    vbankDue: r.vbank_due,
    paidAt: r.paid_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    legacy: r.legacy_od_id != null,
    ...(detail && {
        buyerEmail: r.buyer_email,
        buyerPhone: r.buyer_phone,
        buyerMemo: r.buyer_memo,
        adminMemo: r.admin_memo,
        kcpTno: r.kcp_tno,
        kcpAppNo: r.kcp_app_no,
        vbankBank: r.vbank_bank,
        vbankAccount: r.vbank_account,
        vbankHolder: r.vbank_holder,
        history: r.history,
    }),
});

exports.listOrders = handle(async (req, res) => {
    const q = req.query;
    const page = positiveInt(q.page) || 1;
    const size = Math.min(positiveInt(q.size) || 30, 50);
    const { rows, total } = await Order.listForAdmin({
        status: ORDER_STATUSES.includes(q.status) ? q.status : undefined,
        payMethod: PAY_METHODS.includes(q.payMethod) ? q.payMethod : undefined,
        from: dateOnly(q.from),
        to: dateOnly(q.to),
        q: typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '',
        page,
        size,
    });
    res.json({ orders: rows.map(r => toOrderRow(r, false)), total, page, size });
});

const loadOrder = async (req, res) => {
    const id = positiveInt(req.params.id);
    const order = id && (await Order.findById(id));
    if (!order) fail(res, 404, 'Order not found');
    return order;
};

exports.getOrder = handle(async (req, res) => {
    const order = await loadOrder(req, res);
    if (order) res.json({ order: toOrderRow(order, true) });
});

// 상태 하나만 바꾸는 조치(입금 확인·완료)
const simpleTransition = (from, to, fields, label) => handle(async (req, res) => {
    const order = await loadOrder(req, res);
    if (!order) return;
    if (order.status !== from) return fail(res, 400, 'Invalid transition');
    if (!(await Order.transition(order.order_no, [from], to, fields, `${kstStamp()} 직원#${req.userId} ${label}`))) return fail(res, 409, 'Order changed');
    res.json({ ok: true });
    await notice(req, `[${label}] ${order.order_no} ${escapeSlack(order.product_title)} ${won(order.amount)}원`);
});
exports.confirmDeposit = simpleTransition('awaiting_deposit', 'paid', { paid_at: 'NOW' }, '입금 확인');
exports.completeOrder = simpleTransition('paid', 'completed', {}, '완료 처리');

exports.setOrderMemo = handle(async (req, res) => {
    const order = await loadOrder(req, res);
    if (!order) return;
    const memo = text(req.body?.memo, 1000);
    if (memo === null) return fail(res, 400, 'Invalid memo');
    await Order.setAdminMemo(order.id, memo);
    res.json({ ok: true });
});

exports.cancelOrder = handle(async (req, res) => {
    const order = await loadOrder(req, res);
    if (!order) return;
    const reason = text(req.body?.reason, 200);
    if (!reason) return fail(res, 400, 'Invalid reason');
    const wasPaid = ['paid', 'completed'].includes(order.status);
    // 예전 사이트에서 옮긴 주문은 수단과 상관없이 KCP 취소를 부르지 않는다:
    // kcp_tno가 예전 거래번호라서, 부르면 몇 년 전 결제가 실제로 환불될 수 있음 → 상태만 바꾸고 환불은 직접
    const legacy = order.legacy_od_id != null;
    const viaKcp = !legacy && ['card', 'bank'].includes(order.pay_method);
    const canCancel = viaKcp ? wasPaid : wasPaid || order.status === 'awaiting_deposit';
    if (!canCancel) return fail(res, 400, 'Invalid transition');

    if (viaKcp) {
        // KCP 사유는 ASCII만 가능 — 한글 사유는 history·Slack에만
        const r = await kcp.cancel({ tno: order.kcp_tno, reason: 'admin cancel', custIp: req.ip, orderNo: order.order_no });
        if (!r.ok) return fail(res, 400, 'KCP cancel failed', { message: r.resMsg });
    }
    const line = `${kstStamp()} 직원#${req.userId} 주문 취소: ${reason}${legacy ? ' (예전 주문 — KCP 취소 안 함, 환불은 직접)' : ''}`;
    const done = await Order.transition(order.order_no, wasPaid ? ['paid', 'completed'] : ['awaiting_deposit'], 'cancelled', { cancelled_at: 'NOW' }, line);
    if (!done) {
        if (viaKcp) await notice(req, `[주문 취소] ${order.order_no} — KCP 취소는 됐지만 주문 상태를 바꾸지 못했어요 — 확인 필요`);
        return fail(res, 409, 'Order changed');
    }
    const refundManually = !viaKcp && wasPaid;
    res.json({ ok: true, refundManually });
    await notice(req, `[주문 취소] ${order.order_no} ${escapeSlack(order.product_title)} ${won(order.amount)}원 — ${escapeSlack(reason)}${legacy ? ' (예전 주문 — KCP 취소 안 함, 환불은 직접)' : refundManually ? ' (수동 환불 필요)' : ''}`);
});

exports.summary = handle(async (req, res) => res.json({ awaitingCount: await Order.awaitingCount() }));

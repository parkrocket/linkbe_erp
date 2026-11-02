// 고객 회원 관리 API 점검: node scripts/checkShopAdmin.js  (모델·Slack 가짜)
const assert = require('assert');
const slack = require('../src/utils/slack');
const notices = [];
slack.sendSlackMessage = async (channel, text) => void notices.push({ channel, text });

const { requireHomepage } = require('../src/middlewares/requireHomepage');
const Member = require('../src/models/memberModel');
const Product = require('../src/models/productModel');
const Order = require('../src/models/orderModel');
const Admin = require('../src/models/adminModel');
const Homepage = require('../src/models/homepageModel');
const kcp = require('../src/utils/kcp');

let listArgs;
Member.listForAdmin = async args => {
    listArgs = args;
    return { rows: [{ id: 1, login_id: 'a', name: '김', email: 'a@x.kr', phone: '010', status: 'active', created_at: 'c', last_login_at: null, order_count: '3', password_hash: 'x' }], total: 1 };
};
const members = { 5: { id: 5, name: '<b>홍</b>&', status: 'active' }, 6: { id: 6, name: '탈퇴 회원', status: 'left' } };
Member.findById = async id => members[id];
const left = [];
Member.leave = async id => (left.push(id), id === 5);

const ctrl = require('../src/controllers/adminShopController');
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ params: {}, query: {}, body: {}, ...req }, res);
    return res;
};

(async () => {
    const mw = req => new Promise(resolve => {
        const res = { status: c => ({ json: b => resolve([c, b]) }) };
        requireHomepage(req, res, () => resolve('next'));
    });
    assert.deepStrictEqual(await mw({ userRole: 'member', userHomepage: false }), [403, { error: 'Homepage only' }]);
    assert.strictEqual(await mw({ userRole: 'member', userHomepage: true }), 'next');

    let res = await call(ctrl.listMembers, { query: { q: '  김  ', page: '2', size: '999' } });
    assert.deepStrictEqual(listArgs, { q: '김', page: 2, size: 50 });
    assert.deepStrictEqual(Object.keys(res.body.members[0]), ['id', 'loginId', 'name', 'email', 'status', 'createdAt', 'lastLoginAt', 'orderCount']);
    assert.strictEqual(res.body.members[0].orderCount, 3);
    assert.ok(!JSON.stringify(res.body).includes('password') && !JSON.stringify(res.body).includes('010'));
    assert.deepStrictEqual([res.body.total, res.body.page, res.body.size], [1, 2, 50]);
    await call(ctrl.listMembers, { query: { page: '-1', size: 'x', q: 'a'.repeat(150) } });
    assert.deepStrictEqual([listArgs.page, listArgs.size, listArgs.q.length], [1, 20, 100]);

    for (const id of ['abc', '0', '99', '6']) {
        res = await call(ctrl.leaveMember, { params: { id } });
        assert.deepStrictEqual([res.code, res.body], [404, { error: 'Member not found' }], id);
    }
    assert.deepStrictEqual(left, [], '없거나 이미 탈퇴면 leave 호출 안 함');
    assert.strictEqual(notices.length, 0);

    res = await call(ctrl.leaveMember, { params: { id: '5' }, userId: 7 });
    assert.deepStrictEqual(res.body, { ok: true });
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].text, '[회원탈퇴] 관리자 처리: &lt;b&gt;홍&lt;/b&gt;&amp;님 (처리: 직원 #7)');

    // ── 상품 ──
    notices.length = 0;
    const saves = [];
    const prods = { 3: { id: 3, title: 'P', price: 1000, body_html: '<p>x</p>', image_file_id: null, is_visible: 1, sort_order: 0, updated_at: new Date('2026-01-01T00:00:00Z') } };
    Product.findById = async id => prods[id];
    Product.listForAdmin = async () => ({ rows: [{ ...prods[3], body_html: undefined, order_count: '2' }], total: 1 });
    let saveResult = 7;
    Product.save = async (...a) => (saves.push(a), saveResult);
    let removeResult = true;
    Product.remove = async () => removeResult;
    Admin.findByUserId = async () => ({ mb_no: 9 });
    Homepage.findFile = async id => ({ 1: { visibility: 'public' }, 2: { visibility: 'private' } })[id];

    res = await call(ctrl.listProducts, {});
    assert.deepStrictEqual([res.body.products[0].orderCount, res.body.products[0].isVisible, res.body.products[0].bodyHtml], [2, true, undefined]);
    res = await call(ctrl.getProduct, { params: { id: '3' } });
    assert.strictEqual(res.body.product.bodyHtml, '<p>x</p>');
    assert.strictEqual((await call(ctrl.getProduct, { params: { id: '99' } })).code, 404);

    const good = { title: ' 상품 ', price: 5000, bodyHtml: '<p>a</p><script>x</script>', imageFileId: 1, isVisible: true, sortOrder: 2 };
    res = await call(ctrl.saveProduct, { body: good, userId: 1 });
    assert.deepStrictEqual(res.body, { ok: true, id: 7 });
    assert.strictEqual(saves[0][0], null);
    assert.strictEqual(saves[0][1].title, '상품');
    assert.ok(!saves[0][1].bodyHtml.includes('script'));
    assert.strictEqual(saves[0][2], 9);
    for (const bad of [{ title: '' }, { price: 0 }, { price: 100000001 }, { price: 1.5 }, { price: undefined }, { imageFileId: 2 }, { sortOrder: 'x' }]) {
        res = await call(ctrl.saveProduct, { body: { ...good, ...bad } });
        assert.strictEqual(res.code, 400, JSON.stringify(bad));
    }
    assert.strictEqual(saves.length, 1);

    res = await call(ctrl.saveProduct, { params: { id: '3' }, body: good });
    assert.deepStrictEqual([res.code, res.body], [400, { error: 'Missing expectedUpdatedAt' }]);
    assert.strictEqual((await call(ctrl.saveProduct, { params: { id: '99' }, body: { ...good, expectedUpdatedAt: 'x' } })).code, 404);
    res = await call(ctrl.saveProduct, { params: { id: '3' }, body: { ...good, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' } });
    assert.deepStrictEqual(res.body, { ok: true, id: 7 });
    assert.ok(saves[1][3] instanceof Date && saves[1][3].toISOString() === '2026-01-01T00:00:00.000Z');
    saveResult = 'conflict';
    res = await call(ctrl.saveProduct, { params: { id: '3' }, body: { ...good, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' } });
    assert.deepStrictEqual([res.code, res.body], [409, { error: 'Product changed' }]);
    removeResult = 'has_orders';
    res = await call(ctrl.deleteProduct, { params: { id: '3' } });
    assert.deepStrictEqual([res.code, res.body], [409, { error: 'Has orders' }]);
    removeResult = false;
    assert.strictEqual((await call(ctrl.deleteProduct, { params: { id: '3' } })).code, 404);
    removeResult = true;
    assert.deepStrictEqual((await call(ctrl.deleteProduct, { params: { id: '3' } })).body, { ok: true });

    // ── 주문 ──
    const mk = (id, payMethod, status) => ({ id, order_no: `LB${id}`, product_title: '<상품>', amount: 5000, pay_method: payMethod, status, kcp_tno: '123', history: 'h', admin_memo: 'm', buyer_email: 'e', buyer_phone: 'p' });
    const orders = {};
    [[1, 'deposit', 'awaiting_deposit'], [2, 'deposit', 'paid'], [3, 'deposit', 'completed'], [4, 'card', 'paid'], [5, 'bank', 'completed'], [6, 'card', 'pending'], [7, 'card', 'cancelled'], [8, 'card', 'awaiting_deposit'], [9, 'deposit', 'pending']]
        .forEach(([id, m, s]) => (orders[id] = mk(id, m, s)));
    Order.findById = async id => orders[id];
    const trans = [];
    let transResult = true;
    Order.transition = async (...a) => (trans.push(a), transResult);
    let listOrderArgs;
    Order.listForAdmin = async a => ((listOrderArgs = a), { rows: [orders[1]], total: 1 });
    Order.awaitingCount = async () => 4;
    const memos = [];
    Order.setAdminMemo = async (id, m) => (memos.push([id, m]), true);
    const kcpCalls = [];
    let kcpResult = { ok: true, resCd: '0000', resMsg: 'ok' };
    kcp.cancel = async a => (kcpCalls.push(a), kcpResult);
    const act = (fn, id, body, extra) => call(fn, { params: { id: String(id) }, body: body || {}, userId: 7, ip: '1.2.3.4', ...extra });

    res = await call(ctrl.listOrders, { query: { status: 'bad', payMethod: 'card', from: '2026-01-01', to: 'x', q: ' 김 ', size: '999' } });
    assert.deepStrictEqual(listOrderArgs, { status: undefined, payMethod: 'card', from: '2026-01-01', to: undefined, q: '김', page: 1, size: 50 });
    assert.ok(!('history' in res.body.orders[0]) && !('kcpTno' in res.body.orders[0]) && !('buyerEmail' in res.body.orders[0]));
    res = await call(ctrl.getOrder, { params: { id: '1' } });
    assert.deepStrictEqual([res.body.order.history, res.body.order.adminMemo, res.body.order.kcpTno, res.body.order.buyerEmail, res.body.order.buyerPhone], ['h', 'm', '123', 'e', 'p']);
    assert.strictEqual((await call(ctrl.getOrder, { params: { id: '99' } })).code, 404);
    assert.deepStrictEqual((await call(ctrl.summary, {})).body, { awaitingCount: 4 });

    // 입금 확인: awaiting_deposit만
    for (const id of [2, 6, 7]) assert.deepStrictEqual((await act(ctrl.confirmDeposit, id)).body, { error: 'Invalid transition' }, `confirm ${id}`);
    assert.strictEqual(trans.length, 0);
    res = await act(ctrl.confirmDeposit, 1);
    assert.deepStrictEqual(res.body, { ok: true });
    assert.deepStrictEqual(trans[0].slice(0, 4), ['LB1', ['awaiting_deposit'], 'paid', { paid_at: 'NOW' }]);
    assert.ok(/직원#7 입금 확인$/.test(trans[0][4]));
    assert.ok(notices.pop().text.endsWith('(처리: 직원 #7)'));
    transResult = false;
    assert.deepStrictEqual([(await act(ctrl.confirmDeposit, 1)).code], [409]);
    transResult = true;

    // 완료: paid만
    for (const id of [1, 3, 6, 7]) assert.strictEqual((await act(ctrl.completeOrder, id)).code, 400, `complete ${id}`);
    assert.deepStrictEqual((await act(ctrl.completeOrder, 2)).body, { ok: true });
    assert.deepStrictEqual(trans.at(-1).slice(0, 3), ['LB2', ['paid'], 'completed']);

    // 메모
    assert.deepStrictEqual((await act(ctrl.setOrderMemo, 1, { memo: '확인' })).body, { ok: true });
    assert.deepStrictEqual(memos, [[1, '확인']]);
    assert.strictEqual((await act(ctrl.setOrderMemo, 1, { memo: 'a'.repeat(1001) })).code, 400);

    // 취소
    notices.length = 0;
    const before = trans.length;
    assert.strictEqual((await act(ctrl.cancelOrder, 1, { reason: '' })).code, 400);
    for (const id of [6, 7, 8, 9]) assert.deepStrictEqual((await act(ctrl.cancelOrder, id, { reason: '사유' })).body, { error: 'Invalid transition' }, `cancel ${id}`);
    assert.strictEqual(trans.length, before);
    assert.strictEqual(kcpCalls.length, 0);
    assert.strictEqual(notices.length, 0);

    // deposit 대기 → 환불 불필요, KCP 호출 없음
    res = await act(ctrl.cancelOrder, 1, { reason: '고객 요청' });
    assert.deepStrictEqual(res.body, { ok: true, refundManually: false });
    assert.deepStrictEqual(trans.at(-1).slice(0, 4), ['LB1', ['awaiting_deposit'], 'cancelled', { cancelled_at: 'NOW' }]);
    assert.ok(trans.at(-1)[4].includes('직원#7') && trans.at(-1)[4].includes('고객 요청'));
    assert.strictEqual(kcpCalls.length, 0);
    // deposit 입금 후 → 수동 환불 안내
    assert.deepStrictEqual((await act(ctrl.cancelOrder, 2, { reason: 'r' })).body, { ok: true, refundManually: true });
    assert.deepStrictEqual((await act(ctrl.cancelOrder, 3, { reason: 'r' })).body, { ok: true, refundManually: true });
    assert.deepStrictEqual(trans.at(-1)[1], ['paid', 'completed']);
    assert.strictEqual(kcpCalls.length, 0);
    // 카드·계좌이체 → KCP 취소(ASCII 사유 고정)
    res = await act(ctrl.cancelOrder, 4, { reason: '한글 사유 <b>' });
    assert.deepStrictEqual(res.body, { ok: true, refundManually: false });
    assert.deepStrictEqual(kcpCalls[0], { tno: '123', reason: 'admin cancel', custIp: '1.2.3.4', orderNo: 'LB4' });
    assert.ok(notices.at(-1).text.includes('&lt;b&gt;') && notices.at(-1).text.endsWith('(처리: 직원 #7)'));
    assert.strictEqual((await act(ctrl.cancelOrder, 5, { reason: 'r' })).body.ok, true);
    assert.strictEqual(kcpCalls.length, 2);
    // KCP 실패 → 상태 그대로
    const tBefore = trans.length;
    kcpResult = { ok: false, resCd: 'X', resMsg: 'denied' };
    res = await act(ctrl.cancelOrder, 4, { reason: 'r' });
    assert.deepStrictEqual([res.code, res.body], [400, { error: 'KCP cancel failed', message: 'denied' }]);
    assert.strictEqual(trans.length, tBefore);
    // KCP 성공 후 상태 경합 → 경고 + 409
    kcpResult = { ok: true };
    transResult = false;
    notices.length = 0;
    res = await act(ctrl.cancelOrder, 4, { reason: 'r' });
    assert.deepStrictEqual([res.code, res.body], [409, { error: 'Order changed' }]);
    assert.ok(notices[0].text.includes('KCP 취소는 됐지만 주문 상태를 바꾸지 못했어요 — 확인 필요'));

    console.log('checkShopAdmin OK');
})().catch(error => {
    console.error(error);
    process.exit(1);
});

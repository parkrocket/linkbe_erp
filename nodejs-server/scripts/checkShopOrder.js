// 고객 상품·주문 API 점검: node scripts/checkShopOrder.js  (Product·Order·kcp·Slack 가짜, 컨트롤러 직접 호출 — DB·KCP 접속 없음)
const assert = require('assert');
const rateLimit = require('../src/utils/rateLimit');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => void notices.push({ channel, text });

// 상품 가짜: id 1 판매 중, id 2 숨김
const products = { 1: { id: 1, title: '상담 <비용>', price: 12000, body_html: '<p>본문</p><script>x()</script>', image_file_id: 7 } };
const Product = require('../src/models/productModel');
Product.listVisible = async () => [{ id: 1, title: '상담 <비용>', price: '12000', image_file_id: null }];
Product.findVisible = async id => products[id];

// 주문 가짜: 저장 내용을 그대로 보관
const Order = require('../src/models/orderModel');
let saved = [];
let dupOnce = false;
Order.create = async o => {
    if (dupOnce) {
        dupOnce = false;
        throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    }
    saved.push(o);
    return saved.length;
};
Order.appendHistory = async () => true;
Order.listForMember = async mid => saved.filter(o => o.member_id === mid && o.status !== 'pending').map(o => ({ ...o, paid_at: null, created_at: 'T' }));
Order.findForMember = async (mid, no) => {
    const o = saved.find(x => x.member_id === mid && x.order_no === no);
    return o && { ...o, paid_at: null, created_at: 'T' };
};

// KCP 가짜
const kcp = require('../src/utils/kcp');
let ready = true;
kcp.kcpConfig = () => ({ ready, env: 'test', siteCd: 'T0000', siteName: '링크비', jsUrl: 'https://testpay.example/plugin.jsp', gwHost: 'gw' });
const approvalCalls = [];
let approvalOk = true;
kcp.requestMobileApprovalKey = async a => (approvalCalls.push(a), approvalOk ? { ok: true, approvalKey: 'AK', payUrl: 'https://m.example/pay', resMsg: '' } : { ok: false, resMsg: 'x' });

const ctrl = require('../src/controllers/shopController');

const mkRes = () => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    return res;
};
const member = { id: 5, login_id: 'u', name: '홍<길동>', email: 'a@b.co', phone: '010-1234-5678' };
const call = async (fn, req) => {
    const res = mkRes();
    await fn({ params: {}, body: {}, get: h => ({ host: 'linkbe.kr', 'user-agent': 'UA' })[h], member, ...req }, res);
    return res;
};
const reset = () => {
    rateLimit.reset();
    notices = [];
    saved = [];
    approvalCalls.length = 0;
    ready = true;
    approvalOk = true;
    process.env.SHOP_BANK_ACCOUNT = '은행 000-000';
};

(async () => {
    // ── 상품 ──
    reset();
    let r = await call(ctrl.listProducts, {});
    assert.deepStrictEqual(r.body, { products: [{ id: 1, title: '상담 <비용>', price: 12000, imageUrl: null }] });
    r = await call(ctrl.getProduct, { params: { id: '1' } });
    assert.strictEqual(r.body.product.price, 12000);
    assert.ok(r.body.product.imageUrl.endsWith('/7'));
    assert.ok(!r.body.product.bodyHtml.includes('<script'), '본문 정제');
    assert.strictEqual((await call(ctrl.getProduct, { params: { id: '2' } })).code, 404, '숨김·없음');
    assert.strictEqual((await call(ctrl.getProduct, { params: { id: 'abc' } })).code, 404);

    // ── 결제 수단 ──
    r = await call(ctrl.payOptions, {});
    assert.deepStrictEqual(r.body, { methods: ['card', 'bank', 'deposit'], bankAccount: '은행 000-000' });
    ready = false;
    assert.deepStrictEqual((await call(ctrl.payOptions, {})).body.methods, ['deposit'], 'KCP 미준비면 card·bank 빠짐');
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'card', device: 'pc' } });
    assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid method' }]);
    delete process.env.SHOP_BANK_ACCOUNT;
    assert.deepStrictEqual((await call(ctrl.payOptions, {})).body, { methods: [], bankAccount: null });
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
    assert.strictEqual(r.body.error, 'Invalid method', '계좌 없으면 무통장 불가');
    assert.strictEqual(saved.length, 0);

    // ── PC 카드: 바디 금액 무시, DB 값으로 저장·필드 ──
    reset();
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'card', device: 'pc', amount: 1, price: 1, memo: '메모' } });
    assert.strictEqual(r.code, 200);
    assert.match(r.body.orderNo, /^LB\d{12}\d{4}$/);
    assert.deepStrictEqual(Object.keys(r.body.kcp), ['mode', 'jsUrl', 'action', 'fields']);
    assert.strictEqual(r.body.kcp.mode, 'pc');
    assert.strictEqual(r.body.kcp.action, `/node/api/public/shop/kcp/return?order=${r.body.orderNo}`);
    const f = r.body.kcp.fields;
    assert.strictEqual(f.good_mny, '12000');
    assert.strictEqual(f.pay_method, '100000000000');
    assert.strictEqual(f.ordr_idxx, r.body.orderNo);
    assert.strictEqual(f.good_name, '상담 <비용>');
    assert.strictEqual(f.buyr_mail, 'a@b.co');
    assert.strictEqual(f.src, 'pc');
    for (const k of ['res_cd', 'res_msg', 'tno', 'trace_no', 'enc_info', 'enc_data', 'tran_cd', 'ret_pay_method', 'use_pay_method']) assert.strictEqual(f[k], '', k);
    const s = saved[0];
    assert.strictEqual(s.amount, 12000);
    assert.strictEqual(s.status, 'pending');
    assert.strictEqual(s.buyer_name, '홍<길동>');
    assert.strictEqual(s.buyer_memo, '메모');
    assert.match(s.history, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d 주문 생성$/);
    assert.strictEqual(notices.length, 0, '카드는 알림 없음');
    // 주문 후 가격이 바뀌어도 저장된 주문 금액 유지
    products[1].price = 99999;
    assert.strictEqual((await call(ctrl.getOrder, { params: { orderNo: s.order_no } })).body.order.amount, 12000);
    products[1].price = 12000;

    // ── 모바일 계좌이체 ──
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'bank', device: 'mobile', amount: 5 } });
    assert.strictEqual(r.body.kcp.mode, 'mobile');
    assert.strictEqual(r.body.kcp.payUrl, 'https://m.example/pay');
    const a = approvalCalls[0];
    assert.strictEqual(a.amount, 12000, 'KCP 요청 금액은 DB');
    assert.strictEqual(a.retUrl, `https://linkbe.kr/node/api/public/shop/kcp/return?order=${r.body.orderNo}`);
    assert.deepStrictEqual([a.payMethod, a.userAgent, a.goodName, a.orderNo], ['bank', 'UA', '상담 <비용>', r.body.orderNo]);
    const m = r.body.kcp.fields;
    assert.deepStrictEqual([m.pay_method, m.ActionResult, m.currency, m.approval_key, m.Ret_URL, m.good_mny, m.shop_name], ['BANK', 'acnt', '410', 'AK', a.retUrl, '12000', '링크비']);
    assert.deepStrictEqual(Object.keys(m).sort(), ['ActionResult', 'Ret_URL', 'approval_key', 'buyr_mail', 'buyr_name', 'buyr_tel2', 'currency', 'escw_used', 'good_mny', 'good_name', 'ordr_idxx', 'pay_method', 'quotaopt', 'req_tx', 'shop_name', 'site_cd']);
    // 승인 키 실패 → 502
    approvalOk = false;
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'card', device: 'mobile' } });
    assert.deepStrictEqual([r.code, r.body], [502, { error: 'Payment unavailable' }]);

    // ── 무통장 ──
    reset();
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '  홍<길동> ' } });
    assert.deepStrictEqual(Object.keys(r.body), ['orderNo']);
    assert.strictEqual(saved[0].status, 'awaiting_deposit');
    assert.strictEqual(saved[0].deposit_name, '홍<길동>');
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].channel, '#결제');
    assert.strictEqual(notices[0].text, '[무통장 주문] 상담 &lt;비용&gt; 12,000원 — 홍&lt;길동&gt;님 (입금자: 홍&lt;길동&gt;)');
    assert.ok(!notices[0].text.includes('a@b.co') && !notices[0].text.includes('010'), '이메일·휴대폰 미포함');
    for (const bad of [undefined, '', '   ', 'x'.repeat(31), 5]) {
        r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: bad } });
        assert.strictEqual(r.code, 400, `depositName ${bad}`);
    }
    assert.strictEqual(saved.length, 1);

    // ── 입력 검사 ──
    r = await call(ctrl.createOrder, { body: { productId: 2, payMethod: 'deposit', depositName: '홍' } });
    assert.strictEqual(r.code, 404, '숨김 상품 주문');
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍', memo: 'x'.repeat(501) } });
    assert.strictEqual(r.code, 400);
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'card', device: 'tablet' } });
    assert.strictEqual(r.code, 400);
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'cash' } });
    assert.strictEqual(r.body.error, 'Invalid method');
    assert.strictEqual(saved.length, 1, '실패한 요청은 저장 안 함');

    // 주문번호 중복 → 1회 재시도
    reset();
    dupOnce = true;
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(saved.length, 1);

    // ── Host 허용 목록 ──
    reset();
    const hostReq = host => ({ get: h => ({ host, 'user-agent': 'UA' })[h], body: { productId: 1, payMethod: 'card', device: 'mobile' } });
    for (const bad of ['evil.example', undefined, 'linkbe.kr.evil.example']) {
        r = await call(ctrl.createOrder, hostReq(bad));
        assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid host' }], `host ${bad}`);
    }
    assert.strictEqual(saved.length, 0);
    assert.strictEqual(approvalCalls.length, 0);
    assert.strictEqual((await call(ctrl.createOrder, hostReq('LINKBE.KR'))).code, 200);
    assert.strictEqual(approvalCalls[0].retUrl.startsWith('https://LINKBE.KR/'), true);

    // ── 가격 1 미만 ──
    reset();
    for (const bad of [0, -5, 'abc', null]) {
        products[1].price = bad;
        r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
        assert.deepStrictEqual([r.code, r.body], [400, { error: 'Invalid product' }], `price ${bad}`);
    }
    products[1].price = 12000;
    assert.strictEqual(saved.length, 0);

    // ── 시간당 10회 ──
    reset();
    for (let i = 0; i < 10; i++) assert.strictEqual((await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } })).code, 200);
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
    assert.deepStrictEqual([r.code, r.body], [429, { error: 'Too many requests' }]);
    r = await call(ctrl.createOrder, { member: { ...member, id: 6 }, body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
    assert.strictEqual(r.code, 200, '다른 회원은 별도 한도');

    // ── 내 주문 조회: 본인만 ──
    reset();
    r = await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'deposit', depositName: '홍' } });
    const no = r.body.orderNo;
    r = await call(ctrl.getOrder, { params: { orderNo: no } });
    assert.deepStrictEqual([r.body.order.depositName, r.body.order.bankAccount, r.body.order.status], ['홍', '은행 000-000', 'awaiting_deposit']);
    assert.strictEqual((await call(ctrl.getOrder, { member: { ...member, id: 99 }, params: { orderNo: no } })).code, 404, '남의 주문');
    assert.strictEqual((await call(ctrl.getOrder, { params: { orderNo: 'LB0' } })).code, 404);
    r = await call(ctrl.listOrders, {});
    assert.strictEqual(r.body.orders.length, 1);
    assert.deepStrictEqual(Object.keys(r.body.orders[0]), ['orderNo', 'productTitle', 'amount', 'payMethod', 'status', 'createdAt', 'paidAt']);
    assert.strictEqual((await call(ctrl.listOrders, { member: { ...member, id: 99 } })).body.orders.length, 0);
    // pending은 목록엔 없지만 상세는 본인에게 보임
    await call(ctrl.createOrder, { body: { productId: 1, payMethod: 'card', device: 'pc' } });
    assert.strictEqual((await call(ctrl.listOrders, {})).body.orders.length, 1);
    const pend = saved.find(o => o.status === 'pending');
    assert.strictEqual((await call(ctrl.getOrder, { params: { orderNo: pend.order_no } })).body.order.bankAccount, null);

    console.log('checkShopOrder OK');
})().catch(e => {
    console.error(e);
    process.exit(1);
});

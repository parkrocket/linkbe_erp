const crypto = require('crypto');
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const kcp = require('../utils/kcp'); // 호출 시점 참조 (점검에서 가짜 교체)
const slack = require('../utils/slack'); // 호출 시점 참조 (점검에서 가짜 교체)
const rateLimit = require('../utils/rateLimit');
const { escapeSlack } = require('../utils/slackEscape');
const { publicFileUrl } = require('../utils/uploads');
const { sanitizeHtml } = require('../utils/sanitizeHtml');

// 고객 상품 조회·주문 API(/api/public/shop/*) — 금액·상품명·주문자는 항상 DB 값, 화면이 보낸 amount 등은 읽지 않음
const HOUR = 60 * 60 * 1000;
const ORDER_MAX = 10; // 회원당 시간당 주문 생성 수
const MEMO_MAX = 500;
const DEPOSIT_NAME_MAX = 30;

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('shop api error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

const notify = async text => {
    try {
        await slack.sendSlackMessage(process.env.SLACK_SHOP_CHANNEL || '#결제', text);
    } catch (error) {
        console.error('shop slack notice failed:', error.message);
    }
};

const bankAccount = () => process.env.SHOP_BANK_ACCOUNT || null;

// 지금 쓸 수 있는 결제 수단 — card·bank는 KCP 준비됨, deposit은 계좌 안내 문구가 있을 때
const availableMethods = () => {
    const methods = [];
    if (kcp.kcpConfig().ready) methods.push('card', 'bank');
    if (bankAccount()) methods.push('deposit');
    return methods;
};

// 주문번호·이력용 KST 시각 부품
const kstParts = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const p = {};
    for (const x of parts) p[x.type] = x.value;
    return p;
};
const makeOrderNo = () => {
    const p = kstParts();
    return `LB${p.year.slice(2)}${p.month}${p.day}${p.hour}${p.minute}${p.second}${crypto.randomInt(0, 10000).toString().padStart(4, '0')}`;
};
const kstStamp = () => {
    const p = kstParts();
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

const toProduct = row => ({ id: row.id, title: row.title, price: Number(row.price), imageUrl: publicFileUrl(row.image_file_id) });
const toOrder = row => ({
    orderNo: row.order_no,
    productTitle: row.product_title,
    amount: Number(row.amount),
    payMethod: row.pay_method,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
});

const parseId = v => (/^\d{1,10}$/.test(String(v)) ? Number(v) : null);

exports.listProducts = handle(async (req, res) => {
    res.json({ products: (await Product.listVisible()).map(toProduct) });
});

exports.getProduct = handle(async (req, res) => {
    const id = parseId(req.params.id);
    const row = id && (await Product.findVisible(id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ product: { ...toProduct(row), bodyHtml: sanitizeHtml(row.body_html) } });
});

exports.payOptions = (req, res) => {
    res.json({ methods: availableMethods(), bankAccount: bankAccount() });
};

// 결제창에 넘길 값 — PC (영카트 orderform 필드 그대로, 결과용 빈 칸 포함)
const pcFields = (cfg, o, method) => ({
    req_tx: 'pay',
    site_cd: cfg.siteCd,
    site_name: cfg.siteName,
    ordr_idxx: o.orderNo,
    good_name: o.title,
    good_mny: String(o.amount),
    currency: 'WON',
    quotaopt: '12',
    module_type: '01',
    good_expr: '0',
    skin_indx: '1',
    disp_tax_yn: 'N',
    pay_method: kcp.PAY_METHODS[method].pc,
    buyr_name: o.name,
    buyr_mail: o.email,
    buyr_tel1: o.phone,
    buyr_tel2: o.phone,
    res_cd: '',
    res_msg: '',
    tno: '',
    trace_no: '',
    enc_info: '',
    enc_data: '',
    tran_cd: '',
    ret_pay_method: '',
    use_pay_method: '',
    src: 'pc',
});

// 모바일 결제창 필드(승인 키 발급 뒤)
const mobileFields = (cfg, o, method, approvalKey, retUrl) => ({
    req_tx: 'pay',
    site_cd: cfg.siteCd,
    shop_name: cfg.siteName,
    pay_method: kcp.PAY_METHODS[method].mobile,
    ActionResult: kcp.PAY_METHODS[method].action,
    ordr_idxx: o.orderNo,
    good_name: o.title,
    good_mny: String(o.amount),
    currency: '410',
    quotaopt: '12',
    approval_key: approvalKey,
    Ret_URL: retUrl,
    escw_used: 'N',
    buyr_name: o.name,
    buyr_mail: o.email,
    buyr_tel2: o.phone,
});

exports.createOrder = handle(async (req, res) => {
    const member = req.member;
    if (!rateLimit.hit(`order:${member.id}`, ORDER_MAX, HOUR)) return res.status(429).json({ error: 'Too many requests' });

    const body = req.body ?? {};
    const { payMethod, device } = body;
    const memo = body.memo === undefined || body.memo === null ? '' : body.memo;
    if (typeof memo !== 'string' || memo.length > MEMO_MAX) return res.status(400).json({ error: 'Invalid memo' });
    if (typeof payMethod !== 'string' || !availableMethods().includes(payMethod)) return res.status(400).json({ error: 'Invalid method' });
    const isDeposit = payMethod === 'deposit';
    if (!isDeposit && device !== 'pc' && device !== 'mobile') return res.status(400).json({ error: 'Invalid device' });
    let depositName = null;
    if (isDeposit) {
        depositName = typeof body.depositName === 'string' ? body.depositName.trim() : '';
        if (depositName.length < 1 || depositName.length > DEPOSIT_NAME_MAX) return res.status(400).json({ error: 'Invalid deposit name' });
    }

    const pid = parseId(body.productId);
    const product = pid && (await Product.findVisible(pid));
    if (!product) return res.status(404).json({ error: 'Not found' });

    const row = {
        member_id: member.id,
        product_id: product.id,
        product_title: product.title,
        amount: Number(product.price), // 화면이 보낸 금액은 무시
        pay_method: payMethod,
        status: isDeposit ? 'awaiting_deposit' : 'pending',
        buyer_name: member.name,
        buyer_email: member.email,
        buyer_phone: member.phone ?? null,
        buyer_memo: memo || null,
        deposit_name: depositName,
    };
    // 주문번호 중복(같은 초·같은 난수)이면 한 번만 다시 시도
    let orderNo;
    for (let attempt = 0; ; attempt++) {
        orderNo = makeOrderNo();
        try {
            await Order.create({ ...row, order_no: orderNo, history: `${kstStamp()} 주문 생성` });
            break;
        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY' || attempt >= 1) throw error;
        }
    }

    if (isDeposit) {
        await notify(`[무통장 주문] ${escapeSlack(product.title)} ${row.amount.toLocaleString('en-US')}원 — ${escapeSlack(member.name)}님 (입금자: ${escapeSlack(depositName)})`);
        return res.json({ orderNo });
    }

    const cfg = kcp.kcpConfig();
    const o = { orderNo, title: product.title, amount: row.amount, name: member.name, email: member.email ?? '', phone: member.phone ?? '' };
    const action = `/node/api/public/shop/kcp/return?order=${orderNo}`;
    if (device === 'pc') {
        return res.json({ orderNo, kcp: { mode: 'pc', jsUrl: cfg.jsUrl, action, fields: pcFields(cfg, o, payMethod) } });
    }
    const retUrl = `https://${req.get('host')}${action}`;
    const key = await kcp.requestMobileApprovalKey({
        orderNo, amount: o.amount, goodName: o.title, payMethod, retUrl, userAgent: req.get('user-agent') || '',
    });
    if (!key.ok) {
        await Order.appendHistory(orderNo, `${kstStamp()} 모바일 승인 키 발급 실패`).catch(() => {});
        return res.status(502).json({ error: 'Payment unavailable' });
    }
    res.json({ orderNo, kcp: { mode: 'mobile', payUrl: key.payUrl, fields: mobileFields(cfg, o, payMethod, key.approvalKey, retUrl) } });
});

exports.listOrders = handle(async (req, res) => {
    res.json({ orders: (await Order.listForMember(req.member.id)).map(toOrder) });
});

exports.getOrder = handle(async (req, res) => {
    const row = await Order.findForMember(req.member.id, String(req.params.orderNo)); // 본인 것만 — 남의 것은 없는 것과 같은 404
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
        order: {
            ...toOrder(row),
            depositName: row.deposit_name,
            bankAccount: row.pay_method === 'deposit' ? bankAccount() : null,
            buyerMemo: row.buyer_memo,
        },
    });
});

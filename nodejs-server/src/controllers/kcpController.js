const querystring = require('querystring');
const iconv = require('iconv-lite');
const Order = require('../models/orderModel');
const kcp = require('../utils/kcp'); // 호출 시점 참조 (점검에서 가짜 교체)
const { notify, kstStamp } = require('./shopController');
const { escapeSlack } = require('../utils/slackEscape');

// KCP 결제창이 돌아오는 곳(POST /api/public/shop/kcp/return?order=…) — 여기서 실제 승인. 금액은 DB 값만, 고객 화면엔 KCP 메시지를 넘기지 않음
const ORDER_NO = /^LB\d{16}$/;
const METHOD_LABEL = { card: '카드', bank: '계좌이체' };

// ponytail: 프로세스 메모리 잠금 — pm2 1개 기준. 여러 프로세스로 늘리면 DB 잠금(SELECT … FOR UPDATE 등)으로
const inFlight = new Set();

// %XX를 바이트로 되돌린 뒤 charset으로 디코드(+는 공백)
const decodeWith = charset => s => {
    const bytes = Buffer.from(s.replace(/\+/g, ' '), 'latin1');
    const out = [];
    for (let i = 0; i < bytes.length; i++) {
        const hex = bytes[i] === 0x25 && bytes.toString('latin1', i + 1, i + 3);
        if (hex && /^[0-9a-fA-F]{2}$/.test(hex)) {
            out.push(parseInt(hex, 16));
            i += 2;
        } else {
            out.push(bytes[i]);
        }
    }
    return iconv.decode(Buffer.from(out), charset);
};

// PC는 화면이 UTF-8 폼으로 보냄(src=pc), 그 밖(모바일 Ret_URL)은 EUC-KR
exports.parseReturnBody = buf => {
    if (!Buffer.isBuffer(buf) || buf.length === 0) return {};
    const raw = buf.toString('latin1');
    const isPc = querystring.parse(raw).src === 'pc';
    return querystring.parse(raw, '&', '=', {
        decodeURIComponent: decodeWith(isPc ? 'utf8' : 'cp949'),
    });
};

const str = v => (typeof v === 'string' ? v : '');

exports.kcpReturn = async (req, res) => {
    const no = req.query.order;
    if (typeof no !== 'string' || !ORDER_NO.test(no))
        return res.redirect(303, '/pay');
    const result = path => `/mypage/orders/${no}${path}`;
    // 같은 주문을 이미 처리 중이면(새로고침 연타) KCP 호출 없이 결과 화면
    if (inFlight.has(no)) return res.redirect(303, result(''));
    inFlight.add(no);
    try {
        await handleReturn(req, res, no, result);
    } catch (error) {
        // 승인 이후 단계는 handleReturn 안에서 모두 잡으므로 여기는 승인 전 오류(주문 조회 등)
        console.error('kcp return error:', error.message);
        if (!res.headersSent) res.redirect(303, result('?pay=fail'));
    } finally {
        inFlight.delete(no);
    }
};

const addHistory = (no, line) =>
    Order.appendHistory(no, `${kstStamp()} ${line}`).catch(e =>
        console.error('kcp history failed:', e.message),
    );

// 실패 기록 남용 방지 — 주문당 20줄 넘으면 기록만 건너뜀(상태·응답은 그대로)
const MAX_HISTORY_LINES = 20;
const addFailHistory = (order, line) =>
    String(order.history || '').split('\n').length > MAX_HISTORY_LINES
        ? undefined
        : addHistory(order.order_no, line);

async function handleReturn(req, res, no, result) {
    const body = exports.parseReturnBody(req.body);
    const order = await Order.findByOrderNo(no);
    if (!order) return res.redirect(303, '/pay');
    if (order.status !== 'pending') return res.redirect(303, result(''));

    const resCd = str(body.res_cd);
    if (resCd === '3001') return res.redirect(303, result('?pay=cancel'));
    if (resCd !== '0000') return res.redirect(303, result('?pay=fail'));
    if (body.ordr_idxx !== undefined && body.ordr_idxx !== no)
        return res.redirect(303, result('?pay=fail'));

    const amount = Number(order.amount);
    const custIp = str(req.ip);
    // approve가 throw·reject해도 승인됐는지 모르는 경로로
    const ap = await Promise.resolve()
        .then(() =>
            kcp.approve({
                tranCd: str(body.tran_cd),
                encData: str(body.enc_data),
                encInfo: str(body.enc_info),
                orderNo: no,
                amount,
                custIp,
            }),
        )
        .catch(e => {
            console.error('kcp approve error:', e.message);
            return { ok: false, resCd: 'NETWORK' };
        });

    if (!ap.ok) {
        // KCP 응답 코드(4자리)나 실행 전 거부(INVALID)면 실패 확정, 그 밖(95xx 연동 모듈 통신 오류·NETWORK)은 승인됐는지 모름 — tno가 없어 자동 취소 불가
        const unknown =
            ap.resCd !== 'INVALID' &&
            (/^95\d\d$/.test(str(ap.resCd)) ||
                !/^[0-9A-Z]{4}$/.test(str(ap.resCd)));
        if (unknown) {
            await addFailHistory(order, `KCP 승인 결과 모름(${ap.resCd}) — 확인 필요`);
            await notify(
                `⚠️ [결제 확인 필요] 주문번호 ${no} — KCP 승인 결과를 받지 못했어요. KCP 상점관리자에서 승인 여부를 확인해 주세요.`,
            );
        } else {
            await addFailHistory(
                order,
                `KCP 승인 실패(${ap.resCd}) ${str(ap.resMsg).slice(0, 100)}`,
            );
        }
        return res.redirect(303, result('?pay=fail'));
    }

    // 승인됐는데 거래번호가 없으면 자동 취소 불가 — 사람이 직접
    if (!ap.tno) {
        await addFailHistory(order, 'KCP 승인됐으나 거래번호 없음 — 직접 취소 필요');
        await notify(
            `⚠️ [결제 확인 필요] 주문번호 ${no} — KCP 거래번호를 받지 못해 자동 취소할 수 없어요 — 상점관리자에서 주문번호로 찾아 직접 취소해 주세요`,
        );
        return res.redirect(303, result('?pay=fail'));
    }

    // 여기부터 실제 승인됨 — 저장 못 하면 반드시 취소
    const autoCancel = async (reason, label) => {
        const c = await Promise.resolve()
            .then(() =>
                kcp.cancel({ tno: ap.tno, reason, custIp, orderNo: no }),
            )
            .catch(
                e => (
                    console.error('kcp cancel error:', e.message),
                    { ok: false, resCd: 'ERROR' }
                ),
            );
        await addHistory(
            no,
            `KCP 자동 취소 ${c.ok ? '완료' : `실패(${c.resCd})`} — ${label} (KCP ${ap.tno})`,
        );
        await notify(
            `⚠️ [결제 자동 취소] 주문번호 ${no} (KCP ${ap.tno}) ${label}${c.ok ? '' : ' — 자동 취소 실패 — 상점관리자에서 직접 취소 필요'}`,
        );
        res.redirect(303, result('?pay=fail'));
    };

    if (Number(ap.amount) !== amount) {
        console.error('kcp amount mismatch:', no, ap.amount, amount);
        return autoCancel(
            'auto cancel: amount mismatch',
            `승인 금액 불일치(${ap.amount}원 ≠ ${amount}원)`,
        );
    }

    let saved = false;
    try {
        saved = await Order.transition(
            no,
            ['pending'],
            'paid',
            { kcp_tno: ap.tno, kcp_app_no: ap.appNo, paid_at: 'NOW' },
            `${kstStamp()} 결제 완료(KCP ${ap.tno})`,
        );
    } catch (error) {
        console.error('kcp order save failed:', error.message);
    }
    if (!saved)
        return autoCancel('auto cancel: order save failed', '주문 저장 실패');

    await notify(
        `[결제 완료] ${escapeSlack(order.product_title)} ${amount.toLocaleString('en-US')}원 ${METHOD_LABEL[order.pay_method] || order.pay_method} — ${escapeSlack(order.buyer_name)}님`,
    );
    res.redirect(303, result('?pay=ok'));
}

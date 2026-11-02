// KCP 승인 콜백 점검: node scripts/checkKcpReturn.js  (Order·kcp·Slack 가짜, 컨트롤러 직접 호출 — DB·KCP 접속 없음)
const assert = require('assert');
const iconv = require('iconv-lite');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) =>
    void notices.push({ channel, text });

// 주문 가짜(금액은 DB처럼 문자열로)
const NO = 'LB2611031200001234';
const Order = require('../src/models/orderModel');
let orders;
let findCalls = 0;
let transitions = [];
let transitionResult = true;
let histories = [];
Order.findByOrderNo = async no => (
    findCalls++,
    orders[no] && { ...orders[no] }
);
Order.transition = async (...args) => {
    transitions.push(args);
    if (transitionResult instanceof Error) throw transitionResult;
    return transitionResult;
};
Order.appendHistory = async (no, line) => (histories.push([no, line]), true);

// KCP 가짜
const kcp = require('../src/utils/kcp');
let approveCalls = [];
let cancelCalls = [];
let approveResult;
let approveGate = null;
let cancelResult;
kcp.approve = async a => {
    approveCalls.push(a);
    if (approveGate) await approveGate;
    return approveResult;
};
kcp.cancel = async a => (cancelCalls.push(a), cancelResult);

const ctrl = require('../src/controllers/kcpController');

const reset = () => {
    orders = {
        [NO]: {
            order_no: NO,
            product_title: '상담 <비용>',
            amount: '12000',
            pay_method: 'card',
            status: 'pending',
            buyer_name: '홍<길동>',
        },
    };
    findCalls = 0;
    transitions = [];
    transitionResult = true;
    histories = [];
    notices = [];
    approveCalls = [];
    cancelCalls = [];
    approveResult = {
        ok: true,
        resCd: '0000',
        resMsg: '정상처리',
        tno: '24110312345678',
        amount: 12000,
        appNo: '30001234',
    };
    approveGate = null;
    cancelResult = { ok: true, resCd: '0000', resMsg: '' };
};

const utf8Body = fields =>
    Buffer.from(
        Object.entries(fields)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&'),
    );
// 모바일: EUC-KR 바이트를 퍼센트 인코딩
const eucBody = fields =>
    Buffer.from(
        Object.entries(fields)
            .map(
                ([k, v]) =>
                    `${k}=${[...iconv.encode(v, 'euc-kr')].map(b => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('')}`,
            )
            .join('&'),
    );
const pcOk = (extra = {}) =>
    utf8Body({
        src: 'pc',
        res_cd: '0000',
        res_msg: '정상처리',
        enc_data: 'ENC',
        enc_info: 'INF',
        tran_cd: '00100000',
        ordr_idxx: NO,
        ...extra,
    });

const call = async (body, query = { order: NO }) => {
    const res = { code: null, location: null };
    res.redirect = (code, url) => {
        res.code = code;
        res.location = url;
    };
    await ctrl.kcpReturn({ query, body, ip: '1.2.3.4' }, res);
    return res;
};
const loc = (path = '') => `/mypage/orders/${NO}${path}`;

(async () => {
    // ── 본문 해석: PC UTF-8, 모바일 EUC-KR(한글 정상) ──
    assert.deepStrictEqual(ctrl.parseReturnBody(pcOk()).res_msg, '정상처리');
    const mb = ctrl.parseReturnBody(
        eucBody({
            res_cd: '0000',
            res_msg: '정상처리 되었습니다',
            enc_data: 'a+b/c=',
            tran_cd: '00100000',
        }),
    );
    assert.strictEqual(
        mb.res_msg,
        '정상처리 되었습니다',
        '모바일 EUC-KR 디코드',
    );
    assert.strictEqual(mb.enc_data, 'a+b/c=', '퍼센트 인코딩된 +는 그대로');
    assert.strictEqual(
        ctrl.parseReturnBody(Buffer.from('a=x+y')).a,
        'x y',
        '+는 공백',
    );
    assert.deepStrictEqual(ctrl.parseReturnBody(undefined), {});

    // ── 정상 PC ──
    reset();
    let r = await call(pcOk());
    assert.deepStrictEqual([r.code, r.location], [303, loc('?pay=ok')]);
    assert.deepStrictEqual(approveCalls, [
        {
            tranCd: '00100000',
            encData: 'ENC',
            encInfo: 'INF',
            orderNo: NO,
            amount: 12000,
            custIp: '1.2.3.4',
        },
    ]);
    assert.strictEqual(transitions.length, 1);
    const [tNo, tFrom, tTo, tFields, tLine] = transitions[0];
    assert.deepStrictEqual(
        [tNo, tFrom, tTo, tFields],
        [
            NO,
            ['pending'],
            'paid',
            {
                kcp_tno: '24110312345678',
                kcp_app_no: '30001234',
                paid_at: 'NOW',
            },
        ],
    );
    assert.match(tLine, /결제 완료/);
    assert.deepStrictEqual(notices, [
        {
            channel: '#결제',
            text: '[결제 완료] 상담 &lt;비용&gt; 12,000원 카드 — 홍&lt;길동&gt;님',
        },
    ]);
    assert.strictEqual(cancelCalls.length, 0);

    // ── 정상 모바일(EUC-KR, src 없음), 계좌이체, 채널 환경변수, 응답 금액 문자열 ──
    reset();
    orders[NO].pay_method = 'bank';
    approveResult.amount = '12000';
    process.env.SLACK_SHOP_CHANNEL = '#테스트';
    r = await call(
        eucBody({
            res_cd: '0000',
            res_msg: '정상처리',
            enc_data: 'E2',
            enc_info: 'I2',
            tran_cd: '00100000',
            ordr_idxx: NO,
        }),
    );
    delete process.env.SLACK_SHOP_CHANNEL;
    assert.strictEqual(r.location, loc('?pay=ok'));
    assert.strictEqual(approveCalls[0].encData, 'E2');
    assert.deepStrictEqual(notices, [
        {
            channel: '#테스트',
            text: '[결제 완료] 상담 &lt;비용&gt; 12,000원 계좌이체 — 홍&lt;길동&gt;님',
        },
    ]);

    // ── 금액 변조: approve에는 DB 금액, 응답 금액 다르면 취소 1회 ──
    reset();
    approveResult.amount = 100;
    r = await call(pcOk({ good_mny: '100', amount: '100' }));
    assert.strictEqual(approveCalls[0].amount, 12000, '승인 요청 금액은 DB 값');
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(cancelCalls.length, 1);
    assert.deepStrictEqual(cancelCalls[0], {
        tno: '24110312345678',
        reason: cancelCalls[0].reason,
        custIp: '1.2.3.4',
        orderNo: NO,
    });
    assert.match(cancelCalls[0].reason, /^[\x20-\x7e]+$/, '취소 사유 영문');
    assert.strictEqual(transitions.length, 0, '금액 다르면 paid로 바꾸지 않음');
    assert.strictEqual(notices.length, 1);
    assert.match(notices[0].text, /^⚠️ \[결제 자동 취소\] 주문번호 LB\d{16}/);
    assert.ok(!notices[0].text.includes('자동 취소 실패'));

    // ── 사용자 취소 3001 ──
    reset();
    r = await call(
        utf8Body({ src: 'pc', res_cd: '3001', res_msg: '사용자 취소' }),
    );
    assert.strictEqual(r.location, loc('?pay=cancel'));
    assert.strictEqual(approveCalls.length, 0);

    // ── res_cd 실패 ──
    reset();
    r = await call(
        utf8Body({ src: 'pc', res_cd: '9999', res_msg: '<b>오류</b>' }),
    );
    assert.strictEqual(
        r.location,
        loc('?pay=fail'),
        'res_msg는 화면에 넘기지 않음',
    );
    assert.strictEqual(approveCalls.length, 0);

    // ── 주문번호 불일치 ──
    reset();
    r = await call(pcOk({ ordr_idxx: 'LB2611031200009999' }));
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(approveCalls.length, 0);

    // ── 이미 처리된 주문(새로고침) → KCP 호출 없이 결과 화면 ──
    reset();
    orders[NO].status = 'paid';
    r = await call(pcOk());
    assert.deepStrictEqual([r.code, r.location], [303, loc()]);
    assert.strictEqual(approveCalls.length, 0);

    // ── 거의 동시에 두 요청 → approve 1회, 두 번째는 결과 화면 ──
    reset();
    let open;
    approveGate = new Promise(resolve => (open = resolve));
    const first = call(pcOk());
    await new Promise(resolve => setImmediate(resolve));
    const second = await call(pcOk());
    assert.deepStrictEqual([second.code, second.location], [303, loc()]);
    open();
    assert.strictEqual((await first).location, loc('?pay=ok'));
    assert.strictEqual(approveCalls.length, 1, '동시 요청은 approve 1회');
    // 잠금 해제 확인: 끝난 뒤엔 다시 처리됨
    orders[NO].status = 'pending';
    approveGate = null;
    assert.strictEqual((await call(pcOk())).location, loc('?pay=ok'));
    assert.strictEqual(approveCalls.length, 2);

    // ── approve 실패(KCP 응답 있음) → 기록, 취소·알림 없음 ──
    reset();
    approveResult = {
        ok: false,
        resCd: '8128',
        resMsg: '거절',
        tno: null,
        amount: null,
        appNo: null,
    };
    r = await call(pcOk());
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(histories.length, 1);
    assert.match(histories[0][1], /8128/);
    assert.deepStrictEqual(
        [transitions.length, cancelCalls.length, notices.length],
        [0, 0, 0],
    );
    // 실행 전 거부(INVALID)도 결과가 확실한 실패
    reset();
    approveResult = {
        ok: false,
        resCd: 'INVALID',
        resMsg: 'Invalid tran_cd',
        tno: null,
        amount: null,
        appNo: null,
    };
    r = await call(pcOk({ tran_cd: 'x' }));
    assert.deepStrictEqual(
        [r.location, notices.length, histories.length],
        [loc('?pay=fail'), 0, 1],
    );

    // ── 결과 모름(9502·NETWORK) → pending 유지, 기록, 확인 필요 알림 ──
    for (const resCd of ['9502', '9501', 'NETWORK']) {
        reset();
        approveResult = {
            ok: false,
            resCd,
            resMsg: '연동 모듈 호출 오류',
            tno: null,
            amount: null,
            appNo: null,
        };
        r = await call(pcOk());
        assert.strictEqual(r.location, loc('?pay=fail'));
        assert.deepStrictEqual(
            [transitions.length, cancelCalls.length, histories.length],
            [0, 0, 1],
            resCd,
        );
        assert.deepStrictEqual(
            notices.map(n => n.text),
            [
                `⚠️ [결제 확인 필요] 주문번호 ${NO} — KCP 승인 결과를 받지 못했어요. KCP 상점관리자에서 승인 여부를 확인해 주세요.`,
            ],
        );
    }

    // ── approve가 throw·reject → 결과 모름 경로(pending 유지, 기록, 확인 필요 알림) ──
    for (const fail of [new Error('socket'), 'rejected']) {
        reset();
        kcp.approve = async a => {
            approveCalls.push(a);
            throw fail;
        };
        r = await call(pcOk());
        assert.strictEqual(r.location, loc('?pay=fail'));
        assert.deepStrictEqual(
            [transitions.length, cancelCalls.length, histories.length],
            [0, 0, 1],
        );
        assert.match(histories[0][1], /NETWORK/);
        assert.match(notices[0].text, /^⚠️ \[결제 확인 필요\]/);
        assert.strictEqual(notices.length, 1);
    }
    kcp.approve = async a => {
        approveCalls.push(a);
        if (approveGate) await approveGate;
        return approveResult;
    };

    // ── 승인 ok인데 tno 없음 → 취소 시도 없이 직접 취소 안내 ──
    reset();
    approveResult.tno = null;
    r = await call(pcOk());
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.deepStrictEqual(
        [transitions.length, cancelCalls.length, histories.length],
        [0, 0, 1],
    );
    assert.strictEqual(notices.length, 1);
    assert.ok(
        notices[0].text.includes(
            'KCP 거래번호를 받지 못해 자동 취소할 수 없어요 — 상점관리자에서 주문번호로 찾아 직접 취소해 주세요',
        ),
    );

    // ── 승인 후 transition false → 취소 1회, 경고 1건 ──
    reset();
    transitionResult = false;
    r = await call(pcOk());
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(cancelCalls.length, 1);
    assert.deepStrictEqual(cancelCalls[0], {
        tno: '24110312345678',
        reason: 'auto cancel: order save failed',
        custIp: '1.2.3.4',
        orderNo: NO,
    });
    assert.strictEqual(notices.length, 1);
    assert.match(notices[0].text, /^⚠️ \[결제 자동 취소\] 주문번호 LB\d{16}/);
    assert.ok(!notices[0].text.includes('[결제 완료]'));

    // ── 승인 후 DB 오류 + 자동 취소 실패 → 직접 취소 안내 ──
    reset();
    transitionResult = new Error('db down');
    cancelResult = { ok: false, resCd: '9502', resMsg: '' };
    r = await call(pcOk());
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(cancelCalls.length, 1);
    assert.strictEqual(notices.length, 1);
    assert.ok(
        notices[0].text.includes(
            '자동 취소 실패 — 상점관리자에서 직접 취소 필요',
        ),
    );

    // ── 없는 주문·형식 아닌 주문번호 ──
    reset();
    r = await call(pcOk(), { order: 'LB2611031200000000' });
    assert.deepStrictEqual([r.code, r.location], [303, '/pay']);
    for (const bad of ['LB1', '../x', undefined, ['LB2611031200001234']]) {
        reset();
        r = await call(pcOk(), { order: bad });
        assert.deepStrictEqual(
            [r.code, r.location],
            [303, '/pay'],
            `order ${bad}`,
        );
        assert.strictEqual(findCalls, 0);
    }

    // ── 주문 조회 DB 오류 → 실패 화면, 승인 없음 ──
    reset();
    const realFind = Order.findByOrderNo;
    Order.findByOrderNo = async () => {
        throw new Error('db');
    };
    r = await call(pcOk());
    Order.findByOrderNo = realFind;
    assert.strictEqual(r.location, loc('?pay=fail'));
    assert.strictEqual(approveCalls.length, 0);
    // 잠금 해제 증명: 같은 주문으로 다시 호출하면 조회가 다시 일어남
    const before = findCalls;
    r = await call(pcOk());
    assert.strictEqual(findCalls, before + 1, '조회 오류 뒤 잠금 해제');
    assert.strictEqual(r.location, loc('?pay=ok'));

    console.log('checkKcpReturn OK');
})().catch(e => {
    console.error(e);
    process.exit(1);
});

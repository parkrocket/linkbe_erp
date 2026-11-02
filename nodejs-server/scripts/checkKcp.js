// KCP 연동 도구 점검 — node scripts/checkKcp.js (실행 파일·KCP 서버 호출 안 함: execFile·axios 가짜)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const axios = require('axios');
const iconv = require('iconv-lite');

const US = '\x1f';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kcp-'));
const SITE_KEY = 'FAKE-SITE-KEY-123';
Object.assign(process.env, { KCP_ENV: 'test', KCP_HOME: home, KCP_SITE_KEY: SITE_KEY });
delete process.env.KCP_SITE_CD;
delete process.env.SHOP_SITE_NAME;

const kcp = require('../src/utils/kcp');

// 가짜 execFile — 호출 기록 후 정해 둔 출력 반환
let calls = [];
let nextOut = { err: null, stdout: Buffer.alloc(0) };
childProcess.execFile = (bin, args, opts, cb) => {
    calls.push({ bin, args, opts });
    setImmediate(() => cb(nextOut.err, nextOut.stdout, Buffer.alloc(0)));
};
const out = (lastLine, err = null) => {
    const logs = '1103-013545.832 - 1 - MSG : TX_START\n1103-013545.900 - 1 - MSG : SEND\n';
    nextOut = { err, stdout: Buffer.concat([Buffer.from(logs), iconv.encode(lastLine + '\n', 'cp949')]) };
};

// 로그에 사이트 키가 남지 않는지 확인용
const logged = [];
for (const k of ['log', 'error', 'warn']) {
    const orig = console[k];
    console[k] = (...a) => { logged.push(a.map(String).join(' ')); if (process.env.KCP_DEBUG) orig(...a); };
}

(async () => {
    // 설정: 실행 파일 없으면 ready false
    let c = kcp.kcpConfig();
    assert.deepStrictEqual(c, {
        ready: false, env: 'test', siteCd: 'T0000', siteName: '링크비',
        jsUrl: 'https://testpay.kcp.co.kr/plugin/payplus_web.jsp', gwHost: 'testpaygw.kcp.co.kr',
    });
    assert.ok(!JSON.stringify(c).includes(SITE_KEY));
    fs.mkdirSync(path.join(home, 'bin'));
    fs.writeFileSync(path.join(home, 'bin', 'pp_cli_x64'), '');
    kcp.resetKcpConfig();
    assert.strictEqual(kcp.kcpConfig().ready, true);
    delete process.env.KCP_SITE_KEY;
    assert.strictEqual(kcp.kcpConfig().ready, false);
    process.env.KCP_SITE_KEY = SITE_KEY;

    // live: 사이트 코드 기본값 없음 → ready false, 호스트·스크립트 주소
    process.env.KCP_ENV = 'live';
    c = kcp.kcpConfig();
    assert.strictEqual(c.ready, false);
    assert.strictEqual(c.siteCd, '');
    assert.strictEqual(c.jsUrl, 'https://pay.kcp.co.kr/plugin/payplus_web.jsp');
    assert.strictEqual(c.gwHost, 'paygw.kcp.co.kr');
    process.env.KCP_SITE_CD = 'SRTEST1';
    process.env.SHOP_SITE_NAME = 'Shop';
    c = kcp.kcpConfig();
    assert.strictEqual(c.ready, true);
    assert.strictEqual(c.siteCd, 'SRTEST1');
    assert.strictEqual(c.siteName, 'Shop');
    process.env.KCP_ENV = 'test';
    delete process.env.KCP_SITE_CD;
    delete process.env.SHOP_SITE_NAME;

    assert.deepStrictEqual(kcp.PAY_METHODS, {
        card: { pc: '100000000000', mobile: 'CARD', action: 'card' },
        bank: { pc: '010000000000', mobile: 'BANK', action: 'acnt' },
    });

    // 승인: 인자 순서·값, 마지막 줄만 파싱(EUC-KR 한글)
    out(`res_cd=0000${US}res_msg=정상처리${US}tno=20261103000001${US}amount=12000${US}app_no=12345678${US}card_name=테스트카드`);
    let r = await kcp.approve({ tranCd: '00100000', encData: 'ENC+/=data', encInfo: 'INFO', orderNo: 'P202611030001', amount: 12000, custIp: '127.0.0.1' });
    assert.deepStrictEqual(r, { ok: true, resCd: '0000', resMsg: '정상처리', tno: '20261103000001', amount: 12000, appNo: '12345678' });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].bin, path.join(home, 'bin', 'pp_cli_x64'));
    assert.deepStrictEqual(calls[0].opts, { timeout: 30000, encoding: 'buffer' });
    assert.deepStrictEqual(calls[0].args, ['-h', [
        `home=${home}`, 'site_cd=T0000', `site_key=${SITE_KEY}`, 'tx_cd=00100000', 'pa_url=testpaygw.kcp.co.kr', 'pa_port=8090',
        'ordr_idxx=P202611030001', 'payx_data=', `ordr_data=ordr_data=ordr_mony=12000${US}`, 'rcvr_data=', 'escw_data=', 'modx_data=',
        'enc_data=ENC+/=data', 'enc_info=INFO', 'trace_no=', 'cust_ip=127.0.0.1', 'log_path=/nonexistent', 'log_level=3', 'opt=0',
    ].join(',')]);

    // 승인 실패
    out(`res_cd=8061${US}res_msg=원거래없음${US}res_en_msg=no data`);
    r = await kcp.approve({ tranCd: '00100000', encData: 'E', encInfo: 'I', orderNo: 'P1', amount: 1000, custIp: '::1' });
    assert.deepStrictEqual(r, { ok: false, resCd: '8061', resMsg: '원거래없음', tno: null, amount: null, appNo: null });

    // 화면이 보낸 값이 이상하면 실행 안 하고 ok:false
    calls = [];
    for (const bad of [{ encData: 'a,b' }, { encData: 'a"b' }, { encInfo: 'a\nb' }, { tranCd: '0010' }, { encData: '한글' }, { amount: 0 }, { amount: 1.5 }]) {
        r = await kcp.approve({ tranCd: '00100000', encData: 'E', encInfo: 'I', orderNo: 'P1', amount: 1000, custIp: '::1', ...bad });
        assert.strictEqual(r.ok, false, JSON.stringify(bad));
    }
    assert.strictEqual(calls.length, 0);

    // 빈 출력·오류·시간 초과 → 9502
    const E9502 = { res_cd: '9502', res_msg: '연동 모듈 호출 오류' };
    nextOut = { err: null, stdout: Buffer.alloc(0) };
    assert.deepStrictEqual(await kcp.runPpCli({ tx_cd: '00100000' }), E9502);
    nextOut = { err: null, stdout: Buffer.from('1103-01 - MSG : TX_START\n\n') };
    assert.deepStrictEqual(await kcp.runPpCli({ tx_cd: '00100000' }), E9502);
    nextOut = { err: Object.assign(new Error(`Command failed: pp_cli_x64 -h site_key=${SITE_KEY}`), { code: 'ENOENT' }), stdout: undefined };
    assert.deepStrictEqual(await kcp.runPpCli({ tx_cd: '00100000' }), E9502);
    out(`res_cd=0000${US}res_msg=ok`, Object.assign(new Error(`Command failed: site_key=${SITE_KEY}`), { killed: true, signal: 'SIGTERM' }));
    assert.deepStrictEqual(await kcp.runPpCli({ tx_cd: '00100000' }), E9502);

    // 값에 구분자·줄바꿈·한글·모르는 칸 → throw
    for (const v of ['a,b', 'a"b', 'a\nb', 'a\rb', '한']) {
        await assert.rejects(kcp.runPpCli({ tx_cd: '00100000', ordr_idxx: v }), /Invalid KCP field/);
    }
    await assert.rejects(kcp.runPpCli({ tx_cdd: '1' }), /Unknown KCP field/);

    // 취소: modx_data 형식
    calls = [];
    out(`res_cd=0000${US}res_msg=취소완료`);
    r = await kcp.cancel({ tno: '20261103000001', reason: 'admin cancel', custIp: '10.0.0.1' });
    assert.deepStrictEqual(r, { ok: true, resCd: '0000', resMsg: '취소완료' });
    const arg = calls[0].args[1];
    assert.ok(arg.includes(',tx_cd=00200000,'));
    assert.ok(arg.includes(`,modx_data=mod_data=tno=20261103000001${US}mod_type=STSC${US}mod_ip=10.0.0.1${US}mod_desc=admin cancel${US},`));
    assert.ok(arg.includes(',ordr_data=,') && arg.includes(',enc_data=,enc_info=,'));
    await assert.rejects(kcp.cancel({ tno: '1', reason: '관리자 취소', custIp: '::1' }), /ASCII/);
    out(`res_cd=8061${US}res_msg=원거래없음`);
    assert.deepStrictEqual(await kcp.cancel({ tno: '1', reason: 'x', custIp: '::1' }), { ok: false, resCd: '8061', resMsg: '원거래없음' });

    // 모바일 승인 키: SOAP 요청·응답
    let posted;
    const okXml = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>
<ns:approveResponse xmlns:ns="http://webservice.act.webpay.service.kcp.kr"><ns:return>
<ax21:approvalKey xmlns:ax21="x">KEY123abc</ax21:approvalKey>
<ax21:baseResponseType><ax22:error><ax22:code>0000</ax22:code><ax22:detail></ax22:detail><ax22:message>성공</ax22:message></ax22:error>
<ax22:warningList><ax22:code>W1</ax22:code></ax22:warningList></ax21:baseResponseType>
<ax21:payUrl>https://devpggw.kcp.co.kr:8100/pay?a=1&amp;b=2</ax21:payUrl></ns:return></ns:approveResponse></soapenv:Body></soapenv:Envelope>`;
    axios.post = async (url, body, opts) => { posted = { url, body, opts }; return { status: 200, data: okXml }; };
    r = await kcp.requestMobileApprovalKey({ orderNo: 'P202611030001', amount: 12000, goodName: '홈페이지 <유지보수> & 호스팅', payMethod: 'card', retUrl: 'https://x.kr/r?order=P1&a=b', userAgent: 'Mozilla "UA"' });
    assert.deepStrictEqual(r, { ok: true, approvalKey: 'KEY123abc', payUrl: 'https://devpggw.kcp.co.kr:8100/pay?a=1&b=2', resMsg: '성공' });
    assert.strictEqual(posted.url, 'https://devpggw.kcp.co.kr:8100/services/KCPPaymentService');
    assert.strictEqual(posted.opts.timeout, 15000);
    assert.match(posted.opts.headers['Content-Type'], /^text\/xml/);
    const b = posted.body;
    for (const s of ['>P202611030001</pay:orderID>', '>12000</pay:paymentAmount>', '>T0000</pay:siteCode>', '>CARD</pay:paymentMethod>',
        '>false</pay:escrow>', '>홈페이지 &lt;유지보수&gt; &amp; 호스팅</pay:productName>', '>https://x.kr/r?order=P1&amp;a=b</pay:returnUrl>',
        '>P202611030001</dom:requestID>', '>Mozilla &quot;UA&quot;</dom:userAgent>', '>WEB</dom:requestApp>', '>0.1</dom:version>', '>0</dom:detailLevel>',
        '<ns:approve>', 'xmlns:ns="http://webservice.act.webpay.service.kcp.kr"']) {
        assert.ok(b.includes(s), s);
    }
    assert.ok(!b.includes(SITE_KEY));
    await kcp.requestMobileApprovalKey({ orderNo: 'P1', amount: 1, goodName: 'g', payMethod: 'BANK', retUrl: 'u', userAgent: '' });
    assert.ok(posted.body.includes('>BANK</pay:paymentMethod>'));

    // live 주소
    process.env.KCP_ENV = 'live';
    process.env.KCP_SITE_CD = 'SRTEST1';
    await kcp.requestMobileApprovalKey({ orderNo: 'P1', amount: 1, goodName: 'g', payMethod: 'bank', retUrl: 'u', userAgent: '' });
    assert.strictEqual(posted.url, 'https://smpay.kcp.co.kr/services/KCPPaymentService.KCPPaymentServiceHttpSoap11Endpoint/');
    process.env.KCP_ENV = 'test';
    delete process.env.KCP_SITE_CD;

    // 실패: 오류 코드·네트워크 오류·잘못된 결제수단
    axios.post = async () => ({ status: 200, data: '<a:error><a:code>8888</a:code><a:message>실패</a:message></a:error>' });
    assert.deepStrictEqual(await kcp.requestMobileApprovalKey({ orderNo: 'P1', amount: 1, goodName: 'g', payMethod: 'card', retUrl: 'u', userAgent: '' }),
        { ok: false, approvalKey: null, payUrl: null, resMsg: '실패' });
    axios.post = async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); };
    r = await kcp.requestMobileApprovalKey({ orderNo: 'P1', amount: 1, goodName: 'g', payMethod: 'card', retUrl: 'u', userAgent: '' });
    assert.strictEqual(r.ok, false);
    r = await kcp.requestMobileApprovalKey({ orderNo: 'P1', amount: 1, goodName: 'g', payMethod: 'deposit', retUrl: 'u', userAgent: '' });
    assert.strictEqual(r.ok, false);

    // 어떤 로그에도 사이트 키 없음
    assert.ok(logged.length > 0);
    assert.ok(logged.every((l) => !l.includes(SITE_KEY) && !l.includes('ENC+/=data')), 'secret in log');

    fs.rmSync(home, { recursive: true, force: true });
    console.info('checkKcp OK');
})().catch((e) => {
    console.info(e);
    process.exit(1);
});

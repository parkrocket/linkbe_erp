// KCP 예전 연동 모듈(pp_cli_x64) 호출·모바일 승인 키(SOAP) — 영카트 pp_ax_hub_lib.php·KCPComLibrary.php 기준
// execFile·axios는 호출 시점에 모듈 객체에서 꺼냄(점검에서 가짜로 교체)
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const axios = require('axios');
const iconv = require('iconv-lite');

const US = '\x1f';
const PA_PORT = '8090';
const ERR_9502 = { res_cd: '9502', res_msg: '연동 모듈 호출 오류' };

const HOSTS = {
    test: {
        gwHost: 'testpaygw.kcp.co.kr',
        jsUrl: 'https://testpay.kcp.co.kr/plugin/payplus_web.jsp',
        soapUrl: 'https://devpggw.kcp.co.kr:8100/services/KCPPaymentService',
    },
    live: {
        gwHost: 'paygw.kcp.co.kr',
        jsUrl: 'https://pay.kcp.co.kr/plugin/payplus_web.jsp',
        soapUrl: 'https://smpay.kcp.co.kr/services/KCPPaymentService.KCPPaymentServiceHttpSoap11Endpoint/',
    },
};

exports.PAY_METHODS = {
    card: { pc: '100000000000', mobile: 'CARD', action: 'card' },
    bank: { pc: '010000000000', mobile: 'BANK', action: 'acnt' },
};

// 실행 파일 존재 여부는 경로별로 한 번만 확인(점검은 resetKcpConfig로 다시)
let binCache = null;
exports.resetKcpConfig = () => {
    binCache = null;
};

// 사이트 키는 내부용 — 바깥으로 내보내는 kcpConfig()에는 넣지 않음
function settings() {
    const env = process.env.KCP_ENV === 'live' ? 'live' : 'test';
    const home = process.env.KCP_HOME || path.join(os.homedir(), 'kcp');
    const bin = path.join(home, 'bin', 'pp_cli_x64');
    if (!binCache || binCache.bin !== bin) binCache = { bin, exists: fs.existsSync(bin) };
    return {
        env,
        home,
        bin,
        binExists: binCache.exists,
        siteCd: process.env.KCP_SITE_CD || (env === 'test' ? 'T0000' : ''),
        siteKey: process.env.KCP_SITE_KEY || '',
        siteName: process.env.SHOP_SITE_NAME || '링크비',
        ...HOSTS[env],
    };
}

exports.kcpConfig = () => {
    const s = settings();
    return {
        ready: Boolean(s.siteCd && s.siteKey && s.binExists),
        env: s.env,
        siteCd: s.siteCd,
        siteName: s.siteName,
        jsUrl: s.jsUrl,
        gwHost: s.gwHost,
    };
};

// pp_ax_hub_lib.php mf_do_tx와 같은 인자 순서
const FIELD_ORDER = ['home', 'site_cd', 'site_key', 'tx_cd', 'pa_url', 'pa_port', 'ordr_idxx', 'payx_data', 'ordr_data', 'rcvr_data',
    'escw_data', 'modx_data', 'enc_data', 'enc_info', 'trace_no', 'cust_ip', 'log_path', 'log_level', 'opt'];
// 쉼표는 인자 구분자, 따옴표·줄바꿈은 결과 줄을 깨뜨림, 한글은 인코딩이 달라(UTF-8 vs EUC-KR) 금지
const BAD_VALUE = /[,"\r\n\0]|[^\x00-\x7f]/;

function parseLine(line) {
    const res = {};
    for (const part of line.split(US)) {
        const i = part.indexOf('=');
        if (i > 0) res[part.slice(0, i)] = part.slice(i + 1);
    }
    return res;
}

exports.runPpCli = async (fields) => {
    const s = settings();
    const all = { home: s.home, site_cd: s.siteCd, site_key: s.siteKey, pa_url: s.gwHost, pa_port: PA_PORT, log_path: '/nonexistent', log_level: '3', opt: '0' };
    for (const [k, v] of Object.entries(fields)) {
        if (!FIELD_ORDER.includes(k)) throw new Error(`Unknown KCP field: ${k}`);
        all[k] = v;
    }
    for (const k of FIELD_ORDER) {
        all[k] = all[k] == null ? '' : String(all[k]);
        if (BAD_VALUE.test(all[k])) throw new Error(`Invalid KCP field: ${k}`);
    }
    const arg = FIELD_ORDER.map((k) => `${k}=${all[k]}`).join(',');
    return new Promise((resolve) => {
        // 셸 없이 인자 배열로 실행. err.message에는 명령줄(사이트 키 포함)이 들어 있어 로그에 쓰지 않음
        childProcess.execFile(s.bin, ['-h', arg], { timeout: 30000, encoding: 'buffer' }, (err, stdout) => {
            if (err && (err.killed || typeof err.code === 'string')) {
                console.error('[kcp] pp_cli 실행 실패', err.code || '', err.signal || '');
                return resolve({ ...ERR_9502 });
            }
            // 예전 PHP exec()처럼 앞쪽 로그 줄은 버리고 마지막 줄만 결과로 씀(종료 코드는 보지 않음)
            const lines = stdout ? iconv.decode(stdout, 'cp949').split('\n').map((l) => l.trim()).filter(Boolean) : [];
            const res = lines.length ? parseLine(lines[lines.length - 1]) : {};
            if (!res.res_cd) return resolve({ ...ERR_9502 });
            resolve(res);
        });
    });
};

function logFail(what, res) {
    console.error(`[kcp] ${what} 실패`, res.res_cd, res.res_msg);
}

exports.approve = async ({ tranCd, encData, encInfo, orderNo, amount, custIp }) => {
    // tranCd·encData·encInfo는 결제창(브라우저)이 준 값 — 형식이 이상하면 실행하지 않음
    const fields = {
        tx_cd: tranCd,
        ordr_idxx: orderNo,
        ordr_data: `ordr_data=ordr_mony=${amount}${US}`,
        enc_data: encData,
        enc_info: encInfo,
        cust_ip: custIp,
    };
    const valid = /^\d{8}$/.test(String(tranCd)) && Number.isSafeInteger(amount) && amount > 0
        && [encData, encInfo, orderNo, custIp].every((v) => typeof v === 'string' && !BAD_VALUE.test(v));
    if (!valid) return { ok: false, resCd: 'INVALID', resMsg: 'Invalid payment data', tno: null, amount: null, appNo: null };
    const res = await exports.runPpCli(fields);
    const ok = res.res_cd === '0000';
    if (!ok) logFail('승인', res);
    const paid = Number(res.amount);
    return {
        ok,
        resCd: res.res_cd,
        resMsg: res.res_msg || '',
        tno: ok ? res.tno || null : null,
        amount: ok && res.amount && Number.isSafeInteger(paid) ? paid : null,
        appNo: ok ? res.app_no || null : null,
    };
};

// 전체 취소(STSC). orderNo는 선택(예전 자동 취소는 주문번호를 함께 보냄)
exports.cancel = async ({ tno, reason, custIp, orderNo = '' }) => {
    if (/[^\x20-\x7e]/.test(reason)) throw new Error('Cancel reason must be ASCII');
    const res = await exports.runPpCli({
        tx_cd: '00200000',
        ordr_idxx: orderNo,
        modx_data: `mod_data=tno=${tno}${US}mod_type=STSC${US}mod_ip=${custIp}${US}mod_desc=${reason}${US}`,
        cust_ip: custIp,
    });
    const ok = res.res_cd === '0000';
    if (!ok) logFail('취소', res);
    return { ok, resCd: res.res_cd, resMsg: res.res_msg || '' };
};

const xmlEscape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const xmlUnescape = (v) => v.replace(/&(lt|gt|quot|apos|amp);/g, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);
// 네임스페이스 접두어와 상관없이 첫 태그 내용
const tagText = (xml, name) => {
    const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([^<]*)</(?:[\\w.-]+:)?${name}>`));
    return m ? xmlUnescape(m[1]) : null;
};

exports.requestMobileApprovalKey = async ({ orderNo, amount, goodName, payMethod, retUrl, userAgent }) => {
    const fail = (resMsg) => ({ ok: false, approvalKey: null, payUrl: null, resMsg });
    const method = exports.PAY_METHODS[payMethod]?.mobile || (['CARD', 'BANK'].includes(payMethod) ? payMethod : null);
    if (!method) return fail('Invalid pay method');
    const s = settings();
    const e = xmlEscape;
    // KCPPaymentService.wsdl: approve(ns) > req(ns) > ApproveReq 칸(pay) > BaseRequestType 칸(dom), 모두 qualified
    const xml = '<?xml version="1.0" encoding="UTF-8"?>'
        + '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
        + ' xmlns:ns="http://webservice.act.webpay.service.kcp.kr"'
        + ' xmlns:pay="http://payment.domain.webpay.service.kcp.kr/xsd"'
        + ' xmlns:dom="http://domain.webpay.service.kcp.kr/xsd">'
        + '<soapenv:Body><ns:approve><ns:req>'
        + '<pay:accessCredentialType><dom:accessLicense></dom:accessLicense><dom:signature></dom:signature><dom:timestamp></dom:timestamp></pay:accessCredentialType>'
        + '<pay:baseRequestType>'
        + `<dom:detailLevel>0</dom:detailLevel><dom:requestApp>WEB</dom:requestApp><dom:requestID>${e(orderNo)}</dom:requestID>`
        + `<dom:userAgent>${e(userAgent)}</dom:userAgent><dom:version>0.1</dom:version>`
        + '</pay:baseRequestType>'
        + '<pay:escrow>false</pay:escrow>'
        + `<pay:orderID>${e(orderNo)}</pay:orderID><pay:paymentAmount>${e(amount)}</pay:paymentAmount>`
        + `<pay:paymentMethod>${method}</pay:paymentMethod><pay:productName>${e(goodName)}</pay:productName>`
        + `<pay:returnUrl>${e(retUrl)}</pay:returnUrl><pay:siteCode>${e(s.siteCd)}</pay:siteCode>`
        + '</ns:req></ns:approve></soapenv:Body></soapenv:Envelope>';
    let data;
    try {
        // 예전 PHP는 soapaction '' 로 호출. WSDL엔 urn:approve — 필요하면 테스트 상점에서 확인
        const res = await axios.post(s.soapUrl, xml, {
            timeout: 15000,
            responseType: 'text',
            headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
        });
        data = String(res.data);
    } catch (err) {
        console.error('[kcp] 모바일 승인 키 요청 실패', err.code || '', err.response?.status || '');
        return fail('연동 오류');
    }
    const errBlock = data.match(/<(?:[\w.-]+:)?error(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?error>/);
    const code = errBlock ? tagText(errBlock[1], 'code') : null;
    const resMsg = (errBlock && tagText(errBlock[1], 'message')) || '';
    const approvalKey = tagText(data, 'approvalKey');
    const payUrl = tagText(data, 'payUrl');
    if (code !== '0000' || !approvalKey || !payUrl) {
        console.error('[kcp] 모바일 승인 키 실패', code, resMsg);
        return fail(resMsg || '연동 오류');
    }
    return { ok: true, approvalKey, payUrl, resMsg };
};

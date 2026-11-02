// 홈페이지 문의 접수 점검: node scripts/checkInquiry.js  (모델·Slack 가짜, 업로드는 임시 폴더)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.UPLOAD_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-upload-'));
const { validateInquiry } = require('../src/utils/inquiryValidation');
const { sniffAllowed } = require('../src/utils/uploads');

const slack = require('../src/utils/slack');
let notices = [];
let slackFails = false;
slack.sendSlackMessage = async (channel, text) => {
    if (slackFails) throw new Error('slack down');
    notices.push({ channel, text });
};
const Homepage = require('../src/models/homepageModel');
let saved;
let recent = 0;
let failSave = false;
Homepage.countRecentByIp = async () => recent;
Homepage.createInquiryWithFiles = async (inquiry, files) => {
    if (failSave) throw new Error('db down');
    saved = { inquiry, files };
    return 77;
};
const ctrl = require('../src/controllers/publicHomepageController');

const qna = { name: ' 홍길동 ', phone: '010-1234-5678', company: '링크비', email: 'a@b.co', body: '문의합니다', agree: '1', website: '', startedAt: String(Date.now() - 10000) };
const estimate = { ...qna, email: '', category: 'homepage', contactMethod: 'phone' };
const pdf = (name = 'a.pdf', size = 100) => ({ originalname: name, buffer: Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(size)]), size: size + 8 });
const call = async (kind, body, files = []) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await ctrl.createInquiry({ params: { kind }, body, files, ip: '1.2.3.4' }, res);
    return res;
};
const reset = () => ((saved = undefined), (notices = []), (recent = 0), (failSave = false), (slackFails = false));

(async () => {
    // ── 검증 ──
    assert.deepStrictEqual(validateInquiry(qna, 'qna').value, {
        kind: 'qna',
        name: '홍길동',
        phone: '010-1234-5678',
        company: '링크비',
        email: 'a@b.co',
        category: null,
        contactMethod: null,
        body: '문의합니다',
    });
    // 견적: 이메일 선택, 분류 필수, 연락 수단 선택
    // 줄바꿈: 브라우저는 CRLF로 보냄 → LF로 세서 화면(5000자)과 같은 기준, 저장도 LF
    const lines = ('a'.repeat(99) + '\r\n').repeat(49) + 'a'.repeat(99); // LF 기준 4999자, CRLF 기준 5048자
    const multi = validateInquiry({ ...qna, body: lines }, 'qna');
    assert.ok(multi.value && !multi.value.body.includes('\r'), '줄 많은 5000자 이내 본문은 통과, CR 제거');
    assert.deepStrictEqual(validateInquiry(estimate, 'estimate').value.category, 'homepage');
    assert.deepStrictEqual(validateInquiry({ ...estimate, contactMethod: '' }, 'estimate').value.contactMethod, null);
    const bad = [
        ['qna', { name: '' }, 'Invalid name'],
        ['qna', { name: 'a'.repeat(31) }, 'Invalid name'],
        ['qna', { phone: '12' }, 'Invalid phone'],
        ['qna', { company: '' }, 'Invalid company'],
        ['qna', { email: '' }, 'Invalid email'], // 1:1 문의는 이메일 필수
        ['qna', { email: 'not-mail' }, 'Invalid email'],
        ['estimate', { email: 'bad' }, 'Invalid email'], // 견적은 선택이지만 쓰면 형식 검사
        ['qna', { body: '' }, 'Invalid body'],
        ['qna', { body: 'a'.repeat(5001) }, 'Invalid body'],
        ['qna', { agree: '' }, 'Agreement required'],
        ['estimate', { category: '' }, 'Invalid category'],
        ['estimate', { category: 'shop' }, 'Invalid category'],
        ['estimate', { contactMethod: 'fax' }, 'Invalid contact method'],
    ];
    for (const [kind, patch, error] of bad) {
        assert.deepStrictEqual(validateInquiry({ ...(kind === 'qna' ? qna : estimate), ...patch }, kind), { error }, `${kind} ${JSON.stringify(patch)}`);
    }

    // ── 파일 내용 검사 (확장자와 실제 내용이 맞아야) ──
    assert.ok(sniffAllowed(Buffer.from('%PDF-1.4 ...'), 'pdf'));
    assert.ok(sniffAllowed(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), 'png'));
    assert.ok(sniffAllowed(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'jpg'));
    assert.ok(sniffAllowed(Buffer.from('PK\x03\x04...'), 'docx'));
    assert.ok(sniffAllowed(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]), 'hwp'));
    assert.ok(!sniffAllowed(Buffer.from('MZ\x90\x00'), 'pdf'), 'exe를 pdf로 위장');
    assert.ok(!sniffAllowed(Buffer.from('%PDF'), 'exe'), '허용 안 된 확장자');
    assert.ok(!sniffAllowed(Buffer.from('<?php echo 1;'), 'png'));

    // ── 접수 ──
    reset();
    let res = await call('qna', qna, [pdf('견적서.PDF')]);
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);
    assert.strictEqual(saved.inquiry.ip, '1.2.3.4');
    assert.strictEqual(saved.files.length, 1);
    const f = saved.files[0];
    assert.strictEqual(f.originalName, '견적서.PDF');
    assert.strictEqual(f.mime, 'application/pdf');
    assert.ok(/^[0-9a-f-]{36}$/.test(f.storedName), 'UUID 이름');
    assert.ok(fs.existsSync(path.join(process.env.UPLOAD_ROOT, 'private', f.storedName)), '비공개 폴더에 저장');
    // Slack: 회사·이름만 (연락처·내용 없음), 이스케이프
    assert.deepStrictEqual(notices, [{ channel: '#hibye-관리', text: '[1:1 문의] 링크비 홍길동님 → https://hibye.kr/admin?tab=homepage' }]);
    reset();
    await call('estimate', { ...estimate, company: '<b>회사</b>' });
    assert.strictEqual(notices[0].text, '[견적 요청] &lt;b&gt;회사&lt;/b&gt; 홍길동님 → https://hibye.kr/admin?tab=homepage');
    assert.ok(!notices[0].text.includes('010'), '연락처 미포함');

    // 종류 화이트리스트, 검증 실패 400
    reset();
    res = await call('form_doc', qna);
    assert.strictEqual(res.code, 404);
    res = await call('qna', { ...qna, email: '' });
    assert.deepStrictEqual([res.code, res.body], [400, { error: 'Invalid email' }]);
    assert.strictEqual(saved, undefined);

    // 첨부 제한: 4개, 위장 파일
    res = await call('qna', qna, [pdf(), pdf(), pdf(), pdf()]);
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid file']);
    res = await call('qna', qna, [{ originalname: 'a.pdf', buffer: Buffer.from('MZ\x90\x00'), size: 4 }]);
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid file']);
    res = await call('qna', qna, [{ originalname: 'run.exe', buffer: Buffer.from('%PDF'), size: 4 }]);
    assert.deepStrictEqual([res.code, res.body.error], [400, 'Invalid file']);
    assert.strictEqual(saved, undefined);

    // 스팸: 함정 칸·3초 미만·IP 10분 5건 이상 → 저장·알림 없이 같은 성공 응답
    for (const [name, body, count] of [
        ['함정 칸', { ...qna, website: 'http://spam' }, 0],
        ['3초 미만', { ...qna, startedAt: String(Date.now() - 1000) }, 0],
        ['시작 시각 없음', { ...qna, startedAt: '' }, 0],
        ['IP 5건', qna, 5],
    ]) {
        reset();
        recent = count;
        res = await call('qna', body);
        assert.deepStrictEqual([res.code, res.body], [200, { ok: true }], name);
        assert.strictEqual(saved, undefined, `${name}: 저장 안 함`);
        assert.deepStrictEqual(notices, [], `${name}: 알림 안 함`);
    }

    // 저장 실패 → 500, 써 둔 파일 정리 / Slack 실패해도 200
    reset();
    failSave = true;
    const before = fs.readdirSync(path.join(process.env.UPLOAD_ROOT, 'private')).length;
    res = await call('qna', qna, [pdf()]);
    assert.strictEqual(res.code, 500);
    assert.strictEqual(fs.readdirSync(path.join(process.env.UPLOAD_ROOT, 'private')).length, before, '실패 시 파일 정리');
    reset();
    slackFails = true;
    res = await call('qna', qna);
    assert.deepStrictEqual([res.code, res.body], [200, { ok: true }]);

    // 실제 HTTP(multipart): 10MB 초과·4번째 파일은 라우터에서 400 (저장 전)
    const express = require('express');
    const app = express();
    app.set('trust proxy', require('../src/config/trustProxy').TRUST_PROXY); // 운영과 같은 설정
    app.use('/h', require('../src/routes/publicHomepage'));
    const server = app.listen(0);
    const url = `http://127.0.0.1:${server.address().port}/h/inquiries/qna`;
    const form = (files) => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(qna)) fd.append(k, v);
        files.forEach(([name, size]) => fd.append('files', new Blob([Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(size)])]), name));
        return fd;
    };
    reset();
    let http = await fetch(url, { method: 'POST', body: form([['big.pdf', 10 * 1024 * 1024 + 1]]) });
    assert.deepStrictEqual([http.status, await http.json()], [400, { error: 'Invalid file' }]);
    http = await fetch(url, { method: 'POST', body: form([['1.pdf', 10], ['2.pdf', 10], ['3.pdf', 10], ['4.pdf', 10]]) });
    assert.strictEqual(http.status, 400);
    assert.strictEqual(saved, undefined);
    http = await fetch(url, { method: 'POST', body: form([['ok.pdf', 10]]) });
    assert.deepStrictEqual([http.status, await http.json()], [200, { ok: true }]);
    assert.strictEqual(saved.files.length, 1, '정상 multipart 접수');
    // 클라이언트 IP: 로드밸런서·nginx(사설·루프백)가 붙인 값만 믿음 — 클라이언트가 보낸 X-Forwarded-For 앞부분은 무시
    for (const [xff, expected] of [
        ['6.6.6.6, 203.0.113.9', '203.0.113.9'], // 앞의 6.6.6.6은 클라이언트가 지어낸 값
        ['1.1.1.1, 203.0.113.9, 172.31.5.5', '203.0.113.9'], // 마지막은 로드밸런서(사설 IP)
    ]) {
        reset();
        http = await fetch(url, { method: 'POST', headers: { 'X-Forwarded-For': xff }, body: form([]) });
        assert.strictEqual(saved.inquiry.ip, expected, xff);
    }
    server.close();

    fs.rmSync(process.env.UPLOAD_ROOT, { recursive: true, force: true });
    console.log('checkInquiry ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkInquiry 실패 ❌', err.message);
    process.exit(1);
});
